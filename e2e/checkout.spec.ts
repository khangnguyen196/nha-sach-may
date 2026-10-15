import { test as base, expect, type Page } from '@playwright/test'
import {
  cancelAndDeleteOrders,
  cartQuantities,
  clearAddresses,
  clearCart,
  createHiddenBook,
  deleteAddress,
  deleteHiddenBooks,
  findBooksByStockDesc,
  ordersOf,
  seedAddress,
  setCartItem,
  stockOf,
  type E2eBook,
} from '../scripts/e2e-user'
import { ACCOUNT_PROJECTS, checkoutStatePath, fillLogin, NO_SESSION, readCredentials, type ProjectUsers } from './auth'
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

// Sách lấy từ cuối danh sách (id giảm dần) để không trùng sách của spec giỏ; mỗi project một bộ sách riêng để chạy
// song song trên CI không giẫm tồn kho của nhau. Tồn kho ≤ 98: đặt được số lượng stock + 1 (giỏ giới hạn 99).
let lowStock: E2eBook[]
let regular: E2eBook[]

test.beforeAll(async () => {
  ;[lowStock, regular] = await Promise.all([findBooksByStockDesc(2, 5, 2), findBooksByStockDesc(20, 98, 2)])
  if (lowStock.length === 0 || regular.length === 0) throw new Error('Cần sách tồn kho 2–5 và 20–98 để test')
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

// Luôn tìm trong <main>: lúc trang vừa hydrate, React có thể còn giữ một bản sao ẩn của boundary đang stream
// (`<div hidden id="S:…">` cuối body) → locator theo test id ngoài <main> khớp 2 phần tử
const placeButton = (page: Page) => page.getByRole('main').getByTestId('checkout-summary').locator('button[type="submit"]')
const checkoutError = (page: Page) => page.getByRole('main').getByTestId('checkout-error')

async function openCheckout(page: Page, path = '/thanh-toan') {
  await page.goto(path)
  await waitForHydration(page, 'main [data-testid="checkout-summary"] button[type="submit"]')
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
