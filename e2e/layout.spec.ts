import { expect, test, type Locator, type Route } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { ADD_TO_CART_SUBMIT, addToCartButton, vnd } from './cart'
import {
  collectErrors,
  FOCUS_RING_PX,
  focusRingClip,
  localeLinkSelector,
  openMoreMenu,
  openPalette,
  tabTo,
  waitForHydration,
  waitForSettled,
} from './helpers'

// Playwright biên dịch spec sang CommonJS (không có import.meta): đọc fixture theo đường dẫn từ gốc repo
const fixture: { slug: string; price: number }[] = JSON.parse(readFileSync('e2e/fixtures/books.json', 'utf8'))
const sapiens = fixture.find((book) => book.slug === 'sapiens')
if (!sapiens) throw new Error('e2e/fixtures/books.json thiếu sapiens')
/** Dải đáy màn hình mà bong bóng chat tự ẩn khi khối [data-chat-avoid] chạm vào (BOTTOM_BAND_PX, chat-bubble.tsx) */
const CHAT_BOTTOM_BAND_PX = 88

test('header dính trên cùng khi cuộn', async ({ page }) => {
  await page.goto('/')
  const header = page.getByRole('banner')
  await page.mouse.wheel(0, 2_000)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(header).toBeInViewport()
  expect((await header.boundingBox())?.y).toBe(0)
})

test('không tràn ngang: layout viewport bằng bề rộng màn hình (trang chủ, trang sách có kệ, chợ sách cũ vi / en)', async ({
  page,
}) => {
  // Phần tử absolute trong kệ cuộn ngang từng kéo document rộng ~1456px ở trang sách → mobile thu nhỏ cả trang.
  // Chợ sách cũ: hàng chip bộ lọc (w-max) từng kéo ô grid rộng 965px → trang 997px ở màn 390px (đánh giá 2026-10-30)
  await page.goto('/')
  const bookHref = await page.locator('main a[href^="/sach/"]').first().getAttribute('href')
  for (const path of ['/', bookHref ?? '/', '/cho-sach-cu', '/en/used-books']) {
    await page.goto(path)
    // Đo bề rộng cả trang: chờ mọi phần stream (kệ "Cùng danh mục" trong Suspense) đã hiện + font đã tải
    await waitForSettled(page)
    const { innerWidth, scrollWidth, viewport } = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }))
    expect(innerWidth, path).toBe(page.viewportSize()?.width)
    expect(scrollWidth, path).toBeLessThanOrEqual(viewport)
  }
})

test('đổi theme → class trên <html> đổi', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  const html = page.locator('html')
  await expect(html).toHaveClass(/dark/)

  await openMoreMenu(page)
  await page.getByRole('button', { name: 'Chuyển sang giao diện sáng' }).click()
  await expect(html).toHaveClass(/light/)
  await page.getByRole('button', { name: 'Chuyển sang giao diện tối' }).click()
  await expect(html).toHaveClass(/dark/)
  expect(errors).toEqual([])
})

test('bấm đổi ngôn ngữ trước khi hydrate (JS chưa tải) vẫn giữ query', async ({ page }) => {
  // Chặn JS của app (giữ CSS): trang chỉ còn HTML tĩnh + inline script, như lúc mạng chậm chưa hydrate xong
  await page.route('**/_next/static/**', (route) =>
    route.request().resourceType() === 'script' ? route.abort() : route.continue(),
  )
  await page.goto('/sach?page=2&sort=price-asc')
  // Dưới md link nằm trong menu "⋯": <details> mở được không cần JS
  await openMoreMenu(page)
  const link = page.getByRole('link', { name: /Xem bằng tiếng Anh/ })
  await expect(link).toHaveAttribute('href', '/en/books?page=2&sort=price-asc')
  await link.click()
  await expect(page).toHaveURL(/\/en\/books\?page=2&sort=price-asc$/)
})

test('trang không có query: link đổi ngôn ngữ không có dấu ? thừa (trước và sau hydrate)', async ({ page }) => {
  await page.goto('/')
  await openMoreMenu(page)
  const link = page.getByRole('link', { name: /Xem bằng tiếng Anh/ })
  await expect(link).toHaveAttribute('href', '/en')
  await waitForHydration(page, localeLinkSelector(page))
  await expect(link).toHaveAttribute('href', '/en')
  await page.goto('/dang-nhap')
  await openMoreMenu(page)
  await expect(page.getByRole('link', { name: /Xem bằng tiếng Anh/ })).toHaveAttribute('href', '/en/login')
})

test('đổi ngôn ngữ giữ nguyên query', async ({ page }) => {
  await page.goto('/?x=1')
  await openMoreMenu(page)
  // Link trong HTML tĩnh (cả fallback Suspense lúc trang chưa stream xong) đã có query trước khi bấm
  await expect(page.getByRole('link', { name: /Xem bằng tiếng Anh/ })).toHaveAttribute('href', '/en?x=1')
  await page.getByRole('link', { name: /Xem bằng tiếng Anh/ }).click()
  await expect(page).toHaveURL(/\/en\?x=1$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  await openMoreMenu(page)
  await expect(page.getByRole('link', { name: /View in Vietnamese/ })).toHaveAttribute('href', '/?x=1')
  await page.getByRole('link', { name: /View in Vietnamese/ }).click()
  await expect(page).toHaveURL(/\/\?x=1$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
})

test('palette: có kết quả, điều hướng bằng phím, Enter → trang tìm kiếm', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  const dialog = await openPalette(page)

  // Sách nào trong catalog cũng có ISBN-13 bắt đầu bằng 978/979 → luôn có kết quả, không phụ thuộc một cuốn cụ thể
  await dialog.getByRole('combobox').fill('978')
  const options = dialog.getByRole('option')
  await expect.poll(() => options.count()).toBeGreaterThan(1)
  await expect(dialog.locator('img').first()).toBeVisible()

  await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowUp')
  await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true')
  expect(errors).toEqual([])

  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/tim-kiem\?q=978$/)
})

test('palette: mở bằng nút → Esc → focus về nút; Ctrl K → Esc → focus về phần tử trước đó', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await waitForHydration(page, 'header button[aria-haspopup="dialog"]')
  // Listener Ctrl K gắn trong useEffect: chờ main thread rảnh (như openPalette)
  await waitForSettled(page)
  // Palette mở thì phần ngoài bị aria-hidden → tìm nút bằng CSS, không bằng role
  const trigger = page.locator('header button[aria-keyshortcuts]')
  const dialog = page.getByRole('dialog')

  await trigger.click()
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await expect(dialog.getByRole('combobox')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()

  const cta = page.getByRole('main').getByRole('link', { name: 'Xem tất cả sách', exact: true })
  await cta.focus()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(cta).toBeFocused()

  // Đóng bằng chính phím tắt
  await page.keyboard.press('ControlOrMeta+k')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(dialog).toBeHidden()
  await expect(cta).toBeFocused()

  // Focus ở body → không kéo focus lên nút
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))
  await page.keyboard.press('ControlOrMeta+k')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true)
  await expect(trigger).not.toBeFocused()
  expect(errors).toEqual([])
})

test('palette: đóng bằng Ctrl K cũng xóa chữ đã gõ', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  const dialog = await openPalette(page)
  await dialog.getByRole('combobox').fill('abc')
  await page.keyboard.press('ControlOrMeta+k')
  await expect(dialog).toBeHidden()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('combobox')).toHaveValue('')
  expect(errors).toEqual([])
})

test('palette: Esc rồi Ctrl K ngay (palette đang đóng dở) → lần đóng sau vẫn về phần tử ban đầu', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await waitForHydration(page, 'header button[aria-haspopup="dialog"]')
  // Listener Ctrl K gắn trong useEffect: chờ main thread rảnh (như openPalette)
  await waitForSettled(page)
  const dialog = page.getByRole('dialog')
  const cta = page.getByRole('main').getByRole('link', { name: 'Xem tất cả sách', exact: true })
  await cta.focus()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(dialog.getByRole('combobox')).toBeFocused({ timeout: 10_000 })
  // Không chờ: phím thứ hai tới khi hiệu ứng đóng chưa xong, focus còn ở ô nhập của palette
  await page.keyboard.press('Escape')
  await page.keyboard.press('ControlOrMeta+k')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(cta).toBeFocused()
  expect(errors).toEqual([])
})

test('palette: từ khóa vô nghĩa → trạng thái rỗng; Esc đóng', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/en')
  const dialog = await openPalette(page)

  await dialog.getByRole('combobox').fill('zzqqxx vvkk')
  await expect(dialog.getByText('No books found for “zzqqxx vvkk”')).toBeVisible()
  await expect(dialog.getByRole('option')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(errors).toEqual([])
})

test('palette: Ctrl K rồi gõ ngay khi chunk palette còn đang tải → không mất phím nào; đang gõ ô khác thì phím ở lại ô đó', async ({
  page,
}) => {
  // Chunk palette chỉ tải trước khi rê chuột / focus nút: Ctrl K ngay sau hydrate từng mất cả 7/7 phím (production
  // 2026-11-06, 30 ms / phím). Chunk tải lười = mọi chunk xin sau khi trang đã ổn định (như expectLazyChunkError)
  const SEARCH_TRIGGER = 'header button[aria-haspopup="dialog"]'
  await page.goto('/tim-kiem')
  await waitForHydration(page, SEARCH_TRIGGER)
  await waitForSettled(page)
  const CHUNKS = '**/_next/static/chunks/**'
  let delayed = 0
  const slowChunk = async (route: Route) => {
    delayed += 1
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    await route.continue()
  }
  await page.route(CHUNKS, slowChunk)

  // Ô tìm kiếm của trang đang focus: phím thuộc về ô đó, palette mở ra với ô trống
  // CSS theo id, không theo role: palette (Radix Dialog) mở thì mọi phần tử ngoài dialog mang aria-hidden → rời cây
  // trợ năng, getByRole('main') không còn khớp
  const pageInput = page.locator('#main input[name="q"]')
  await pageInput.focus()
  await page.keyboard.press('ControlOrMeta+k')
  await page.keyboard.type('abc', { delay: 30 })
  const dialog = page.getByRole('dialog')
  // 10 s: chunk palette cố ý chậm 1,5 s mỗi file
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  expect(delayed).toBeGreaterThan(0)
  await expect(dialog.getByRole('combobox')).toHaveValue('')
  await expect(pageInput).toHaveValue('abc')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(pageInput).toBeFocused()

  // Logo đang focus (không phải nút tìm kiếm: focus nút tải trước chunk): phím giữ lại rồi vào ô của palette
  // Tải lại để chunk palette chưa có trong trang (route bật thì Playwright tắt bộ nhớ đệm HTTP → chunk xin lại)
  // unrouteAll 'ignoreErrors': handler cũ đang chờ 1,5 s thì route.continue() của nó trên request đã hủy (reload) không ném lỗi
  await page.unrouteAll({ behavior: 'ignoreErrors' })
  await page.reload()
  await waitForHydration(page, SEARCH_TRIGGER)
  await waitForSettled(page)
  delayed = 0
  await page.route(CHUNKS, slowChunk)
  const logo = page.getByRole('banner').locator('a[href="/"]')
  await logo.focus()
  await page.keyboard.press('ControlOrMeta+k')
  await page.keyboard.type('sapiens', { delay: 30 })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  expect(delayed).toBeGreaterThan(0)
  await expect(dialog.getByRole('combobox')).toHaveValue('sapiens')
  await expect(dialog.getByRole('combobox')).toBeFocused()
  // Đóng vẫn xóa chữ, focus về logo
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(logo).toBeFocused()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(dialog.getByRole('combobox')).toHaveValue('')
  await page.unrouteAll({ behavior: 'ignoreErrors' })
})

test('palette: Ctrl K mở rồi đóng ngay khi ô nhập chưa nhận focus → không còn giữ phím của trang', async ({ page }) => {
  // Hai lần Ctrl K trong cùng một lượt xử lý (React gộp thành một lần render, trạng thái mở cuối cùng vẫn là đóng) từng
  // để bộ giữ phím bật: mọi phím in được của trang bị chặn (Space không cuộn, không bấm nút) tới lần mở sau
  const SEARCH_TRIGGER = 'header button[aria-haspopup="dialog"]'
  await page.goto('/')
  await waitForHydration(page, SEARCH_TRIGGER)
  await waitForSettled(page)
  const CHUNKS = '**/_next/static/chunks/**'
  await page.route(CHUNKS, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    await route.continue()
  })

  await page.evaluate(() => {
    for (let index = 0; index < 2; index += 1) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }))
    }
  })
  const dialog = page.getByRole('dialog')
  // Chunk cố ý chậm 1,5 s: chờ quá thời gian đó rồi mới kết luận palette vẫn đóng
  await page.waitForTimeout(2_000)
  await expect(dialog).toBeHidden()

  // Phím không bị chặn ở pha capture: listener bubble của document thấy defaultPrevented = false
  await page.evaluate(() => {
    const seen: string[] = []
    Reflect.set(window, '__keysPrevented', seen)
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) seen.push(event.key)
    })
  })
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))
  await page.keyboard.press('a')
  await page.keyboard.press('Space')
  expect(await page.evaluate(() => Reflect.get(window, '__keysPrevented'))).toEqual([])
  // Space ở body cuộn trang như thường
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.unrouteAll({ behavior: 'ignoreErrors' })
})

test('/api/search: từ khóa quá ngắn → 400 INVALID_INPUT; hợp lệ → cache CDN', async ({ request }) => {
  const invalid = await request.get('/api/search?q=a')
  expect(invalid.status()).toBe(400)
  expect(await invalid.json()).toEqual({ ok: false, code: 'INVALID_INPUT' })

  const valid = await request.get('/api/search?q=978')
  expect(valid.status()).toBe(200)
  expect(valid.headers()['cache-control']).toContain('s-maxage=')
  const body = await valid.json()
  expect(body.ok).toBe(true)
  expect(body.data.length).toBeGreaterThan(0)
  expect(body.data.length).toBeLessThanOrEqual(8)
})

test('footer nằm dưới màn hình đầu ở trang có nội dung stream (không gây CLS)', async ({ page }) => {
  for (const path of ['/gio-hang', '/tim-kiem?q=zzqqxx', '/tim-kiem?q=nguyen']) {
    await page.goto(path)
    const top = await page.getByRole('contentinfo').evaluate((footer) => footer.getBoundingClientRect().top)
    const viewport = await page.evaluate(() => window.innerHeight)
    expect(top, path).toBeGreaterThanOrEqual(viewport - 1)
  }
})

test('footer có email liên hệ (mailto), cả footer rút gọn ở trang đăng nhập', async ({ page }) => {
  for (const [path, label] of [
    ['/', 'Liên hệ: nha-sach-may@googlegroups.com'],
    ['/dang-nhap', 'Liên hệ: nha-sach-may@googlegroups.com'],
    ['/en', 'Contact: nha-sach-may@googlegroups.com'],
  ] as const) {
    await page.goto(path)
    const footer = page.getByRole('contentinfo')
    await expect(footer.getByText(label), path).toBeVisible()
    await expect(footer.getByRole('link', { name: 'nha-sach-may@googlegroups.com' }), path).toHaveAttribute(
      'href',
      'mailto:nha-sach-may@googlegroups.com',
    )
  }
})

// docs/plans/sau-ux.md mục 4: router prefetch /tai-khoan khi chưa có phiên → proxy 307 → Next 307 → 404 segment
// account/__PAGE__ (lỗi console chập chờn của cart-account.spec.ts:94). Link /account ở fallback của AccountLink không
// prefetch; khách chưa đăng nhập tải trang không được gửi request RSC nào tới khu tài khoản.
// Chỉ là kiểm hồi quy cho khách; không tái hiện được lỗi gốc (bỏ bản sửa vẫn qua 20/20, sau-ux.md mục 4).
test('khách chưa đăng nhập: không có request RSC / prefetch nào tới /tai-khoan (/en/account)', async ({ page }) => {
  const errors = collectErrors(page)
  const accountRsc: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (!/^\/(en\/account|tai-khoan)(\/|$)/.test(url.pathname)) return
    if (url.searchParams.has('_rsc') || request.headers()['rsc'] !== undefined) accountRsc.push(url.pathname + url.search)
  })
  for (const path of ['/', '/sach/sapiens', '/en', '/en/books/sapiens']) {
    await page.goto(path)
    await waitForHydration(page, 'header button[aria-haspopup="dialog"]')
    // Prefetch theo viewport chạy sau hydrate, lúc rảnh
    await page.waitForTimeout(1_500)
  }
  expect(accountRsc).toEqual([])
  expect(errors).toEqual([])
})

test.describe('trang sách trên điện thoại 390×844 (đánh giá 2026-10-30)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('giá + nút "Thêm vào giỏ" trong màn hình đầu (không cuộn), khối nút nằm trên dải đáy của bong bóng chat', async ({
    page,
  }) => {
    await page.goto('/sach/sapiens')
    await waitForHydration(page, ADD_TO_CART_SUBMIT)
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    expect(await page.evaluate(() => window.scrollY)).toBe(0)

    await expect(addToCartButton(page)).toBeInViewport()
    const price = page.getByRole('main').getByText(vnd(sapiens.price), { exact: true }).filter({ visible: true }).first()
    await expect(price).toBeInViewport()
    // Khối nút chạm dải đáy → bong bóng chat ẩn ngay khi mở trang (chat.spec cần bong bóng hiện ở /sach/sapiens)
    const { bottom, innerHeight } = await page
      .getByRole('main')
      .locator('[data-chat-avoid]')
      .filter({ visible: true })
      .evaluate((element) => ({ bottom: element.getBoundingClientRect().bottom, innerHeight: window.innerHeight }))
    // Nhỏ hơn hẳn: IntersectionObserver (rootMargin trong chat-bubble.tsx) coi chạm mép là giao nhau → bằng đúng giới hạn
    // thì bong bóng vẫn ẩn
    expect(bottom).toBeLessThan(innerHeight - CHAT_BOTTOM_BAND_PX)
  })
})

// Tắt JS thì phần Suspense nằm trong <div hidden> chờ $RC (không chạy) → khung chờ còn hiện, như lúc trang đang stream trên
// mạng chậm. Hàng viên chip của khung chờ (4 × w-24 = 408px) từng kéo trang rộng 424px ở màn 390px (test Chrome 2026-10-30)
test.describe('khung chờ chợ sách cũ ở 390×844, tắt JS', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } })

  for (const path of ['/cho-sach-cu', '/en/used-books']) {
    test(`khung chờ đang hiện và không tràn ngang: ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByTestId('market-count')).toBeHidden()
      await expect(page.getByRole('main').locator('[aria-hidden="true"] .animate-pulse.rounded-full').first()).toBeVisible()
      const { innerWidth, scrollWidth, viewport } = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }))
      // Điện thoại (isMobile) tràn ngang thì nới layout viewport theo nội dung (thu nhỏ trang) → kiểm cả innerWidth
      expect(innerWidth).toBe(390)
      expect(scrollWidth).toBeLessThanOrEqual(viewport)
    })
  }
})

// Khung chờ dưới md từng thiếu nhãn nhóm (text-xs) của 2 hàng chip + dòng đếm thấp hơn 1lh → thấp hơn bộ lọc thật ~54px,
// trang nhảy khi phần stream thay vào (đo bản build local 4c98b82: 80 vs 134,4px)
test.describe('khung chờ chợ sách cũ cao bằng bộ lọc thật ở 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  type Edges = { filters: { top: number; height: number }; gridTop: number }
  // Đầu lưới đo từ đỉnh khối bộ lọc: bản tắt JS có thêm dải <noscript> phía trên nên vị trí tuyệt đối khác nhau
  const gridOffset = ({ filters, gridTop }: Edges) => gridTop - filters.top

  for (const path of ['/cho-sach-cu', '/en/used-books']) {
    test(`chênh ≤ 2px, không tràn ngang: ${path}`, async ({ page, browser, baseURL, isMobile, deviceScaleFactor }) => {
      await page.goto(path)
      await waitForSettled(page)
      // Bộ lọc thật: MarketFilters ngay trước dòng đếm, lưới ngay sau
      const actual: Edges = await page
        .getByRole('main')
        .getByTestId('market-count')
        .evaluate((count) => {
          const filters = count.previousElementSibling?.getBoundingClientRect()
          const grid = count.nextElementSibling?.getBoundingClientRect()
          if (!filters || !grid) throw new Error('thiếu khối bộ lọc / lưới quanh dòng đếm')
          return { filters: { top: filters.top, height: filters.height }, gridTop: grid.top }
        })

      const context = await browser.newContext({
        baseURL,
        javaScriptEnabled: false,
        viewport: { width: 390, height: 844 },
        isMobile,
        deviceScaleFactor,
      })
      try {
        const noJs = await context.newPage()
        await noJs.goto(path)
        const skeleton = noJs.getByRole('main').locator('[aria-hidden="true"]:has(> .grid .animate-pulse.rounded-full)')
        await expect(skeleton).toBeVisible()
        // Con của khung chờ: khối viên chip, dòng đếm, lưới
        const pending: Edges = await skeleton.evaluate((root) => {
          const filters = root.children[0]?.getBoundingClientRect()
          const grid = root.children[2]?.getBoundingClientRect()
          if (!filters || !grid) throw new Error('khung chờ thiếu khối viên chip / lưới')
          return { filters: { top: filters.top, height: filters.height }, gridTop: grid.top }
        })
        const detail = JSON.stringify({ pending, actual })
        expect(Math.abs(pending.filters.height - actual.filters.height), detail).toBeLessThanOrEqual(2)
        expect(Math.abs(gridOffset(pending) - gridOffset(actual)), detail).toBeLessThanOrEqual(2)
        const { scrollWidth, viewport } = await noJs.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }))
        expect(scrollWidth).toBeLessThanOrEqual(viewport)
      } finally {
        await context.close()
      }
    })
  }
})

test('chợ sách cũ: vòng focus của chip đầu (Tab) không bị khung cuộn hàng chip cắt', async ({ page }) => {
  // Khung overflow-x-auto (overflow-y thành auto theo) từng cắt mất cạnh trên / dưới vòng 3px, từ md cả cạnh trái
  await page.goto('/cho-sach-cu')
  await waitForSettled(page)
  const chip = page.getByRole('main').getByRole('group').first().getByRole('link').first()
  await expect(chip).toBeVisible()
  // Đúng đường bàn phím (không gọi focus()): Tab từ đầu trang tới chip đầu
  for (let step = 0; step < 40 && !(await chip.evaluate((element) => element === document.activeElement)); step++) {
    await page.keyboard.press('Tab')
  }
  await expect(chip).toBeFocused()
  expect(await chip.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
  expect(await chip.evaluate((element) => element.closest('ul')?.parentElement?.scrollLeft)).toBe(0)
  expect(await focusRingClip(chip, FOCUS_RING_PX)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
})

test('danh mục cha: vòng focus của chip danh mục con đầu (Tab) không bị khung cuộn cắt, ở 390 và 1280', async ({ page }) => {
  // Khung overflow-x-auto (overflow-y thành auto theo) từng cắt cạnh trên / dưới vòng 3px (đo 3 / 3px ở cả hai bề rộng)
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/danh-muc/van-hoc')
    await waitForSettled(page)
    const chip = page.getByRole('main').getByRole('navigation', { name: 'Danh mục con' }).getByRole('link').first()
    await expect(chip).toBeVisible()
    await tabTo(page, chip)
    expect(await chip.evaluate((element) => element.closest('nav')?.scrollLeft), `${width}`).toBe(0)
    expect(await focusRingClip(chip, FOCUS_RING_PX), `${width}`).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  }
})

// de-sau-2 (chủ dự án chọn (e) 2026-11-06): dưới md ngôn ngữ + sáng / tối gộp vào menu "⋯" (<details>), mọi nút icon
// header 44×44, logo luôn có chữ (hai dòng ở màn < 375px). Từ md giữ nguyên hai nút 36px.
const HEADER_ICON_PX = 44
const LOGO_GAP_PX = 4

/**
 * Vòng focus đang vẽ: một box-shadow có độ loang > 0 (ring-3) hoặc outline. Chờ vì nút có transition-all: ngay lúc focus
 * box-shadow còn là các lớp 0px trong suốt.
 */
const expectFocusRing = (element: Locator) =>
  expect
    .poll(() =>
      element.evaluate((node) => {
        const style = getComputedStyle(node)
        return /0px 0px 0px [1-9]\d*(\.\d+)?px/.test(style.boxShadow) || (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0)
      }),
    )
    .toBe(true)

test.describe('header điện thoại: menu "⋯" (de-sau-2)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('320 / 360 / 390 / 430: một hàng cao 64, không tràn ngang, logo có chữ, nút icon ≥ 44×44, ngôn ngữ + sáng / tối chỉ trong menu', async ({
    page,
  }) => {
    const errors = collectErrors(page)
    await page.goto('/')
    const banner = page.getByRole('banner')
    for (const width of [320, 360, 390, 430]) {
      await page.setViewportSize({ width, height: 844 })
      await page.evaluate(async () => {
        await document.fonts.ready
      })
      const layout = await page.evaluate(() => {
        const header = document.querySelector('header')
        const logo = header?.querySelector('a[href="/"]')
        const text = logo?.querySelector(':scope > span')
        if (!header || !logo || !(text instanceof HTMLElement)) throw new Error('thiếu header / logo / chữ logo')
        const box = (element: Element) => {
          const { left, right, top, bottom, width, height } = element.getBoundingClientRect()
          return { left, right, top, bottom, width, height }
        }
        // Nút / link đang hiện trừ logo. checkVisibility, không getClientRects: Chromium ẩn nội dung <details> đóng bằng
        // content-visibility: hidden, mục trong menu đóng vẫn có thể có hộp
        const controls = [...header.querySelectorAll('a, button, summary')]
          .filter((element) => element !== logo && element.checkVisibility())
          .map((element) => ({ name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '', ...box(element) }))
        const textStyle = getComputedStyle(text)
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          header: box(header),
          logo: box(logo),
          text: {
            ...box(text),
            scrollWidth: text.scrollWidth,
            clientWidth: text.clientWidth,
            position: textStyle.position,
            fontSize: parseFloat(textStyle.fontSize),
          },
          controls,
        }
      })
      const at = `${width}px`
      expect(layout.scrollWidth, at).toBeLessThanOrEqual(layout.clientWidth)
      expect(layout.header.height, at).toBe(64)
      // Tìm kiếm, giỏ, tài khoản, "⋯": không còn nút ngôn ngữ / sáng tối ngoài menu
      expect(layout.controls.map((control) => control.name), at).toHaveLength(4)
      for (const control of layout.controls) {
        expect(control.width, `${at} ${control.name}`).toBeGreaterThanOrEqual(HEADER_ICON_PX)
        expect(control.height, `${at} ${control.name}`).toBeGreaterThanOrEqual(HEADER_ICON_PX)
        // Một hàng: mọi nút nằm trọn trong chiều cao header
        expect(control.top, `${at} ${control.name}`).toBeGreaterThanOrEqual(layout.header.top)
        expect(control.bottom, `${at} ${control.name}`).toBeLessThanOrEqual(layout.header.bottom)
      }
      // Không chồng nhau: logo → từng nút từ trái sang phải; logo chừa ≥ 4px
      let previousRight = layout.logo.right + LOGO_GAP_PX
      for (const control of [...layout.controls].sort((a, b) => a.left - b.left)) {
        expect(control.left, `${at} ${control.name}`).toBeGreaterThanOrEqual(previousRight)
        previousRight = control.right
      }
      expect(layout.logo.top, at).toBeGreaterThanOrEqual(layout.header.top)
      expect(layout.logo.bottom, at).toBeLessThanOrEqual(layout.header.bottom)
      // Chữ logo hiện thật: không sr-only (absolute 1px), không bị cắt, chữ ≥ 12px
      expect(layout.text.position, at).not.toBe('absolute')
      expect(layout.text.height, at).toBeGreaterThan(1)
      expect(layout.text.width, at).toBeGreaterThan(1)
      expect(layout.text.scrollWidth, at).toBeLessThanOrEqual(layout.text.clientWidth)
      expect(layout.text.fontSize, at).toBeGreaterThanOrEqual(12)
      await expect(banner.getByRole('link', { name: /Xem bằng tiếng Anh/ }), at).toHaveCount(0)
      await expect(banner.getByRole('button', { name: /Chuyển sang giao diện/ }), at).toHaveCount(0)
      await expect(banner.getByRole('link', { name: 'Nhà Sách Mây' }), at).toBeVisible()
    }
    expect(errors).toEqual([])
  })

  test('menu: chạm mở / đóng, bấm ra ngoài đóng, Enter / Space mở, Esc đóng + focus về "⋯", aria-expanded đúng, mục cao ≥ 44', async ({
    page,
  }) => {
    const errors = collectErrors(page)
    await page.goto('/')
    // Esc / bấm ra ngoài / aria-expanded cần JS của MoreMenu
    await waitForHydration(page, 'header summary')
    await waitForSettled(page)
    const details = page.locator('header details')
    const summary = details.locator('summary')
    const items = details.locator('a, button')
    const expectOpen = async (open: boolean) => {
      if (open) await expect(details).toHaveAttribute('open', '')
      else await expect(details).not.toHaveAttribute('open')
      await expect(summary).toHaveAttribute('aria-expanded', String(open))
    }

    await expect(summary).toHaveAccessibleName('Tùy chọn khác')
    await expectOpen(false)
    await summary.tap()
    await expectOpen(true)
    await expect(items).toHaveCount(2)
    for (const item of await items.all()) {
      expect((await item.boundingBox())?.height).toBeGreaterThanOrEqual(HEADER_ICON_PX)
    }
    await summary.tap()
    await expectOpen(false)

    // Lề trái 16px của trang: không có phần tử bấm được
    await summary.tap()
    await expectOpen(true)
    await page.touchscreen.tap(4, 400)
    await expectOpen(false)

    // Chạm đặt điểm bắt đầu Tab ở chỗ chạm → đặt lại về logo (link ngay trước cụm nút)
    await page.getByRole('banner').locator('a[href="/"]').focus()
    await tabTo(page, summary)
    await page.keyboard.press('Enter')
    await expectOpen(true)
    await tabTo(page, items.first())
    await page.keyboard.press('Escape')
    await expectOpen(false)
    await expect(summary).toBeFocused()

    await page.keyboard.press('Space')
    await expectOpen(true)
    await tabTo(page, items.last())
    await page.keyboard.press('Escape')
    await expectOpen(false)
    await expect(summary).toBeFocused()
    expect(errors).toEqual([])
  })

  test('menu: focus rời menu bằng Tab → menu đóng, aria-expanded "false", focus không bị kéo về "⋯"', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/')
    await waitForHydration(page, 'header summary')
    await waitForSettled(page)
    const details = page.locator('header details')
    const summary = details.locator('summary')
    await page.getByRole('banner').locator('a[href="/"]').focus()
    await tabTo(page, summary)
    await page.keyboard.press('Enter')
    await expect(details).toHaveAttribute('open', '')
    await expect(summary).toHaveAttribute('aria-expanded', 'true')
    await tabTo(page, details.locator('a, button').last())
    await page.keyboard.press('Tab')
    await expect(details).not.toHaveAttribute('open')
    await expect(summary).toHaveAttribute('aria-expanded', 'false')
    expect(await details.evaluate((node) => !node.contains(document.activeElement))).toBe(true)
    expect(errors).toEqual([])
  })

  for (const theme of ['dark', 'light']) {
    test(`vòng focus của "⋯" và mục trong menu (${theme})`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
      await page.goto('/')
      await expect(page.locator('html')).toHaveClass(new RegExp(theme))
      await waitForHydration(page, 'header summary')
      const details = page.locator('header details')
      const summary = details.locator('summary')
      await page.getByRole('banner').locator('a[href="/"]').focus()
      await tabTo(page, summary)
      await expectFocusRing(summary)
      await page.keyboard.press('Enter')
      await expect(details).toHaveAttribute('open', '')
      for (const item of await details.locator('a, button').all()) {
        await tabTo(page, item)
        await expectFocusRing(item)
      }
    })
  }

  test('đổi ngôn ngữ từ menu: /sach?page=2&sort=price-asc ↔ /en/books?page=2&sort=price-asc', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/sach?page=2&sort=price-asc')
    await waitForHydration(page, localeLinkSelector(page))
    await openMoreMenu(page)
    await page.getByRole('link', { name: /Xem bằng tiếng Anh/ }).click()
    await expect(page).toHaveURL(/\/en\/books\?page=2&sort=price-asc$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await waitForHydration(page, localeLinkSelector(page))
    await openMoreMenu(page)
    await page.getByRole('link', { name: /View in Vietnamese/ }).click()
    await expect(page).toHaveURL(/\/sach\?page=2&sort=price-asc$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi')
    expect(errors).toEqual([])
  })

  test('đổi ngôn ngữ từ menu ở trang sách → /en/books/<cùng slug>', async ({ page }) => {
    await page.goto('/sach/sapiens')
    await waitForHydration(page, localeLinkSelector(page))
    await openMoreMenu(page)
    await page.getByRole('link', { name: /Xem bằng tiếng Anh/ }).click()
    await expect(page).toHaveURL(/\/en\/books\/sapiens$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('đổi sáng / tối từ menu: class trên <html> đổi dark ↔ light', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/')
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)
    await waitForHydration(page, 'header details button')
    await openMoreMenu(page)
    await page.getByRole('button', { name: 'Chuyển sang giao diện sáng' }).click()
    await expect(html).toHaveClass(/light/)
    await page.getByRole('button', { name: 'Chuyển sang giao diện tối' }).click()
    await expect(html).toHaveClass(/dark/)
    expect(errors).toEqual([])
  })
})

test.describe('header từ md giữ nguyên (de-sau-2)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('nút ngôn ngữ + sáng / tối hiện thẳng trên header, không có "⋯", nút header 36×36', async ({ page }) => {
    await page.goto('/')
    const banner = page.getByRole('banner')
    const locale = banner.getByRole('link', { name: /Xem bằng tiếng Anh/ })
    const theme = banner.getByRole('button', { name: 'Chuyển sang giao diện sáng' })
    await expect(locale).toBeVisible()
    await expect(theme).toBeVisible()
    await expect(page.locator('header summary')).toBeHidden()
    const cart = banner.getByRole('link', { name: /Giỏ hàng/ })
    for (const control of [locale, theme, cart]) {
      expect(await control.boundingBox()).toMatchObject({ width: 36, height: 36 })
    }
  })
})
