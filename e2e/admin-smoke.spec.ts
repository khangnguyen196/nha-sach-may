import { expect } from '@playwright/test'
import { cleanupE2eAdminData, createE2eBook, createE2eCategory, type E2eAdminBook } from '../scripts/e2e-user'
import { adminTest as test, main, openBookEditor, saveBook } from './admin'
import { collectErrors } from './helpers'

// Chạy ở cả desktop-admin và mobile-admin: tổng quan, danh sách sách, form sửa sách lưu được, trang không tràn ngang.
// Mỗi project một sách test riêng (trên CI hai project chạy song song).

let book: E2eAdminBook
const slugs: string[] = []

test.beforeAll(async () => {
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  book = await createE2eBook({ categoryId: leaf.id, active: false })
  slugs.push(book.slug)
})

test.afterAll(async () => {
  await cleanupE2eAdminData(slugs)
})

async function expectNoHorizontalScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test('tổng quan → danh sách sách (lọc sách ẩn) → sửa sách, lưu được', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/admin')
  await expect(main(page).getByRole('heading', { name: 'Tổng quan', level: 1 })).toBeVisible()
  await expect(main(page).getByText('Sách đang ẩn', { exact: true })).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.getByRole('navigation', { name: 'Khu quản trị' }).getByRole('link', { name: 'Sách' }).click()
  await expect(page).toHaveURL(/\/admin\/sach$/)
  await expect(main(page).getByRole('table')).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.goto(`/admin/sach?status=hidden&q=${encodeURIComponent(book.title)}`)
  await main(page).getByRole('link', { name: book.title }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/sach/${book.id}$`))

  await openBookEditor(page, book.id)
  await expectNoHorizontalScroll(page)
  await saveBook(page)
  expect(errors).toEqual([])
})

test('link "Quản trị" chỉ admin thấy: trang tài khoản, cạnh icon tài khoản ở header (từ sm)', async ({ page, baseURL }) => {
  const errors = collectErrors(page)
  const header = page.getByRole('banner')
  const headerLink = (name: string) => header.getByRole('link', { name, exact: true })

  // Dưới sm (640px) header không có chỗ cho nút thứ 6: chỉ còn link ở trang tài khoản, header không tràn ngang
  for (const width of [360, 375, 412]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/tai-khoan')
    await expect(main(page).getByRole('link', { name: /Quản trị cửa hàng/ })).toBeVisible()
    await expect(headerLink('Quản trị')).toBeHidden()
    await expectNoHorizontalScroll(page)
  }
  await main(page).getByRole('link', { name: /Quản trị cửa hàng/ }).click()
  await expect(page).toHaveURL(`${baseURL}/admin`)
  await expect(main(page).getByRole('heading', { name: 'Tổng quan', level: 1 })).toBeVisible()

  await page.setViewportSize({ width: 640, height: 800 })
  await page.goto('/en')
  await expect(headerLink('Admin')).toBeVisible()
  await expectNoHorizontalScroll(page)
  await headerLink('Admin').click()
  await expect(page).toHaveURL(`${baseURL}/admin`)
  expect(errors).toEqual([])
})
