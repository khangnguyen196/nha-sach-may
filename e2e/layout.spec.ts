import { expect, test } from '@playwright/test'
import { collectErrors, openPalette, waitForHydration } from './helpers'

test('header dính trên cùng khi cuộn', async ({ page }) => {
  await page.goto('/')
  const header = page.getByRole('banner')
  await page.mouse.wheel(0, 2_000)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(header).toBeInViewport()
  expect((await header.boundingBox())?.y).toBe(0)
})

test('không tràn ngang: layout viewport bằng bề rộng màn hình (trang chủ, trang sách có kệ)', async ({ page }) => {
  // Phần tử absolute trong kệ cuộn ngang từng kéo document rộng ~1456px ở trang sách → mobile thu nhỏ cả trang
  await page.goto('/')
  const bookHref = await page.locator('main a[href^="/sach/"]').first().getAttribute('href')
  for (const path of ['/', bookHref ?? '/']) {
    await page.goto(path)
    // Kệ "Cùng danh mục" stream sau trong Suspense
    await page.waitForLoadState('networkidle')
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
