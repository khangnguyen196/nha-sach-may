import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import {
  bookBySlug,
  createE2eUser,
  deleteE2eUsers,
  makeAdmin,
  signedInClient,
  USED_PHOTO_BUCKET,
  usedListingRow,
  type E2eUser,
} from '../scripts/e2e-user'
import { login, NO_SESSION } from './auth'
import { vnd } from './cart'
import { collectErrors, waitForHydration, waitForSettled } from './helpers'

// Tab Sách mới | Sách cũ (N) của trang tìm kiếm (docs/plans/tim-sach-cu.md): /tim-kiem?q=…&type=used. Người bán + admin
// tạo riêng mỗi lần chạy, xóa ở afterAll.
//
// Quy tắc dữ liệu (bất biến ở scripts/e2e-seed.test.ts, SEARCH_USED_BOOKS):
// - Tin dùng sách thật của e2e/fixtures/books.json (danh mục lá đang bật: sách e2e tạo bằng service role nằm ngoài danh
//   mục đã cache nên không bao giờ khớp tìm kiếm), MỖI PROJECT MỘT CUỐN, không spec nào khác dùng cuốn đó; từ khóa
//   không dấu của project chỉ khớp đúng cuốn của project (desktop-account / mobile-account chạy song song: N đếm đúng
//   tin của mình).
// - Duyệt QUA GIAO DIỆN admin (updateTag used-listings), rút QUA GIAO DIỆN người bán (ca (b) và afterAll): bằng RPC thì
//   trang tìm kiếm đã cache không thấy thay đổi.

test.describe.configure({ mode: 'serial' })
test.use({ storageState: NO_SESSION })

type Client = Awaited<ReturnType<typeof signedInClient>>

/** Sách + từ khóa không dấu riêng của từng project (giữ khớp SEARCH_USED_BOOKS trong scripts/e2e-seed.test.ts) */
const DATA_BY_PROJECT: Record<string, { slug: string; query: string }> = {
  'desktop-account': { slug: 'suong-khoi-que-nha', query: 'suong khoi' },
  'mobile-account': { slug: 'oxford-thuong-yeu', query: 'oxford thuong' },
}
/** Khớp sách thật không có tin nào (không spec nào đăng tin sách đó) */
const QUERY_NO_LISTING = 'ky mong'
/** Không khớp sách nào */
const QUERY_NO_BOOK = 'qxzw vjk'

let seller: E2eUser
let admin: E2eUser
let sellerClient: Client
let sellerContext: BrowserContext
let adminContext: BrowserContext
let sellerPage: Page
let adminPage: Page
let book: Awaited<ReturnType<typeof bookBySlug>>
let query: string
/** Tin còn đang bán của spec (ca (b) rút tin thứ hai) */
let listed: { id: number; price: number }[] = []

async function signedInPage(browser: Browser, testInfo: TestInfo, user: E2eUser) {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, storageState: NO_SESSION })
  const page = await context.newPage()
  await login(page, user)
  return { context, page }
}

const main = (page: Page) => page.getByRole('main')
/** Next giữ trang trước khi bấm link trong DOM ở dạng ẩn (Activity) → chỉ xét phần đang hiển thị */
const tabs = (page: Page) => main(page).getByTestId('search-tabs').filter({ visible: true })
const tab = (page: Page, name: string | RegExp) => tabs(page).getByRole('link', { name })
const card = (page: Page, id: number) =>
  main(page).locator(`[data-testid="market-listing"][data-listing-id="${id}"]`).filter({ visible: true })
const searchUrl = (q: string, extra = '') => `/tim-kiem?q=${encodeURIComponent(q)}${extra}`
const params = (page: Page) => Object.fromEntries(new URL(page.url()).searchParams)

/** Tin chờ duyệt của người bán (RPC theo phiên người bán, như form đăng tin), ảnh WebP thật trong thư mục của họ */
async function createPendingListing(price: number) {
  const path = `${seller.id}/${randomUUID()}.webp`
  const webp = await sharp({ create: { width: 60, height: 80, channels: 3, background: '#7a5' } }).webp().toBuffer()
  const upload = await sellerClient.storage.from(USED_PHOTO_BUCKET).upload(path, webp, { contentType: 'image/webp' })
  if (upload.error) throw new Error(`upload: ${upload.error.message}`)
  const { data, error } = await sellerClient.rpc('create_used_listing', {
    p_book_id: book.id,
    p_condition: 'good',
    p_price: price,
    p_description: 'Sách e2e tìm sách cũ',
    p_photos: [path],
  })
  if (error) throw new Error(`create_used_listing: ${error.message}`)
  return data
}

/** Admin duyệt qua giao diện: action updateTag used-listings → trang tìm kiếm thấy tin */
async function approveViaUi(id: number) {
  await adminPage.goto(`/admin/sach-cu/${id}`)
  await expect(main(adminPage).getByRole('heading', { name: 'Duyệt tin sách cũ', level: 1 })).toBeVisible()
  await waitForHydration(adminPage, 'main [data-testid="listing-review"] button')
  await main(adminPage).getByTestId('listing-review').getByRole('button', { name: 'Duyệt tin' }).click()
  await expect(main(adminPage).getByTestId('listing-review-feedback')).toContainText('Đã duyệt tin', { timeout: 15_000 })
  expect(await usedListingRow(id)).toMatchObject({ status: 'approved' })
}

/** Người bán rút tin qua giao diện (Sách tôi bán): action updateTag → tin biến khỏi tab Sách cũ */
async function withdrawViaUi(id: number) {
  const row = await usedListingRow(id)
  if (!row || row.status === 'withdrawn' || row.status === 'sold') return
  await sellerPage.goto('/tai-khoan/sach-toi-ban')
  const item = main(sellerPage).locator(`[data-testid="listing-row"][data-listing-id="${id}"]`)
  const open = item.getByRole('button', { name: 'Rút tin' })
  await expect(open).toBeEnabled()
  await open.click()
  await item.getByTestId('withdraw-confirm').getByRole('button', { name: 'Rút tin' }).click()
  await expect(item.getByTestId('listing-status')).toHaveText('Đã rút', { timeout: 15_000 })
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(150_000)
  const data = DATA_BY_PROJECT[testInfo.project.name]
  if (!data) throw new Error(`Không có sách tìm sách cũ cho project ${testInfo.project.name}`)
  query = data.query
  book = await bookBySlug(data.slug)
  ;[seller, admin] = await Promise.all([createE2eUser('search-used-seller'), createE2eUser('search-used-admin')])
  await makeAdmin(admin.id)
  sellerClient = await signedInClient(seller)
  ;({ context: sellerContext, page: sellerPage } = await signedInPage(browser, testInfo, seller))
  ;({ context: adminContext, page: adminPage } = await signedInPage(browser, testInfo, admin))

  // Giá viết thẳng trong lời gọi: scripts/e2e-seed.test.ts đọc giá để kiểm giá gốc của sách (trần giá tin)
  const cheap = await createPendingListing(41_000)
  listed.push({ id: cheap, price: 41_000 })
  const dear = await createPendingListing(47_000)
  listed.push({ id: dear, price: 47_000 })
  await approveViaUi(cheap)
  await approveViaUi(dear)
})

test.afterAll(async () => {
  test.setTimeout(120_000)
  try {
    // Rút qua giao diện từng tin còn đang bán (cả khi ca đỏ giữa chừng), lỗi bước này không chặn dọn user
    for (const { id } of listed) {
      try {
        await withdrawViaUi(id)
      } catch (error) {
        console.error(`Dọn: rút tin ${id} lỗi`, error)
      }
    }
  } finally {
    await Promise.all([sellerContext?.close(), adminContext?.close()])
    await deleteE2eUsers([seller, admin].filter((user) => user !== undefined).map((user) => user.id))
  }
})

test('(a) tìm không dấu → "Sách cũ (2)"; bấm tab → đúng 2 tin: tên sách, tình trạng, giá, link trang tin', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(searchUrl(query))
  await expect(tab(page, 'Sách mới')).toHaveAttribute('aria-current', 'page')
  await expect(tab(page, 'Sách cũ (2)')).toBeVisible()
  await expect(tab(page, 'Sách cũ (2)')).not.toHaveAttribute('aria-current')
  await expect(tabs(page)).toHaveAttribute('aria-label', 'Loại sách')

  await waitForHydration(page, 'main [data-testid="search-tabs"] a[data-tab="used"]')
  await tab(page, 'Sách cũ (2)').click()
  await expect.poll(() => params(page)).toEqual({ q: query, type: 'used' })
  await expect(tab(page, 'Sách cũ (2)')).toHaveAttribute('aria-current', 'page')
  await expect(main(page).getByTestId('search-used-count').filter({ visible: true })).toHaveText(
    `2 tin sách cũ cho “${query}”`,
  )
  for (const { id, price } of listed) {
    const item = card(page, id)
    await expect(item).toContainText(book.title)
    await expect(item).toContainText('Tốt')
    await expect(item.getByTestId('market-listing-price')).toHaveText(vnd(price))
    await expect(item.getByTestId('market-listing-seller')).toHaveText(`Người bán: ${seller.fullName}`)
    await expect(item.getByRole('link')).toHaveAttribute('href', `/cho-sach-cu/${id}`)
  }
  // Mỗi tin một lần, không tin nào khác (từ khóa chỉ khớp cuốn của project)
  await expect(main(page).getByTestId('market-listing').filter({ visible: true })).toHaveCount(2)
  // Bộ lọc / sắp xếp của tab Sách mới không hiện ở tab Sách cũ
  await expect(main(page).getByRole('combobox')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('(b) người bán rút 1 tin qua giao diện → "Sách cũ (1)", tin đã rút không còn trong tab', async ({ page }) => {
  test.setTimeout(90_000)
  const [kept, withdrawn] = listed
  if (!kept || !withdrawn) throw new Error('Thiếu tin của beforeAll')
  await withdrawViaUi(withdrawn.id)
  listed = [kept]

  const errors = collectErrors(page)
  await page.goto(searchUrl(query))
  await expect(tab(page, 'Sách cũ (1)')).toBeVisible()
  await page.goto(searchUrl(query, '&type=used'))
  await expect(tab(page, 'Sách cũ (1)')).toHaveAttribute('aria-current', 'page')
  await expect(main(page).getByTestId('search-used-count')).toHaveText(`1 tin sách cũ cho “${query}”`)
  await expect(card(page, kept.id)).toBeVisible()
  await expect(card(page, withdrawn.id)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('(c) đổi tab hai chiều giữ ô tìm, q và sort; gửi lại form ở tab Sách cũ vẫn ở tab Sách cũ', async ({ page }) => {
  const errors = collectErrors(page)
  const input = () => main(page).getByRole('searchbox').filter({ visible: true })
  await page.goto(searchUrl(query, '&sort=price-asc&page=1'))
  await expect(input()).toHaveValue(query)
  await waitForHydration(page, 'main [data-testid="search-tabs"] a[data-tab="used"]')

  await tab(page, /^Sách cũ/).click()
  await expect.poll(() => params(page)).toEqual({ q: query, sort: 'price-asc', type: 'used' })
  await expect(tab(page, /^Sách cũ/)).toHaveAttribute('aria-current', 'page')
  await expect(input()).toHaveValue(query)

  await tab(page, 'Sách mới').click()
  await expect.poll(() => params(page)).toEqual({ q: query, sort: 'price-asc' })
  await expect(tab(page, 'Sách mới')).toHaveAttribute('aria-current', 'page')
  await expect(input()).toHaveValue(query)
  // Tab Sách mới giữ nguyên như trước: lưới sách có cuốn của project
  await expect(main(page).getByRole('link', { name: book.title }).filter({ visible: true }).first()).toBeVisible()

  // Gửi lại form (Enter) ở tab Sách cũ với từ khóa khác → vẫn ở tab Sách cũ
  await page.goto(searchUrl(query, '&type=used'))
  await input().fill(QUERY_NO_LISTING)
  await input().press('Enter')
  await expect.poll(() => params(page)).toEqual({ q: QUERY_NO_LISTING, type: 'used' })
  await expect(tab(page, 'Sách cũ (0)')).toHaveAttribute('aria-current', 'page')
  await expect(input()).toHaveValue(QUERY_NO_LISTING)
  expect(errors).toEqual([])
})

test('(d) trạng thái rỗng: từ khóa khớp sách không có tin, từ khóa không khớp sách nào; link sang Chợ sách cũ', async ({
  page,
}) => {
  const errors = collectErrors(page)
  for (const q of [QUERY_NO_LISTING, QUERY_NO_BOOK]) {
    await page.goto(searchUrl(q, '&type=used'))
    await expect(tab(page, 'Sách cũ (0)'), q).toHaveAttribute('aria-current', 'page')
    await expect(main(page).getByTestId('search-used-count'), q).toHaveText(`0 tin sách cũ cho “${q}”`)
    const empty = main(page).getByTestId('search-used-empty')
    await expect(empty, q).toContainText(`Chưa có sách cũ nào cho “${q}”`)
    await expect(empty.getByRole('link', { name: 'Xem Chợ sách cũ' }), q).toHaveAttribute('href', '/cho-sach-cu')
    await expect(main(page).getByTestId('market-listing'), q).toHaveCount(0)
  }
  await main(page).getByTestId('search-used-empty').getByRole('link', { name: 'Xem Chợ sách cũ' }).click()
  await expect(page).toHaveURL(/\/cho-sach-cu$/)
  await expect(main(page).getByRole('heading', { name: 'Chợ sách cũ', level: 1 })).toBeVisible()
  expect(errors).toEqual([])
})

test('(e) en: /en/search?q=…&type=used nhãn tiếng Anh, link /en/used-books/<id>', async ({ page }) => {
  const [kept] = listed
  if (!kept) throw new Error('Thiếu tin của beforeAll')
  const errors = collectErrors(page)
  await page.goto(`/en/search?q=${encodeURIComponent(query)}&type=used`)
  await expect(tabs(page)).toHaveAttribute('aria-label', 'Book type')
  await expect(tab(page, 'Used books (1)')).toHaveAttribute('aria-current', 'page')
  const newHref = new URL((await tab(page, 'New books').getAttribute('href')) ?? '', page.url())
  expect(newHref.pathname).toBe('/en/search')
  expect(Object.fromEntries(newHref.searchParams)).toEqual({ q: query })
  await expect(main(page).getByTestId('search-used-count')).toHaveText(`1 used listing for “${query}”`)
  const item = card(page, kept.id)
  await expect(item).toContainText('Good')
  await expect(item.getByTestId('market-listing-price')).toHaveText(vnd(kept.price, 'en'))
  await expect(item.getByRole('link')).toHaveAttribute('href', `/en/used-books/${kept.id}`)

  await page.goto(`/en/search?q=${encodeURIComponent(QUERY_NO_BOOK)}&type=used`)
  const empty = main(page).getByTestId('search-used-empty')
  await expect(empty).toContainText(`No used books for “${QUERY_NO_BOOK}”`)
  await expect(empty.getByRole('link', { name: 'Browse used books' })).toHaveAttribute('href', '/en/used-books')
  expect(errors).toEqual([])
})

test('(f) không tràn ngang ở 320 / 390 / 1440: tab Sách mới, tab Sách cũ, trạng thái rỗng', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = collectErrors(page)
  const paths = [searchUrl(query), searchUrl(query, '&type=used'), searchUrl(QUERY_NO_BOOK, '&type=used')]
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    for (const path of paths) {
      await page.goto(path)
      await expect(tabs(page), `${width} ${path}`).toBeVisible()
      await waitForSettled(page)
      const { innerWidth, scrollWidth, viewport } = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }))
      expect(innerWidth, `${width} ${path}`).toBe(width)
      expect(scrollWidth, `${width} ${path}`).toBeLessThanOrEqual(viewport)
    }
  }
  // Tab cao ≥ 44px (dưới md: vùng chạm)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(searchUrl(query))
  const box = await tab(page, 'Sách mới').boundingBox()
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  expect(errors).toEqual([])
})

// Trang vượt quá (không phải kết quả rỗng): từ khóa của project còn 1 tin đang bán (sau (b)) → page=99 → UI 404 +
// noindex, HTTP 200 (soft 404, như mẫu ở catalog.spec.ts)
test('(g) tab Sách cũ, page vượt quá → UI 404 + noindex, không lỗi console', async ({ page }) => {
  const [kept] = listed
  if (!kept) throw new Error('Thiếu tin của beforeAll')
  const errors = collectErrors(page)
  await page.goto(searchUrl(query, '&type=used'))
  await expect(card(page, kept.id)).toBeVisible()

  const response = await page.goto(searchUrl(query, '&type=used&page=99'))
  expect(response?.status()).toBe(200)
  await expect(main(page).getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached()
  await expect(main(page).getByTestId('market-listing')).toHaveCount(0)
  await waitForHydration(page, 'main a[href="/"]')
  expect(errors).toEqual([])
})
