import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { ADD_TO_CART_SUBMIT, addToCartButton, vnd } from './cart'
import { collectErrors, openPalette, waitForHydration, waitForSettled } from './helpers'

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
  const link = page.getByRole('link', { name: /Xem bằng tiếng Anh/ })
  await expect(link).toHaveAttribute('href', '/en/books?page=2&sort=price-asc')
  await link.click()
  await expect(page).toHaveURL(/\/en\/books\?page=2&sort=price-asc$/)
})

test('trang không có query: link đổi ngôn ngữ không có dấu ? thừa (trước và sau hydrate)', async ({ page }) => {
  await page.goto('/')
  const link = page.getByRole('link', { name: /Xem bằng tiếng Anh/ })
  await expect(link).toHaveAttribute('href', '/en')
  await waitForHydration(page, 'header a[hreflang]')
  await expect(link).toHaveAttribute('href', '/en')
  await page.goto('/dang-nhap')
  await expect(page.getByRole('link', { name: /Xem bằng tiếng Anh/ })).toHaveAttribute('href', '/en/login')
})

test('đổi ngôn ngữ giữ nguyên query', async ({ page }) => {
  await page.goto('/?x=1')
  // Link trong HTML tĩnh (cả fallback Suspense lúc trang chưa stream xong) đã có query trước khi bấm
  await expect(page.getByRole('link', { name: /Xem bằng tiếng Anh/ })).toHaveAttribute('href', '/en?x=1')
  await page.getByRole('link', { name: /Xem bằng tiếng Anh/ }).click()
  await expect(page).toHaveURL(/\/en\?x=1$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

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
