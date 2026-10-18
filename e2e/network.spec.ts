import { expect, test } from '@playwright/test'
import { failServerActions, waitForHydration } from './helpers'

// Mất mạng đúng lúc gửi form (request Server Action không tới server): câu "không kết nối được máy chủ" trong khối lỗi
// của form, chữ đã gõ còn nguyên, không lên trang lỗi. Khách chưa đăng nhập, không ghi dữ liệu.
const NETWORK = 'Không kết nối được máy chủ. Bạn kiểm tra mạng rồi bấm lại nhé, thông tin đã nhập vẫn còn nguyên.'

test('đăng nhập: mất mạng → câu mới, email + mật khẩu còn nguyên', async ({ page }) => {
  await page.goto('/dang-nhap')
  await waitForHydration(page, 'main form button[type="submit"]')
  const main = page.getByRole('main')
  await main.getByLabel('Email').fill('khach@example.com')
  await main.getByLabel('Mật khẩu', { exact: true }).fill('mat-khau-bat-ky')
  await failServerActions(page, '**/dang-nhap')
  await main.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(main.getByRole('alert')).toHaveText(NETWORK)
  await expect(main.getByLabel('Email')).toHaveValue('khach@example.com')
  await expect(main.getByLabel('Mật khẩu', { exact: true })).toHaveValue('mat-khau-bat-ky')
  await expect(page.getByTestId('error-page')).toHaveCount(0)
})

test('đăng ký: mất mạng → câu mới, họ tên + email + mật khẩu còn nguyên', async ({ page }) => {
  await page.goto('/dang-ky')
  await waitForHydration(page, 'main form button[type="submit"]')
  const main = page.getByRole('main')
  await main.getByLabel('Họ và tên').fill('Khách Mất Mạng')
  await main.getByLabel('Email').fill('khach-mat-mang@example.com')
  await main.getByLabel('Mật khẩu', { exact: true }).fill('Mat-khau-du-dai-1')
  await failServerActions(page, '**/dang-ky')
  await main.getByRole('button', { name: 'Đăng ký' }).click()
  await expect(main.getByRole('alert')).toHaveText(NETWORK)
  await expect(main.getByLabel('Họ và tên')).toHaveValue('Khách Mất Mạng')
  await expect(main.getByLabel('Email')).toHaveValue('khach-mat-mang@example.com')
  await expect(main.getByLabel('Mật khẩu', { exact: true })).toHaveValue('Mat-khau-du-dai-1')
})
