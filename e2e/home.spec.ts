import { expect, test, type Page } from '@playwright/test'
import { collectErrors, waitForHydration } from './helpers'

// Trang chủ (Phase 8): hero → kệ Nổi bật / Bán chạy (ẩn khi ít sách) → Mới về (sách tiếng Việt) → Sách ngoại văn →
// Danh mục. Không giả định sách cụ thể: lấy sách từ kệ rồi mở trang sách để kiểm tra ngôn ngữ.

const shelf = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
const shelfBooks = (page: Page, name: string) => shelf(page, name).locator('a[href^="/sach/"], a[href^="/en/books/"]')

async function headingOrder(page: Page) {
  return page.getByRole('main').getByRole('heading', { level: 2 }).allTextContents()
}

async function bookLanguage(page: Page, href: string) {
  await page.goto(href)
  const details = page.getByRole('region', { name: /Thông tin chi tiết|Details/ })
  return details.locator('dt', { hasText: /^(Ngôn ngữ|Language)$/ }).locator('xpath=following-sibling::dd[1]').textContent()
}

test('thứ tự kệ: Nổi bật, Bán chạy (nếu có) → Mới về → Sách ngoại văn → Danh mục', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  const order = await headingOrder(page)
  const index = (name: string) => order.indexOf(name)

  expect(index('Mới về')).toBeGreaterThanOrEqual(0)
  expect(index('Sách ngoại văn')).toBeGreaterThan(index('Mới về'))
  expect(index('Danh mục')).toBeGreaterThan(index('Sách ngoại văn'))
  // Kệ ẩn khi ít sách (Nổi bật < 4, Bán chạy < 6); có thì phải đứng trước Mới về
  for (const name of ['Nổi bật', 'Bán chạy']) {
    if (index(name) >= 0) expect(index(name), name).toBeLessThan(index('Mới về'))
  }
  for (const name of ['Nổi bật', 'Bán chạy']) {
    const count = await shelfBooks(page, name).count()
    expect(count === 0 || count >= (name === 'Nổi bật' ? 4 : 6), name).toBe(true)
  }
  expect(await shelfBooks(page, 'Mới về').count()).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

test('Mới về là sách tiếng Việt, Sách ngoại văn là sách tiếng Anh', async ({ page }) => {
  await page.goto('/')
  const viHrefs = await shelfBooks(page, 'Mới về').evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''))
  const enHrefs = await shelfBooks(page, 'Sách ngoại văn').evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''))
  expect(viHrefs.length).toBeGreaterThan(0)
  expect(enHrefs.length).toBeGreaterThan(0)
  // Hai kệ không có sách chung
  expect(viHrefs.filter((href) => enHrefs.includes(href))).toEqual([])

  for (const href of [viHrefs[0], viHrefs.at(-1)]) expect(await bookLanguage(page, href ?? ''), href).toBe('Tiếng Việt')
  for (const href of [enHrefs[0], enHrefs.at(-1)]) expect(await bookLanguage(page, href ?? ''), href).toBe('Tiếng Anh')
})

test('CTA hero → Tất cả sách; "Xem tất cả" của kệ trỏ đúng trang', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(shelf(page, 'Mới về').getByRole('link', { name: 'Xem tất cả' })).toHaveAttribute(
    'href',
    '/sach?lang=vi&sort=newest',
  )
  await expect(shelf(page, 'Sách ngoại văn').getByRole('link', { name: 'Xem tất cả' })).toHaveAttribute(
    'href',
    '/danh-muc/sach-ngoai-van',
  )

  await page.getByRole('main').getByRole('link', { name: 'Xem tất cả sách' }).click()
  await expect(page).toHaveURL(/\/sach$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tất cả sách' })).toBeVisible()
  await expect(page.getByRole('main').locator('a[href^="/sach/"]').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('Tất cả sách: lọc ngôn ngữ, sắp xếp, phân trang qua URL', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/sach?lang=en&sort=newest')
  const status = page.getByRole('main').getByRole('status').filter({ visible: true })
  await expect(status).toHaveText(/\d+ cuốn sách/)
  const english = Number((await status.textContent())?.replace(/\D/g, ''))

  await page.goto('/sach')
  await expect(status).toHaveText(/\d+ cuốn sách/)
  const all = Number((await status.textContent())?.replace(/\D/g, ''))
  expect(english).toBeGreaterThan(0)
  expect(english).toBeLessThan(all)

  // Hơn 24 cuốn → có trang 2
  await page.getByRole('navigation', { name: 'Phân trang' }).getByRole('link', { name: 'Trang sau' }).click()
  await expect(page).toHaveURL(/\/sach\?page=2$/)
  await expect(page.getByRole('main').locator('a[href^="/sach/"]').filter({ visible: true }).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('nút kệ cuộn được trên desktop, ẩn trên mobile', async ({ page, isMobile }) => {
  await page.goto('/')
  const next = shelf(page, 'Mới về').getByRole('button', { name: 'Cuộn kệ sang phải' })
  const list = shelf(page, 'Mới về').getByRole('list')
  if (isMobile) {
    await expect(next).toBeHidden()
    return
  }
  await waitForHydration(page, '#new-arrivals-list')
  await expect(next).toBeVisible()
  const previous = shelf(page, 'Mới về').getByRole('button', { name: 'Cuộn kệ sang trái' })
  await expect(previous).toBeDisabled()
  await next.click()
  await expect.poll(() => list.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
  await expect(previous).toBeEnabled()
})

test('/en cùng bố cục, CTA → /en/books', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/en')
  const order = await headingOrder(page)
  expect(order.indexOf('New arrivals')).toBeGreaterThanOrEqual(0)
  expect(order.indexOf('Foreign Books')).toBeGreaterThan(order.indexOf('New arrivals'))
  expect(order.indexOf('Categories')).toBeGreaterThan(order.indexOf('Foreign Books'))
  await page.getByRole('main').getByRole('link', { name: 'Browse all books' }).click()
  await expect(page).toHaveURL(/\/en\/books$/)
  await expect(page.getByRole('heading', { level: 1, name: 'All books' })).toBeVisible()
  expect(errors).toEqual([])
})
