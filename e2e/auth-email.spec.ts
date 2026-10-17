import { randomBytes } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { canSignIn, createE2eUser, deleteE2eUsers, findUserIdByEmail } from '../scripts/e2e-user'
import { NO_SESSION } from './auth'
import { collectErrors, waitForHydration } from './helpers'
import { waitForAuthEmail } from './mailbox'

// Thư thật của Supabase Auth (template song ngữ supabase/templates/, hộp thư giả Mailpit của Supabase local) →
// link token_hash → trang trung gian /xac-nhan → nút POST. Mỗi test tự tạo user, xóa ở finally.
test.use({ storageState: NO_SESSION })

test('đăng ký (en) → thư tiếng Anh → xác nhận → vào tài khoản; mở lại link → hết hạn', async ({ page }) => {
  const errors = collectErrors(page)
  const email = `e2e+${randomBytes(6).toString('hex')}-signup@example.com`
  try {
    await page.goto('/en/register')
    await waitForHydration(page, 'main form button[type="submit"]')
    await page.getByRole('main').getByLabel('Full name').fill('Kiểm Thử Đăng Ký')
    await page.getByRole('main').getByLabel('Email').fill(email)
    await page.getByRole('main').getByLabel('Password', { exact: true }).fill(`E2e-${randomBytes(9).toString('base64url')}`)
    await page.getByRole('main').getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('main').getByRole('heading', { name: 'Check your inbox' })).toBeVisible()

    const mail = await waitForAuthEmail(email)
    expect(mail.subject).toBe('Confirm your Nhà Sách Mây account')
    expect(mail.link).toContain('type=email')
    expect(mail.link).toContain('locale=en')

    await page.goto(mail.link)
    await expect(page).toHaveURL(/\/en\/confirm\?/)
    await page.getByRole('main').getByRole('button', { name: 'Confirm email' }).click()
    await expect(page).toHaveURL(/\/en\/account$/)
    await expect(page.getByRole('main').getByText(email)).toBeVisible()

    // Link chỉ dùng được một lần
    await page.context().clearCookies()
    await page.goto(mail.link)
    await page.getByRole('main').getByRole('button', { name: 'Confirm email' }).click()
    await expect(page).toHaveURL(/\/en\/login\?error=LINK_EXPIRED$/)
    expect(errors).toEqual([])
  } finally {
    const id = await findUserIdByEmail(email)
    if (id) await deleteE2eUsers([id])
  }
})

test('quên mật khẩu (vi) → thư tiếng Việt → đặt mật khẩu mới → đăng nhập bằng mật khẩu mới', async ({ page }, testInfo) => {
  const errors = collectErrors(page)
  const user = await createE2eUser(`${testInfo.project.name}-forgot`)
  try {
    await page.goto('/quen-mat-khau')
    await waitForHydration(page, 'main form button[type="submit"]')
    await page.getByRole('main').getByLabel('Email').fill(user.email)
    await page.getByRole('main').getByRole('button', { name: 'Gửi liên kết' }).click()
    await expect(page.getByRole('main').getByRole('heading', { name: 'Kiểm tra hộp thư của bạn' })).toBeVisible()

    const mail = await waitForAuthEmail(user.email)
    expect(mail.subject).toBe('Đặt lại mật khẩu Nhà Sách Mây')
    expect(mail.link).toContain('type=recovery')
    expect(mail.link).toContain('locale=vi')

    await page.goto(mail.link)
    await expect(page).toHaveURL(/\/xac-nhan\?/)
    await page.getByRole('main').getByRole('button', { name: 'Tiếp tục' }).click()
    await expect(page).toHaveURL(/\/dat-lai-mat-khau$/)

    const newPassword = `${user.password}-moi`
    await waitForHydration(page, 'main form button[type="submit"]')
    await page.getByRole('main').getByLabel('Mật khẩu mới').fill(newPassword)
    await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
    await expect(page.getByRole('heading', { name: 'Đã đổi mật khẩu' })).toBeVisible()
    expect(await canSignIn(user.email, newPassword)).toBe(true)
    expect(await canSignIn(user.email, user.password)).toBe(false)
    expect(errors).toEqual([])
  } finally {
    await deleteE2eUsers([user.id])
  }
})
