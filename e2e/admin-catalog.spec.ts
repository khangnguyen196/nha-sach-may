import { expect } from '@playwright/test'
import {
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  e2eAdminSlug,
  linkAuthor,
  unlinkAuthor,
  type E2eCategory,
} from '../scripts/e2e-user'
import { adminTest as test, main } from './admin'
import { waitForHydration } from './helpers'

// Danh mục và tác giả qua UI admin. Mọi dòng test có slug e2e-admin-… (ô slug điền tay), dọn theo slug sau mỗi test.
// Danh mục tạo qua UI nằm dưới một danh mục gốc ẩn: có trang danh mục nhưng không lên menu công khai.

test.describe.configure({ mode: 'serial' })

let root: E2eCategory
const slugs: string[] = []

test.beforeAll(async () => {
  root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
})

test.afterAll(async () => {
  await cleanupE2eAdminData(slugs)
})

const hiddenLabel = (category: E2eCategory) => `${category.name} (Đã ẩn)`

test('danh mục: tạo danh mục con, sửa tên tiếng Anh → /en/categories/<slug> hiện tên mới', async ({ page }) => {
  const slug = e2eAdminSlug()
  slugs.push(slug)
  const name = `E2E con ${slug.slice(-6)}`

  await page.goto('/admin/danh-muc/moi')
  await waitForHydration(page, 'main form button[type="submit"]')
  await main(page).getByLabel('Tên', { exact: true }).fill(name)
  await main(page).getByLabel('Đường dẫn (slug)').fill(slug)
  await main(page).getByLabel('Danh mục cha').selectOption({ label: hiddenLabel(root) })
  await main(page).getByRole('button', { name: 'Tạo' }).click()

  await expect(page).toHaveURL(/\/admin\/danh-muc$/)
  await main(page).getByRole('link', { name }).click()
  await expect(page).toHaveURL(/\/admin\/danh-muc\/\d+$/)
  await waitForHydration(page, 'main form button[type="submit"]')
  await main(page).getByLabel('Tên (tiếng Anh)').fill(`${name} EN`)
  await main(page).getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(main(page).getByRole('status').filter({ hasText: 'Đã lưu.' })).toBeVisible({ timeout: 15_000 })

  await page.goto(`/en/categories/${slug}`)
  await expect(main(page).getByRole('heading', { level: 1 })).toHaveText(`${name} EN`)
})

test('danh mục đang có sách không làm cha được', async ({ page }) => {
  const parent = await createE2eCategory({ active: false })
  slugs.push(parent.slug)
  const book = await createE2eBook({ categoryId: parent.id, active: false })
  slugs.push(book.slug)
  const slug = e2eAdminSlug()
  slugs.push(slug)

  await page.goto('/admin/danh-muc/moi')
  await waitForHydration(page, 'main form button[type="submit"]')
  await main(page).getByLabel('Tên', { exact: true }).fill(`E2E con ${slug.slice(-6)}`)
  await main(page).getByLabel('Đường dẫn (slug)').fill(slug)
  await main(page).getByLabel('Danh mục cha').selectOption({ label: hiddenLabel(parent) })
  await main(page).getByRole('button', { name: 'Tạo' }).click()

  await expect(main(page).getByText('Danh mục này đang có sách nên không làm cha được.')).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/danh-muc\/moi$/)
})

test('tác giả: tạo, sửa tiểu sử; còn sách thì không xóa được, hết sách thì xóa được', async ({ page }) => {
  const slug = e2eAdminSlug()
  slugs.push(slug)
  const name = `E2E Tác Giả ${slug.slice(-6)}`
  const category = await createE2eCategory({ parentId: root.id })
  slugs.push(category.slug)
  const book = await createE2eBook({ categoryId: category.id, active: false })
  slugs.push(book.slug)

  await page.goto('/admin/tac-gia/moi')
  await waitForHydration(page, 'main form button[type="submit"]')
  await main(page).getByLabel('Tên', { exact: true }).fill(name)
  await main(page).getByLabel('Đường dẫn (slug)').fill(slug)
  await main(page).getByRole('button', { name: 'Tạo' }).click()
  await expect(page).toHaveURL(/\/admin\/tac-gia$/)

  // Tìm theo tên (slug của test không chứa tên): mỗi từ khớp tên hoặc slug
  await page.goto(`/admin/tac-gia?q=${encodeURIComponent(`tác giả ${slug.slice(-6)}`)}`)
  await main(page).getByRole('link', { name }).click()
  await expect(page).toHaveURL(/\/admin\/tac-gia\/\d+$/)
  const authorId = Number(/(\d+)$/.exec(page.url())?.[1])

  await waitForHydration(page, 'main form button[type="submit"]')
  await main(page).getByLabel('Tiểu sử', { exact: true }).fill('Tiểu sử E2E.')
  await main(page).getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(main(page).getByRole('status').filter({ hasText: 'Đã lưu.' })).toBeVisible({ timeout: 15_000 })

  await linkAuthor(book.id, authorId)
  await page.reload()
  await waitForHydration(page, 'main form button[type="submit"]')
  await main(page).getByRole('button', { name: 'Xóa tác giả' }).click()
  await expect(main(page).getByRole('alert').filter({ hasText: 'Tác giả vẫn còn sách nên chưa xóa được.' })).toBeVisible()

  await unlinkAuthor(book.id, authorId)
  await page.reload()
  await waitForHydration(page, 'main form button[type="submit"]')
  await main(page).getByRole('button', { name: 'Xóa tác giả' }).click()
  await expect(page).toHaveURL(/\/admin\/tac-gia$/)
  await page.goto(`/admin/tac-gia/${authorId}`)
  await expect(main(page).getByRole('heading', { name: 'Không tìm thấy' })).toBeVisible()
})
