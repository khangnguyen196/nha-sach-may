import { test as base, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import {
  cancelAndDeleteOrders,
  cartQuantities,
  clearAddresses,
  clearCart,
  createE2eVoucher,
  createHiddenBook,
  deleteAddress,
  deleteE2eVouchers,
  deleteHiddenBooks,
  orderRow,
  ordersOf,
  placeE2eOrder,
  seedAddress,
  setCartItem,
  setPaymentStatus,
  signedInClient,
  stockOf,
  type E2eBook,
} from '../scripts/e2e-user'
import {
  ACCOUNT_PROJECTS,
  checkoutStatePath,
  fillLogin,
  NO_SESSION,
  readCredentials,
  readShopBooks,
  type ProjectUsers,
} from './auth'
import { addFromBookPage, badge, vnd } from './cart'
import { collectErrors, fillAddress, waitForHydration } from './helpers'

// Đặt hàng thật trên sách thật: mỗi test bắt đầu từ giỏ / sổ địa chỉ / đơn rỗng của user checkout (user riêng, không
// đụng giỏ của cart-account.spec). Sau mỗi test, đơn bị hủy (trigger hoàn tồn kho, sold_count) rồi xóa.
const test = base.extend<{ users: ProjectUsers; projectIndex: number }>({
  users: async ({}, provide, testInfo) => {
    const users = readCredentials()[testInfo.project.name]
    if (!users) throw new Error(`Không có user e2e cho project ${testInfo.project.name}`)
    await provide(users)
  },
  projectIndex: async ({}, provide, testInfo) => {
    await provide(Math.max(ACCOUNT_PROJECTS.findIndex((name) => name === testInfo.project.name), 0))
  },
  storageState: async ({}, provide, testInfo) => provide(checkoutStatePath(testInfo.project.name)),
})

// Cùng một giỏ / sổ địa chỉ cho cả file → chạy tuần tự
test.describe.configure({ mode: 'serial' })

const SHIPPING_FEE = 30_000
const FREE_SHIP_FROM = 300_000
const totalOf = (subtotal: number) => subtotal + (subtotal >= FREE_SHIP_FROM ? 0 : SHIPPING_FEE)

// Sách e2e riêng của project (setup tạo, slug e2e-shop-…): đặt hàng không đổi tồn kho sách thật, hai project chạy song
// song không giẫm nhau. low: tồn 4, regular: tồn 60 (≤ 98: đặt được số lượng stock + 1, giỏ giới hạn 99).
let lowStock: E2eBook[]
let regular: E2eBook[]

test.beforeAll(async ({}, testInfo) => {
  ;({ low: lowStock, regular } = readShopBooks(testInfo.project.name))
})

const pick = (books: E2eBook[], index: number) => {
  const book = books[index % books.length]
  if (!book) throw new Error('Không có sách test')
  return book
}

let hiddenBookId: number | undefined

test.beforeEach(async ({ users }) => {
  const id = users.checkout.id
  await cancelAndDeleteOrders([id])
  await Promise.all([clearCart(id), clearAddresses(id)])
})

test.afterEach(async ({ users }) => {
  await cancelAndDeleteOrders([users.checkout.id])
  if (hiddenBookId !== undefined) {
    await deleteHiddenBooks(hiddenBookId)
    hiddenBookId = undefined
  }
})

// Nút "Đặt hàng" (nút "Áp dụng" của ô mã giảm giá cũng nằm trong khối tóm tắt nhưng thuộc form GET riêng: form="…").
// Luôn tìm trong <main>: lúc trang vừa hydrate, React có thể còn giữ một bản sao ẩn của boundary đang stream
// (`<div hidden id="S:…">` cuối body) → locator theo test id ngoài <main> khớp 2 phần tử
const placeButton = (page: Page) => page.getByRole('main').getByTestId('checkout-summary').locator('button[type="submit"]:not([form])')
const checkoutError = (page: Page) => page.getByRole('main').getByTestId('checkout-error')

async function openCheckout(page: Page, path = '/thanh-toan') {
  await page.goto(path)
  await waitForHydration(page, 'main [data-testid="checkout-summary"] button[type="submit"]:not([form])')
}

test('luồng mua COD: khách thêm sách → đăng nhập → đặt hàng → trang thành công, tồn kho mới', async ({
  browser,
  baseURL,
  users,
  projectIndex,
}) => {
  test.setTimeout(120_000)
  const book = pick(lowStock, projectIndex)
  await seedAddress(users.checkout.id)
  const stockBefore = await stockOf(book.id)

  const guest = await browser.newContext({ baseURL, storageState: NO_SESSION })
  const page = await guest.newPage()
  const errors = collectErrors(page)
  await addFromBookPage(page, book)
  await page.goto('/gio-hang')
  await page.getByRole('main').getByTestId('cart-summary').getByRole('link', { name: 'Thanh toán' }).click()
  await expect(page).toHaveURL(/\/dang-nhap\?next=%2Fthanh-toan$/)

  await fillLogin(page, users.checkout)
  await expect(page).toHaveURL(/\/thanh-toan$/, { timeout: 20_000 })
  // Giỏ khách gộp xong (CartSync → refresh) thì nút mới mở
  await expect(placeButton(page)).toBeEnabled({ timeout: 15_000 })
  const line = page.getByRole('main').getByTestId('checkout-line')
  await expect(line).toHaveCount(1)
  await expect(line).toContainText(book.title)
  await expect(page.getByRole('main').getByTestId('checkout-address-option').getByRole('radio')).toBeChecked()
  const total = totalOf(book.price)
  await expect(page.getByRole('main').getByTestId('checkout-total')).toHaveText(vnd(total))

  await page.getByRole('main').getByLabel('Ghi chú cho đơn hàng').fill('Giao giờ hành chính')
  await placeButton(page).click()
  await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })
  const code = (await page.getByRole('main').getByTestId('order-code').textContent())?.trim()
  await expect(page.getByRole('main').getByTestId('order-total')).toHaveText(vnd(total))
  await expect(page.getByRole('main').getByTestId('order-cod')).toContainText(vnd(total))
  await expect(page.getByRole('main').getByTestId('order-success')).toContainText('12 Phố Huế, Phường Ba Đình, Thành phố Hà Nội')
  await expect(page.getByRole('main').getByTestId('order-note')).toContainText('Giao giờ hành chính')
  await expect(page.getByRole('main').getByTestId('order-item')).toContainText(book.title)
  await expect(badge(page)).toHaveCount(0)

  const orders = await ordersOf(users.checkout.id)
  expect(orders).toHaveLength(1)
  expect(orders[0]).toMatchObject({
    order_code: code,
    status: 'pending',
    payment_method: 'cod',
    payment_status: 'unpaid',
    note: 'Giao giờ hành chính',
    total,
    order_items: [{ book_id: book.id, quantity: 1 }],
  })
  expect(await cartQuantities(users.checkout.id)).toEqual({})
  expect(await stockOf(book.id)).toBe(stockBefore - 1)

  // updateTag('book:{id}') trong action: trang sách (cache `hours`) hiện tồn kho mới ngay
  await page.goto(`/sach/${book.slug}`)
  await expect(page.getByRole('main').getByText(`Chỉ còn ${stockBefore - 1} cuốn`)).toBeVisible()
  expect(errors).toEqual([])
  await guest.close()
})

test('badge về 0 sau khi đặt hàng khi số trên badge đến từ lần "Thêm" (header chưa render lại từ server)', async ({
  page,
  users,
  projectIndex,
}) => {
  await seedAddress(users.checkout.id)
  // Trang sách tải lúc giỏ rỗng: header từ server = 0; bấm "Thêm" → store 1, prop của header vẫn 0
  await addFromBookPage(page, pick(regular, projectIndex))
  // Điều hướng phía client: layout (header) giữ nguyên, không render lại từ server
  await page.getByRole('banner').getByRole('link', { name: /Giỏ hàng/ }).click()
  await expect(page).toHaveURL(/\/gio-hang$/)
  await page.getByTestId('cart-summary').getByRole('link', { name: 'Thanh toán' }).click()
  await expect(page).toHaveURL(/\/thanh-toan$/)
  await expect(placeButton(page)).toBeEnabled()
  await placeButton(page).click()
  await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })
  await expect(page.getByRole('main').getByTestId('order-code')).toBeVisible()
  await expect(badge(page)).toHaveCount(0)
})

test('chưa có địa chỉ → "Thêm địa chỉ" → lưu → quay lại thanh toán với địa chỉ mới được chọn', async ({
  page,
  users,
  projectIndex,
}) => {
  test.setTimeout(60_000)
  const errors = collectErrors(page)
  await setCartItem(users.checkout.id, pick(regular, projectIndex).id, 1)
  await openCheckout(page)
  await expect(page.getByRole('main').getByText('Bạn chưa có địa chỉ giao hàng nào.', { exact: false })).toBeVisible()
  await expect(placeButton(page)).toBeDisabled()

  await page.getByRole('main').getByRole('link', { name: 'Thêm địa chỉ' }).click()
  await expect(page).toHaveURL(/\/tai-khoan\/dia-chi\/moi\?next=%2Fthanh-toan$/)
  await fillAddress(page, {
    name: 'Người Nhận Mới',
    phone: '0912345678',
    province: 'Thành phố Hà Nội',
    ward: 'Phường Ba Đình',
    street: '1 Tràng Tiền',
  })
  await page.getByRole('button', { name: 'Lưu địa chỉ' }).click()
  await expect(page).toHaveURL(/\/thanh-toan\?address=\d+$/)
  const option = page.getByRole('main').getByTestId('checkout-address-option')
  await expect(option).toHaveCount(1)
  await expect(option).toContainText('Người Nhận Mới')
  await expect(option.getByRole('radio')).toBeChecked()
  await expect(placeButton(page)).toBeEnabled()
  expect(errors).toEqual([])
})

test('bấm "Đặt hàng" 2 lần liên tiếp → đúng 1 đơn, tới trang thành công, không hiện lỗi', async ({
  page,
  users,
  projectIndex,
}) => {
  await seedAddress(users.checkout.id)
  await setCartItem(users.checkout.id, pick(regular, projectIndex).id, 1)
  await openCheckout(page)
  await placeButton(page).dblclick()
  await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })
  expect(await ordersOf(users.checkout.id)).toHaveLength(1)
  await expect(checkoutError(page)).toHaveCount(0)
})

test('mất mạng khi đặt hàng → khối lỗi trong form; bấm lại cùng key → đúng 1 đơn', async ({
  page,
  users,
  projectIndex,
}) => {
  await seedAddress(users.checkout.id)
  await setCartItem(users.checkout.id, pick(regular, projectIndex).id, 1)
  await openCheckout(page)

  // Server Action POST về chính URL trang, header `next-action`
  let mode: 'block' | 'drop-response' = 'block'
  await page.route('**/thanh-toan', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST' || !request.headers()['next-action']) return route.continue()
    // drop-response: request tới server (đơn đã tạo) nhưng phản hồi không về được trình duyệt
    if (mode === 'drop-response') await route.fetch()
    await route.abort('internetdisconnected')
  })

  // 1. Request không tới server
  await placeButton(page).click()
  await expect(checkoutError(page)).toContainText('Không kết nối được máy chủ, thử lại sau ít phút.')
  await expect(checkoutError(page)).toBeFocused()
  await expect(page).toHaveURL(/\/thanh-toan$/)
  expect(await ordersOf(users.checkout.id)).toHaveLength(0)

  // 2. Đơn đã tạo nhưng mất phản hồi: vẫn là khối lỗi, trang giữ nguyên (cùng idempotency key)
  mode = 'drop-response'
  await placeButton(page).click()
  await expect.poll(async () => (await ordersOf(users.checkout.id)).length).toBe(1)
  await expect(placeButton(page)).toBeEnabled()
  await expect(checkoutError(page)).toContainText('Không kết nối được máy chủ, thử lại sau ít phút.')
  await expect(page).toHaveURL(/\/thanh-toan$/)
  const [created, ...others] = await ordersOf(users.checkout.id)
  expect(others).toEqual([])

  // 3. Có mạng lại, bấm lại → place_order trả đúng đơn đã tạo, không đơn thứ hai, không CART_EMPTY
  await page.unrouteAll()
  await placeButton(page).click()
  await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })
  await expect(page.getByRole('main').getByTestId('order-code')).toHaveText(created?.order_code ?? '')
  expect(await ordersOf(users.checkout.id)).toHaveLength(1)
})

test('vượt tồn kho: mở trang thì chặn sớm; tồn kho giảm sau khi mở trang → lỗi + link về giỏ', async ({
  page,
  users,
  projectIndex,
}) => {
  const book = pick(regular, projectIndex)
  const stock = await stockOf(book.id)
  await seedAddress(users.checkout.id)

  await setCartItem(users.checkout.id, book.id, stock + 1)
  await openCheckout(page)
  await expect(page.getByRole('main').getByTestId('checkout-problems')).toBeVisible()
  await expect(page.getByRole('main').getByTestId('checkout-line')).toContainText(`Chỉ còn ${stock} cuốn trong kho.`)
  await expect(placeButton(page)).toBeDisabled()

  // Trang mở lúc giỏ còn hợp lệ, giỏ vượt tồn kho sau đó → place_order chặn
  await setCartItem(users.checkout.id, book.id, 1)
  await openCheckout(page)
  await expect(placeButton(page)).toBeEnabled()
  await setCartItem(users.checkout.id, book.id, stock + 1)
  await placeButton(page).click()
  await expect(checkoutError(page)).toContainText(`Sách "${book.title}" chỉ còn ${stock} cuốn.`)
  await expect(checkoutError(page)).toBeFocused()
  expect(await ordersOf(users.checkout.id)).toHaveLength(0)

  await checkoutError(page).getByRole('link', { name: 'Về giỏ hàng để sửa số lượng' }).click()
  await expect(page).toHaveURL(/\/gio-hang$/)
  await expect(page.getByRole('main').getByTestId('cart-line')).toContainText(`Chỉ còn ${stock} cuốn trong kho.`)
  await expect(page.getByRole('main').getByRole('button', { name: `Giảm còn ${stock}` })).toBeVisible()
})

test('sách ngừng bán: mở trang thì chặn sớm; ẩn sau khi mở trang → lỗi + link về giỏ', async ({
  page,
  users,
  projectIndex,
}) => {
  const book = pick(regular, projectIndex)
  const hidden = await createHiddenBook()
  hiddenBookId = hidden.id
  await seedAddress(users.checkout.id)

  await setCartItem(users.checkout.id, book.id, 1)
  await setCartItem(users.checkout.id, hidden.id, 1)
  await openCheckout(page)
  await expect(page.getByRole('main').getByTestId('checkout-line').filter({ hasText: 'Sách không còn bán' })).toContainText('Ngừng bán')
  await expect(page.getByRole('main').getByTestId('checkout-problems')).toBeVisible()
  await expect(placeButton(page)).toBeDisabled()

  await clearCart(users.checkout.id)
  await setCartItem(users.checkout.id, book.id, 1)
  await openCheckout(page)
  await expect(placeButton(page)).toBeEnabled()
  await setCartItem(users.checkout.id, hidden.id, 1)
  await placeButton(page).click()
  await expect(checkoutError(page)).toContainText(`Sách "${hidden.title}" hiện không còn bán.`)
  await expect(checkoutError(page).getByRole('link', { name: 'Về giỏ hàng để xóa sách này' })).toBeVisible()
  expect(await ordersOf(users.checkout.id)).toHaveLength(0)
})

test('địa chỉ bị xóa ở tab khác → lỗi, danh sách địa chỉ cập nhật', async ({ page, users, projectIndex }) => {
  await seedAddress(users.checkout.id, { recipient: 'Người Nhận Hai', isDefault: false })
  const gone = await seedAddress(users.checkout.id, { recipient: 'Người Nhận Một', isDefault: true })
  await setCartItem(users.checkout.id, pick(regular, projectIndex).id, 1)
  await openCheckout(page)
  await expect(page.getByRole('main').getByTestId('checkout-address-option')).toHaveCount(2)
  await expect(page.getByRole('main').getByTestId('checkout-address-option').filter({ hasText: 'Người Nhận Một' }).getByRole('radio')).toBeChecked()

  await deleteAddress(gone)
  await placeButton(page).click()
  await expect(checkoutError(page)).toContainText('Địa chỉ này không còn. Hãy chọn địa chỉ khác.')
  await expect(page.getByRole('main').getByTestId('checkout-address-option')).toHaveCount(1)
  await expect(page.getByRole('main').getByTestId('checkout-address-option')).toContainText('Người Nhận Hai')
  await expect(checkoutError(page).getByRole('link', { name: 'Chọn địa chỉ khác' })).toBeVisible()
  expect(await ordersOf(users.checkout.id)).toHaveLength(0)
})

test('đặt ở tab A rồi đặt ở tab B → B báo giỏ trống, trang về trạng thái rỗng', async ({ page, users, projectIndex }) => {
  await seedAddress(users.checkout.id)
  await setCartItem(users.checkout.id, pick(regular, projectIndex).id, 1)
  const tabB = await page.context().newPage()
  await openCheckout(page)
  await openCheckout(tabB)

  await placeButton(page).click()
  await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })
  await placeButton(tabB).click()
  await expect(tabB.getByRole('main').getByText('Giỏ hàng đang trống').first()).toBeVisible()
  await expect(placeButton(tabB)).toHaveCount(0)
  expect(await ordersOf(users.checkout.id)).toHaveLength(1)
  await tabB.close()
})

test('tổng tiền đổi sau khi mở trang → CART_CHANGED, tổng mới hiện ra, bấm lại thì đặt được', async ({
  page,
  users,
  projectIndex,
}) => {
  const book = pick(regular, projectIndex)
  const stock = await stockOf(book.id)
  await seedAddress(users.checkout.id)
  await setCartItem(users.checkout.id, book.id, 1)
  await openCheckout(page)
  await expect(page.getByRole('main').getByTestId('checkout-total')).toHaveText(vnd(totalOf(book.price)))

  // Giỏ sửa ở tab khác sau khi trang đã mở
  await setCartItem(users.checkout.id, book.id, 2)
  await placeButton(page).click()
  await expect(checkoutError(page)).toContainText('Giỏ hàng vừa thay đổi. Kiểm tra lại tổng tiền rồi đặt hàng.')
  await expect(page.getByRole('main').getByTestId('checkout-total')).toHaveText(vnd(totalOf(book.price * 2)))
  // place_order dừng trước khi ghi: không có đơn, không trừ kho, giỏ giữ nguyên
  expect(await ordersOf(users.checkout.id)).toHaveLength(0)
  expect(await stockOf(book.id)).toBe(stock)
  expect(await cartQuantities(users.checkout.id)).toEqual({ [book.id]: 2 })

  await placeButton(page).click()
  await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })
  await expect(page.getByRole('main').getByTestId('order-total')).toHaveText(vnd(totalOf(book.price * 2)))
})

test('RPC: cùng key song song → một đơn; gửi lại sau khi đơn đã tạo → trả đơn cũ, không CART_CHANGED', async ({
  users,
  projectIndex,
}) => {
  const book = pick(regular, projectIndex)
  const addressId = await seedAddress(users.checkout.id)
  await setCartItem(users.checkout.id, book.id, 1)
  const client = await signedInClient(users.checkout)
  const args = {
    p_address_id: addressId,
    p_idempotency_key: randomUUID(),
    p_expected_total: totalOf(book.price),
  }

  const [first, second] = await Promise.all([client.rpc('place_order', args), client.rpc('place_order', args)])
  expect(first.error).toBeNull()
  expect(second.error).toBeNull()
  expect(second.data?.id).toBe(first.data?.id)

  // Giỏ đã rỗng, tổng thật bây giờ là 0 ≠ p_expected_total: vẫn trả đơn cũ (mất phản hồi rồi gửi lại)
  const resend = await client.rpc('place_order', args)
  expect(resend.error).toBeNull()
  expect(resend.data?.id).toBe(first.data?.id)

  // Key khác (đơn mới thật) với giỏ rỗng → CART_EMPTY
  const other = await client.rpc('place_order', { ...args, p_idempotency_key: randomUUID() })
  expect(other.error?.message).toBe('CART_EMPTY')

  const orders = await ordersOf(users.checkout.id)
  expect(orders).toHaveLength(1)
  expect(orders[0]?.order_items).toEqual([{ book_id: book.id, quantity: 1 }])
})

test('ghi chú quá 500 ký tự → lỗi tại ô, không mất nội dung', async ({ page, users, projectIndex }) => {
  await seedAddress(users.checkout.id)
  await setCartItem(users.checkout.id, pick(regular, projectIndex).id, 1)
  await openCheckout(page)
  const note = page.getByRole('main').getByLabel('Ghi chú cho đơn hàng')
  // maxLength chặn gõ quá ở trình duyệt; bỏ đi để kiểm tra lớp server (form gửi thẳng, trình duyệt cũ)
  await note.evaluate((element) => element.removeAttribute('maxlength'))
  const text = 'a'.repeat(501)
  await note.fill(text)
  await placeButton(page).click()
  await expect(page.getByRole('main').getByText('Ghi chú tối đa 500 ký tự.')).toBeVisible()
  await expect(note).toHaveValue(text)
  await expect(note).toHaveAttribute('aria-invalid', 'true')
  expect(await ordersOf(users.checkout.id)).toHaveLength(0)
})

test('/en/checkout: giá theo locale en', async ({ page, users, projectIndex }) => {
  const book = pick(regular, projectIndex)
  await seedAddress(users.checkout.id)
  await setCartItem(users.checkout.id, book.id, 1)
  await openCheckout(page, '/en/checkout')
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible()
  await expect(page.getByRole('main').getByTestId('checkout-total')).toHaveText(vnd(totalOf(book.price), 'en'))
  await expect(page.getByRole('main').getByTestId('checkout-total')).toHaveText(/^₫[\d,]+$/)
})

test.describe('khách (chưa đăng nhập)', () => {
  test.use({ storageState: NO_SESSION })

  test('/thanh-toan → /dang-nhap?next=%2Fthanh-toan', async ({ page }) => {
    await page.goto('/thanh-toan')
    await expect(page).toHaveURL(/\/dang-nhap\?next=%2Fthanh-toan$/)
    await page.goto('/en/checkout')
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fcheckout$/)
  })
})

// ---------- Phase 9: voucher, chuyển khoản VietQR ----------

const main = (page: Page) => page.getByRole('main')

async function applyVoucher(page: Page, code: string) {
  await main(page).getByLabel('Mã giảm giá').fill(code)
  await main(page).getByRole('button', { name: 'Áp dụng' }).click()
}

test('voucher: mã sai / chưa đủ tối thiểu → lỗi dưới ô; mã đúng (gõ chữ thường) → giảm 10%, đơn lưu mã', async ({
  page,
  users,
  projectIndex,
}) => {
  test.setTimeout(90_000)
  const errors = collectErrors(page)
  const book = pick(regular, projectIndex)
  const [voucher, highMin] = await Promise.all([createE2eVoucher(), createE2eVoucher({ minOrderValue: 50_000_000 })])
  try {
    await seedAddress(users.checkout.id)
    await setCartItem(users.checkout.id, book.id, 1)
    await openCheckout(page)
    const total = main(page).getByTestId('checkout-total')
    const voucherError = main(page).getByTestId('voucher-error')

    // Form GET: mã nằm trên URL, server tính lại bằng quote_order
    await applyVoucher(page, 'KHONG-CO-MA-NAY')
    await expect(page).toHaveURL(/[?&]voucher=KHONG-CO-MA-NAY/)
    await expect(voucherError).toHaveText('Mã giảm giá không hợp lệ hoặc đã hết hạn.')
    await expect(total).toHaveText(vnd(totalOf(book.price)))

    await applyVoucher(page, highMin.code)
    await expect(voucherError).toContainText('50.000.000')
    await expect(total).toHaveText(vnd(totalOf(book.price)))

    await applyVoucher(page, voucher.code.toLowerCase())
    await expect(main(page).getByText(`Đã áp dụng mã ${voucher.code}`)).toBeVisible()
    const discount = Math.floor(book.price / 10)
    await expect(main(page).getByTestId('checkout-discount')).toHaveText(`−${vnd(discount)}`)
    const expected = totalOf(book.price) - discount
    await expect(total).toHaveText(vnd(expected))
    // Địa chỉ đang chọn được giữ khi áp mã
    await expect(main(page).getByTestId('checkout-address-option').getByRole('radio')).toBeChecked()

    await waitForHydration(page, 'main [data-testid="checkout-summary"] button[type="submit"]:not([form])')
    await placeButton(page).click()
    await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })
    await expect(main(page).getByTestId('order-discount')).toHaveText(`−${vnd(discount)}`)
    await expect(main(page).getByTestId('order-total')).toHaveText(vnd(expected))
    const [order] = await ordersOf(users.checkout.id)
    expect(order && (await orderRow(order.id))).toMatchObject({ voucher_code: voucher.code, discount, total: expected })
    expect(errors).toEqual([])
  } finally {
    await cancelAndDeleteOrders([users.checkout.id])
    await deleteE2eVouchers([voucher.code, highMin.code])
  }
})

test('chuyển khoản VietQR: trang thành công + chi tiết đơn có mã QR, số tiền, nội dung = mã đơn; đã trả → ẩn QR, không hủy', async ({
  page,
  users,
  projectIndex,
}) => {
  test.setTimeout(60_000)
  const errors = collectErrors(page)
  const book = pick(regular, projectIndex)
  await seedAddress(users.checkout.id)
  await setCartItem(users.checkout.id, book.id, 1)
  await openCheckout(page)
  await main(page).getByLabel('Chuyển khoản ngân hàng (VietQR)').check()
  await placeButton(page).click()
  await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })

  const code = (await main(page).getByTestId('order-code').textContent())?.trim() ?? ''
  const total = vnd(totalOf(book.price))
  const card = main(page).getByTestId('vietqr')
  await expect(card.getByRole('img', { name: `Mã VietQR chuyển khoản cho đơn ${code}` })).toBeVisible()
  await expect(card.getByTestId('vietqr-content')).toHaveText(code)
  await expect(card.getByTestId('vietqr-amount')).toHaveText(total)
  // Chưa cấu hình tài khoản thật → luôn có cảnh báo demo
  await expect(card.getByTestId('vietqr-demo')).toBeVisible()
  await expect(main(page).getByTestId('order-bank-amount')).toContainText(total)
  await expect(main(page).getByTestId('order-cod')).toHaveCount(0)

  const [order] = await ordersOf(users.checkout.id)
  expect(order).toMatchObject({ order_code: code, payment_method: 'bank_transfer', payment_status: 'unpaid' })

  await page.goto(`/tai-khoan/don-hang/${code}`)
  await expect(main(page).getByTestId('order-payment-method')).toHaveText('Chuyển khoản ngân hàng (VietQR)')
  await expect(main(page).getByTestId('vietqr').getByTestId('vietqr-content')).toHaveText(code)
  await expect(main(page).getByText('Hủy đơn hàng', { exact: true })).toBeVisible()

  // Cửa hàng đối soát xong → đã thanh toán: không còn QR, khách không tự hủy được
  await setPaymentStatus(order?.id ?? 0, 'paid')
  await page.reload()
  await expect(main(page).getByTestId('order-payment-status')).toHaveText('Đã thanh toán')
  await expect(main(page).getByTestId('vietqr')).toHaveCount(0)
  await expect(main(page).getByText('Hủy đơn hàng', { exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})

// Chờ migration 20261016020000_payments_email.sql: trước đó cancel_order chưa kiểm tra payment_status → test này fail.
test('RPC: khách không tự hủy được đơn đã thanh toán (cancel_order chặn ở DB)', async ({ users, projectIndex }) => {
  const client = await signedInClient(users.checkout)
  const addressId = await seedAddress(users.checkout.id)
  const order = await placeE2eOrder(client, users.checkout.id, {
    addressId,
    bookId: pick(regular, projectIndex).id,
    quantity: 1,
    paymentMethod: 'bank_transfer',
  })
  await setPaymentStatus(order.id, 'paid')
  const { error } = await client.rpc('cancel_order', { p_order_id: order.id })
  expect(error?.message).toBe('ORDER_NOT_CANCELLABLE')
  expect(await orderRow(order.id)).toMatchObject({ status: 'pending', payment_status: 'paid' })
})
