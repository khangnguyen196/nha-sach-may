import { test as base, expect, type Page } from '@playwright/test'
import type { E2eUser } from '../scripts/e2e-user'
import { adminStatePath, readAdminCredentials } from './auth'
import { waitForHydration } from './helpers'

/** Test admin: phiên đăng nhập sẵn của user admin theo project (desktop-admin / mobile-admin) */
export const adminTest = base.extend<{ admin: E2eUser }>({
  admin: async ({}, provide, testInfo) => {
    const admin = readAdminCredentials()[testInfo.project.name]
    if (!admin) throw new Error(`Không có admin e2e cho project ${testInfo.project.name}`)
    await provide(admin)
  },
  storageState: async ({}, provide, testInfo) => provide(adminStatePath(testInfo.project.name)),
})

/** Trang admin stream nội dung sau cổng kiểm tra quyền → locator đặt trong <main> */
export const main = (page: Page) => page.getByRole('main')

/** Mở trang sửa sách, chờ form hydrate (lỗi hiện tại chỗ thay vì POST cả trang) */
export async function openBookEditor(page: Page, bookId: number) {
  await page.goto(`/admin/sach/${bookId}`)
  await expect(main(page).getByRole('heading', { name: 'Sửa sách', level: 1 })).toBeVisible()
  await waitForHydration(page, 'main form button[type="submit"]')
}

/** Bấm nút lưu của form chính trang sửa sách và chờ thông báo đã lưu */
export async function saveBook(page: Page) {
  await main(page).getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(main(page).getByRole('status').filter({ hasText: 'Đã lưu.' })).toBeVisible({ timeout: 15_000 })
}
