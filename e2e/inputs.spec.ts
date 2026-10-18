import { expect, test } from '@playwright/test'
import { badge } from './cart'
import { openChat } from './chat'
import { openPalette } from './helpers'
import { expectReadableInputs } from './inputs'

// Ô nhập ≥ 16px trên mobile (iOS Safari tự phóng to nếu nhỏ hơn). Khách chưa đăng nhập; trang cần tài khoản ở
// inputs-account.spec.ts. Chỉ project mobile: desktop (≥ 640px) giữ cỡ chữ cũ.
test.beforeEach(({ isMobile }) => {
  test.skip(!isMobile, 'iOS chỉ tự phóng to trên điện thoại')
})

for (const path of ['/tim-kiem', '/sach', '/dang-nhap', '/dang-ky', '/quen-mat-khau']) {
  test(`ô nhập ở ${path} ≥ 16px`, async ({ page }) => {
    await page.goto(path)
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
  await expectReadableInputs(page.getByRole('main'), 'giỏ hàng')
})
