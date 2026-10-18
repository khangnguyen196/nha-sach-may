import { expect, test } from '@playwright/test'
import { createHiddenBook, deleteHiddenBooks } from '../scripts/e2e-user'
import { collectErrorsAllow404, waitForHydration } from './helpers'

// Trang 404 giải thích đúng thứ không có (proxy gắn loại trang vào request khi rewrite) + đường đi tiếp; vẫn HTTP 404.
const cases = [
  {
    path: '/sach/khong-ton-tai-e2e',
    text: 'Cuốn sách này không có hoặc đã ngừng bán. Bạn thử tìm tên sách hoặc xem các danh mục nhé.',
    links: [['Tìm sách', '/tim-kiem'], ['Xem danh mục', '/#categories-title']],
  },
  {
    path: '/en/books/khong-ton-tai-e2e',
    text: 'This book doesn’t exist or is no longer sold. Try searching for the title or browse categories.',
    links: [['Search books', '/en/search'], ['Browse categories', '/en#categories-title']],
  },
  {
    path: '/danh-muc/khong-ton-tai-e2e',
    text: 'Danh mục này không có hoặc đang tạm ẩn. Bạn xem các danh mục khác nhé.',
    links: [['Tìm sách', '/tim-kiem'], ['Xem danh mục', '/#categories-title']],
  },
  {
    path: '/tac-gia/khong-ton-tai-e2e',
    text: 'Không có tác giả này trong nhà sách. Bạn thử tìm theo tên nhé.',
    links: [['Tìm sách', '/tim-kiem'], ['Xem danh mục', '/#categories-title']],
  },
  {
    path: '/khong-co-trang-nay-e2e',
    text: 'Trang bạn tìm không có hoặc đã được chuyển đi. Bạn thử tìm sách hoặc xem danh mục nhé.',
    links: [['Tìm sách', '/tim-kiem'], ['Về trang chủ', '/']],
  },
] as const

for (const c of cases) {
  test(`404 ${c.path}: HTTP 404, câu giải thích đúng loại trang, link đi tiếp`, async ({ page }) => {
    const errors = collectErrorsAllow404(page)
    const response = await page.goto(c.path)
    expect(response?.status()).toBe(404)
    const view = page.getByRole('main').getByTestId('not-found')
    await expect(view).toContainText(c.text)
    for (const [name, href] of c.links) {
      await expect(view.getByRole('link', { name, exact: true })).toHaveAttribute('href', href)
    }
    await waitForHydration(page, `main [data-testid="not-found"] a[href="${c.links[0][1]}"]`)
    expect(errors).toEqual([])
  })
}

test('sách đang ẩn (ngừng bán) → HTTP 404 + câu "đã ngừng bán"', async ({ page }) => {
  const book = await createHiddenBook()
  try {
    const response = await page.goto(`/sach/${book.slug}`)
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('main').getByTestId('not-found')).toContainText('Cuốn sách này không có hoặc đã ngừng bán.')
  } finally {
    await deleteHiddenBooks(book.id)
  }
})
