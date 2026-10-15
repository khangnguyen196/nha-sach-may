import { expect, type Page } from '@playwright/test'
import type { E2eBook } from '../scripts/e2e-user'
import { waitForHydration } from './helpers'

export const badge = (page: Page) => page.getByRole('banner').getByTestId('cart-count')

export async function readGuestCart(page: Page) {
  return page.evaluate(() => localStorage.getItem('nsm-cart-v1'))
}

/**
 * Mở trang sách, bấm "Thêm vào giỏ" `times` lần. Mỗi lần chờ badge tăng VÀ nút hết "Đang thêm…": badge của
 * người đã đăng nhập tăng optimistic trước khi action ghi xong DB, chuyển trang ngay thì giỏ chưa kịp có sách.
 */
export async function addFromBookPage(page: Page, book: E2eBook, { times = 1, startAt = 0, path = '/sach' } = {}) {
  await page.goto(`${path}/${book.slug}`)
  await waitForHydration(page, 'main form button[type="submit"]')
  const button = page.getByRole('main').locator('form button[type="submit"]')
  for (let i = 1; i <= times; i++) {
    await button.click()
    await expect(badge(page)).toHaveText(String(startAt + i))
    await expect(button).toHaveText(/Thêm vào giỏ|Add to cart/)
    await expect(page.getByRole('main').getByText(/Đã thêm vào giỏ|Added to cart/)).toBeVisible()
  }
}
