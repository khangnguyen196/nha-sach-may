import { expect, type Page } from '@playwright/test'

export function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

/**
 * collectErrors cho trang trả 404 thật: Chromium log "Failed to load resource" cho chính tài liệu 404 → bỏ dòng đó,
 * thay bằng ghi mọi response lỗi không phải điều hướng (chunk, RSC, prefetch…).
 */
export function collectErrorsAllow404(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) errors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.request().isNavigationRequest()) {
      errors.push(`${response.status()} ${response.url()}`)
    }
  })
  return errors
}

// Phím tắt chỉ có tác dụng sau hydration. Không bấm lặp tới khi mở: ⌘K là toggle, nếu chunk palette tải chậm
// thì lần bấm thứ hai đóng nó lại. React gắn `__reactProps$…` lên DOM node khi hydrate nút, nhưng listener ⌘K
// gắn trong useEffect, chạy sau khi cả cây hydrate xong: trang nhiều card (nhiều Link) + máy bận thì khoảng hở
// này đủ dài để phím bị nuốt → chờ thêm networkidle.
export async function openPalette(page: Page) {
  await waitForHydration(page, 'header button[aria-haspopup="dialog"]')
  await page.waitForLoadState('networkidle')
  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  return dialog
}

export async function waitForHydration(page: Page, selector: string) {
  await page.waitForFunction((sel) => {
    const element = document.querySelector(sel)
    return element !== null && Object.keys(element).some((key) => key.startsWith('__reactProps'))
  }, selector)
}

/** Form địa chỉ (Phase 4), dùng ở sổ địa chỉ và luồng "Thêm địa chỉ" từ trang thanh toán */
export async function fillAddress(
  page: Page,
  address: { name: string; phone: string; province: string; ward: string; street: string },
) {
  // Ô tỉnh nạp phường qua fetch trong onChange → phải chờ hydrate trước khi chọn
  await waitForHydration(page, 'main form select[name="province"]')
  await page.getByRole('main').getByLabel('Tên người nhận').fill(address.name)
  await page.getByRole('main').getByLabel('Số điện thoại').fill(address.phone)
  await page.getByRole('main').getByLabel('Tỉnh/Thành phố').selectOption({ label: address.province })
  const ward = page.getByRole('main').getByLabel('Phường/Xã')
  await expect(ward.locator('option', { hasText: address.ward })).toHaveCount(1)
  await ward.selectOption({ label: address.ward })
  await page.getByRole('main').getByLabel('Số nhà, tên đường').fill(address.street)
}
