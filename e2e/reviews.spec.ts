import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  deliverOrder,
  placeE2eOrder,
  reviewsOf,
  seedAddress,
  signedInClient,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'
import { login, NO_SESSION } from './auth'
import { collectErrors, waitForHydration } from './helpers'

// Đánh giá (Phase 9) trên sách e2e riêng (danh mục gốc ẩn), không đụng điểm của sách thật. Hai user riêng mỗi lần chạy:
// `buyer` có đơn đã giao chứa sách (đặt qua RPC, service role đưa tới delivered), `other` chưa mua. Xóa ở afterAll:
// deleteE2eUsers tự hoàn kho đơn delivered; xóa sách thì đánh giá xóa theo cascade.

test.describe.configure({ mode: 'serial' })
test.use({ storageState: NO_SESSION })

let buyer: E2eUser
let other: E2eUser
let book: E2eAdminBook
const slugs: string[] = []

test.beforeAll(async () => {
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  book = await createE2eBook({ categoryId: leaf.id, price: 90_000, stock: 10 })
  slugs.push(book.slug)
  ;[buyer, other] = await Promise.all([createE2eUser('reviews'), createE2eUser('reviews-other')])
  const addressId = await seedAddress(buyer.id)
  const order = await placeE2eOrder(await signedInClient(buyer), buyer.id, { addressId, bookId: book.id, quantity: 1 })
  await deliverOrder(order.id)
})

test.afterAll(async () => {
  await deleteE2eUsers([buyer, other].flatMap((user) => (user ? [user.id] : [])))
  await cleanupE2eAdminData(slugs)
})

/** Radio sao ẩn (sr-only) trong nhãn có icon: bấm vào nhãn như người dùng */
const star = (form: Locator, label: string) =>
  form.locator('label').filter({ has: form.page().getByRole('radio', { name: label }) })

const reviews = (page: Page) => page.getByRole('main').getByRole('region', { name: 'Đánh giá', exact: true })

async function openBook(page: Page) {
  await page.goto(`/sach/${book.slug}`)
  await expect(page.getByRole('heading', { level: 1, name: book.title })).toBeVisible()
}

test('chưa đăng nhập: chưa có đánh giá + link đăng nhập quay lại đúng trang sách', async ({ page }) => {
  const errors = collectErrors(page)
  await openBook(page)
  await expect(reviews(page).getByText('Chưa có đánh giá nào.')).toBeVisible()
  await expect(page.getByTestId('rating-summary')).toHaveCount(0)
  await expect(reviews(page).getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute(
    'href',
    `/dang-nhap?next=${encodeURIComponent(`/sach/${book.slug}`)}`,
  )
  expect(errors).toEqual([])
})

test('chưa nhận sách: không có form; gọi thẳng PostgREST cũng bị RLS chặn', async ({ page }) => {
  await login(page, other)
  await openBook(page)
  await expect(reviews(page).getByTestId('review-not-eligible')).toBeVisible()
  await expect(reviews(page).getByTestId('review-form')).toHaveCount(0)

  const client = await signedInClient(other)
  const { error } = await client.from('reviews').insert({ book_id: book.id, rating: 5, content: 'Chưa mua (e2e)' })
  expect(error?.code).toBe('42501')
  expect(await reviewsOf(book.id)).toEqual([])
})

test('đã nhận sách: viết → hiện trong danh sách + điểm trung bình; sửa; xóa', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = collectErrors(page)
  await login(page, buyer)
  await openBook(page)
  const form = reviews(page).getByTestId('review-form')
  await waitForHydration(page, 'main [data-testid="review-form"] button[type="submit"]')

  // Thiếu số sao → trình duyệt chặn (required); chọn 5 sao + nhận xét → lưu
  await star(form, '5 sao').click()
  await expect(form.getByRole('radio', { name: '5 sao' })).toBeChecked()
  await form.getByLabel('Nhận xét').fill('Sách hay, giao nhanh (e2e)')
  await form.getByRole('button', { name: 'Gửi đánh giá' }).click()
  await expect(reviews(page).getByRole('status').filter({ hasText: 'Đã lưu đánh giá.' })).toBeVisible({ timeout: 15_000 })
  const item = reviews(page).getByTestId('review')
  await expect(item).toHaveCount(1)
  await expect(item).toContainText('Sách hay, giao nhanh (e2e)')
  await expect(item).toContainText(buyer.fullName)
  await expect(page.getByTestId('rating-summary')).toContainText('5')
  await expect(page.getByTestId('rating-summary')).toContainText('1 đánh giá')
  expect(await reviewsOf(book.id)).toMatchObject([{ user_id: buyer.id, rating: 5, content: 'Sách hay, giao nhanh (e2e)' }])

  // Sửa: form hiện sẵn đánh giá của mình
  await expect(reviews(page).getByRole('heading', { name: 'Đánh giá của bạn' })).toBeVisible()
  await expect(form.getByRole('radio', { name: '5 sao' })).toBeChecked()
  await star(form, '3 sao').click()
  await form.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(page.getByTestId('rating-summary')).toContainText('3', { timeout: 15_000 })
  expect(await reviewsOf(book.id)).toMatchObject([{ rating: 3 }])

  await reviews(page).getByRole('button', { name: 'Xóa đánh giá' }).click()
  await expect(reviews(page).getByRole('status').filter({ hasText: 'Đã xóa đánh giá.' })).toBeVisible({ timeout: 15_000 })
  await expect(reviews(page).getByText('Chưa có đánh giá nào.')).toBeVisible()
  await expect(page.getByTestId('rating-summary')).toHaveCount(0)
  expect(await reviewsOf(book.id)).toEqual([])
  expect(errors).toEqual([])
})
