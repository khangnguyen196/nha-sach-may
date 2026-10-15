import { test as base, expect, type BrowserContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { cartQuantities, clearCart, findBooksByStock, type E2eBook } from '../scripts/e2e-user'
import { login, NO_SESSION, readCredentials, storageStatePath, type ProjectUsers } from './auth'
import { addFromBookPage, badge, readGuestCart, vnd } from './cart'
import { collectErrors, waitForHydration } from './helpers'

// Giỏ tài khoản + gộp giỏ khi đăng nhập. Mặc định dùng phiên đăng nhập sẵn của project (auth.setup.ts).
const test = base.extend<{ users: ProjectUsers }>({
  users: async ({}, provide, testInfo) => {
    const users = readCredentials()[testInfo.project.name]
    if (!users) throw new Error(`Không có user e2e cho project ${testInfo.project.name}`)
    await provide(users)
  },
  storageState: async ({}, provide, testInfo) => provide(storageStatePath(testInfo.project.name)),
})

// Cùng một giỏ tài khoản cho cả file → chạy tuần tự, mỗi test bắt đầu từ giỏ rỗng
test.describe.configure({ mode: 'serial' })

let books: E2eBook[]

test.beforeAll(async () => {
  books = await findBooksByStock(10, 10_000, 2)
  if (books.length < 2) throw new Error('Cần 2 sách tồn kho ≥ 10 để test')
})

test.beforeEach(async ({ users }) => {
  await clearCart(users.user.id)
})

test('thêm / đổi số lượng / xóa, tải lại vẫn đúng', async ({ page }) => {
  const errors = collectErrors(page)
  const [book] = books
  if (!book) return

  await addFromBookPage(page, book)
  await page.goto('/gio-hang')
  const line = page.getByTestId('cart-line')
  await expect(line).toHaveCount(1)
  await expect(line.getByRole('link', { name: book.title })).toBeVisible()
  await expect(page.getByTestId('cart-subtotal')).toHaveText(vnd(book.price))

  await waitForHydration(page, 'main [data-testid="cart-line"] button')
  await line.getByRole('button', { name: `Tăng số lượng “${book.title}”` }).click()
  await expect(line.getByRole('spinbutton')).toHaveValue('2')
  await expect(page.getByTestId('cart-subtotal')).toHaveText(vnd(book.price * 2))
  await expect(badge(page)).toHaveText('2')
  await expect(page.getByTestId('cart-shipping')).toHaveText(book.price * 2 >= 300_000 ? 'Miễn phí' : vnd(30_000))

  await page.reload()
  await expect(page.getByTestId('cart-line').getByRole('spinbutton')).toHaveValue('2')
  await expect(badge(page)).toHaveText('2')

  await waitForHydration(page, 'main [data-testid="cart-line"] button')
  await page.getByRole('button', { name: `Xóa “${book.title}” khỏi giỏ` }).click()
  await expect(page.getByText('Giỏ hàng đang trống')).toBeVisible()
  await expect(badge(page)).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Giỏ hàng đang trống')).toBeVisible()
  expect(errors).toEqual([])
})

test('vượt tồn kho → lỗi dịch sẵn ở server theo locale', async ({ page }) => {
  const [lowStock] = await findBooksByStock(1, 5)
  test.skip(!lowStock, 'Không có sách tồn kho 1–5')
  if (!lowStock) return

  const errors = collectErrors(page)
  // Nút của người đã đăng nhập không tự chặn ở client: lần bấm vượt tồn kho đi tới Server Action
  await addFromBookPage(page, lowStock, { times: lowStock.stock })
  await page.getByRole('main').getByRole('button', { name: 'Thêm vào giỏ' }).click()
  await expect(page.getByRole('main').getByText(`Sách "${lowStock.title}" chỉ còn ${lowStock.stock} cuốn.`)).toBeVisible()
  await expect(badge(page)).toHaveText(String(lowStock.stock))

  await page.goto(`/en/books/${lowStock.slug}`)
  await waitForHydration(page, 'main form button[type="submit"]')
  await page.getByRole('main').getByRole('button', { name: 'Add to cart' }).click()
  await expect(
    page.getByRole('main').getByText(`Only ${lowStock.stock} copies of "${lowStock.title}" are left.`),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('/en/cart hiện giá theo locale en', async ({ page }) => {
  const [book] = books
  if (!book) return
  await addFromBookPage(page, book)
  await page.goto('/en/cart')
  await expect(page.getByRole('heading', { level: 1, name: 'Cart' })).toBeVisible()
  await expect(page.getByTestId('cart-subtotal')).toHaveText(vnd(book.price, 'en'))
  expect(vnd(book.price, 'en')).toMatch(/^₫[\d,]+$/)
})

test('gộp giỏ khách khi đăng nhập, đăng xuất rồi đăng nhập lại vẫn còn', async ({ page, browser, baseURL, users }) => {
  const [first, second] = books
  if (!first || !second) return
  // Giỏ tài khoản có sẵn 1 cuốn sách đầu
  await addFromBookPage(page, first)

  const guest = await browser.newContext({ baseURL, storageState: NO_SESSION })
  const guestPage = await guest.newPage()
  const errors = collectErrors(guestPage)
  await addFromBookPage(guestPage, first)
  await addFromBookPage(guestPage, second, { startAt: 1 })

  await login(guestPage, users.user)
  await expect(badge(guestPage)).toHaveText('3')
  await expect.poll(() => readGuestCart(guestPage)).toBeNull()
  expect(await cartQuantities(users.user.id)).toEqual({ [first.id]: 2, [second.id]: 1 })

  await waitForHydration(guestPage, 'main form button[type="submit"]')
  await guestPage.getByRole('button', { name: 'Đăng xuất' }).click()
  await expect(guestPage).toHaveURL(/\/$/)
  await expect(guestPage.getByRole('banner').getByRole('link', { name: 'Đăng nhập' })).toBeVisible()
  await expect(badge(guestPage)).toHaveCount(0)

  await login(guestPage, users.user)
  await expect(badge(guestPage)).toHaveText('3')
  expect(errors).toEqual([])
  await guest.close()
})

test('nhiều tab cùng mở sau khi đăng nhập → chỉ gộp một lần', async ({ browser, baseURL, users }, testInfo) => {
  const [book] = books
  if (!book) return

  const context = await browser.newContext({ baseURL, storageState: NO_SESSION })
  const guestPage = await context.newPage()
  await addFromBookPage(guestPage, book, { times: 2 })

  // Có phiên (cookie dùng chung của project) trong khi localStorage vẫn còn giỏ khách → hai tab cùng thấy hàng
  const state: { cookies: Parameters<BrowserContext['addCookies']>[0] } = JSON.parse(
    readFileSync(storageStatePath(testInfo.project.name), 'utf8'),
  )
  await context.addCookies(state.cookies)
  const [tabA, tabB] = await Promise.all([context.newPage(), context.newPage()])
  await Promise.all([tabA.goto('/'), tabB.goto('/')])

  await expect.poll(() => readGuestCart(tabA)).toBeNull()
  // Cả hai tab đã qua bước gộp (không còn ai giữ / chờ khóa) trước khi đọc DB
  const lockIdle = async () => {
    const { held = [], pending = [] } = await navigator.locks.query()
    return held.length + pending.length === 0
  }
  await Promise.all([tabA.waitForFunction(lockIdle), tabB.waitForFunction(lockIdle)])
  await expect(badge(tabA)).toHaveText('2')
  await expect(badge(tabB)).toHaveText('2')
  expect(await cartQuantities(users.user.id)).toEqual({ [book.id]: 2 })
  await context.close()
})
