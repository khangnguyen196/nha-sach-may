import { expect, test } from '@playwright/test'
import {
  cleanupE2eAdminData,
  createE2eAuthor,
  createE2eBook,
  createE2eCategory,
  linkAuthor,
  type E2eAdminBook,
} from '../scripts/e2e-user'
import { collectErrors } from './helpers'

// Quy tắc ẩn danh mục (docs/plans/sau-ux.md mục 6, A1): sách thuộc danh mục không hiện (gốc ẩn + con đang hiện) không
// lên tìm kiếm, palette, trang tác giả; link trực tiếp vẫn mở được. Đối chứng: sách không có danh mục vẫn hiện (★6c giữ
// nguyên). Dữ liệu e2e-admin-… tạo bằng service role, mỗi worker một bộ, dọn đúng slug của mình.
// Danh mục tạo sau khi build không vào cache getCategories (cache 'max') → test này kiểm đường lọc được nối vào từng
// chỗ; logic cây danh mục (con của gốc ẩn) kiểm ở Vitest (listing.test.ts, utils.test.ts).
test.describe.configure({ mode: 'serial' })

let hidden: E2eAdminBook
let control: E2eAdminBook
let authorSlug: string
const slugs: string[] = []

// Tên sách test: "E2E sách <6 ký tự cuối của slug>" → 6 ký tự đó là từ khóa riêng của từng cuốn
const token = (book: E2eAdminBook) => book.slug.slice(-6)

test.beforeAll(async () => {
  const root = await createE2eCategory({ active: false })
  const leaf = await createE2eCategory({ parentId: root.id })
  hidden = await createE2eBook({ categoryId: leaf.id })
  control = await createE2eBook({ categoryId: null })
  const author = await createE2eAuthor()
  await linkAuthor(hidden.id, author.id)
  await linkAuthor(control.id, author.id)
  authorSlug = author.slug
  slugs.push(root.slug, leaf.slug, hidden.slug, control.slug, author.slug)
})

test.afterAll(async () => {
  await cleanupE2eAdminData(slugs)
})

test('trang tìm kiếm: sách thuộc danh mục ẩn không hiện, sách không có danh mục vẫn hiện', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(`/tim-kiem?q=${token(hidden)}`)
  await expect(page.getByRole('main').getByText(`Không tìm thấy sách nào cho “${token(hidden)}”`)).toBeVisible()
  await expect(page.getByRole('main').locator(`a[href="/sach/${hidden.slug}"]`)).toHaveCount(0)

  await page.goto(`/tim-kiem?q=${token(control)}`)
  await expect(page.getByRole('main').locator(`a[href="/sach/${control.slug}"]`).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('palette (/api/search): không gợi ý sách thuộc danh mục ẩn', async ({ request }) => {
  const slugsOf = async (q: string) => {
    const response = await request.get(`/api/search?${new URLSearchParams({ q })}`)
    expect(response.status()).toBe(200)
    const body: { ok: boolean; data?: { slug: string }[] } = await response.json()
    expect(body.ok).toBe(true)
    return (body.data ?? []).map((hit) => hit.slug)
  }
  expect(await slugsOf(token(hidden))).toEqual([])
  expect(await slugsOf(token(control))).toEqual([control.slug])
})

test('trang tác giả: chỉ liệt kê sách không thuộc danh mục ẩn', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(`/tac-gia/${authorSlug}`)
  await expect(page.getByRole('main').locator(`a[href="/sach/${control.slug}"]`).first()).toBeVisible()
  await expect(page.getByRole('main').locator(`a[href="/sach/${hidden.slug}"]`)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('link trực tiếp tới sách thuộc danh mục ẩn vẫn mở được (A1), không có kệ "Cùng danh mục"', async ({ page }) => {
  const errors = collectErrors(page)
  const response = await page.goto(`/sach/${hidden.slug}`)
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('main').getByRole('heading', { level: 1, name: hidden.title })).toBeVisible()
  await expect(page.getByRole('main').getByRole('button', { name: 'Thêm vào giỏ' })).toBeVisible()
  await expect(page.locator('#related-books')).toHaveCount(0)
  expect(errors).toEqual([])
})
