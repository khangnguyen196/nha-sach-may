import { expect } from '@playwright/test'
import {
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  insertReview,
  reviewsOf,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'
import { adminTest as test, main } from './admin'
import { collectErrors, waitForHydration } from './helpers'

// Kiểm duyệt đánh giá: đánh giá tạo sẵn bằng service role (bỏ qua điều kiện "đã nhận sách", đã có test riêng ở
// reviews.spec) trên sách e2e riêng; admin lọc theo sao và gỡ qua UI.

test.describe.configure({ mode: 'serial' })

let author: E2eUser
let book: E2eAdminBook
const slugs: string[] = []

test.beforeAll(async () => {
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  book = await createE2eBook({ categoryId: leaf.id })
  slugs.push(book.slug)
  author = await createE2eUser('admin-reviews')
})

test.afterAll(async () => {
  if (author) await deleteE2eUsers([author.id])
  await cleanupE2eAdminData(slugs)
})

test('lọc theo số sao → gỡ đánh giá: mất khỏi danh sách và khỏi trang sách', async ({ page }) => {
  test.setTimeout(60_000)
  const errors = collectErrors(page)
  const content = `Nội dung không phù hợp ${book.slug} (e2e)`
  await insertReview(book.id, author.id, 1, content)

  await page.goto('/admin/danh-gia?sao=1')
  const item = main(page).getByTestId('admin-review').filter({ hasText: content })
  await expect(item).toHaveCount(1)
  await expect(item).toContainText(book.title)
  await page.goto('/admin/danh-gia?sao=5')
  await expect(main(page).getByTestId('admin-review').filter({ hasText: content })).toHaveCount(0)

  await page.goto(`/sach/${book.slug}`)
  await expect(main(page).getByTestId('review').filter({ hasText: content })).toHaveCount(1)

  await page.goto('/admin/danh-gia?sao=1')
  await waitForHydration(page, 'main [data-testid="admin-review"] button[type="submit"]')
  await item.getByRole('button', { name: 'Gỡ đánh giá' }).click()
  await expect(item).toHaveCount(0, { timeout: 15_000 })
  expect(await reviewsOf(book.id)).toEqual([])

  // updateTag(book:{id}): trang sách công khai không còn đánh giá
  await page.goto(`/sach/${book.slug}`)
  await expect(main(page).getByText('Chưa có đánh giá nào.')).toBeVisible()
  expect(errors).toEqual([])
})
