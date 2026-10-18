import { test as base, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import {
  cancelAndDeleteOrders,
  clearAddresses,
  clearCart,
  ordersOf,
  seedAddress,
  setCartItem,
  setOrderStatus,
  setPaymentStatus,
  signedInClient,
  stockOf,
  type E2eBook,
} from '../scripts/e2e-user'
import {
  ACCOUNT_PROJECTS,
  ordersStatePath,
  readCredentials,
  readShopBooks,
  storageStatePath,
  type ProjectUsers,
} from './auth'
import { vnd } from './cart'
import { collectErrors, collectErrorsAllow404, failServerActions, waitForHydration } from './helpers'

// Đơn của user "orders" riêng cho mỗi project (checkout.spec xóa mọi đơn của user checkout sau mỗi test). Đơn tạo
// bằng RPC place_order với phiên của chính user đó (nhanh, không phụ thuộc trang checkout), trừ test hủy đơn đặt qua
// UI để kiểm tra cả cache trang sách. Mỗi test bắt đầu và kết thúc với 0 đơn (hủy để hoàn tồn kho, rồi xóa).
const test = base.extend<{ users: ProjectUsers; projectIndex: number }>({
  users: async ({}, provide, testInfo) => {
    const users = readCredentials()[testInfo.project.name]
    if (!users) throw new Error(`Không có user e2e cho project ${testInfo.project.name}`)
    await provide(users)
  },
  projectIndex: async ({}, provide, testInfo) => {
    await provide(Math.max(ACCOUNT_PROJECTS.findIndex((name) => name === testInfo.project.name), 0))
  },
  storageState: async ({}, provide, testInfo) => provide(ordersStatePath(testInfo.project.name)),
})

test.describe.configure({ mode: 'serial' })

// Sách e2e riêng của project (setup tạo, slug e2e-shop-…, không trùng sách checkout.spec): plenty (tồn 200) cho đơn
// tạo bằng RPC (mỗi đơn 1 cuốn), medium (tồn 40) cho test hủy (đặt tới khi còn 3 → trang sách có nhãn "Chỉ còn 3
// cuốn", hủy xong nhãn mất).
let plenty: E2eBook[]
let medium: E2eBook[]

test.beforeAll(async ({}, testInfo) => {
  ;({ plenty, medium } = readShopBooks(testInfo.project.name))
})

const pick = (books: E2eBook[], index: number) => {
  const book = books[index % books.length]
  if (!book) throw new Error('Không có sách test')
  return book
}
const plentyBook = (projectIndex: number) => pick(plenty, projectIndex)

test.beforeEach(async ({ users }) => {
  const id = users.orders.id
  await cancelAndDeleteOrders([id])
  await Promise.all([clearCart(id), clearAddresses(id)])
})

test.afterEach(async ({ users }) => {
  await cancelAndDeleteOrders([users.orders.id])
})

/** Đặt `count` đơn, mỗi đơn 1 cuốn, tuần tự (created_at tăng dần) bằng phiên của user */
async function placeOrders(users: ProjectUsers, book: E2eBook, count: number) {
  const addressId = await seedAddress(users.orders.id)
  const client = await signedInClient(users.orders)
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    await setCartItem(users.orders.id, book.id, 1)
    const { data, error } = await client.rpc('place_order', { p_address_id: addressId, p_idempotency_key: randomUUID() })
    if (error) throw new Error(`place_order: ${error.message}`)
    codes.push(data.order_code)
  }
  const orders = await ordersOf(users.orders.id)
  return { codes, orders }
}

const main = (page: Page) => page.getByRole('main')
const rows = (page: Page) => main(page).getByTestId('order-row')

test('chưa có đơn → trạng thái rỗng + link "Khám phá sách"', async ({ page }) => {
  await page.goto('/tai-khoan/don-hang')
  await expect(main(page).getByRole('heading', { level: 1, name: 'Đơn hàng của tôi' })).toBeVisible()
  await expect(main(page).getByText('Bạn chưa có đơn hàng nào')).toBeVisible()
  await main(page).getByRole('link', { name: 'Khám phá sách' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('trang tài khoản có thẻ "Đơn hàng của tôi"', async ({ page }) => {
  await page.goto('/tai-khoan')
  await main(page).getByRole('link', { name: /Đơn hàng của tôi/ }).click()
  await expect(page).toHaveURL(/\/tai-khoan\/don-hang$/)
})

test('12 đơn: phân trang 10 + 2, mới nhất trước, lọc "Đã hủy", trang vượt quá → 404', async ({
  page,
  users,
  projectIndex,
}) => {
  test.setTimeout(90_000)
  const { codes, orders } = await placeOrders(users, plentyBook(projectIndex), 12)
  const newest = [...codes].reverse()
  // Hai đơn cũ nhất bị hủy (admin), một đơn đã giao
  const byCode = new Map(orders.map((order) => [order.order_code, order.id]))
  const id = (code: string | undefined) => byCode.get(code ?? '') ?? 0
  await setOrderStatus(id(codes[0]), 'cancelled')
  await setOrderStatus(id(codes[1]), 'cancelled')
  // Đi đúng luồng: trigger chặn nhảy cóc pending → delivered
  for (const status of ['confirmed', 'shipping', 'delivered'] as const) await setOrderStatus(id(codes[2]), status)

  await page.goto('/tai-khoan/don-hang')
  await expect(rows(page)).toHaveCount(10)
  await expect(rows(page).first().getByTestId('order-row-code')).toHaveText(newest[0] ?? '')
  await expect(rows(page).first().getByTestId('order-status')).toHaveText('Chờ xác nhận')

  await main(page).getByRole('navigation', { name: 'Phân trang' }).getByRole('link', { name: 'Trang 2' }).click()
  await expect(page).toHaveURL(/\/tai-khoan\/don-hang\?page=2$/)
  await expect(rows(page)).toHaveCount(2)
  await expect(rows(page).getByTestId('order-status')).toHaveText(['Đã hủy', 'Đã hủy'])

  await main(page).getByRole('navigation', { name: 'Lọc theo trạng thái' }).getByRole('link', { name: 'Đã hủy' }).click()
  await expect(page).toHaveURL(/\/tai-khoan\/don-hang\?status=cancelled$/)
  await expect(rows(page)).toHaveCount(2)
  await expect(
    main(page).getByRole('navigation', { name: 'Lọc theo trạng thái' }).getByRole('link', { name: 'Đã hủy' }),
  ).toHaveAttribute('aria-current', 'page')

  await page.goto('/tai-khoan/don-hang?status=delivered')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).getByTestId('order-row-code')).toHaveText(codes[2] ?? '')

  await page.goto('/tai-khoan/don-hang?status=processing')
  await expect(main(page).getByText('Không có đơn nào ở mục này')).toBeVisible()

  await page.goto('/tai-khoan/don-hang?page=99')
  await expect(main(page).getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
})

test('chi tiết đơn: mã, địa chỉ, sách, tiền khớp DB; đơn của user khác → 404', async ({
  page,
  browser,
  baseURL,
  users,
  projectIndex,
}, testInfo) => {
  // 6 lượt tải thẳng trang 404 / 200 sau phần chi tiết đơn: quá 30 giây mặc định khi CI chậm
  test.setTimeout(60_000)
  const book = plentyBook(projectIndex)
  const { orders } = await placeOrders(users, book, 1)
  const order = orders[0]
  if (!order) throw new Error('Không tạo được đơn')

  await page.goto('/tai-khoan/don-hang')
  await rows(page).first().click()
  await expect(page).toHaveURL(new RegExp(`/tai-khoan/don-hang/${order.order_code}$`))
  await expect(main(page).getByRole('heading', { level: 1 })).toHaveText(`Đơn hàng ${order.order_code}`)
  await expect(main(page).getByTestId('order-status').first()).toHaveText('Chờ xác nhận')
  await expect(main(page).getByTestId('order-explain')).toHaveText('Cửa hàng đang xác nhận đơn hàng.')
  await expect(main(page).getByTestId('order-code')).toHaveText(order.order_code)
  await expect(main(page).getByTestId('order-address')).toHaveText('12 Phố Huế, Phường Ba Đình, Thành phố Hà Nội')
  await expect(main(page).getByTestId('order-item')).toContainText(book.title)
  await expect(main(page).getByTestId('order-total')).toHaveText(vnd(order.total))

  // Chủ đơn: trang đặt hàng thành công + chi tiết đơn (tải thẳng, qua proxy) là 200
  for (const path of [`/tai-khoan/don-hang/${order.order_code}`, `/en/checkout/success/${order.order_code}`]) {
    expect((await page.goto(path))?.status(), path).toBe(200)
  }

  // User chính của project (khác user đơn hàng): proxy không thấy đơn (lọc user_id) → HTTP 404 như mã không tồn tại
  const other = await browser.newContext({ baseURL, storageState: storageStatePath(testInfo.project.name) })
  const otherPage = await other.newPage()
  const errors = collectErrorsAllow404(otherPage)
  for (const path of [
    `/tai-khoan/don-hang/${order.order_code}`,
    `/thanh-toan/thanh-cong/${order.order_code}`,
    `/en/account/orders/${order.order_code}`,
    '/tai-khoan/don-hang/NS-khong-hop-le',
  ]) {
    const response = await otherPage.goto(path)
    expect(response?.status(), path).toBe(404)
    await expect(main(otherPage).getByRole('heading', { name: /^(Không tìm thấy trang|Page not found)$/ })).toBeVisible()
    await waitForHydration(otherPage, 'main a[href="/"], main a[href="/en"]')
    expect(errors, path).toEqual([])
  }
  await other.close()
})

test('đặt qua checkout → "Xem đơn hàng" → hủy kèm lý do: Đã hủy, hoàn tồn kho, trang sách hiện tồn kho mới', async ({
  page,
  users,
  projectIndex,
}) => {
  test.setTimeout(120_000)
  const errors = collectErrors(page)
  const book = pick(medium, projectIndex)
  const stockBefore = await stockOf(book.id)
  await seedAddress(users.orders.id)
  await setCartItem(users.orders.id, book.id, stockBefore - 3)

  await page.goto('/thanh-toan')
  const place = main(page).getByTestId('checkout-summary').locator('button[type="submit"]:not([form])')
  await waitForHydration(page, 'main [data-testid="checkout-summary"] button[type="submit"]:not([form])')
  await place.click()
  await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })
  const code = (await main(page).getByTestId('order-code').textContent())?.trim() ?? ''

  // placeOrder đã updateTag → trang sách hiện tồn kho sau khi đặt (cache trang sách lúc này là bản mới)
  await page.goto(`/sach/${book.slug}`)
  await expect(main(page).getByText('Chỉ còn 3 cuốn')).toBeVisible()

  await page.goBack()
  await main(page).getByRole('link', { name: 'Xem đơn hàng' }).click()
  await expect(page).toHaveURL(new RegExp(`/tai-khoan/don-hang/${code}$`))

  await waitForHydration(page, 'main details form button[type="submit"]')
  await main(page).getByText('Hủy đơn hàng', { exact: true }).click()
  await main(page).getByLabel('Lý do hủy').fill('Đặt nhầm số lượng')
  await main(page).getByRole('button', { name: 'Xác nhận hủy' }).click()

  await expect(main(page).getByTestId('order-status').first()).toHaveText('Đã hủy')
  await expect(main(page).getByTestId('cancel-done')).toHaveText('Đã hủy đơn hàng.')
  await expect(main(page).getByTestId('order-cancelled-reason')).toContainText('Đặt nhầm số lượng')
  await expect(main(page).getByText('Hủy đơn hàng', { exact: true })).toHaveCount(0)

  const [order] = await ordersOf(users.orders.id)
  expect(order).toMatchObject({ order_code: code, status: 'cancelled' })
  expect(await stockOf(book.id)).toBe(stockBefore)

  // cancelOrder updateTag('book:{id}') → trang sách hết nhãn "Chỉ còn 3 cuốn" ngay
  await page.goto(`/sach/${book.slug}`)
  await expect(main(page).getByRole('heading', { level: 1 })).toBeVisible()
  await expect(main(page).getByText(/Chỉ còn \d+ cuốn/)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('cửa hàng xác nhận sau khi trang đã mở → hủy báo đã xác nhận + email liên hệ, trang hiện "Đã xác nhận"', async ({
  page,
  users,
  projectIndex,
}) => {
  const { orders } = await placeOrders(users, plentyBook(projectIndex), 1)
  const order = orders[0]
  if (!order) throw new Error('Không tạo được đơn')

  await page.goto(`/tai-khoan/don-hang/${order.order_code}`)
  await waitForHydration(page, 'main details form button[type="submit"]')
  await setOrderStatus(order.id, 'confirmed')

  await main(page).getByText('Hủy đơn hàng', { exact: true }).click()
  await main(page).getByRole('button', { name: 'Xác nhận hủy' }).click()
  const cancelError = main(page).getByTestId('cancel-error')
  await expect(cancelError).toHaveText(
    'Cửa hàng đã xác nhận đơn nên bạn không tự hủy được nữa. Cần hủy, bạn gửi email tới nha-sach-may@googlegroups.com kèm mã đơn nhé.',
  )
  await expect(cancelError.getByRole('link', { name: 'nha-sach-may@googlegroups.com' })).toHaveAttribute(
    'href',
    'mailto:nha-sach-may@googlegroups.com',
  )
  await expect(main(page).getByTestId('order-status').first()).toHaveText('Đã xác nhận')
  await expect(main(page).getByText('Hủy đơn hàng', { exact: true })).toHaveCount(0)
  expect((await ordersOf(users.orders.id))[0]?.status).toBe('confirmed')
})

test('lý do 501 ký tự → lỗi tại ô, không mất nội dung', async ({ page, users, projectIndex }) => {
  const { orders } = await placeOrders(users, plentyBook(projectIndex), 1)
  const order = orders[0]
  if (!order) throw new Error('Không tạo được đơn')

  await page.goto(`/tai-khoan/don-hang/${order.order_code}`)
  await waitForHydration(page, 'main details form button[type="submit"]')
  await main(page).getByText('Hủy đơn hàng', { exact: true }).click()
  const reason = main(page).getByLabel('Lý do hủy')
  // maxLength chặn ở trình duyệt; bỏ đi để thử kiểm tra ở server
  await reason.evaluate((element) => element.removeAttribute('maxlength'))
  const long = 'a'.repeat(501)
  await reason.fill(long)
  await main(page).getByRole('button', { name: 'Xác nhận hủy' }).click()
  await expect(main(page).getByText('Lý do hủy tối đa 500 ký tự.')).toBeVisible()
  await expect(reason).toHaveValue(long)
  await expect(reason).toHaveAttribute('aria-invalid', 'true')
  expect((await ordersOf(users.orders.id))[0]?.status).toBe('pending')
})

test('/en/account/orders: giá ₫…, nhãn trạng thái tiếng Anh', async ({ page, users, projectIndex }) => {
  const { orders } = await placeOrders(users, plentyBook(projectIndex), 2)
  const [newest, oldest] = orders
  if (!newest || !oldest) throw new Error('Không tạo được đơn')
  await setOrderStatus(oldest.id, 'cancelled')

  await page.goto('/en/account/orders')
  await expect(main(page).getByRole('heading', { level: 1, name: 'My orders' })).toBeVisible()
  await expect(rows(page).getByTestId('order-status')).toHaveText(['Awaiting confirmation', 'Cancelled'])
  await expect(rows(page).first().getByTestId('order-row-total')).toHaveText(vnd(newest.total, 'en'))

  await rows(page).first().click()
  await expect(page).toHaveURL(new RegExp(`/en/account/orders/${newest.order_code}$`))
  await expect(main(page).getByRole('heading', { level: 1 })).toHaveText(`Order ${newest.order_code}`)
  await expect(main(page).getByText('Cancel order', { exact: true })).toBeVisible()
})

// Hủy bị từ chối vì trạng thái đổi sau khi trang đã mở (admin giao đơn, nhận tiền, tab khác đã hủy): mỗi lý do một câu
// riêng nói rõ cần làm gì; lý do cần cửa hàng xử lý kèm link email liên hệ
const EMAIL = 'nha-sach-may@googlegroups.com'
const refusals = [
  {
    name: 'đang giao',
    change: async (id: number) => {
      await setOrderStatus(id, 'confirmed')
      await setOrderStatus(id, 'shipping')
    },
    message: `Cửa hàng đã giao đơn cho bên vận chuyển nên bạn không tự hủy được nữa. Cần hủy, bạn gửi email tới ${EMAIL} kèm mã đơn nhé.`,
    email: true,
  },
  {
    name: 'đã giao',
    change: async (id: number) => {
      await setOrderStatus(id, 'confirmed')
      await setOrderStatus(id, 'shipping')
      await setOrderStatus(id, 'delivered')
    },
    message: `Đơn đã giao xong nên không hủy được. Cần đổi trả, bạn gửi email tới ${EMAIL} kèm mã đơn nhé.`,
    email: true,
  },
  {
    name: 'đã thanh toán',
    change: (id: number) => setPaymentStatus(id, 'paid'),
    message: `Đơn đã thanh toán nên cần cửa hàng hủy và hoàn tiền. Bạn gửi email tới ${EMAIL} kèm mã đơn nhé.`,
    email: true,
  },
  {
    name: 'đã hủy ở tab khác',
    change: (id: number) => setOrderStatus(id, 'cancelled'),
    message: 'Đơn này đã được hủy trước đó, bạn không cần làm gì thêm.',
    email: false,
  },
] as const

for (const refusal of refusals) {
  test(`hủy bị từ chối (${refusal.name}) → câu riêng${refusal.email ? ' + email liên hệ' : ''}, nút hủy biến mất`, async ({
    page,
    users,
    projectIndex,
  }) => {
    const errors = collectErrors(page)
    const { orders } = await placeOrders(users, plentyBook(projectIndex), 1)
    const order = orders[0]
    if (!order) throw new Error('Không tạo được đơn')

    await page.goto(`/tai-khoan/don-hang/${order.order_code}`)
    await waitForHydration(page, 'main details form button[type="submit"]')
    await refusal.change(order.id)

    await main(page).getByText('Hủy đơn hàng', { exact: true }).click()
    await main(page).getByRole('button', { name: 'Xác nhận hủy' }).click()
    const cancelError = main(page).getByTestId('cancel-error')
    await expect(cancelError).toHaveText(refusal.message)
    await expect(cancelError.getByRole('link', { name: EMAIL })).toHaveCount(refusal.email ? 1 : 0)
    if (refusal.email) {
      await expect(cancelError.getByRole('link', { name: EMAIL })).toHaveAttribute('href', `mailto:${EMAIL}`)
    }
    await expect(main(page).getByText('Hủy đơn hàng', { exact: true })).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

test('không tìm thấy đơn: mã sai dạng, mã không có, đơn của tài khoản khác → HTTP 404, CÙNG một câu', async ({
  browser,
  baseURL,
  users,
  projectIndex,
}, testInfo) => {
  test.setTimeout(60_000)
  const { orders } = await placeOrders(users, plentyBook(projectIndex), 1)
  const order = orders[0]
  if (!order) throw new Error('Không tạo được đơn')

  // User chính của project: không phải chủ đơn
  const other = await browser.newContext({ baseURL, storageState: storageStatePath(testInfo.project.name) })
  const page = await other.newPage()
  const errors = collectErrorsAllow404(page)
  const message =
    'Không tìm thấy đơn hàng này. Có thể mã đơn chưa đúng, hoặc đơn này thuộc một tài khoản khác. Bạn kiểm tra lại trong Tài khoản → Đơn hàng.'
  const texts = new Set<string>()
  for (const code of ['NS-khong-hop-le', 'NS00000000000', order.order_code]) {
    for (const path of [`/tai-khoan/don-hang/${code}`, `/thanh-toan/thanh-cong/${code}`]) {
      const response = await page.goto(path)
      expect(response?.status(), path).toBe(404)
      const view = main(page).getByTestId('not-found')
      await expect(view, path).toContainText(message)
      await expect(view.getByRole('link', { name: 'Đơn hàng của tôi' }), path).toHaveAttribute('href', '/tai-khoan/don-hang')
      texts.add((await view.textContent()) ?? '')
    }
  }
  // Không để lộ mã đơn nào tồn tại: mọi trường hợp hiện y hệt nhau
  expect(texts.size).toBe(1)
  expect(errors).toEqual([])
  await other.close()
})

test('danh sách đơn ?page vượt quá → soft 404 (200, noindex), "Về trang đầu" giữ bộ lọc', async ({ page }) => {
  const response = await page.goto('/tai-khoan/don-hang?status=cancelled&page=99')
  expect(response?.status()).toBe(200)
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached()
  await expect(main(page).getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
  await expect(main(page).getByRole('link', { name: 'Về trang đầu' })).toHaveAttribute(
    'href',
    '/tai-khoan/don-hang?status=cancelled',
  )
})

test('hủy đơn khi mất mạng → câu mới, lý do đã gõ còn nguyên, đơn chưa bị hủy', async ({ page, users, projectIndex }) => {
  const { orders } = await placeOrders(users, plentyBook(projectIndex), 1)
  const order = orders[0]
  if (!order) throw new Error('Không tạo được đơn')
  await page.goto(`/tai-khoan/don-hang/${order.order_code}`)
  await waitForHydration(page, 'main details form button[type="submit"]')
  await main(page).getByText('Hủy đơn hàng', { exact: true }).click()
  await main(page).getByLabel('Lý do hủy').fill('Đặt nhầm địa chỉ')
  await failServerActions(page, `**/tai-khoan/don-hang/${order.order_code}`)
  await main(page).getByRole('button', { name: 'Xác nhận hủy' }).click()
  await expect(main(page).getByTestId('cancel-error')).toHaveText('Không kết nối được máy chủ. Bạn kiểm tra mạng rồi bấm lại nhé, thông tin đã nhập vẫn còn nguyên.')
  await expect(main(page).getByLabel('Lý do hủy')).toHaveValue('Đặt nhầm địa chỉ')
  expect((await ordersOf(users.orders.id))[0]?.status).toBe('pending')
})
