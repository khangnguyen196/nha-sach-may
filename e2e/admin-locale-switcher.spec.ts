import { expect, type Page } from '@playwright/test'
import {
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  type E2eAdminBook,
  type E2eCategory,
} from '../scripts/e2e-user'
import { adminTest as test, main } from './admin'
import { collectErrors, waitForHydration } from './helpers'

// LocaleSwitcher trên trang sách / danh mục tạo sau build (slug chưa prerender → App Shell + stream theo request).
// Bản sửa đầu của ux-messages mục 13 gọi usePathname() ở fallback Suspense ngoài: App Shell của slug chưa biết lỗi, trang
// sách / danh mục mới ra trang lỗi. Quy ước đã chốt: link đổi ngôn ngữ giữ nguyên trang, params và query.
// Dữ liệu test (slug e2e-admin-…) tạo bằng service role: gốc ẩn + con đang hiện (có trang danh mục, không lên menu).

test.describe.configure({ mode: 'serial' })

let category: E2eCategory
let book: E2eAdminBook
const slugs: string[] = []

test.beforeAll(async () => {
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  category = await createE2eCategory({ parentId: root.id })
  slugs.push(category.slug)
  book = await createE2eBook({ categoryId: category.id })
  slugs.push(book.slug)
})

test.afterAll(async () => {
  await cleanupE2eAdminData(slugs)
})

const switchToEnglish = (page: Page) => page.getByRole('link', { name: /Xem bằng tiếng Anh/ })
const switchToVietnamese = (page: Page) => page.getByRole('link', { name: /View in Vietnamese/ })

/** Trang hiện nội dung thật (tiêu đề đúng), không phải trang lỗi */
async function expectRendered(page: Page, heading: string) {
  await expect(main(page).getByRole('heading', { level: 1 })).toHaveText(heading)
  await expect(page.getByTestId('error-page')).toHaveCount(0)
}

test('trang sách tạo sau build: render bình thường, đổi ngôn ngữ giữ trang + query (cả hai chiều)', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(`/sach/${book.slug}?x=1`)
  await expectRendered(page, book.title)
  await expect(switchToEnglish(page)).toHaveAttribute('href', `/en/books/${book.slug}?x=1`)

  await waitForHydration(page, 'header a[hreflang="en"]')
  await switchToEnglish(page).click()
  await expect(page).toHaveURL(new RegExp(`/en/books/${book.slug}\\?x=1$`))
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expectRendered(page, book.title)
  await expect(switchToVietnamese(page)).toHaveAttribute('href', `/sach/${book.slug}?x=1`)
  expect(errors).toEqual([])
})

test('danh mục tạo sau build: render bình thường, đổi ngôn ngữ giữ trang + query', async ({ page }) => {
  // Danh mục tạo bằng service role không làm mới cache danh mục của Next → lưu lại qua admin trước
  await page.goto(`/admin/danh-muc/${category.id}`)
  await waitForHydration(page, 'main form button[type="submit"]')
  await main(page).getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(main(page).getByRole('status').filter({ hasText: 'Đã lưu.' })).toBeVisible({ timeout: 15_000 })

  const errors = collectErrors(page)
  await page.goto(`/danh-muc/${category.slug}?sort=price-asc`)
  await expectRendered(page, category.name)
  await expect(switchToEnglish(page)).toHaveAttribute('href', `/en/categories/${category.slug}?sort=price-asc`)

  await waitForHydration(page, 'header a[hreflang="en"]')
  await switchToEnglish(page).click()
  await expect(page).toHaveURL(new RegExp(`/en/categories/${category.slug}\\?sort=price-asc$`))
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expectRendered(page, category.name)
  expect(errors).toEqual([])
})
