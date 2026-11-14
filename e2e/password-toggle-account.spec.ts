import { expect, test, type Page } from '@playwright/test'
import { createE2eUser, deleteE2eUsers } from '../scripts/e2e-user'
import { NO_SESSION } from './auth'
import { collectErrors, waitForHydration } from './helpers'
import { waitForAuthEmail } from './mailbox'

// Nút hiện / ẩn mật khẩu ở trang đặt lại mật khẩu (cần phiên recovery: đường quên mật khẩu như auth-email.spec.ts).
// Trang đăng nhập / đăng ký: password-toggle.spec.ts. User riêng mỗi lần chạy, xóa ở finally. Không đổi mật khẩu thật:
// mật khẩu giả quá ngắn → bị chặn ở bước kiểm tra dữ liệu.
test.use({ storageState: NO_SESSION })

const SHORT_PASSWORD = 'ngan1'

async function expectToggle(
  page: Page,
  { label, show, hide, submit, error }: { label: string; show: string; hide: string; submit: string; error: string },
) {
  await waitForHydration(page, 'main form button[type="submit"]')
  const main = page.getByRole('main')
  const input = main.getByLabel(label, { exact: true })
  const toggle = main.getByRole('button', { name: show, exact: true })
  await expect(toggle).toBeVisible()
  await expect(input).toHaveAttribute('type', 'password')
  await expect(toggle).toHaveAttribute('type', 'button')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(toggle).toHaveAttribute('aria-controls', (await input.getAttribute('id')) ?? '')

  await input.fill(SHORT_PASSWORD)
  await toggle.click()
  await expect(input).toHaveAttribute('type', 'text')
  await expect(main.getByRole('button', { name: hide, exact: true })).toHaveAttribute('aria-pressed', 'true')

  // Gửi khi đang hiện → ô về password
  await main.getByRole('button', { name: submit, exact: true }).click()
  await expect(input).toHaveAttribute('type', 'password')
  await expect(main.getByText(error, { exact: true })).toBeVisible()
  await expect(input).toHaveAttribute('type', 'password')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
}

test('đặt lại mật khẩu (vi + en): nút hiện / ẩn, gửi khi đang hiện → về password', async ({ page }, testInfo) => {
  const errors = collectErrors(page)
  const user = await createE2eUser(`${testInfo.project.name}-pwtoggle`)
  try {
    await page.goto('/quen-mat-khau')
    await waitForHydration(page, 'main form button[type="submit"]')
    await page.getByRole('main').getByLabel('Email', { exact: true }).fill(user.email)
    await page.getByRole('main').getByRole('button', { name: 'Gửi liên kết', exact: true }).click()
    await expect(page.getByRole('main').getByRole('heading', { name: 'Kiểm tra hộp thư của bạn' })).toBeVisible()

    const mail = await waitForAuthEmail(user.email)
    await page.goto(mail.link)
    await expect(page).toHaveURL(/\/xac-nhan\?/)
    await page.getByRole('main').getByRole('button', { name: 'Tiếp tục', exact: true }).click()
    await expect(page).toHaveURL(/\/dat-lai-mat-khau$/)

    await expectToggle(page, {
      label: 'Mật khẩu mới',
      show: 'Hiện mật khẩu',
      hide: 'Ẩn mật khẩu',
      submit: 'Lưu mật khẩu mới',
      error: 'Mật khẩu cần ít nhất 8 ký tự.',
    })

    // Cùng phiên recovery, trang tiếng Anh
    await page.goto('/en/reset-password')
    await expectToggle(page, {
      label: 'New password',
      show: 'Show password',
      hide: 'Hide password',
      submit: 'Save new password',
      error: 'Password must be at least 8 characters.',
    })
    expect(errors).toEqual([])
  } finally {
    await deleteE2eUsers([user.id])
  }
})
