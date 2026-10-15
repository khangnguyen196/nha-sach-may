import { expect, test, type Page } from '@playwright/test'
import {
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  createE2eVoucher,
  deleteE2eUsers,
  deleteE2eVouchers,
  ordersOf,
  stockOf,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'
import { fillLogin, NO_SESSION } from './auth'
import { addFromBookPage, badge, vnd } from './cart'
import { collectErrors, fillAddress, waitForHydration } from './helpers'

// Luồng mua hàng trọn vẹn (Phase 10), mỗi project một lần chạy độc lập: user mới tạo cho mỗi lần chạy, sách e2e riêng
// (danh mục gốc ẩn), voucher riêng. Khách vãng lai thêm sách → đăng nhập (giỏ gộp) → thêm địa chỉ → áp mã giảm giá →
// chuyển khoản VietQR → trang thành công → chi tiết đơn → hủy → danh sách đơn. Dọn ở afterAll.

test.describe.configure({ mode: 'serial' })
test.use({ storageState: NO_SESSION })

const SHIPPING_FEE = 30_000
let buyer: E2eUser
let books: E2eAdminBook[]
let voucherCode: string
const slugs: string[] = []

test.beforeAll(async () => {
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  books = await Promise.all([
    createE2eBook({ categoryId: leaf.id, price: 70_000, stock: 20 }),
    createE2eBook({ categoryId: leaf.id, price: 50_000, stock: 20 }),
  ])
  slugs.push(...books.map((book) => book.slug))
  ;[buyer, { code: voucherCode }] = await Promise.all([createE2eUser('purchase'), createE2eVoucher()])
})

test.afterAll(async () => {
  if (buyer) await deleteE2eUsers([buyer.id])
  if (voucherCode) await deleteE2eVouchers([voucherCode])
  await cleanupE2eAdminData(slugs)
})

const main = (page: Page) => page.getByRole('main')
const placeButton = (page: Page) => main(page).getByTestId('checkout-summary').locator('button[type="submit"]:not([form])')

test('khách → đăng nhập → địa chỉ → voucher → VietQR → chi tiết đơn → hủy → danh sách đơn', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = collectErrors(page)
  const [first, second] = books
  if (!first || !second) throw new Error('Thiếu sách test')

  // 1. Khách vãng lai: 2 cuốn sách thứ nhất + 1 cuốn sách thứ hai (giỏ localStorage)
  await addFromBookPage(page, first, { times: 2 })
  await addFromBookPage(page, second, { startAt: 2 })
  await page.goto('/gio-hang')
  await main(page).getByTestId('cart-summary').getByRole('link', { name: 'Thanh toán' }).click()

  // 2. Đăng nhập → quay lại thanh toán, giỏ khách gộp vào giỏ tài khoản
  await expect(page).toHaveURL(/\/dang-nhap\?next=%2Fthanh-toan$/)
  await fillLogin(page, buyer)
  await expect(page).toHaveURL(/\/thanh-toan$/, { timeout: 20_000 })
  await expect(main(page).getByTestId('checkout-line')).toHaveCount(2, { timeout: 15_000 })

  // 3. Chưa có địa chỉ → thêm → quay lại với địa chỉ vừa thêm
  await main(page).getByRole('link', { name: 'Thêm địa chỉ' }).click()
  await fillAddress(page, {
    name: 'Người Mua E2E',
    phone: '0912345678',
    province: 'Thành phố Hà Nội',
    ward: 'Phường Ba Đình',
    street: '7 Hàng Bài',
  })
  await page.getByRole('button', { name: 'Lưu địa chỉ' }).click()
  await expect(page).toHaveURL(/\/thanh-toan\?address=\d+$/)

  // 4. Mã giảm giá 10%
  const subtotal = first.price * 2 + second.price
  const discount = Math.floor(subtotal / 10)
  const total = subtotal + SHIPPING_FEE - discount
  await main(page).getByLabel('Mã giảm giá').fill(voucherCode.toLowerCase())
  await main(page).getByRole('button', { name: 'Áp dụng' }).click()
  await expect(main(page).getByTestId('checkout-discount')).toHaveText(`−${vnd(discount)}`)
  await expect(main(page).getByTestId('checkout-total')).toHaveText(vnd(total))

  // 5. Chuyển khoản VietQR → trang thành công có mã QR đúng số tiền, nội dung = mã đơn
  await waitForHydration(page, 'main [data-testid="checkout-summary"] button[type="submit"]:not([form])')
  await main(page).getByLabel('Chuyển khoản ngân hàng (VietQR)').check()
  await placeButton(page).click()
  await expect(page).toHaveURL(/\/thanh-toan\/thanh-cong\/NS\d+$/, { timeout: 20_000 })
  const code = (await main(page).getByTestId('order-code').textContent())?.trim() ?? ''
  await expect(main(page).getByTestId('vietqr-content')).toHaveText(code)
  await expect(main(page).getByTestId('vietqr-amount')).toHaveText(vnd(total))
  await expect(badge(page)).toHaveCount(0)
  expect(await stockOf(first.id)).toBe(18)

  // 6. Chi tiết đơn → hủy (đơn chưa thanh toán) → tồn kho hoàn lại
  await main(page).getByRole('link', { name: 'Xem đơn hàng' }).click()
  await expect(page).toHaveURL(new RegExp(`/tai-khoan/don-hang/${code}$`))
  await expect(main(page).getByTestId('vietqr')).toBeVisible()
  await waitForHydration(page, 'main details form button[type="submit"]')
  await main(page).getByText('Hủy đơn hàng', { exact: true }).click()
  await main(page).getByLabel('Lý do hủy').fill('Đổi ý (e2e)')
  await main(page).getByRole('button', { name: 'Xác nhận hủy' }).click()
  await expect(main(page).getByTestId('order-status').first()).toHaveText('Đã hủy', { timeout: 15_000 })
  await expect(main(page).getByTestId('vietqr')).toHaveCount(0)
  expect(await stockOf(first.id)).toBe(20)

  // 7. Danh sách đơn: đơn vừa hủy ở đầu
  await page.goto('/tai-khoan/don-hang')
  await expect(main(page).getByRole('link', { name: new RegExp(code) }).first()).toBeVisible()
  const [order] = await ordersOf(buyer.id)
  expect(order).toMatchObject({ order_code: code, status: 'cancelled', payment_method: 'bank_transfer', total })
  expect(errors).toEqual([])
})
