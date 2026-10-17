import { expect, type Page } from '@playwright/test'
import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import {
  bookRow,
  cleanupE2eAdminData,
  coverExists,
  coverPublicBase,
  createE2eAuthor,
  createE2eBook,
  createE2eCategory,
  downloadCover,
  seedCover,
  type E2eAdminBook,
  type E2eCategory,
} from '../scripts/e2e-user'
import { adminTest as test, main, openBookEditor, saveBook } from './admin'
import { waitForHydration } from './helpers'

// Sửa sách trong admin → trang công khai đổi ngay (updateTag). Không đụng sách thật: sách / danh mục / tác giả test
// (slug e2e-admin-…) tạo bằng service role. Danh mục test: gốc ẩn + 2 con đang hiện → có trang danh mục nhưng không lên
// menu. Danh mục tạo bằng service role không làm mới cache danh mục của Next → lưu lại một danh mục qua admin
// (touchCategories) trước khi mở trang danh mục công khai.

test.describe.configure({ mode: 'serial' })

let categoryA: E2eCategory
let categoryB: E2eCategory
let book: E2eAdminBook
let other: E2eAdminBook
let author: { id: number; slug: string; name: string }
const slugs: string[] = []

test.beforeAll(async () => {
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  categoryA = await createE2eCategory({ parentId: root.id })
  categoryB = await createE2eCategory({ parentId: root.id })
  slugs.push(categoryA.slug, categoryB.slug)
  book = await createE2eBook({ categoryId: categoryA.id, price: 80_000, stock: 10 })
  other = await createE2eBook({ categoryId: categoryA.id, active: false })
  slugs.push(book.slug, other.slug)
  author = await createE2eAuthor()
  slugs.push(author.slug)
})

test.afterAll(async () => {
  await cleanupE2eAdminData(slugs)
})

const bookCard = (page: Page) => main(page).locator(`a[href="/sach/${book.slug}"]`)

async function touchCategories(page: Page) {
  await page.goto(`/admin/danh-muc/${categoryA.id}`)
  await waitForHydration(page, 'main form button[type="submit"]')
  await main(page).getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(main(page).getByRole('status').filter({ hasText: 'Đã lưu.' })).toBeVisible({ timeout: 15_000 })
}

test('sửa giá + tồn kho → trang sách công khai cập nhật ngay', async ({ page }) => {
  await page.goto(`/sach/${book.slug}`)
  await expect(main(page).getByText(/^80\.000\s₫$/).first()).toBeVisible()
  await expect(main(page).getByText('Còn hàng')).toBeVisible()

  await openBookEditor(page, book.id)
  await main(page).getByLabel('Giá bán (₫)').fill('95.000')
  await main(page).getByLabel('Tồn kho').fill('3')
  await saveBook(page)
  expect(await bookRow(book.id)).toMatchObject({ price: 95_000, stock: 3 })

  await page.goto(`/sach/${book.slug}`)
  await expect(main(page).getByText(/^95\.000\s₫$/).first()).toBeVisible()
  await expect(main(page).getByText('Chỉ còn 3 cuốn')).toBeVisible()
})

test('ẩn → trang sách 404 và mất khỏi danh mục; hiện lại → có lại', async ({ page }) => {
  await touchCategories(page)
  await page.goto(`/danh-muc/${categoryA.slug}`)
  await expect(bookCard(page)).toBeVisible()

  await openBookEditor(page, book.id)
  await main(page).getByRole('button', { name: 'Ẩn sách' }).click()
  await expect(main(page).getByText(/Sách đang ẩn/)).toBeVisible({ timeout: 15_000 })
  expect((await bookRow(book.id))?.is_active).toBe(false)
  // Đang ẩn: "Xem trên cửa hàng" không còn là link (trang cửa hàng 404)
  await openBookEditor(page, book.id)
  await expect(main(page).getByTestId('shop-link-hidden')).toContainText('Đang ẩn, khách không thấy')
  await expect(main(page).getByRole('link', { name: /Xem trên cửa hàng/ })).toHaveCount(0)

  await page.goto(`/sach/${book.slug}`)
  await expect(main(page).getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
  await page.goto(`/danh-muc/${categoryA.slug}`)
  await expect(main(page).getByRole('heading', { level: 1 })).toHaveText(categoryA.name)
  await expect(bookCard(page)).toHaveCount(0)

  await openBookEditor(page, book.id)
  await main(page).getByRole('button', { name: 'Hiện lại' }).click()
  await expect(main(page).getByText('Sách đang hiện trên cửa hàng.')).toBeVisible({ timeout: 15_000 })
  await openBookEditor(page, book.id)
  await expect(main(page).getByRole('link', { name: /Xem trên cửa hàng/ })).toHaveAttribute('href', `/sach/${book.slug}`)

  await page.goto(`/sach/${book.slug}`)
  await expect(main(page).getByRole('heading', { level: 1 })).toHaveText(book.title)
  await page.goto(`/danh-muc/${categoryA.slug}`)
  await expect(bookCard(page)).toBeVisible()
})

test('đổi danh mục + gắn tác giả → danh mục mới có sách, danh mục cũ không; trang sách hiện tác giả', async ({ page }) => {
  await touchCategories(page)
  await page.goto(`/danh-muc/${categoryB.slug}`)
  await expect(main(page).getByRole('heading', { level: 1 })).toHaveText(categoryB.name)
  await expect(bookCard(page)).toHaveCount(0)

  await openBookEditor(page, book.id)
  await main(page).getByLabel('Danh mục', { exact: true }).selectOption({ label: categoryB.name })
  await main(page).getByLabel('Tác giả, dòng 1').selectOption({ label: author.name })
  await saveBook(page)
  expect(await bookRow(book.id)).toMatchObject({
    category_id: categoryB.id,
    book_authors: [{ author_id: author.id, role: 'author' }],
  })

  await page.goto(`/danh-muc/${categoryB.slug}`)
  await expect(bookCard(page)).toBeVisible()
  await page.goto(`/danh-muc/${categoryA.slug}`)
  await expect(main(page).getByRole('heading', { level: 1 })).toHaveText(categoryA.name)
  await expect(bookCard(page)).toHaveCount(0)
  await page.goto(`/sach/${book.slug}`)
  await expect(main(page).getByRole('link', { name: author.name })).toBeVisible()
})

test('lỗi tại ô: giá gốc nhỏ hơn giá bán, slug trùng sách khác', async ({ page }) => {
  await openBookEditor(page, book.id)
  await main(page).getByLabel('Giá gốc (₫)').fill('1000')
  await main(page).getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(main(page).getByText('Giá gốc phải lớn hơn hoặc bằng giá bán.')).toBeVisible()
  await expect(main(page).getByLabel('Giá gốc (₫)')).toHaveAttribute('aria-invalid', 'true')

  await main(page).getByLabel('Giá gốc (₫)').fill('')
  await main(page).getByLabel('Đường dẫn (slug)').fill(other.slug)
  await main(page).getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(main(page).getByText('Đường dẫn này đã được dùng, hãy chọn đường dẫn khác.')).toBeVisible()
  expect((await bookRow(book.id))?.slug).toBe(book.slug)
})

/** JPEG nhiễu (nén kém) ~1–2MB, lớn hơn 600px */
const noisyJpeg = (width: number, height: number) =>
  sharp(randomBytes(width * height * 3), { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer()

test('bìa: JPEG lớn → WebP 600px tên mới, bìa cũ bị xóa, trang sách hiện bìa mới', async ({ page }) => {
  const oldPath = await seedCover(book.id, await sharp(await noisyJpeg(120, 180)).webp().toBuffer())
  const jpeg = await noisyJpeg(1000, 1500)
  expect(jpeg.length).toBeGreaterThan(900_000)

  await openBookEditor(page, book.id)
  await main(page).getByLabel('Ảnh mới').setInputFiles({ name: 'bia.jpg', mimeType: 'image/jpeg', buffer: jpeg })
  await main(page).getByRole('button', { name: 'Tải ảnh lên' }).click()
  await expect(main(page).getByText('Đã cập nhật ảnh bìa.')).toBeVisible({ timeout: 30_000 })

  const coverUrl = (await bookRow(book.id))?.cover_url ?? ''
  const base = coverPublicBase()
  expect(coverUrl.startsWith(base)).toBe(true)
  const path = coverUrl.slice(base.length)
  expect(path).toMatch(new RegExp(`^${book.id}-[0-9a-f]{8}\\.webp$`))
  const { format, width } = await sharp(await downloadCover(path)).metadata()
  expect({ format, width }).toEqual({ format: 'webp', width: 600 })
  // Ảnh cũ xóa trong after() của action, sau khi đã trả phản hồi
  await expect.poll(() => coverExists(oldPath), { timeout: 10_000 }).toBe(false)

  await page.goto(`/sach/${book.slug}`)
  await expect(main(page).getByRole('img', { name: book.title })).toHaveAttribute('src', new RegExp(encodeURIComponent(path)))
})

test('bìa: file .png là văn bản → không phải ảnh; file > 4MB → quá lớn, không upload gì', async ({ page }) => {
  const before = (await bookRow(book.id))?.cover_url
  await openBookEditor(page, book.id)
  const file = main(page).getByLabel('Ảnh mới')

  await file.setInputFiles({ name: 'bia.png', mimeType: 'image/png', buffer: Buffer.from('không phải ảnh') })
  await main(page).getByRole('button', { name: 'Tải ảnh lên' }).click()
  await expect(main(page).getByText('Tệp không phải ảnh JPEG, PNG, WebP hoặc AVIF.')).toBeVisible()

  await file.setInputFiles({ name: 'lon.jpg', mimeType: 'image/jpeg', buffer: randomBytes(4.2 * 1024 * 1024) })
  await expect(main(page).getByText('Ảnh tối đa 4MB.')).toBeVisible()
  await main(page).getByRole('button', { name: 'Tải ảnh lên' }).click()
  await expect(main(page).getByText('Ảnh tối đa 4MB.')).toBeVisible()

  expect((await bookRow(book.id))?.cover_url).toBe(before)
})

test('danh sách: tìm không dấu ra đúng sách; % không khớp mọi sách', async ({ page }) => {
  const query = book.title.toLowerCase().replace('sách', 'sach')
  await page.goto(`/admin/sach?q=${encodeURIComponent(query)}`)
  await expect(main(page).getByRole('status').filter({ hasText: /sách$/ })).toHaveText('1 sách')
  await expect(main(page).getByRole('link', { name: book.title })).toBeVisible()

  await page.goto(`/admin/sach?q=${encodeURIComponent('%')}`)
  await expect(main(page).getByRole('status').filter({ hasText: /sách$/ })).toHaveText('0 sách')
})
