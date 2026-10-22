import { expect, test, type Page } from '@playwright/test'
import { collectErrors, waitForSettled } from './helpers'

// Đồng hồ kim giờ Việt Nam + dòng giờ số và trạng thái cửa hàng ở hero trang chủ (src/features/store). Giờ lấy từ đồng
// hồ của trình duyệt (page.clock), hiển thị theo Asia/Ho_Chi_Minh; mở cửa 06:00 ≤ giờ < 22:00. Không tính ở server /
// lúc prerender: mặt đồng hồ (server) có trong HTML, kim + dòng số chỉ có sau khi JS chạy.

const clock = (page: Page) => page.getByRole('main').getByTestId('store-clock')
const clockFace = (page: Page) => page.getByRole('main').getByTestId('store-clock-face')

/** Góc (độ) của từng kim, đọc từ thuộc tính transform="rotate(<góc> 50 50)" */
async function handAngles(page: Page) {
  return clockFace(page).evaluate((face) => {
    const angles: Record<string, number> = {}
    for (const hand of face.querySelectorAll('[data-hand]')) {
      const match = /^rotate\(([^\s)]+) 50 50\)$/.exec(hand.getAttribute('transform') ?? '')
      const name = hand.getAttribute('data-hand')
      if (!match || !name) throw new Error(`Kim không xoay bằng rotate(… 50 50): ${hand.outerHTML}`)
      angles[name] = Number(match[1])
    }
    return angles
  })
}

/**
 * Đồng hồ chạy theo giây: install (giờ giả chạy như thật) → mở trang → chờ ổn định → dừng ở `pauseUtc`.
 * waitForSettled dùng requestIdleCallback (Playwright làm giả cả hàm này) → gọi TRƯỚC pauseAt, không gọi khi đồng hồ
 * đang dừng. `installUtc` sớm hơn `pauseUtc` ít nhất 3 phút: goto + waitForSettled trên CI (mobile) có thể ăn vài chục
 * giây giờ giả, pauseAt không lùi giờ được.
 */
async function openPausedAt(page: Page, path: string, installUtc: string, pauseUtc: string) {
  if (Date.parse(pauseUtc) - Date.parse(installUtc) < 3 * 60_000) {
    throw new Error('installUtc phải sớm hơn pauseUtc ≥ 3 phút')
  }
  await page.clock.install({ time: new Date(installUtc) })
  await page.goto(path)
  await expect(clock(page).locator('time')).toBeVisible()
  await waitForSettled(page)
  await page.clock.pauseAt(new Date(pauseUtc))
}

const OPEN_VI = 'Cửa hàng đang mở cửa'
const CLOSED_VI = 'Cửa hàng đã đóng cửa'

test('vi: 14:35:00 giờ VN, đang mở cửa, dateTime theo giờ VN', async ({ page }) => {
  const errors = collectErrors(page)
  await page.clock.setFixedTime(new Date('2026-10-22T07:35:00Z'))
  await page.goto('/')
  const line = clock(page)
  await expect(line.locator('time')).toHaveText('14:35:00 giờ Việt Nam')
  await expect(line.locator('time')).toHaveAttribute('datetime', '2026-10-22T14:35:00+07:00')
  await expect(line).toContainText(OPEN_VI)
  await waitForSettled(page)
  expect(errors).toEqual([])
})

test('en: 2:35:00 PM in Vietnam, store is open', async ({ page }) => {
  const errors = collectErrors(page)
  await page.clock.setFixedTime(new Date('2026-10-22T07:35:00Z'))
  await page.goto('/en')
  const line = clock(page)
  await expect(line.locator('time')).toHaveText(/^2:35:00\sPM in Vietnam$/)
  await expect(line.locator('time')).toHaveAttribute('datetime', '2026-10-22T14:35:00+07:00')
  await expect(line).toContainText('Store is open')
  await waitForSettled(page)
  expect(errors).toEqual([])
})

for (const { utc, time, status, dateTime } of [
  { utc: '2026-10-21T22:59:59Z', time: '05:59:59', status: CLOSED_VI, dateTime: '2026-10-22T05:59:59+07:00' },
  { utc: '2026-10-21T23:00:00Z', time: '06:00:00', status: OPEN_VI, dateTime: '2026-10-22T06:00:00+07:00' },
  { utc: '2026-10-22T15:00:00Z', time: '22:00:00', status: CLOSED_VI, dateTime: '2026-10-22T22:00:00+07:00' },
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

test('vi: kim và dòng số theo giây, kim nhảy (không transition / animation)', async ({ page }) => {
  const errors = collectErrors(page)
  await openPausedAt(page, '/', '2026-10-22T07:32:00Z', '2026-10-22T07:35:05Z')
  const time = clock(page).locator('time')
  await expect(time).toHaveText('14:35:05 giờ Việt Nam')
  await expect(time).toHaveAttribute('datetime', '2026-10-22T14:35:05+07:00')
  let angles = await handAngles(page)
  expect(angles.hour).toBeCloseTo(77.5, 1)
  expect(angles.minute).toBeCloseTo(210.5, 1)
  expect(angles.second).toBeCloseTo(30, 1)
  const motion = await clockFace(page)
    .locator('[data-hand]')
    .evaluateAll((hands) =>
      hands.map((hand) => {
        const style = getComputedStyle(hand)
        return { transition: style.transitionDuration, animation: style.animationName }
      }),
    )
  const jump = { transition: '0s', animation: 'none' }
  expect(motion).toEqual([jump, jump, jump])

  // Chưa tới đầu giây kế: chữ và kim giữ nguyên (đọc một lần, không chờ: toHaveText thử lại tới khi khớp). Canh cách
  // cài đổi chữ trước ranh giới giây (VD làm tròn lên, đếm +1 mỗi lần hẹn giờ bắn).
  await page.clock.runFor(999)
  expect(await time.textContent()).toBe('14:35:05 giờ Việt Nam')
  expect((await handAngles(page)).second).toBeCloseTo(30, 1)

  await page.clock.runFor(1)
  await expect(time).toHaveText('14:35:06 giờ Việt Nam')
  await expect(time).toHaveAttribute('datetime', '2026-10-22T14:35:06+07:00')
  angles = await handAngles(page)
  expect(angles.hour).toBeCloseTo(77.5, 1)
  expect(angles.minute).toBeCloseTo(210.6, 1)
  expect(angles.second).toBeCloseTo(36, 1)
  expect(errors).toEqual([])
})

for (const { path, before, after, open, closed } of [
  { path: '/', before: /^21:59:59 giờ Việt Nam$/, after: /^22:00:00 giờ Việt Nam$/, open: OPEN_VI, closed: CLOSED_VI },
  {
    path: '/en',
    before: /^9:59:59\sPM in Vietnam$/,
    after: /^10:00:00\sPM in Vietnam$/,
    open: 'Store is open',
    closed: 'Store is closed',
  },
]) {
  test(`21:59:59 → 22:00:00 giờ VN: giờ và trạng thái đổi cùng lúc: ${path}`, async ({ page }) => {
    const errors = collectErrors(page)
    await openPausedAt(page, path, '2026-10-22T14:56:00Z', '2026-10-22T14:59:59Z')
    const line = clock(page)
    await expect(line.locator('time')).toHaveText(before)
    await expect(line).toContainText(open)
    // Đọc một lần ngay trước 22:00:00: chưa đổi giờ, chưa đóng cửa
    await page.clock.runFor(999)
    expect(await line.locator('time').textContent()).toMatch(before)
    expect(await line.textContent()).toContain(open)
    await page.clock.runFor(1)
    await expect(line.locator('time')).toHaveText(after)
    await expect(line.locator('time')).toHaveAttribute('datetime', '2026-10-22T22:00:00+07:00')
    await expect(line).toContainText(closed)
    expect(errors).toEqual([])
  })
}

test.describe('giảm chuyển động', () => {
  test.use({ reducedMotion: 'reduce' })

  test('không kim giây, dòng số giờ:phút', async ({ page }) => {
    const errors = collectErrors(page)
    await page.clock.setFixedTime(new Date('2026-10-22T07:35:05Z'))
    await page.goto('/')
    const time = clock(page).locator('time')
    await expect(time).toHaveText('14:35 giờ Việt Nam')
    await expect(time).toHaveAttribute('datetime', '2026-10-22T14:35+07:00')
    await expect(clockFace(page).locator('[data-hand="second"]')).toHaveCount(0)
    await expect(clockFace(page).locator('[data-hand="hour"]')).toHaveCount(1)
    await expect(clockFace(page).locator('[data-hand="minute"]')).toHaveCount(1)
    // Nhịp phút: kim phút đứng ở đầu phút (05 giây không tính)
    const angles = await handAngles(page)
    expect(angles.hour).toBeCloseTo(77.5, 1)
    expect(angles.minute).toBeCloseTo(210, 1)
    await waitForSettled(page)
    expect(errors).toEqual([])
  })

  test('cập nhật mỗi phút: 21:59 → 22:00, đóng cửa', async ({ page }) => {
    const errors = collectErrors(page)
    await openPausedAt(page, '/', '2026-10-22T14:56:00Z', '2026-10-22T14:59:30Z')
    const line = clock(page)
    await expect(line.locator('time')).toHaveText('21:59 giờ Việt Nam')
    await expect(line).toContainText(OPEN_VI)
    // Đọc một lần ngay trước 22:00: chưa đổi giờ, chưa đóng cửa
    await page.clock.runFor(29_999)
    expect(await line.locator('time').textContent()).toBe('21:59 giờ Việt Nam')
    expect(await line.textContent()).toContain(OPEN_VI)
    await page.clock.runFor(1)
    await expect(line.locator('time')).toHaveText('22:00 giờ Việt Nam')
    await expect(line.locator('time')).toHaveAttribute('datetime', '2026-10-22T22:00+07:00')
    await expect(line).toContainText(CLOSED_VI)
    expect(errors).toEqual([])
  })
})

test('đổi giảm chuyển động khi trang đang mở: kim giây và giây mất / hiện lại', async ({ page }) => {
  const errors = collectErrors(page)
  await openPausedAt(page, '/', '2026-10-22T07:32:00Z', '2026-10-22T07:35:05Z')
  const time = clock(page).locator('time')
  const secondHand = clockFace(page).locator('[data-hand="second"]')
  await expect(time).toHaveText('14:35:05 giờ Việt Nam')
  await expect(secondHand).toHaveCount(1)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(time).toHaveText('14:35 giờ Việt Nam')
  await expect(time).toHaveAttribute('datetime', '2026-10-22T14:35+07:00')
  await expect(secondHand).toHaveCount(0)

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(time).toHaveText('14:35:05 giờ Việt Nam')
  await expect(secondHand).toHaveCount(1)
  expect(errors).toEqual([])
})

test('tab ẩn thì dừng hẹn giờ, hiện lại thì nhảy ngay tới giờ mới', async ({ page }) => {
  const errors = collectErrors(page)
  await openPausedAt(page, '/', '2026-10-22T07:32:00Z', '2026-10-22T07:35:05Z')
  const time = clock(page).locator('time')
  await expect(time).toHaveText('14:35:05 giờ Việt Nam')

  const setVisibility = (state: 'hidden' | 'visible') =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value === 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    }, state)

  await setVisibility('hidden')
  await page.clock.runFor(5000)
  // Đọc một lần, không chờ: toHaveText thử lại tới khi khớp nên không bắt được chữ đã đổi
  expect(await time.textContent()).toBe('14:35:05 giờ Việt Nam')
  expect((await handAngles(page)).second).toBeCloseTo(30, 1)

  // Không runFor: hiện lại là tính giờ ngay
  await setVisibility('visible')
  await expect(time).toHaveText('14:35:10 giờ Việt Nam')
  expect((await handAngles(page)).second).toBeCloseTo(60, 1)
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
    // Mặt đồng hồ nằm trọn trong màn hình
    const face = await clockFace(page).evaluate((element) => {
      const box = element.getBoundingClientRect()
      return { left: box.left, right: box.right, viewportWidth: window.innerWidth }
    })
    expect(face.left, utc).toBeGreaterThanOrEqual(0)
    expect(face.right, utc).toBeLessThanOrEqual(face.viewportWidth)
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
    // Style tiêm nằm ngoài @layer nên thắng class Tailwind. 1.5rem = 200% text-xs: cả câu (vi ~545px, en ~430px) không
    // vừa một dòng 288px, từng cụm vẫn vừa (đo 2026-10-23, Chromium, có giây: giờ + dấu chấm vi "22:00:00" ~278px;
    // en "10:00:00 PM": riêng cụm giờ ~275px, cụm giờ + dấu chấm ~287px; trạng thái vi ~271px). Cỡ lớn hơn thì cụm
    // giờ + dấu chấm en dài nhất không còn vừa 288px.
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
    // Khoảng trắng trước dấu chấm là \u00a0 (dấu chấm dính với giờ khi dòng 1 gần đầy). Ở 1.5rem dòng 1 còn thừa chỗ nên
    // trình duyệt không ngắt trước dấu chấm kể cả với khoảng trắng thường → câu so top không canh được \u00a0, phải so
    // textContent (không dùng toHaveText: Playwright gộp khoảng trắng, coi \u00a0 như dấu cách).
    expect(size.dotText).toBe('\u00a0· ')
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

    test(`mặt đồng hồ có mặt, tròn đúng cỡ, không kim: ${path}`, async ({ page }) => {
      await page.goto(path)
      const face = clockFace(page)
      await expect(face).toBeVisible()
      await expect(face.locator('[data-hand]')).toHaveCount(0)
      const viewport = page.viewportSize()
      if (!viewport) throw new Error('Không có viewport')
      // size-28 (112px) dưới sm (640px), sm:size-36 (144px) từ sm: Pixel 7 rộng 412px, Desktop Chrome 1280px
      const expected = viewport.width >= 640 ? 144 : 112
      const box = await face.boundingBox()
      if (!box) throw new Error('Không đo được mặt đồng hồ')
      expect(box.width).toBeCloseTo(expected, 1)
      expect(box.height).toBeCloseTo(expected, 1)
    })
  }
})

test('HTML prerender không chứa giờ / trạng thái / kim của đồng hồ', async ({ request }) => {
  for (const path of ['/', '/en']) {
    const html = await (await request.get(path)).text()
    // Chuỗi đã dịch vẫn có trong dữ liệu RSC (props của client leaf), nhưng phần tử đồng hồ trong HTML phải rỗng
    const element = /<p[^>]*data-testid="store-clock"[^>]*>([\s\S]*?)<\/p>/.exec(html)
    expect(element, path).not.toBeNull()
    expect(element?.[1], path).toBe('')
    expect(html, path).not.toMatch(/\d{1,2}:\d{2}(:\d{2})?(\s[AP]M)? (giờ Việt Nam|in Vietnam)/)
    // Mặt đồng hồ (server) có trong HTML, kim thì không: kim chỉ vẽ khi đã biết giờ của khách
    expect(html, path).toContain('data-testid="store-clock-face"')
    expect(html, path).not.toContain('data-hand')
  }
})
