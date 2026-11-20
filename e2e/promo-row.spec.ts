import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { vnd } from './cart'
import { collectErrors, FOCUS_RING_PX, focusRingClip, tabTo, waitForHydration, waitForSettled } from './helpers'

// Hàng thẻ khuyến mãi đầu trang chủ (đợt trang-chu-khuyen-mai, phương án A): Đang giảm giá, Miễn phí giao hàng, Bán
// chạy, Sách ngoại văn; dưới là dải đồng hồ + nút "Xem tất cả sách". Giả định dữ liệu (≥ 4 sách đang giảm còn hàng ở
// danh mục đang hiện, ≥ 4 sách tiếng Anh, kệ / thẻ Bán chạy ẩn vì seed không ghi sold_count, seed không ghi
// cover_width nên thẻ giảm giá chỉ xếp theo % giảm): scripts/e2e-seed.test.ts (promo-row.spec).

// Playwright biên dịch spec sang CommonJS (không có import.meta): đọc fixture theo đường dẫn từ gốc repo
const fixture: { slug: string; price: number; original_price: number | null; stock: number }[] = JSON.parse(
  readFileSync('e2e/fixtures/books.json', 'utf8'),
)
/** Mốc freeship / phí giao của DB (private.free_ship_from(), private.flat_shipping_fee() trong supabase/schema.sql) */
const FREE_SHIP_FROM = 300_000
const SHIPPING_FEE = 30_000

const row = (page: Page) => page.getByRole('main').getByRole('region', { name: /^(Ưu đãi|Deals)$/ })
const card = (page: Page, name: string) => row(page).getByRole('article', { name, exact: true })
const tiles = (page: Page, name: string) => card(page, name).locator('[data-book-slot]')
const list = (page: Page) => page.locator('#promo-cards')

async function noHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, viewport } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, label).toBeLessThanOrEqual(viewport)
}

test('vi: đủ thẻ theo dữ liệu, sách giảm giá xếp theo % giảm, link đúng, không còn câu trích dẫn', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await waitForSettled(page)

  // Thứ tự thẻ; Bán chạy ẩn (seed không có sách sold_count > 0 ở danh mục đang hiện, bất biến ở e2e-seed.test.ts)
  await expect(row(page).getByRole('article')).toHaveCount(3)
  const titles = await row(page).getByRole('heading', { level: 3 }).allTextContents()
  expect(titles).toEqual(['Đang giảm giá', 'Miễn phí giao hàng', 'Sách ngoại văn'])
  await expect(card(page, 'Bán chạy')).toHaveCount(0)

  // Đang giảm giá: 4 cuốn, nhãn -X% không tăng dần, mỗi cuốn là sách đang giảm còn hàng của fixture
  const sale = tiles(page, 'Đang giảm giá')
  await expect(sale).toHaveCount(4)
  // Nhãn -X% là chữ "-<số>%" đầu tiên trong link (giá dạng "146.000 ₫" không có dấu %)
  const percents = await sale
    .locator('[data-book-link]')
    .evaluateAll((links) => links.map((a) => Number(/-(\d+)%/.exec(a.textContent ?? '')?.[1] ?? Number.NaN)))
  expect(percents).toHaveLength(4)
  expect([...percents].sort((a, b) => b - a)).toEqual(percents)
  const saleSlugs = await sale
    .locator('[data-book-link]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')?.replace('/sach/', '') ?? ''))
  for (const slug of saleSlugs) {
    const book = fixture.find((b) => b.slug === slug)
    expect(book, slug).toBeDefined()
    expect(book?.original_price ?? 0, slug).toBeGreaterThan(book?.price ?? 0)
    expect(book?.stock ?? 0, slug).toBeGreaterThan(0)
  }
  // Ảnh đứng một mình (không có tên hiển thị) → alt là tên sách
  for (const img of await sale.locator('img').all()) expect(await img.getAttribute('alt')).not.toBe('')
  await expect(card(page, 'Đang giảm giá').getByRole('link', { name: 'Xem tất cả sách', exact: true })).toHaveAttribute(
    'href',
    '/sach',
  )

  // Miễn phí giao hàng: số từ quote_items (không hard-code trong app)
  const ship = card(page, 'Miễn phí giao hàng')
  await expect(ship).toContainText(vnd(FREE_SHIP_FROM))
  await expect(ship).toContainText(`phí giao ${vnd(SHIPPING_FEE)}`)
  await expect(ship.getByRole('link', { name: 'Chọn sách ngay' })).toHaveAttribute('href', '/sach')

  // Sách ngoại văn: 4 cuốn có tên, link về danh mục
  await expect(tiles(page, 'Sách ngoại văn')).toHaveCount(4)
  await expect(card(page, 'Sách ngoại văn').getByRole('link', { name: 'Xem sách ngoại văn' })).toHaveAttribute(
    'href',
    '/danh-muc/sach-ngoai-van',
  )

  // Dải dưới hàng thẻ: nút "Xem tất cả sách" → /sach
  await expect(page.getByTestId('home-strip').getByRole('link', { name: 'Xem tất cả sách', exact: true })).toHaveAttribute(
    'href',
    '/sach',
  )

  // Câu trích dẫn hero đã bỏ: không blockquote / figure nào ở vùng đầu trang (trước dải đồng hồ); phần dưới (kệ…) không
  // thuộc phạm vi kiểm này
  await expect(
    page.getByTestId('home-strip').locator('xpath=preceding::*[self::blockquote or self::figure]'),
  ).toHaveCount(0)
  await expect(page.getByRole('main')).not.toContainText('Descartes')
  expect(errors).toEqual([])
})

test('en: cùng thẻ, chuỗi tiếng Anh, link /en', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/en')
  await waitForSettled(page)
  const titles = await row(page).getByRole('heading', { level: 3 }).allTextContents()
  expect(titles).toEqual(['On sale', 'Free shipping', 'Foreign Books'])
  await expect(tiles(page, 'On sale')).toHaveCount(4)
  await expect(card(page, 'On sale').getByRole('link', { name: 'Browse all books', exact: true })).toHaveAttribute(
    'href',
    '/en/books',
  )
  await expect(card(page, 'Free shipping')).toContainText(vnd(FREE_SHIP_FROM, 'en'))
  await expect(card(page, 'Foreign Books').getByRole('link', { name: 'See foreign books' })).toHaveAttribute(
    'href',
    '/en/categories/sach-ngoai-van',
  )
  for (const href of await tiles(page, 'Foreign Books')
    .locator('[data-book-link]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''))) {
    expect(href).toMatch(/^\/en\/books\//)
  }
  await expect(page.getByTestId('home-strip').getByRole('link', { name: 'Browse all books', exact: true })).toHaveAttribute(
    'href',
    '/en/books',
  )
  expect(errors).toEqual([])
})

// Theo mẫu catalog.spec (lưới sách). Thẻ thứ 4 (tải lười) không có trên CI: Bán chạy ẩn → chỉ 3 thẻ, đều trong
// EAGER_CARDS của promo-row.tsx
test('ảnh: bìa đầu thẻ đầu ưu tiên cao (ứng viên LCP), các bìa còn lại của 3 thẻ đầu tải ngay', async ({ page }) => {
  await page.goto('/')
  const saleCovers = card(page, 'Đang giảm giá').locator('img')
  await expect(saleCovers).toHaveCount(4)
  await expect(saleCovers.nth(0)).toHaveAttribute('fetchpriority', 'high')
  for (const index of [1, 2, 3]) {
    await expect(saleCovers.nth(index)).not.toHaveAttribute('fetchpriority', 'high')
    await expect(saleCovers.nth(index)).toHaveAttribute('loading', 'eager')
  }
  const foreignCovers = card(page, 'Sách ngoại văn').locator('img')
  await expect(foreignCovers).toHaveCount(4)
  for (const index of [0, 1, 2, 3]) {
    await expect(foreignCovers.nth(index)).not.toHaveAttribute('fetchpriority', 'high')
    await expect(foreignCovers.nth(index)).toHaveAttribute('loading', 'eager')
  }
})

test('lần vào đầu (chưa chọn theme) là giao diện sáng, nền trắng', async ({ browser, baseURL }) => {
  // Context mới: không localStorage `theme`
  const context = await browser.newContext({ baseURL })
  try {
    const page = await context.newPage()
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).toHaveClass(/\blight\b/)
    await expect(html).not.toHaveClass(/\bdark\b/)
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)')
  } finally {
    await context.close()
  }
})

for (const width of [320, 390, 1440]) {
  test(`${width}px: không tràn ngang (vi, en)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/', '/en']) {
      await page.goto(path)
      await waitForSettled(page)
      await noHorizontalOverflow(page, `${width} ${path}`)
    }
  })
}

test('1440px: mọi thẻ vừa một hàng, không nút trước / sau', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Khổ 1440 chỉ ở máy tính')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await waitForHydration(page, '#promo-cards')
  await waitForSettled(page)
  const { scrollWidth, clientWidth } = await list(page).evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  await expect(row(page).getByRole('button', { name: 'Thẻ ưu đãi sau' })).toHaveCount(0)
})

test('khổ md (hàng tràn): nút trước / sau cuộn hàng thẻ; điện thoại không có nút', async ({ page, isMobile }) => {
  const next = row(page).getByRole('button', { name: 'Thẻ ưu đãi sau' })
  if (isMobile) {
    await page.goto('/')
    await waitForSettled(page)
    await expect(next).toBeHidden()
    return
  }
  // Giảm chuyển động: ShelfNav cuộn tức thì → đọc scrollLeft ngay sau mỗi lần bấm
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 800, height: 900 })
  await page.goto('/')
  await waitForHydration(page, '#promo-cards')
  const previous = row(page).getByRole('button', { name: 'Thẻ ưu đãi trước' })
  await expect(next).toBeVisible()
  await expect(previous).toBeDisabled()
  const scrollLeft = () => list(page).evaluate((element) => element.scrollLeft)
  await next.click()
  await expect.poll(scrollLeft).toBeGreaterThan(0)
  await expect(previous).toBeEnabled()
  const scrolled = await scrollLeft()
  await previous.click()
  await expect.poll(scrollLeft).toBeLessThan(scrolled)
})

test('không tự trượt, không chuyển động tự động (cả khi giảm chuyển động)', async ({ page }) => {
  // Đồng hồ giả (thời gian vẫn chạy tự nhiên): tua 10 giây hẹn giờ thay vì chờ thật
  await page.clock.install()
  await page.setViewportSize({ width: 390, height: 844 })
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/')
    await waitForHydration(page, '#promo-cards')
    await waitForSettled(page)
    // Không có animation CSS / Web Animation nào chạy trong hàng thẻ, và hàng đứng yên sau khi tua hẹn giờ (băng chuyền
    // tự trượt thường đổi thẻ sau 3–5 giây bằng setInterval / setTimeout)
    const running = () =>
      row(page).evaluate((section) =>
        section.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length,
      )
    expect(await running(), reducedMotion).toBe(0)
    await page.clock.runFor(10_000)
    expect(await list(page).evaluate((element) => element.scrollLeft), reducedMotion).toBe(0)
    expect(await running(), reducedMotion).toBe(0)
  }
})

test('bàn phím: Tab đi qua từng link của hàng thẻ, thẻ được cuộn vào màn hình, vòng focus không bị cắt', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await waitForSettled(page)
  const links = row(page).getByRole('link')
  const count = await links.count()
  expect(count).toBeGreaterThan(4)
  await page.getByRole('banner').locator('a[href="/"]').focus()
  // Link cuối hàng (thẻ cuối, ngoài màn hình lúc đầu ở 390px): Tab tới được, trình duyệt cuộn hàng tới
  const last = links.last()
  await tabTo(page, last, 80)
  await expect(last).toBeInViewport()
  expect(await list(page).evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  const clip = await focusRingClip(last, FOCUS_RING_PX)
  expect(Math.max(clip.top, clip.right, clip.bottom, clip.left)).toBe(0)
})

test('bàn phím, giao diện tối: Tab tới ô sách đầu của thẻ đầu, vòng focus hiện và không bị cắt', async ({ page }) => {
  // Sáng là mặc định từ đợt trang-chu-khuyen-mai: chọn tối bằng localStorage như người dùng đã chọn
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  await waitForSettled(page)
  const first = card(page, 'Đang giảm giá').locator('[data-book-link]').first()
  await page.getByRole('banner').locator('a[href="/"]').focus()
  await tabTo(page, first)
  await expect(first).toBeFocused()
  await expect(first).toBeInViewport()
  // Vòng focus (ring-3 focus-visible:ring-focus-ring) là box-shadow 3px có màu
  const shadow = await first.evaluate((element) => getComputedStyle(element).boxShadow)
  expect(shadow).not.toBe('none')
  expect(shadow).toMatch(/\b3px\b/)
  expect(shadow).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
  const clip = await focusRingClip(first, FOCUS_RING_PX)
  expect(Math.max(clip.top, clip.right, clip.bottom, clip.left)).toBe(0)
})
