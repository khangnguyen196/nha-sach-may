import { expect, type Page } from '@playwright/test'

export function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
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
