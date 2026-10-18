import { expect, test } from '@playwright/test'
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

    for (const path of ['/thanh-toan', '/gio-hang', '/tai-khoan/dia-chi/moi', '/tai-khoan']) {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expectReadableInputs(page.getByRole('main'), path)
    }
  } finally {
    await deleteE2eUsers([user.id])
  }
})
