import { expect, test, type Page } from '@playwright/test'
import { collectErrors, waitForSettled } from './helpers'

// Đồng hồ giờ Việt Nam + trạng thái cửa hàng ở hero trang chủ (src/features/store). Giờ lấy từ đồng hồ của trình duyệt
// (page.clock), hiển thị theo Asia/Ho_Chi_Minh; mở cửa 06:00 ≤ giờ < 22:00. Không tính ở server / lúc prerender.

const clock = (page: Page) => page.getByRole('main').getByTestId('store-clock')

const OPEN_VI = 'Cửa hàng đang mở cửa'
const CLOSED_VI = 'Cửa hàng đã đóng cửa'

test('vi: 14:35 giờ VN, đang mở cửa, dateTime theo giờ VN', async ({ page }) => {
  const errors = collectErrors(page)
  await page.clock.setFixedTime(new Date('2026-10-22T07:35:00Z'))
  await page.goto('/')
  const line = clock(page)
  await expect(line.locator('time')).toHaveText('14:35 giờ Việt Nam')
  await expect(line.locator('time')).toHaveAttribute('datetime', '2026-10-22T14:35+07:00')
  await expect(line).toContainText(OPEN_VI)
  await waitForSettled(page)
  expect(errors).toEqual([])
})

test('en: 2:35 PM in Vietnam, store is open', async ({ page }) => {
  const errors = collectErrors(page)
  await page.clock.setFixedTime(new Date('2026-10-22T07:35:00Z'))
  await page.goto('/en')
  const line = clock(page)
  await expect(line.locator('time')).toHaveText(/^2:35\sPM in Vietnam$/)
  await expect(line.locator('time')).toHaveAttribute('datetime', '2026-10-22T14:35+07:00')
  await expect(line).toContainText('Store is open')
  await waitForSettled(page)
  expect(errors).toEqual([])
})

for (const { utc, time, status, dateTime } of [
  { utc: '2026-10-21T22:59:00Z', time: '05:59', status: CLOSED_VI, dateTime: '2026-10-22T05:59+07:00' },
  { utc: '2026-10-21T23:00:00Z', time: '06:00', status: OPEN_VI, dateTime: '2026-10-22T06:00+07:00' },
  { utc: '2026-10-22T15:00:00Z', time: '22:00', status: CLOSED_VI, dateTime: '2026-10-22T22:00+07:00' },
]) {
  test(`vi: mốc ${time} giờ VN → ${status}`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.clock.setFixedTime(new Date(utc))
    await page.goto('/')
    const line = clock(page)
    await expect(line.locator('time')).toHaveText(`${time} giờ Việt Nam`)
    await expect(line.locator('time')).toHaveAttribute('datetime', dateTime)
    await expect(line).toContainText(status)
    await waitForSettled(page)
    expect(errors).toEqual([])
  })
}

test('vi: 21:59 → sang 22:00 thì giờ và trạng thái đổi cùng lúc', async ({ page }) => {
  const errors = collectErrors(page)
  // install: giờ giả vẫn chạy như thật; bắt đầu đúng 21:59:00 để còn gần cả phút trước mốc 22:00
  await page.clock.install({ time: new Date('2026-10-22T14:59:00Z') })
  await page.goto('/')
  const line = clock(page)
  await expect(line.locator('time')).toHaveText('21:59 giờ Việt Nam')
  await expect(line).toContainText(OPEN_VI)
  await waitForSettled(page)
  await page.clock.runFor(60_000)
  await expect(line.locator('time')).toHaveText('22:00 giờ Việt Nam')
  await expect(line.locator('time')).toHaveAttribute('datetime', '2026-10-22T22:00+07:00')
  await expect(line).toContainText(CLOSED_VI)
  expect(errors).toEqual([])
})

test('en: 9:59 PM → 10:00 PM, store is closed', async ({ page }) => {
  const errors = collectErrors(page)
  await page.clock.install({ time: new Date('2026-10-22T14:59:00Z') })
  await page.goto('/en')
  const line = clock(page)
  await expect(line.locator('time')).toHaveText(/^9:59\sPM in Vietnam$/)
  await expect(line).toContainText('Store is open')
  await waitForSettled(page)
  await page.clock.runFor(60_000)
  await expect(line.locator('time')).toHaveText(/^10:00\sPM in Vietnam$/)
  await expect(line.locator('time')).toHaveAttribute('datetime', '2026-10-22T22:00+07:00')
  await expect(line).toContainText('Store is closed')
  expect(errors).toEqual([])
})

test('màn hình 320px: không tràn ngang, đồng hồ một dòng, cao bằng chỗ giữ', async ({ page, browser }) => {
  const viewport = { width: 320, height: 640 }
  // Chỗ giữ: HTML server, chưa có JS
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport })
  let placeholderHeight: number
  try {
    const staticPage = await noJs.newPage()
    await staticPage.goto('/')
    const box = await clock(staticPage).boundingBox()
    if (!box) throw new Error('Không đo được chỗ giữ của đồng hồ')
    placeholderHeight = box.height
    expect(placeholderHeight).toBeGreaterThan(0)
  } finally {
    await noJs.close()
  }

  await page.setViewportSize(viewport)
  for (const utc of ['2026-10-22T07:35:00Z', '2026-10-22T15:00:00Z']) {
    await page.clock.setFixedTime(new Date(utc))
    await page.goto('/')
    const line = clock(page)
    await expect(line.locator('time')).toBeVisible()
    await waitForSettled(page)
    const size = await line.evaluate((element) => {
      const time = element.querySelector('time')
      const status = element.lastElementChild
      if (!time || !status) throw new Error('Thiếu <time> hoặc trạng thái trong đồng hồ')
      return {
        height: element.getBoundingClientRect().height,
        lineHeight: parseFloat(getComputedStyle(element).lineHeight),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        timeRects: time.getClientRects().length,
        statusRects: status.getClientRects().length,
        timeTop: time.getBoundingClientRect().top,
        statusTop: status.getBoundingClientRect().top,
      }
    })
    // Chữ xuống dòng làm ô cao hơn chỗ giữ (min-h 1 dòng) → hai câu so chiều cao bắt được.
    // scrollHeight ≤ clientHeight: canh trường hợp quay lại chiều cao cố định h-[1lh]; lỗi xuống dòng do hai câu so chiều
    // cao và câu so top bắt.
    expect(size.height, utc).toBeCloseTo(placeholderHeight, 1)
    expect(size.height, utc).toBeCloseTo(size.lineHeight, 1)
    expect(size.scrollWidth, utc).toBeLessThanOrEqual(size.clientWidth)
    expect(size.scrollHeight, utc).toBeLessThanOrEqual(size.clientHeight)
    // Giờ và trạng thái cùng một dòng
    expect(size.timeRects, utc).toBe(1)
    expect(size.statusRects, utc).toBe(1)
    expect(Math.abs(size.timeTop - size.statusTop), utc).toBeLessThan(1)
    const doc = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(doc.scrollWidth, utc).toBeLessThanOrEqual(doc.clientWidth)
  }
})

for (const path of ['/', '/en']) {
  test(`màn hình 320px, chữ đồng hồ phóng to: xuống dòng sau dấu chấm, không tràn ngang: ${path}`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.setViewportSize({ width: 320, height: 640 })
    await page.clock.setFixedTime(new Date('2026-10-22T07:35:00Z'))
    await page.goto(path)
    const line = clock(page)
    await expect(line.locator('time')).toBeVisible()
    await waitForSettled(page)
    // Chỉ phóng to đồng hồ, không phóng cả html: spacing Tailwind tính bằng rem, phóng cả trang thì phần khác có thể tràn.
    // Style tiêm nằm ngoài @layer nên thắng class Tailwind. 1.5rem = 200% text-xs: cả câu (vi ~510px, en ~390px) không
    // vừa một dòng 288px, cụm dài nhất (trạng thái vi ~271px) vẫn vừa. 2rem thì riêng cụm giờ vi đã ~295px > 288px.
    await page.addStyleTag({ content: '[data-testid="store-clock"] { font-size: 1.5rem }' })
    const size = await line.evaluate((element) => {
      const time = element.querySelector('time')
      const dot = element.children[1]
      const status = element.lastElementChild
      if (!time || !dot || !status) throw new Error('Thiếu <time>, dấu chấm hoặc trạng thái trong đồng hồ')
      return {
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        // Đo mép phải của chữ, không của <p>: <p> là khối rộng cả dòng nên mép phải luôn trong màn hình dù chữ tràn
        statusRight: status.getBoundingClientRect().right,
        dotRight: dot.getBoundingClientRect().right,
        viewportWidth: window.innerWidth,
        timeRects: time.getClientRects().length,
        statusRects: status.getClientRects().length,
        timeTop: time.getBoundingClientRect().top,
        dotText: dot.textContent,
        dotTop: dot.getBoundingClientRect().top,
        statusTop: status.getBoundingClientRect().top,
      }
    })
    expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth)
    expect(size.statusRight).toBeLessThanOrEqual(size.viewportWidth)
    expect(size.dotRight).toBeLessThanOrEqual(size.viewportWidth)
    // Mỗi cụm nguyên một dòng, trạng thái xuống dòng dưới giờ
    expect(size.timeRects).toBe(1)
    expect(size.statusRects).toBe(1)
    expect(size.statusTop).toBeGreaterThan(size.timeTop + 1)
    // Khoảng trắng trước dấu chấm là   (dấu chấm dính với giờ khi dòng 1 gần đầy). Ở 1.5rem dòng 1 còn thừa chỗ nên
    // trình duyệt không ngắt trước dấu chấm kể cả với khoảng trắng thường → câu so top không canh được  , phải so
    // textContent (không dùng toHaveText: Playwright gộp khoảng trắng, coi   như dấu cách).
    expect(size.dotText).toBe(' · ')
    // Dấu chấm không bị tách hẳn sang dòng 2
    expect(Math.abs(size.dotTop - size.timeTop)).toBeLessThan(1)
    expect(errors).toEqual([])
  })
}

test('trang chủ vi + en không nhảy layout (CLS < 0.1)', async ({ page }) => {
  const errors = collectErrors(page)
  await page.clock.setFixedTime(new Date('2026-10-22T07:35:00Z'))
  // Script dạng chuỗi: LayoutShift chưa có trong lib DOM của TypeScript (cách đo như catalog.spec.ts)
  await page.addInitScript({
    content: `window.__cls = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value
      }).observe({ type: 'layout-shift', buffered: true })`,
  })

  for (const url of ['/', '/en']) {
    await page.goto(url)
    await expect(clock(page).locator('time')).toBeVisible()
    await waitForSettled(page)
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.querySelectorAll('main img')].every((img) => {
            if (!(img instanceof HTMLImageElement)) return true
            const box = img.getBoundingClientRect()
            return img.complete || box.top >= window.innerHeight || box.bottom <= 0
          }),
        ),
      )
      .toBe(true)
    const cls = await page.evaluate(() => Number(Reflect.get(window, '__cls')))
    expect(cls, url).toBeLessThan(0.1)
  }
  expect(errors).toEqual([])
})

test.describe('tắt JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  for (const path of ['/', '/en']) {
    test(`chỗ giữ có mặt, rỗng, không có <time>: ${path}`, async ({ page }) => {
      await page.goto(path)
      const line = clock(page)
      await expect(line).toHaveCount(1)
      await expect(line).toHaveText('')
      await expect(line).toHaveAttribute('aria-hidden', 'true')
      await expect(line.locator('time')).toHaveCount(0)
    })
  }
})

test('HTML prerender không chứa giờ / trạng thái của đồng hồ', async ({ request }) => {
  for (const path of ['/', '/en']) {
    const html = await (await request.get(path)).text()
    // Chuỗi đã dịch vẫn có trong dữ liệu RSC (props của client leaf), nhưng phần tử đồng hồ trong HTML phải rỗng
    const element = /<p[^>]*data-testid="store-clock"[^>]*>([\s\S]*?)<\/p>/.exec(html)
    expect(element, path).not.toBeNull()
    expect(element?.[1], path).toBe('')
    expect(html, path).not.toMatch(/\d{1,2}:\d{2}(\s[AP]M)? (giờ Việt Nam|in Vietnam)/)
  }
})
