import { expect, test, type Page } from '@playwright/test'
import { collectErrors, openPalette, waitForHydration } from './helpers'

// Không phụ thuộc một cuốn cụ thể: lấy sách từ lưới rồi đi tiếp. Chỉ giả định danh mục "Văn học" có sách
// ở ít nhất hai danh mục con, và mọi sách có ISBN-13 bắt đầu bằng 978/979 (như layout.spec).

const PAGE_SIZE = 24

// Next giữ trang vừa rời trong DOM ở dạng ẩn (Activity, để Back tức thì) → chỉ lấy phần tử đang hiển thị
const cards = (page: Page) =>
  page.getByRole('main').locator('a[href^="/sach/"], a[href^="/en/books/"]').filter({ visible: true })

async function resultTotal(page: Page) {
  const status = page.getByRole('main').getByRole('status').filter({ visible: true })
  await expect(status).toHaveText(/\d+/)
  return Number((await status.textContent())?.replace(/\D/g, ''))
}

/** Giá bán của từng card trên trang (bỏ giá gốc gạch ngang) */
async function cardPrices(page: Page) {
  const texts = await cards(page).allTextContents()
  return texts.map((text) => Number(/Giá bán([\d.]+)/.exec(text)?.[1]?.replaceAll('.', '')))
}

test('danh mục cha: chọn danh mục con → ?cat=, số kết quả đổi; Back → trạng thái cũ', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/danh-muc/van-hoc')
  const status = page.getByRole('main').getByRole('status').filter({ visible: true })
  const before = await resultTotal(page)
  expect(before).toBeGreaterThan(0)
  await expect(cards(page).first()).toBeVisible()

  const subcategories = page.getByRole('navigation', { name: 'Danh mục con' })
  await expect(subcategories.getByRole('link', { name: 'Tất cả' })).toHaveAttribute('aria-current', 'true')
  const child = subcategories.getByRole('link').nth(1)
  const childName = (await child.textContent()) ?? ''
  await child.click()

  await expect(page).toHaveURL(/\/danh-muc\/van-hoc\?cat=[a-z0-9-]+$/)
  await expect(subcategories.getByRole('link', { name: childName })).toHaveAttribute('aria-current', 'true')
  await expect(status).not.toHaveText(`${before} cuốn sách`)
  expect(await resultTotal(page)).toBeLessThan(before)

  await page.goBack()
  await expect(page).toHaveURL(/\/danh-muc\/van-hoc$/)
  await expect(status).toHaveText(`${before} cuốn sách`)
  await expect(subcategories.getByRole('link', { name: 'Tất cả' })).toHaveAttribute('aria-current', 'true')
  expect(errors).toEqual([])
})

test('sort giá tăng dần → giá trên trang tăng dần', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/danh-muc/van-hoc')
  await waitForHydration(page, 'main select')
  const sort = page.getByRole('combobox', { name: /Sắp xếp/ })
  await sort.selectOption('price-asc')

  await expect(page).toHaveURL(/\/danh-muc\/van-hoc\?sort=price-asc$/)
  await expect(sort).toHaveValue('price-asc')
  await expect
    .poll(async () => {
      const prices = await cardPrices(page)
      return prices.length > 1 && prices.every((price, i) => price >= (prices[i - 1] ?? price))
    })
    .toBe(true)
  expect(errors).toEqual([])
})

test('lọc giá → URL có price, về trang 1, mọi giá trong khoảng', async ({ page, isMobile }) => {
  const errors = collectErrors(page)
  await page.goto('/tim-kiem?q=978&page=2')

  // Desktop: chip ngay trên lưới. Mobile: chip nằm trong sheet "Bộ lọc"
  if (isMobile) {
    await waitForHydration(page, 'main button[aria-haspopup="dialog"]')
    await page.getByRole('button', { name: 'Bộ lọc' }).click()
  }
  const scope = isMobile ? page.getByRole('dialog') : page.getByRole('main')
  await scope.getByRole('link', { name: '100.000 – 200.000 ₫' }).click()

  await expect(page).toHaveURL(/\/tim-kiem\?q=978&price=100-200$/)
  if (isMobile) await expect(page.getByRole('dialog')).toBeHidden()
  await expect
    .poll(async () => {
      const prices = await cardPrices(page)
      return prices.length > 0 && prices.every((price) => price >= 100_000 && price < 200_000)
    })
    .toBe(true)
  expect(errors).toEqual([])
})

test('phân trang: trang 2 không trùng trang 1; ?page=999 → trang 404', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/tim-kiem?q=978')
  const total = await resultTotal(page)
  const pagination = page.getByRole('navigation', { name: 'Phân trang' })

  if (total <= PAGE_SIZE) {
    await expect(pagination).toHaveCount(0)
  } else {
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    const firstPage = await cards(page).evaluateAll((links) => links.map((a) => a.getAttribute('href')))
    await pagination.getByRole('link', { name: 'Trang 2' }).click()

    await expect(page).toHaveURL(/\/tim-kiem\?q=978&page=2$/)
    await expect(pagination.getByRole('link', { name: 'Trang 2' })).toHaveAttribute('aria-current', 'page')
    await expect(cards(page)).toHaveCount(Math.min(PAGE_SIZE, total - PAGE_SIZE))
    // Thứ tự ổn định (tie-breaker id) → không cuốn nào lặp lại giữa hai trang
    const secondPage = await cards(page).evaluateAll((links) => links.map((a) => a.getAttribute('href')))
    expect(secondPage.filter((href) => firstPage.includes(href))).toEqual([])
  }
  expect(errors).toEqual([])

  // Trang có static shell → stream đã bắt đầu khi notFound() chạy nên HTTP vẫn 200 (xem phase-3.md);
  // kiểm tra UI 404 + noindex
  await page.goto('/danh-muc/van-hoc?page=999')
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached()
})

test('card → trang sách: h1 đúng tên, có giá; link tác giả → trang tác giả có cuốn đó', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/danh-muc/van-hoc')
  // Card có tên tác giả (dòng thứ hai không rỗng)
  const card = cards(page)
    .filter({ has: page.locator('p:nth-of-type(2)').filter({ hasText: /\S/ }) })
    .first()
  const title = ((await card.locator('p').first().textContent()) ?? '').trim()
  const href = (await card.getAttribute('href')) ?? ''
  await card.click()

  await expect(page).toHaveURL(href)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
  await expect(page.getByRole('main').getByText(/^\d{1,3}(\.\d{3})*\s₫$/).first()).toBeVisible()
  await expect(page.getByRole('img', { name: title })).toBeVisible()

  await page.getByRole('main').locator('dl a[href^="/tac-gia/"]').first().click()
  await expect(page).toHaveURL(/\/tac-gia\/[a-z0-9-]+$/)
  await expect(cards(page).and(page.locator(`[href="${href}"]`))).toBeVisible()
  expect(errors).toEqual([])
})

test('đổi ngôn ngữ trên trang sách → /en/books/<cùng slug>, mô tả fallback tiếng Việt', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/danh-muc/van-hoc')
  const href = (await cards(page).first().getAttribute('href')) ?? ''
  const slug = href.replace('/sach/', '')
  await page.goto(href)

  const viDescription = page.getByRole('region', { name: 'Giới thiệu sách' }).locator('p').first()
  const text = ((await viDescription.textContent()) ?? '').trim()
  await page.getByRole('link', { name: /Xem bằng tiếng Anh/ }).click()

  await expect(page).toHaveURL(new RegExp(`/en/books/${slug}$`))
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  // Chưa có description_en → hiện mô tả tiếng Việt dưới tiêu đề tiếng Anh
  await expect(page.getByRole('region', { name: 'About this book' }).locator('p').first()).toHaveText(text)
  expect(errors).toEqual([])
})

test('tìm kiếm: palette "Xem tất cả" → /tim-kiem có kết quả; từ khóa vô nghĩa → trạng thái rỗng', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  const dialog = await openPalette(page)
  await dialog.getByRole('combobox').fill('978')
  await expect(dialog.getByRole('option').first()).toBeVisible()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/tim-kiem\?q=978$/)
  expect(await resultTotal(page)).toBeGreaterThan(0)
  await expect(cards(page).first()).toBeVisible()
  const searchbox = page.getByRole('searchbox')
  await expect(searchbox).toHaveValue('978')

  // Form GET, chạy không cần JS
  await searchbox.fill('zzqqxx vvkk')
  await searchbox.press('Enter')
  await expect(page).toHaveURL(/\/tim-kiem\?q=zzqqxx\+vvkk$/)
  await expect(page.getByText('Không tìm thấy sách nào cho “zzqqxx vvkk”').filter({ visible: true })).toBeVisible()
  await expect(cards(page)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('lưới stream vào không gây nhảy layout (CLS < 0.1)', async ({ page }) => {
  const errors = collectErrors(page)
  // Script dạng chuỗi: LayoutShift chưa có trong lib DOM của TypeScript
  await page.addInitScript({
    content: `window.__cls = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value
      }).observe({ type: 'layout-shift', buffered: true })`,
  })

  for (const url of ['/danh-muc/van-hoc', '/tim-kiem?q=978', '/en/categories/van-hoc?sort=newest']) {
    await page.goto(url)
    await expect(cards(page).first()).toBeVisible()
    await page.waitForLoadState('networkidle')
    const cls = await page.evaluate(() => Number(Reflect.get(window, '__cls')))
    expect(cls, url).toBeLessThan(0.1)
  }
  expect(errors).toEqual([])
})

test('lưới sách: 2 bìa đầu ưu tiên cao (ảnh LCP), bìa sau không', async ({ page }) => {
  await page.goto('/danh-muc/van-hoc')
  const covers = page.getByRole('main').locator('ul img')
  await expect(covers.nth(0)).toHaveAttribute('fetchpriority', 'high')
  await expect(covers.nth(1)).toHaveAttribute('fetchpriority', 'high')
  await expect(covers.nth(2)).not.toHaveAttribute('fetchpriority', 'high')
  await expect(covers.nth(5)).toHaveAttribute('loading', 'lazy')
})

test('sang trang / sắp xếp: hiện trạng thái đang tải ngay khi bấm, hết khi kết quả mới tới', async ({ page }) => {
  await page.goto('/sach')
  await waitForHydration(page, 'main select')
  const region = page.getByRole('main').locator('[aria-busy="true"]')
  // Làm chậm phản hồi của trang mới để thấy được trạng thái đang tải
  await page.route(/\/sach\?(.*&)?(page=2|sort=price-asc)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    await route.continue()
  })

  await page.getByRole('navigation', { name: 'Phân trang' }).getByRole('link', { name: 'Trang 2' }).click()
  await expect(region).toHaveCount(1, { timeout: 1_000 })
  await expect(page.getByTestId('catalog-loading')).toHaveText('Đang tải kết quả…')
  await expect(page).toHaveURL(/\/sach\?page=2$/)
  await expect(region).toHaveCount(0)

  await page.getByRole('combobox', { name: /Sắp xếp/ }).selectOption('price-asc')
  await expect(region).toHaveCount(1, { timeout: 1_000 })
  await expect(page).toHaveURL(/sort=price-asc/)
  await expect(region).toHaveCount(0)
})
