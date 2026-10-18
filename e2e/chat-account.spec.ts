import { test as base, expect } from '@playwright/test'
import { storageStatePath } from './auth'
import { ask, bubble, openChat } from './chat'

// Chatbot Mây khi đã đăng nhập (phiên chính của project, chỉ đọc: không đổi giỏ / đơn của user này).
// Tên file kết thúc bằng account.spec.ts → khớp ACCOUNT_SPECS, chạy ở desktop-account + mobile-account.
const test = base.extend({
  storageState: async ({}, provide, testInfo) => provide(storageStatePath(testInfo.project.name)),
})

test('đã đăng nhập: hỏi được (đếm lượt theo tài khoản)', async ({ page }) => {
  await page.goto('/')
  const panel = await openChat(page)
  const reply = await ask(panel, 'Gợi ý sách lịch sử')
  await expect(reply).toHaveAttribute('data-testid', 'chat-reply')
})

test('trang thanh toán không có bong bóng (kể cả sau khi chuyển trang từ trang có bong bóng)', async ({ page }) => {
  await page.goto('/gio-hang')
  await expect(bubble(page)).toBeVisible()
  await page.goto('/thanh-toan')
  await expect(page).toHaveURL(/\/thanh-toan$/)
  await expect(page.getByRole('main')).toBeVisible()
  await expect(bubble(page)).toHaveCount(0)
})
