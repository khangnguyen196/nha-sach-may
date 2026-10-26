import { expect, type Page } from '@playwright/test'
import type { E2eBook } from '../scripts/e2e-user'
import { waitForHydration } from './helpers'

export const vnd = (value: number, locale: 'vi' | 'en' = 'vi') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)

export const badge = (page: Page) => page.getByRole('banner').getByTestId('cart-count')

export async function readGuestCart(page: Page) {
  return page.evaluate(() => localStorage.getItem('nsm-cart-v1'))
}

/**
 * Nút "Thêm vào giỏ" của trang sách. Trang sách của thành viên còn có các form của khối Sở thích (nút chặn, bỏ chặn,
 * ẩn cảnh báo) nên không dùng bộ chọn chung `main form button[type="submit"]`. Dùng được cho cả waitForHydration
 * (document.querySelector: phần tử khớp đầu tiên, kể cả bản ẩn Activity của trang trước) lẫn page.locator.
 */
export const ADD_TO_CART_SUBMIT = 'main [data-testid="add-to-cart"] button[type="submit"]'

/** Nút "Thêm vào giỏ" đang hiển thị (bỏ bản ẩn Activity của trang trước nếu có) */
export const addToCartButton = (page: Page) => page.locator(ADD_TO_CART_SUBMIT).filter({ visible: true })

/**
 * Mở trang sách, bấm "Thêm vào giỏ" `times` lần. Mỗi lần chờ badge tăng VÀ nút hết "Đang thêm…": badge của
 * người đã đăng nhập tăng optimistic trước khi action ghi xong DB, chuyển trang ngay thì giỏ chưa kịp có sách.
 */
export async function addFromBookPage(page: Page, book: E2eBook, { times = 1, startAt = 0, path = '/sach' } = {}) {
  await page.goto(`${path}/${book.slug}`)
  await waitForHydration(page, ADD_TO_CART_SUBMIT)
  const button = addToCartButton(page)
  for (let i = 1; i <= times; i++) {
    await button.click()
    await expect(badge(page)).toHaveText(String(startAt + i))
    await expect(button).toHaveText(/Thêm vào giỏ|Add to cart/)
    await expect(page.getByRole('main').getByText(/Đã thêm vào giỏ|Added to cart/)).toBeVisible()
  }
}
