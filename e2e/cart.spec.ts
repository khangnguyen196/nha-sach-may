import { expect, test } from '@playwright/test'
import { findBooksByStock, type E2eBook } from '../scripts/e2e-user'
import { addFromBookPage, badge, readGuestCart } from './cart'
import { collectErrors, waitForHydration } from './helpers'

// Giỏ khách vãng lai (localStorage). Không cần SUPABASE_SERVICE_ROLE_KEY: sách test lấy bằng quyền anon.
// Mỗi test một context mới → localStorage rỗng.

test.describe('giỏ khách', () => {
  let book: E2eBook

  test.beforeAll(async () => {
    const [found] = await findBooksByStock(10, 10_000)
    if (!found) throw new Error('Không có sách tồn kho ≥ 10 để test')
    book = found
  })

  test('thêm ở trang sách → badge + thông báo, tải lại vẫn giữ giỏ', async ({ page }) => {
    const errors = collectErrors(page)
    await addFromBookPage(page, book, { times: 2 })
    await expect(page.getByRole('main').getByText('Đã thêm vào giỏ')).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'Xem giỏ hàng' })).toBeVisible()
    await expect(page.getByRole('banner').getByRole('link', { name: 'Giỏ hàng, 2 cuốn' })).toBeVisible()
    expect(JSON.parse((await readGuestCart(page)) ?? 'null')).toEqual([{ book_id: book.id, quantity: 2 }])

    await page.reload()
    await expect(badge(page)).toHaveText('2')
    expect(errors).toEqual([])
  })

  test('hai tab: thêm ở tab A → badge tab B cập nhật (sự kiện storage)', async ({ context }) => {
    const tabB = await context.newPage()
    await tabB.goto('/')
    await waitForHydration(tabB, 'header a[href="/gio-hang"]')
    await expect(badge(tabB)).toHaveCount(0)

    const tabA = await context.newPage()
    await addFromBookPage(tabA, book)
    await expect(badge(tabB)).toHaveText('1')
  })

  test('không vượt tồn kho', async ({ page }) => {
    const [lowStock] = await findBooksByStock(1, 5)
    test.skip(!lowStock, 'Không có sách tồn kho 1–5')
    if (!lowStock) return

    await addFromBookPage(page, lowStock, { times: lowStock.stock })
    await page.getByRole('main').getByRole('button', { name: 'Thêm vào giỏ' }).click()
    await expect(page.getByRole('main').getByText(`Giỏ đã có ${lowStock.stock} cuốn sách này`)).toBeVisible()
    await expect(badge(page)).toHaveText(String(lowStock.stock))
  })

  test('sách hết hàng → nút "Hết hàng" bị khóa', async ({ page }) => {
    const [soldOut] = await findBooksByStock(0, 0)
    test.skip(!soldOut, 'Không có sách hết hàng')
    if (!soldOut) return

    await page.goto(`/sach/${soldOut.slug}`)
    await expect(page.getByRole('main').getByRole('button', { name: 'Hết hàng' })).toBeDisabled()
    await expect(page.getByRole('main').getByRole('button', { name: 'Thêm vào giỏ' })).toHaveCount(0)
  })
})
