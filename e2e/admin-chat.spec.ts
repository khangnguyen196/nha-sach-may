import { expect } from '@playwright/test'
import { adminTest as test, main } from './admin'
import { bubble } from './chat'

// Admin là root layout khác, chỉ tiếng Việt: không có bong bóng chat (desktop-admin)

for (const path of ['/admin', '/admin/sach']) {
  test(`không có bong bóng chat ở ${path}`, async ({ page }) => {
    await page.goto(path)
    await expect(main(page)).toBeVisible()
    await expect(bubble(page)).toHaveCount(0)
  })
}
