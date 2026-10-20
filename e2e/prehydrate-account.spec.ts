import { expect, test, type BrowserContext } from '@playwright/test'
import {
  cancelAndDeleteOrders,
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  deliverOrder,
  ordersOf,
  placeE2eOrder,
  seedAddress,
  setCartItem,
  signedInClient,
  type E2eAdminBook,
  type E2eUser,
} from '../scripts/e2e-user'
import { login, NO_SESSION } from './auth'
import { blockHydration, expectLockedUntilHydrated } from './helpers'

// ★8 (docs/plans/no-js.md): form cần tài khoản, nút gửi khóa tới khi hydrate. Chặn mọi chunk JS trước khi vào trang:
// form trong stream vẫn hiện nhờ script inline `$RC`, nhưng React không hydrate → nút khóa, bấm không gửi POST.
// User + sách + đơn riêng của spec (tạo ở beforeAll, xóa ở afterAll): không giẫm dữ liệu của spec khác.

test.describe.configure({ mode: 'serial' })
test.use({ storageState: NO_SESSION })

let user: E2eUser
let books: E2eAdminBook[] = []
const slugs: string[] = []
let storageState: Awaited<ReturnType<BrowserContext['storageState']>>

test.beforeAll(async ({ browser, baseURL }) => {
  const root = await createE2eCategory({ active: false })
  slugs.push(root.slug)
  const leaf = await createE2eCategory({ parentId: root.id })
  slugs.push(leaf.slug)
  books = await Promise.all([
    createE2eBook({ categoryId: leaf.id, price: 70_000, stock: 20 }),
    createE2eBook({ categoryId: leaf.id, price: 50_000, stock: 20 }),
  ])
  slugs.push(...books.map((book) => book.slug))
  user = await createE2eUser('khoa-nut')
  const [reviewBook, cancelBook] = books
  if (!reviewBook || !cancelBook) throw new Error('Thiếu sách test')
  const client = await signedInClient(user)
  const addressId = await seedAddress(user.id)
  // Địa chỉ thứ hai không mặc định: có nút "Đặt làm mặc định"
  await seedAddress(user.id, { recipient: 'Người Nhận Phụ', isDefault: false })
  await placeE2eOrder(client, user.id, { addressId, bookId: reviewBook.id, quantity: 1 })
  const delivered = (await ordersOf(user.id))[0]
  if (!delivered) throw new Error('Không đặt được đơn')
  await deliverOrder(delivered.id)
  await placeE2eOrder(client, user.id, { addressId, bookId: cancelBook.id, quantity: 1 })
  await setCartItem(user.id, cancelBook.id, 1)

  const context = await browser.newContext({ baseURL, storageState: NO_SESSION })
  const page = await context.newPage()
  await login(page, user)
  storageState = await context.storageState()
  await context.close()
})

test.afterAll(async () => {
  if (user) {
    await cancelAndDeleteOrders([user.id])
    await deleteE2eUsers([user.id])
  }
  await cleanupE2eAdminData(slugs)
})

test('viết đánh giá (form trong stream): trước hydrate nút khóa, không POST; sau hydrate nút bật', async ({ browser, baseURL }) => {
  const [reviewBook] = books
  if (!reviewBook) throw new Error('Thiếu sách test')
  const context = await browser.newContext({ baseURL, storageState })
  try {
    const page = await context.newPage()
    const blocked = await blockHydration(page)
    await page.goto(`/sach/${reviewBook.slug}`)
    const form = page.getByRole('main').locator('form:has(input[name="rating"])')
    await expectLockedUntilHydrated(page, blocked, {
      submit: form.locator('button[type="submit"]'),
      selector: 'main form:has(input[name="rating"]) button[type="submit"]',
      visible: page.getByRole('main').getByRole('heading', { level: 1 }),
    })
  } finally {
    await context.close()
  }
})

test('hủy đơn: trước hydrate nút khóa, không POST; sau hydrate nút bật', async ({ browser, baseURL }) => {
  const pending = (await ordersOf(user.id)).find((order) => order.status === 'pending')
  if (!pending) throw new Error('Thiếu đơn chờ xác nhận')
  const context = await browser.newContext({ baseURL, storageState })
  try {
    const page = await context.newPage()
    const blocked = await blockHydration(page)
    await page.goto(`/tai-khoan/don-hang/${pending.order_code}`)
    // <details> mở / đóng không cần JS
    await page.getByRole('main').getByText('Hủy đơn hàng', { exact: true }).click()
    const form = page.getByRole('main').locator('form:has([name="reason"])')
    await expectLockedUntilHydrated(page, blocked, {
      submit: form.locator('button[type="submit"]'),
      selector: 'main form:has([name="reason"]) button[type="submit"]',
      visible: page.getByRole('main').getByRole('heading', { level: 1 }),
    })
    expect((await ordersOf(user.id)).find((order) => order.id === pending.id)?.status).toBe('pending')
  } finally {
    await context.close()
  }
})

test('sổ địa chỉ (form không qua useFormAction): đặt mặc định + xóa khóa trước hydrate, không POST; sau hydrate bật', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ baseURL, storageState })
  try {
    const page = await context.newPage()
    const blocked = await blockHydration(page)
    await page.goto('/tai-khoan/dia-chi')
    const main = page.getByRole('main')
    const setDefault = main.getByRole('button', { name: 'Đặt làm mặc định' })
    await expect(setDefault).toBeVisible()
    await expect(setDefault).toBeDisabled()
    await expect(setDefault).toHaveAttribute('aria-disabled', 'true')
    await setDefault.click({ force: true })
    // Xóa: mở <details> của địa chỉ thứ hai rồi bấm nút xác nhận
    await main.locator('summary[aria-label="Xóa địa chỉ của Người Nhận Phụ"]').click()
    await expectLockedUntilHydrated(page, blocked, {
      submit: main.locator('details[open] button[type="submit"]'),
      selector: 'main li details form button[type="submit"]',
      visible: main.getByRole('heading', { level: 1 }),
    })
    await expect(main.getByRole('button', { name: 'Đặt làm mặc định' })).toBeEnabled()
  } finally {
    await context.close()
  }
})

test('đặt hàng: trước hydrate nút khóa, không POST; sau hydrate nút bật', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, storageState })
  try {
    const page = await context.newPage()
    const blocked = await blockHydration(page)
    await page.goto('/thanh-toan')
    const selector = 'main [data-testid="checkout-summary"] button[type="submit"]:not([form])'
    await expectLockedUntilHydrated(page, blocked, {
      submit: page.locator(selector),
      selector,
      visible: page.getByRole('main').getByRole('heading', { level: 1 }),
    })
    expect((await ordersOf(user.id)).length).toBe(2)
  } finally {
    await context.close()
  }
})

test('giữ nguyên trước hydrate: nút "Đăng xuất" và "Thêm vào giỏ" (form không JS, kết thúc bằng redirect) không khóa', async ({
  browser,
  baseURL,
}) => {
  const [, cartBook] = books
  if (!cartBook) throw new Error('Thiếu sách test')
  const context = await browser.newContext({ baseURL, storageState })
  try {
    const page = await context.newPage()
    await blockHydration(page)
    await page.goto('/tai-khoan')
    // Chỉ kiểm trạng thái nút, không bấm (đăng xuất sẽ thu hồi phiên dùng chung của spec)
    await expect(page.getByRole('main').getByRole('button', { name: 'Đăng xuất' })).toBeEnabled()
    await page.goto(`/sach/${cartBook.slug}`)
    const addToCart = page.getByRole('main').locator('form').getByRole('button', { name: /Thêm vào giỏ/ }).first()
    await expect(addToCart).toBeVisible()
    await expect(addToCart).toBeEnabled()
    await expect(addToCart).toHaveAttribute('aria-disabled', 'false')
  } finally {
    await context.close()
  }
})

// Ngoại lệ không khóa (src/lib/form-ready.test.ts → UNLOCKED_FORMS): signOut kết thúc bằng 303 → bấm trước hydrate về
// trang chủ (trang thật, không trắng), hết phiên. User riêng: đăng xuất thu hồi phiên, không dùng phiên chung của spec.
test('trước hydrate: "Đăng xuất" vẫn gửi được, 303 về trang chủ, trang không trắng, hết phiên', async ({ browser, baseURL }) => {
  const own = await createE2eUser('khoa-nut-dang-xuat')
  const context = await browser.newContext({ baseURL, storageState: NO_SESSION })
  try {
    const page = await context.newPage()
    await login(page, own)
    const blocked = await blockHydration(page)
    await page.goto('/tai-khoan')
    blocked.resetPosts()
    const signOut = page.getByRole('main').getByRole('button', { name: 'Đăng xuất' })
    await expect(signOut).toBeEnabled()
    await signOut.click()
    await expect(page).toHaveURL(/\/$/)
    expect(blocked.posts()).toBe(1)
    await expect(page.getByRole('main')).toBeVisible()
    await blocked.unblock()
    await page.goto('/tai-khoan')
    await expect(page).toHaveURL(/\/dang-nhap\?next=%2Ftai-khoan$/)
  } finally {
    await context.close()
    await deleteE2eUsers([own.id])
  }
})
