import { expect, test, type Locator, type Page } from '@playwright/test'
import { badge } from './cart'
import { openChat } from './chat'
import { openPalette } from './helpers'
import { expectReadableInputs } from './inputs'

// Ô nhập ≥ 16px trên mobile (iOS Safari tự phóng to nếu nhỏ hơn). Khách chưa đăng nhập; trang cần tài khoản ở
// inputs-account.spec.ts. Chỉ project mobile: desktop (≥ 640px) giữ cỡ chữ cũ.
test.beforeEach(({ isMobile }) => {
  test.skip(!isMobile, 'iOS chỉ tự phóng to trên điện thoại')
})

// Đo phải trúng ô của nội dung thật: /tim-kiem có fallback là cùng SearchForm (search/page.tsx), 3 trang auth có form
// trong khung tĩnh; /sach có fallback CatalogSkeleton (không có ô) → chờ dòng đếm kết quả, chỉ có ở nội dung thật.
const READY: Record<string, (page: Page) => Locator> = {
  '/sach': (page) => page.getByRole('main').getByText(/\d+ cuốn sách/),
}

for (const path of ['/tim-kiem', '/sach', '/dang-nhap', '/dang-ky', '/quen-mat-khau']) {
  test(`ô nhập ở ${path} ≥ 16px`, async ({ page }) => {
    await page.goto(path)
    const ready = READY[path]
    if (ready) await expect(ready(page)).toBeVisible()
    await expectReadableInputs(page.getByRole('main'), path)
  })
}

test('ô nhập chat ≥ 16px', async ({ page }) => {
  await page.goto('/')
  const panel = await openChat(page)
  await expectReadableInputs(panel, 'khung chat')
})

test('ô tìm kiếm của palette ≥ 16px', async ({ page }) => {
  await page.goto('/')
  const palette = await openPalette(page)
  await expectReadableInputs(palette, 'palette')
})

test('ô số lượng ở giỏ khách ≥ 16px', async ({ page }) => {
  await page.goto('/sach/sapiens')
  await page.getByRole('main').getByRole('button', { name: 'Thêm vào giỏ' }).click()
  await expect(badge(page)).toHaveText('1')
  await page.goto('/gio-hang')
  // Fallback CartSkeleton không có ô; dòng giỏ khách chỉ có sau khi đọc localStorage ở client
  await expect(page.getByRole('main').getByRole('link', { name: 'Sapiens', exact: true })).toBeVisible()
  await expectReadableInputs(page.getByRole('main'), 'giỏ hàng')
})
