import { expect, test } from '@playwright/test'
import { createE2eUser, deleteE2eUsers } from '../scripts/e2e-user'
import { NO_SESSION } from './auth'

// Tách từ login-typing.spec.ts: test cần user riêng nên chạy ở project tài khoản (phụ thuộc `setup`). Ở project desktop /
// mobile, cleanupE2eUsers của setup chạy song song có thể xóa mất user vừa tạo.
test.use({ storageState: NO_SESSION })

test.describe('không có JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('/dang-nhap?next=%2Fgio-hang: nút đăng nhập khóa (★8); form gửi thẳng (không qua nút) với input next trống → server lấy next từ URL trang, về giỏ', async ({
    page,
  }, testInfo) => {
    const user = await createE2eUser(`${testInfo.project.name}-nojs`)
    try {
      await page.goto('/dang-nhap?next=%2Fgio-hang')
      const main = page.getByRole('main')
      await expect(main.locator('form')).toHaveCount(1)
      await expect(main.locator('form input[type="hidden"][name="next"]')).toHaveValue('')
      await main.getByLabel('Email').fill(user.email)
      await main.getByLabel('Mật khẩu', { exact: true }).fill(user.password)
      // Tắt JS: nút gửi khóa (gửi được thì trang lỗi / kết quả ra trắng, docs/plans/no-js.md ★8)
      const submit = main.getByRole('button', { name: 'Đăng nhập' })
      await expect(submit).toBeDisabled()
      await expect(submit).toHaveAttribute('aria-disabled', 'true')
      // Đường server vẫn giữ (form gửi không qua nút, VD trang HTML cũ còn trong bộ nhớ đệm): next lấy từ Referer
      await main.locator('form').evaluate((form) => {
        if (form instanceof HTMLFormElement) form.requestSubmit()
      })
      await expect(page).toHaveURL(/\/gio-hang$/, { timeout: 20_000 })
    } finally {
      await deleteE2eUsers([user.id])
    }
  })
})
