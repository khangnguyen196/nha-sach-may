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

  // 1. Request không tới server: ghi chú đã gõ vẫn còn
  await main(page).getByLabel('Ghi chú cho đơn hàng').fill('Giao giờ hành chính')
  await placeButton(page).click()
  await expect(checkoutError(page)).toContainText('Không kết nối được máy chủ. Bạn kiểm tra mạng rồi bấm lại nhé, thông tin đã nhập vẫn còn nguyên.')
  await expect(checkoutError(page)).toBeFocused()
  await expect(main(page).getByLabel('Ghi chú cho đơn hàng')).toHaveValue('Giao giờ hành chính')
  await expect(page).toHaveURL(/\/thanh-toan$/)
  expect(await ordersOf(users.checkout.id)).toHaveLength(0)

  // 2. Đơn đã tạo nhưng mất phản hồi: vẫn là khối lỗi, trang giữ nguyên (cùng idempotency key)
  mode = 'drop-response'
  await placeButton(page).click()
  await expect.poll(async () => (await ordersOf(users.checkout.id)).length).toBe(1)
  await expect(placeButton(page)).toBeEnabled()
  await expect(checkoutError(page)).toContainText('Không kết nối được máy chủ. Bạn kiểm tra mạng rồi bấm lại nhé, thông tin đã nhập vẫn còn nguyên.')
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

test('áp dụng voucher (form GET): khối tổng tiền hiện "Đang tính lại…" ngay khi bấm, hết khi trang mới tới', async ({
  page,
  users,
  projectIndex,
}) => {
  await seedAddress(users.checkout.id)
  await setCartItem(users.checkout.id, pick(regular, projectIndex).id, 1)
  await openCheckout(page)
  // Làm chậm trang tính lại để thấy trạng thái đang tính
  await page.route(/\/thanh-toan\?(.*&)?voucher=/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    await route.continue()
  })
  await main(page).getByLabel('Mã giảm giá').fill('KHONG-CO-MA-NAY')
  // click() và expect(locator) của Playwright đều chờ điều hướng do cú bấm gây ra xong (tức chờ hết độ trễ giả lập, trang
  // cũ đã bị thay) → bấm và đọc chữ ngay trong trang cũ, trong cùng một evaluate (thăm dò tối đa 1 s, trước khi phản
  // hồi bị làm chậm 1,5 s tới)
  const pendingText = await main(page)
    .getByRole('button', { name: 'Áp dụng' })
    .evaluate(async (button) => {
      if (!(button instanceof HTMLButtonElement)) return null
      button.click()
      const deadline = performance.now() + 1_000
      while (performance.now() < deadline) {
        const text = document.querySelector('main [data-testid="voucher-pending"]')?.textContent ?? ''
        if (text) return text
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      return null
    })
  expect(pendingText).toBe('Đang tính lại tổng tiền…')
  await expect(page).toHaveURL(/[?&]voucher=KHONG-CO-MA-NAY/)
  await expect(main(page).getByTestId('voucher-error')).toBeVisible()
  await expect(main(page).getByTestId('voucher-pending')).toHaveText('')
})

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
    await expect(voucherError).toHaveText('Không có mã giảm giá này. Bạn kiểm tra lại từng ký tự nhé.')
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

test('ghi chú đã gõ còn nguyên sau khi áp mã giảm giá (form GET tải lại trang)', async ({ page, users, projectIndex }) => {
  await seedAddress(users.checkout.id)
  await setCartItem(users.checkout.id, pick(regular, projectIndex).id, 1)
  await openCheckout(page)
  await main(page).getByLabel('Ghi chú cho đơn hàng').fill('Gọi trước khi giao')
  await applyVoucher(page, 'KHONG-CO-MA-NAY')
  await expect(page).toHaveURL(/[?&]voucher=KHONG-CO-MA-NAY/)
  await expect(main(page).getByTestId('voucher-error')).toBeVisible()
  await expect(main(page).getByLabel('Ghi chú cho đơn hàng')).toHaveValue('Gọi trước khi giao')
})

test('voucher: mỗi lý do không dùng được có câu riêng dưới ô, tổng không đổi', async ({ page, users, projectIndex }) => {
  test.setTimeout(90_000)
  const errors = collectErrors(page)
  const book = pick(regular, projectIndex)
  const [off, future, expired, exhausted] = await Promise.all([
    createE2eVoucher({ isActive: false }),
    createE2eVoucher({ startsAt: '2099-01-02T03:04:00+07:00' }),
    createE2eVoucher({ endsAt: '2020-01-02T03:04:00+07:00' }),
    createE2eVoucher({ usageLimit: 1, usedCount: 1 }),
  ])
  try {
    await seedAddress(users.checkout.id)
    await setCartItem(users.checkout.id, book.id, 1)
    await openCheckout(page)
    const total = main(page).getByTestId('checkout-total')
    const voucherError = main(page).getByTestId('voucher-error')

    const cases: [string, string | RegExp][] = [
      ['AB', 'Không có mã giảm giá này. Bạn kiểm tra lại từng ký tự nhé.'],
      ['giảm10', 'Không có mã giảm giá này. Bạn kiểm tra lại từng ký tự nhé.'],
      [off.code, 'Mã này hiện đã ngừng áp dụng. Bạn thử mã khác nhé.'],
      [future.code, /^Mã này dùng được từ [^T]*2099[^T]*\. Bạn quay lại lúc đó nhé\.$/],
      [expired.code, /^Mã này đã hết hạn lúc [^T]*2020[^T]*\. Bạn thử mã khác nhé\.$/],
      [exhausted.code, 'Mã này đã hết lượt dùng. Bạn thử mã khác nhé.'],
    ]
    for (const [code, message] of cases) {
      await applyVoucher(page, code)
      await expect(voucherError, code).toHaveText(message)
      // Lỗi gắn với ô nhập (trình đọc màn hình đọc kèm ô)
      await expect(main(page).getByLabel('Mã giảm giá')).toHaveAttribute('aria-describedby', 'voucher-error')
      await expect(total, code).toHaveText(vnd(totalOf(book.price)))
    }
    expect(errors).toEqual([])
  } finally {
    await deleteE2eVouchers([off.code, future.code, expired.code, exhausted.code])
  }
})

test('gợi ý mã: chỉ mã public; mã chưa đủ điều kiện mờ + lý do; Áp dụng cập nhật tổng; mã không public vẫn gõ tay được', async ({
  page,
  users,
  projectIndex,
}, testInfo) => {
  test.setTimeout(90_000)
  const errors = collectErrors(page)
  const book = pick(regular, projectIndex)
  const [eligible, highMin, hidden] = await Promise.all([
    createE2eVoucher({ isPublic: true }),
    createE2eVoucher({ isPublic: true, minOrderValue: 50_000_000 }),
    createE2eVoucher({ isPublic: false }),
  ])
  try {
    await seedAddress(users.checkout.id)
    await setCartItem(users.checkout.id, book.id, 1)
    await openCheckout(page)
    await waitForHydration(page, 'main [data-testid="checkout-voucher"] button[aria-haspopup="dialog"]')

    await main(page).getByRole('button', { name: 'Chọn mã giảm giá' }).click()
    const picker = page.getByRole('dialog', { name: 'Mã giảm giá cho đơn này' })
    await expect(picker).toBeVisible()
    const option = (code: string) => picker.getByTestId('voucher-option').filter({ hasText: code })

    // Chỉ mã public; mã đủ điều kiện đứng trước mã chưa đủ
    await expect(option(hidden.code)).toHaveCount(0)
    await expect(option(eligible.code)).toHaveAttribute('data-eligible', 'true')
    await expect(option(eligible.code)).toContainText('Giảm 10%')
    await expect(option(eligible.code).getByRole('button', { name: 'Áp dụng' })).toBeEnabled()
    const shortfall = 50_000_000 - book.price
    await expect(option(highMin.code)).toHaveAttribute('data-eligible', 'false')
    await expect(option(highMin.code).getByTestId('voucher-reason')).toHaveText(`Mua thêm ${vnd(shortfall)} để dùng mã này`)
    await expect(option(highMin.code).getByRole('button', { name: 'Áp dụng' })).toBeDisabled()
    const codes = await picker.getByTestId('voucher-option').evaluateAll((items) =>
      items.map((item) => [item.getAttribute('data-eligible'), item.querySelector('.font-mono')?.textContent]),
    )
    expect(codes.findIndex(([, code]) => code === eligible.code)).toBeLessThan(
      codes.findIndex(([, code]) => code === highMin.code),
    )

    if (testInfo.project.name.startsWith('mobile')) {
      // Tấm trượt sát đáy màn hình, nút ≥ 44px, chữ ≥ 16px
      const viewport = page.viewportSize()
      // Chờ hiệu ứng trượt lên xong
      await expect
        .poll(async () => {
          const box = await picker.boundingBox()
          return box && Math.round(box.y + box.height)
        })
        .toBe(viewport?.height)
      const apply = option(eligible.code).getByRole('button', { name: 'Áp dụng' })
      expect((await apply.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
      const fontSize = await option(eligible.code)
        .getByText('Giảm 10%')
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize))
      expect(fontSize).toBeGreaterThanOrEqual(16)
      expect((await picker.getByRole('button', { name: 'Đóng' }).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    }

    await option(eligible.code).getByRole('button', { name: 'Áp dụng' }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]voucher=${eligible.code}`))
    await expect(main(page).getByText(`Đã áp dụng mã ${eligible.code}`)).toBeVisible()
    const discount = Math.floor(book.price / 10)
    await expect(main(page).getByTestId('checkout-discount')).toHaveText(`−${vnd(discount)}`)
    await expect(main(page).getByTestId('checkout-total')).toHaveText(vnd(totalOf(book.price) - discount))
    // Đã áp mã → không còn ô nhập / nút chọn mã
    await expect(main(page).getByRole('button', { name: 'Chọn mã giảm giá' })).toHaveCount(0)

    // Mã không public: không có trong gợi ý nhưng gõ tay vẫn dùng được
    await main(page).getByRole('link', { name: 'Bỏ mã' }).click()
    await expect(main(page).getByLabel('Mã giảm giá')).toBeVisible()
    await applyVoucher(page, hidden.code.toLowerCase())
    await expect(main(page).getByText(`Đã áp dụng mã ${hidden.code}`)).toBeVisible()
    await expect(main(page).getByTestId('checkout-discount')).toHaveText(`−${vnd(discount)}`)
    expect(errors).toEqual([])
  } finally {
    await deleteE2eVouchers([eligible.code, highMin.code, hidden.code])
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

// cancel_order kiểm payment_status (payments_email.sql); từ ux-messages B báo đúng lý do ORDER_PAID.
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
  expect(error?.message).toBe('ORDER_PAID')
  expect(await orderRow(order.id)).toMatchObject({ status: 'pending', payment_status: 'paid' })
})
