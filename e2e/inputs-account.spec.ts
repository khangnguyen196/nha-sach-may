import { expect, test, type Locator } from '@playwright/test'
import { createE2eUser, deleteE2eUsers, seedAddress, setCartItem } from '../scripts/e2e-user'
import { login, NO_SESSION, readShopBooks } from './auth'
import { expectReadableInputs } from './inputs'

// Ô nhập ≥ 16px trên mobile ở trang cần đăng nhập (thanh toán: mã giảm giá + ghi chú; sổ địa chỉ; tài khoản).
// Tên file kết thúc bằng account.spec.ts → chạy ở desktop-account + mobile-account; chỉ kiểm ở mobile.
// User riêng mỗi lần chạy (giỏ / địa chỉ không giẫm spec khác), xóa ở finally. Sách trong giỏ là sách e2e của project,
// không đặt hàng nên không đổi tồn kho.
test.use({ storageState: NO_SESSION })

test('ô nhập ở thanh toán, giỏ, sổ địa chỉ, tài khoản ≥ 16px', async ({ page, isMobile }, testInfo) => {
  test.skip(!isMobile, 'iOS chỉ tự phóng to trên điện thoại')
  const user = await createE2eUser('inputs')
  try {
    const [book] = readShopBooks(testInfo.project.name).plenty
    if (!book) throw new Error('Không có sách e2e "plenty" cho project')
    await seedAddress(user.id)
    await setCartItem(user.id, book.id, 1)
    await login(page, user)

    // Đo phải trúng ô của nội dung thật: fallback của cả 4 trang là skeleton không có ô (CheckoutSkeleton, CartSkeleton,
    // AddressFormSkeleton, AccountSkeleton) → chờ một phần tử chỉ có ở nội dung thật trước khi đo
    const main = page.getByRole('main')
    const ready: Record<string, Locator> = {
      '/thanh-toan': main.getByTestId('checkout-summary'),
      '/gio-hang': main.getByRole('link', { name: book.title, exact: true }),
      '/tai-khoan/dia-chi/moi': main.getByRole('button', { name: 'Lưu địa chỉ' }),
      '/tai-khoan': main.getByRole('button', { name: 'Đăng xuất' }),
    }
    for (const [path, content] of Object.entries(ready)) {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(content).toBeVisible()
      await expectReadableInputs(main, path)
    }
  } finally {
    await deleteE2eUsers([user.id])
  }
})
