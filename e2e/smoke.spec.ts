import { expect, test } from '@playwright/test'
import { collectErrors } from './helpers'

// Sáng là mặc định từ đợt trang-chu-khuyen-mai (trước: tối)
test('/ là tiếng Việt, light mặc định, có kệ danh mục', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
  await expect(page.locator('html')).toHaveClass(/\blight\b/)
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
  await expect(page.getByRole('main').getByRole('heading', { name: 'Văn học', level: 2, exact: true })).toBeVisible()
  // Chip danh mục con trong kệ Văn học
  await expect(
    page
      .getByRole('main')
      .getByRole('region', { name: 'Văn học', exact: true })
      .getByRole('link', { name: 'Tiểu thuyết', exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('/en là tiếng Anh, tên kệ danh mục dịch từ name_en', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('main').getByRole('heading', { name: 'Literature', level: 2, exact: true })).toBeVisible()
  // Chip danh mục con trong kệ Literature: tên danh mục con cũng lấy từ name_en
  await expect(
    page
      .getByRole('main')
      .getByRole('region', { name: 'Literature', exact: true })
      .getByRole('link', { name: 'Novels', exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('/vi chuyển về / (as-needed)', async ({ page }) => {
  await page.goto('/vi')
  await expect(page).toHaveURL(/\/$/)
})

// Theme khác mặc định (nay là dark) mới chứng minh được "lưu lại": giữ light thì test qua cả khi không đọc localStorage
test('theme dark lưu lại sau khi tải lại, không lỗi hydration', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('theme', 'dark'))
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  expect(errors).toEqual([])
})

test('đường dẫn lạ → 404 đúng ngôn ngữ', async ({ page }) => {
  const response = await page.goto('/en/khong-ton-tai')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

test('/admin chưa đăng nhập → về trang chủ', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/$/)
})

test('bìa sách tải từ Supabase Storage qua next/image', async ({ page }) => {
  await page.goto('/')
  // Bìa trong card có alt="" (tên sách ngay bên dưới) nên không có role img → tìm theo thẻ
  const covers = page.getByRole('region', { name: 'Mới về' }).locator('img')
  await expect(covers.first()).toBeVisible()
  expect(await covers.count()).toBeGreaterThan(0)

  const first = covers.first()
  await first.scrollIntoViewIfNeeded()
  await expect.poll(() => first.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  const src = decodeURIComponent((await first.getAttribute('src')) ?? '')
  expect(src).toContain('/_next/image')
  expect(src).toContain('/storage/v1/object/public/book-covers/')
})
