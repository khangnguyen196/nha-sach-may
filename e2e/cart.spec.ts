import { expect, test } from '@playwright/test'
import { findBooksByStock, type E2eBook } from '../scripts/e2e-user'
import { addFromBookPage, badge, readGuestCart, vnd } from './cart'
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

test.describe('trang giỏ của khách', () => {
  const FREE_SHIP_FROM = 300_000
  const SHIPPING = 30_000

  test('tạm tính + phí ship từ quote_items, tăng tới mốc → miễn phí, tải lại giữ, xóa → rỗng', async ({ page }) => {
    const errors = collectErrors(page)
    // Sách rẻ hơn mốc freeship để thấy cả hai trạng thái
    const candidates = await findBooksByStock(10, 10_000, 20)
    const book = candidates.find((b) => b.price < FREE_SHIP_FROM && Math.ceil(FREE_SHIP_FROM / b.price) <= Math.min(b.stock, 99))
    test.skip(!book, 'Không có sách phù hợp')
    if (!book) return

    await addFromBookPage(page, book)
    await page.getByRole('main').getByRole('link', { name: 'Xem giỏ hàng' }).click()
    await expect(page).toHaveURL(/\/gio-hang$/)

    const line = page.getByTestId('cart-line')
    await expect(line).toHaveCount(1)
    await expect(line.getByRole('link', { name: book.title })).toBeVisible()
    await expect(page.getByTestId('cart-subtotal')).toHaveText(vnd(book.price))
    await expect(page.getByTestId('cart-shipping')).toHaveText(vnd(SHIPPING))
    await expect(page.getByTestId('cart-total')).toHaveText(vnd(book.price + SHIPPING))
    await expect(page.getByTestId('cart-free-ship')).toHaveText(
      `Mua thêm ${vnd(FREE_SHIP_FROM - book.price)} để được miễn phí giao hàng.`,
    )

    const target = Math.ceil(FREE_SHIP_FROM / book.price)
    const increase = line.getByRole('button', { name: `Tăng số lượng “${book.title}”` })
    for (let quantity = 2; quantity <= target; quantity++) {
      await increase.click()
      await expect(line.getByRole('spinbutton')).toHaveValue(String(quantity))
    }
    await expect(page.getByTestId('cart-subtotal')).toHaveText(vnd(book.price * target))
    await expect(page.getByTestId('cart-shipping')).toHaveText('Miễn phí')
    await expect(page.getByTestId('cart-free-ship')).toHaveText('Đơn của bạn được miễn phí giao hàng.')
    await expect(badge(page)).toHaveText(String(target))

    await page.reload()
    await expect(page.getByTestId('cart-line').getByRole('spinbutton')).toHaveValue(String(target))
    await expect(page.getByTestId('cart-subtotal')).toHaveText(vnd(book.price * target))

    await page.getByRole('button', { name: `Xóa “${book.title}” khỏi giỏ` }).click()
    await expect(page.getByText('Giỏ hàng đang trống')).toBeVisible()
    await expect(badge(page)).toHaveCount(0)
    expect(await readGuestCart(page)).toBeNull()
    expect(errors).toEqual([])
  })

  test('sách không còn bán → dòng "Ngừng bán", không tính tiền', async ({ page }) => {
    const [book] = await findBooksByStock(10, 10_000)
    if (!book) return
    await page.goto('/gio-hang')
    await page.evaluate(
      (items) => localStorage.setItem('nsm-cart-v1', JSON.stringify(items)),
      [
        { book_id: book.id, quantity: 1 },
        { book_id: 999_999_999, quantity: 3 },
      ],
    )
    await page.reload()
    await expect(page.getByTestId('cart-line')).toHaveCount(2)
    await expect(page.getByText('Ngừng bán', { exact: true })).toBeVisible()
    await expect(page.getByTestId('cart-subtotal')).toHaveText(vnd(book.price))

    await page.getByRole('button', { name: 'Xóa sách không còn bán khỏi giỏ' }).click()
    await expect(page.getByTestId('cart-line')).toHaveCount(1)
    expect(JSON.parse((await readGuestCart(page)) ?? 'null')).toEqual([{ book_id: book.id, quantity: 1 }])
  })

  test('/api/cart/guest: tham số sai → 400; hợp lệ → lines + quote, cache CDN ngắn', async ({ request }) => {
    const bad = await request.get('/api/cart/guest?items=12x0')
    expect(bad.status()).toBe(400)
    expect(await bad.json()).toEqual({ ok: false, code: 'INVALID_INPUT' })

    const [book] = await findBooksByStock(10, 10_000)
    if (!book) return
    const ok = await request.get(`/api/cart/guest?items=${book.id}x2`)
    expect(ok.status()).toBe(200)
    expect(ok.headers()['cache-control']).toContain('s-maxage=60')
    const body = await ok.json()
    expect(body.ok).toBe(true)
    expect(body.data.lines).toEqual([expect.objectContaining({ book_id: book.id, quantity: 2 })])
    expect(body.data.quote).toMatchObject({ item_count: 1, subtotal: book.price * 2, free_ship_from: FREE_SHIP_FROM })

    const empty = await request.get('/api/cart/guest?items=')
    expect((await empty.json()).data).toEqual({
      lines: [],
      quote: { item_count: 0, subtotal: 0, shipping_fee: 0, total: 0, free_ship_from: FREE_SHIP_FROM },
    })
  })
})
