import { test as base, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import {
  cancelAndDeleteOrders,
  clearAddresses,
  clearCart,
  findBooksByStockDesc,
  ordersOf,
  seedAddress,
  setCartItem,
  setOrderStatus,
  signedInClient,
  stockOf,
  type E2eBook,
} from '../scripts/e2e-user'
import { ACCOUNT_PROJECTS, ordersStatePath, readCredentials, storageStatePath, type ProjectUsers } from './auth'
import { vnd } from './cart'
import { collectErrors, waitForHydration } from './helpers'

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

// Sách cho đơn tạo bằng RPC (mỗi đơn 1 cuốn, tồn kho ≥ 30) và cho test hủy (tồn kho 6–98: đặt tới khi còn 3 → trang
// sách có nhãn "Chỉ còn 3 cuốn", hủy xong nhãn mất). Mỗi project một cuốn riêng. Lấy theo id giảm dần (spec giỏ dùng id
// tăng dần) và bỏ các cuốn checkout.spec đang dùng (cùng truy vấn với spec đó).
let plenty: E2eBook[]
let medium: E2eBook[]

test.beforeAll(async () => {
  const [checkoutLow, checkoutRegular, candidates] = await Promise.all([
    findBooksByStockDesc(2, 5, 2),
    findBooksByStockDesc(20, 98, 2),
    findBooksByStockDesc(6, 10_000, 16),
  ])
  const taken = new Set([...checkoutLow, ...checkoutRegular].map((book) => book.id))
  const free = candidates.filter((book) => !taken.has(book.id))
  plenty = free.filter((book) => book.stock >= 30).slice(0, 2)
  medium = free.filter((book) => book.stock <= 98 && !plenty.includes(book)).slice(0, 2)
  if (plenty.length === 0 || medium.length === 0) throw new Error('Cần sách tồn kho ≥ 30 và 6–98 để test')
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
  await setOrderStatus(id(codes[2]), 'delivered')

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

  // User chính của project (khác user đơn hàng): RLS không trả đơn → 404 như mã không tồn tại
  const other = await browser.newContext({ baseURL, storageState: storageStatePath(testInfo.project.name) })
  const otherPage = await other.newPage()
  await otherPage.goto(`/tai-khoan/don-hang/${order.order_code}`)
  await expect(main(otherPage).getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
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
  const place = main(page).getByTestId('checkout-summary').locator('button[type="submit"]')
  await waitForHydration(page, 'main [data-testid="checkout-summary"] button[type="submit"]')
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

test('cửa hàng xác nhận sau khi trang đã mở → hủy báo không thể hủy, trang hiện "Đã xác nhận"', async ({
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
  await expect(main(page).getByTestId('cancel-error')).toHaveText('Đơn hàng này không thể hủy.')
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
