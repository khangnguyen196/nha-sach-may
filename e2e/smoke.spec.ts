import { expect, test, type Page } from '@playwright/test'

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

test('/ là tiếng Việt, dark mặc định, có danh mục', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('heading', { name: 'Danh mục' })).toBeVisible()
  await expect(page.getByRole('main').getByText('Văn học', { exact: true }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('/en là tiếng Anh, tên danh mục dịch từ name_en', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible()
  await expect(page.getByRole('main').getByText('Literature', { exact: true }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('/vi chuyển về / (as-needed)', async ({ page }) => {
  await page.goto('/vi')
  await expect(page).toHaveURL(/\/$/)
})

test('theme light lưu lại sau khi tải lại, không lỗi hydration', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('theme', 'light'))
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/light/)
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
  const covers = page.getByRole('region', { name: 'Mới về' }).getByRole('img')
  await expect(covers.first()).toBeVisible()
  expect(await covers.count()).toBeGreaterThan(0)

  const first = covers.first()
  await first.scrollIntoViewIfNeeded()
  await expect.poll(() => first.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  const src = decodeURIComponent((await first.getAttribute('src')) ?? '')
  expect(src).toContain('/_next/image')
  expect(src).toContain('/storage/v1/object/public/book-covers/')
})
