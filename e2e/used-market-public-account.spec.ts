import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import {
  bookBySlug,
  cancelAndDeleteOrders,
  cleanupE2eAdminData,
  createE2eBook,
  createE2eCategory,
  createE2eUser,
  deleteE2eUsers,
  makeAdmin,
  seedAddress,
  signedInClient,
  USED_PHOTO_BUCKET,
  usedListingRow,
  type E2eUser,
} from '../scripts/e2e-user'
import { login, NO_SESSION } from './auth'
import { vnd } from './cart'
import { collectErrors, collectErrorsAllow404, waitForHydration } from './helpers'

// Chợ sách cũ, trang công khai (docs/plans/cho-sach-cu.md, P-B vòng 9): /cho-sach-cu, /cho-sach-cu/<id>, proxy 404
// used-market, "Có N bản cũ từ X ₫" ở trang sách. Người bán + admin + người mua tạo riêng mỗi lần chạy, xóa ở afterAll.
//
// Quy tắc dữ liệu:
// - Tin cần lên DANH SÁCH dùng sách thật của e2e/fixtures/books.json (danh mục đang hiện; sách e2e tạo bằng service role
//   nằm ngoài danh sách danh mục đã cache nên không bao giờ lên danh sách), MỖI PROJECT MỘT CUỐN (desktop-account /
//   mobile-account chạy song song: "Có N bản cũ" đếm đúng tin của mình). Bất biến (danh mục, trần giá, không spec nào
//   khác dùng) ở scripts/e2e-seed.test.ts. Giá tin ≤ trần của sách.
// - Duyệt QUA GIAO DIỆN admin (/admin/sach-cu/<id>) để updateTag chạy; duyệt bằng RPC thì danh sách / trang sách đã
//   cache không thấy tin. Tương tự, tin đã công khai được người bán rút QUA GIAO DIỆN (updateTag) trong finally của mỗi
//   ca, trước deleteE2eUsers / cleanupE2eAdminData ở afterAll; đơn dọn bằng cancelAndDeleteOrders (tin về đang bán) rồi
//   mới rút.
// - Danh sách dùng chung với project song song: tìm tin của mình theo id (data-listing-id), không đếm tổng.

test.describe.configure({ mode: 'serial' })
test.use({ storageState: NO_SESSION })

type Client = Awaited<ReturnType<typeof signedInClient>>

/** Sách thật riêng của từng project (giữ khớp USED_MARKET_BOOKS trong scripts/e2e-seed.test.ts) */
const BOOK_BY_PROJECT: Record<string, string> = {
  'desktop-account': 'cha-me-5-0',
  'mobile-account': 'nang-cao-von-tu-vung-tieng-nhat-theo-chu-de-bang-hinh-anh',
}
const SHIPPING_FEE = 30_000

let seller: E2eUser
let admin: E2eUser
let buyer: E2eUser
let sellerClient: Client
let buyerClient: Client
let book: Awaited<ReturnType<typeof bookBySlug>>
let sellerContext: BrowserContext
let adminContext: BrowserContext
let sellerPage: Page
let adminPage: Page
const slugs: string[] = []

async function signedInPage(browser: Browser, testInfo: TestInfo, user: E2eUser) {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, storageState: NO_SESSION })
  const page = await context.newPage()
  await login(page, user)
  return { context, page }
}

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(90_000)
  const slug = BOOK_BY_PROJECT[testInfo.project.name]
  if (!slug) throw new Error(`Không có sách chợ sách cũ cho project ${testInfo.project.name}`)
  book = await bookBySlug(slug)
  ;[seller, admin, buyer] = await Promise.all([
    createE2eUser('market-seller'),
    createE2eUser('market-admin'),
    createE2eUser('market-buyer'),
  ])
  await makeAdmin(admin.id)
  ;[sellerClient, buyerClient] = await Promise.all([signedInClient(seller), signedInClient(buyer)])
  ;({ context: sellerContext, page: sellerPage } = await signedInPage(browser, testInfo, seller))
  ;({ context: adminContext, page: adminPage } = await signedInPage(browser, testInfo, admin))
})

test.afterAll(async () => {
  await Promise.all([sellerContext?.close(), adminContext?.close()])
  const users = [seller, admin, buyer].filter((user) => user !== undefined)
  // Đơn của người mua trước (tin sách cũ trong đơn là restrict), rồi tin → ảnh → user, sách test sau cùng
  await cancelAndDeleteOrders(users.map((user) => user.id))
  await deleteE2eUsers(users.map((user) => user.id))
  await cleanupE2eAdminData(slugs)
})

const main = (page: Page) => page.getByRole('main')
const card = (page: Page, id: number) => main(page).locator(`[data-testid="market-listing"][data-listing-id="${id}"]`)
const marketOf = (slug: string, query = '') => `/cho-sach-cu?book=${slug}${query}`

/** Tin chờ duyệt của người bán (RPC theo phiên người bán, như form đăng tin), ảnh WebP thật trong thư mục của họ */
async function createPendingListing(price: number, bookId = book.id) {
  const path = `${seller.id}/${randomUUID()}.webp`
  const webp = await sharp({ create: { width: 60, height: 80, channels: 3, background: '#5a8' } }).webp().toBuffer()
  const upload = await sellerClient.storage.from(USED_PHOTO_BUCKET).upload(path, webp, { contentType: 'image/webp' })
  if (upload.error) throw new Error(`upload: ${upload.error.message}`)
  const { data, error } = await sellerClient.rpc('create_used_listing', {
    p_book_id: bookId,
    p_condition: 'good',
    p_price: price,
    p_description: 'Sách e2e chợ sách cũ',
    p_photos: [path],
  })
  if (error) throw new Error(`create_used_listing: ${error.message}`)
  return data
}

async function openReview(id: number) {
  await adminPage.goto(`/admin/sach-cu/${id}`)
  await expect(main(adminPage).getByRole('heading', { name: 'Duyệt tin sách cũ', level: 1 })).toBeVisible()
  await waitForHydration(adminPage, 'main [data-testid="listing-review"] button')
}

/** Admin duyệt qua giao diện: action updateTag danh sách / tin / "Có N bản cũ" */
async function approveViaUi(id: number) {
  await openReview(id)
  await main(adminPage).getByTestId('listing-review').getByRole('button', { name: 'Duyệt tin' }).click()
  await expect(main(adminPage).getByTestId('listing-review-feedback')).toContainText('Đã duyệt tin', { timeout: 15_000 })
  expect(await usedListingRow(id)).toMatchObject({ status: 'approved' })
}

/** Admin gỡ tin đang bán qua giao diện (từ chối kèm lý do) */
async function takeDownViaUi(id: number) {
  await openReview(id)
  const review = main(adminPage).getByTestId('listing-review')
  await review.getByLabel('Lý do').fill('Gỡ tin e2e.')
  await review.getByRole('button', { name: 'Gỡ tin', exact: true }).click()
  await review.getByTestId('takedown-confirm').getByRole('button', { name: 'Gỡ tin', exact: true }).click()
  await expect(main(adminPage).getByTestId('listing-review-feedback')).toContainText('Đã gỡ tin.', { timeout: 15_000 })
  expect(await usedListingRow(id)).toMatchObject({ status: 'rejected' })
}

/** Người bán rút tin qua giao diện (Sách tôi bán): action updateTag → tin biến khỏi chợ / trang sách */
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

/** Rút mọi tin của ca (kể cả khi ca đỏ giữa chừng) */
async function withdrawAll(ids: readonly number[]) {
  for (const id of ids) await withdrawViaUi(id)
}

test('(p1) khách thấy tin đã duyệt ở /cho-sach-cu (lọc ?book=): ảnh, người bán, giá; trang tin vi / en 200 + hreflang', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const ids: number[] = []
  try {
    const id = await createPendingListing(35_000)
    ids.push(id)
    await approveViaUi(id)

    const errors = collectErrors(page)
    await page.goto(marketOf(book.slug))
    await expect(main(page).getByRole('heading', { name: 'Chợ sách cũ', level: 1 })).toBeVisible()
    await expect(main(page).getByTestId('used-demo-note')).toHaveText('Tính năng demo, không có giao dịch thật.')
    await expect(main(page).getByTestId('market-book-filter')).toContainText(book.title)
    const item = card(page, id)
    await expect(item).toContainText(book.title)
    await expect(item.getByTestId('market-listing-price')).toHaveText(vnd(35_000))
    await expect(item.getByTestId('market-listing-seller')).toHaveText(`Người bán: ${seller.fullName}`)
    // Ảnh đầu (link ký bằng anon, unoptimized) tải được thật
    const photo = item.locator('img')
    await expect
      .poll(() => photo.evaluate((image: HTMLImageElement) => (image.complete ? image.naturalWidth : 0)), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0)

    await item.getByRole('link').click()
    await expect(page).toHaveURL(new RegExp(`/cho-sach-cu/${id}$`))
    await expect(main(page).getByTestId('market-listing-title')).toHaveText(book.title)
    await expect(main(page).getByTestId('market-listing-seller')).toHaveText(seller.fullName)
    await expect(main(page).getByTestId('market-listing-sold')).toHaveCount(0)

    const vi = await page.goto(`/cho-sach-cu/${id}`)
    expect(vi?.status()).toBe(200)
    await expect(main(page).getByTestId('market-listing-price')).toHaveText(vnd(35_000))
    await expect(page.locator('link[rel="alternate"][hreflang="vi"]')).toHaveAttribute('href', new RegExp(`/cho-sach-cu/${id}$`))
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      new RegExp(`/en/used-books/${id}$`),
    )
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/)

    const en = await page.goto(`/en/used-books/${id}`)
    expect(en?.status()).toBe(200)
    await expect(main(page).getByTestId('market-listing-price')).toHaveText(vnd(35_000, 'en'))
    await expect(main(page).getByTestId('market-listing-seller')).toHaveText(seller.fullName)
    expect(errors).toEqual([])
  } finally {
    await withdrawAll(ids)
  }
})

test('(p2) tin chờ duyệt: không lên danh sách, trang tin 404 used-market (cả với chính người bán); id sai → 404', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const id = await createPendingListing(30_000)
  const errors = collectErrorsAllow404(page)

  await page.goto(marketOf(book.slug))
  await expect(main(page).getByTestId('market-count')).toBeVisible()
  await expect(card(page, id)).toHaveCount(0)

  for (const path of [`/cho-sach-cu/${id}`, '/cho-sach-cu/abc', '/en/used-books/987654321', `/en/used-books/${id}`]) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(404)
    await expect(main(page).getByTestId('not-found'), path).toHaveAttribute('data-kind', 'used-market')
  }
  await expect(main(page).getByRole('link', { name: 'Back to Used Books' })).toBeVisible()
  expect(errors).toEqual([])

  // Người bán đọc được tin chờ duyệt của mình (RLS) nhưng trang công khai vẫn 404 (proxy lọc status)
  const own = await sellerPage.goto(`/cho-sach-cu/${id}`)
  expect(own?.status()).toBe(404)
  await expect(main(sellerPage).getByTestId('not-found')).toHaveAttribute('data-kind', 'used-market')
  await expect(main(sellerPage).getByRole('link', { name: 'Về Chợ sách cũ' })).toBeVisible()

  // Tin chưa công khai: rút bằng RPC là đủ (không có cache công khai nào chứa tin)
  const withdrawn = await sellerClient.rpc('withdraw_used_listing', { p_id: id })
  expect(withdrawn.error).toBeNull()
})

test('(p3) tin đã bán: trang tin hiện "Đã bán", không lên danh sách', async ({ page }) => {
  test.setTimeout(120_000)
  const ids: number[] = []
  try {
    const price = 45_000
    const id = await createPendingListing(price)
    ids.push(id)
    await approveViaUi(id)

    const address = await seedAddress(buyer.id)
    const { error } = await buyerClient.rpc('place_used_order', {
      p_listing_id: id,
      p_address_id: address,
      p_payment_method: 'cod',
      p_idempotency_key: randomUUID(),
      p_expected_total: price + SHIPPING_FEE,
    })
    expect(error).toBeNull()
    expect(await usedListingRow(id)).toMatchObject({ status: 'sold' })

    // Đặt bằng RPC không updateTag: trang tin / danh sách chưa mở lần nào sau lần duyệt (updateTag) nên đọc mới
    const errors = collectErrors(page)
    const response = await page.goto(`/cho-sach-cu/${id}`)
    expect(response?.status()).toBe(200)
    await expect(main(page).getByTestId('market-listing-sold')).toHaveText('Đã bán')
    await expect(main(page).getByText('Cuốn sách cũ này đã có người mua.')).toBeVisible()
    await page.goto(marketOf(book.slug))
    await expect(main(page).getByTestId('market-count')).toBeVisible()
    await expect(card(page, id)).toHaveCount(0)
    expect(errors).toEqual([])
  } finally {
    // Tin đã bán không rút được: hủy + xóa đơn trước (trigger trả tin về đang bán), rồi rút qua giao diện
    await cancelAndDeleteOrders([buyer.id])
    await withdrawAll(ids)
  }
})

test('(p4) tin đã duyệt của sách thuộc danh mục ẩn: không lên danh sách, trang tin vẫn 200', async ({ page }) => {
  test.setTimeout(120_000)
  const ids: number[] = []
  try {
    const root = await createE2eCategory({ active: false })
    slugs.push(root.slug)
    const leaf = await createE2eCategory({ parentId: root.id })
    slugs.push(leaf.slug)
    const hiddenBook = await createE2eBook({ categoryId: leaf.id, price: 80_000, originalPrice: 100_000 })
    slugs.push(hiddenBook.slug)
    const id = await createPendingListing(50_000, hiddenBook.id)
    ids.push(id)
    await approveViaUi(id)

    const errors = collectErrors(page)
    await page.goto(marketOf(hiddenBook.slug))
    await expect(main(page).getByTestId('market-count')).toBeVisible()
    await expect(card(page, id)).toHaveCount(0)
    await page.goto('/cho-sach-cu?sort=price-desc')
    await expect(main(page).getByTestId('market-count')).toBeVisible()
    await expect(card(page, id)).toHaveCount(0)

    // Link trực tiếp vẫn xem được (như trang sách của danh mục ẩn)
    const response = await page.goto(`/cho-sach-cu/${id}`)
    expect(response?.status()).toBe(200)
    await expect(main(page).getByTestId('market-listing-title')).toHaveText(hiddenBook.title)
    expect(errors).toEqual([])
  } finally {
    await withdrawAll(ids)
  }
})

test('(p5) trang sách: "Có 2 bản cũ từ 25.000 ₫" → danh sách ?book= xếp giá tăng; gỡ một tin → "Có 1 bản cũ"; câu en', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const ids: number[] = []
  try {
    const cheap = await createPendingListing(25_000)
    ids.push(cheap)
    const dear = await createPendingListing(40_000)
    ids.push(dear)
    await approveViaUi(cheap)
    await approveViaUi(dear)

    const errors = collectErrors(page)
    await page.goto(`/sach/${book.slug}`)
    const copies = main(page).getByTestId('used-copies')
    await expect(copies).toHaveText(`Có 2 bản cũ từ ${vnd(25_000)}`)
    // Link LUÔN tới danh sách lọc theo sách (không trỏ thẳng một tin)
    const link = copies.getByRole('link')
    await expect(link).toHaveAttribute('href', `/cho-sach-cu?book=${book.slug}`)
    await link.click()
    await expect(page).toHaveURL(new RegExp(`/cho-sach-cu\\?book=${book.slug}$`))
    await expect(card(page, cheap)).toBeVisible()
    await expect(card(page, dear)).toBeVisible()

    // Sắp xếp giá tăng (tham số thật của chip): 25.000 đứng trước 40.000
    await main(page).getByRole('group', { name: 'Sắp xếp' }).getByRole('link', { name: 'Giá tăng dần' }).click()
    await expect(page).toHaveURL(new RegExp(`/cho-sach-cu\\?book=${book.slug}&sort=price-asc$`))
    await expect(
      main(page).getByRole('group', { name: 'Sắp xếp' }).getByRole('link', { name: 'Giá tăng dần' }),
    ).toHaveAttribute('aria-current', 'true')
    const order = await main(page)
      .getByTestId('market-listing')
      .evaluateAll((items) => items.map((item) => Number(item.getAttribute('data-listing-id'))))
    expect(order.filter((id) => id === cheap || id === dear)).toEqual([cheap, dear])
    await page.goto(marketOf(book.slug, '&sort=price-desc'))
    const desc = await main(page)
      .getByTestId('market-listing')
      .evaluateAll((items) => items.map((item) => Number(item.getAttribute('data-listing-id'))))
    expect(desc.filter((id) => id === cheap || id === dear)).toEqual([dear, cheap])

    // Admin gỡ tin rẻ qua giao diện → updateTag used-book: trang sách đếm lại
    await takeDownViaUi(cheap)
    await page.goto(`/sach/${book.slug}`)
    await expect(main(page).getByTestId('used-copies')).toHaveText(`Có 1 bản cũ từ ${vnd(40_000)}`)
    await page.goto(`/en/books/${book.slug}`)
    await expect(main(page).getByTestId('used-copies')).toHaveText(`1 used copy from ${vnd(40_000, 'en')}`)
    await expect(main(page).getByTestId('used-copies').getByRole('link')).toHaveAttribute(
      'href',
      `/en/used-books?book=${book.slug}`,
    )
    expect(errors).toEqual([])
  } finally {
    await withdrawAll(ids)
  }
})
