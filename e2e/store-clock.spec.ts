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

/** Giả tab ẩn / hiện: đặt visibilityState rồi bắn visibilitychange (component đọc lại giờ ngay khi tab hiện) */
async function setVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => value === 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  }, state)
}

/** Giá trị dateTime (có giây) của mốc UTC theo giờ VN: "2026-10-22T02:00:05+07:00" */
const vnDateTime = (utcMs: number) => `${new Date(utcMs + 7 * 3600_000).toISOString().slice(0, 19)}+07:00`

/** left (px) của dấu chấm và trạng thái trong dòng đồng hồ */
function dotAndStatusLeft(page: Page) {
  return clock(page).evaluate((element) => {
    const dot = element.children[1]
    const status = element.lastElementChild
    if (!dot || !status) throw new Error('Thiếu dấu chấm hoặc trạng thái trong đồng hồ')
    return { dot: dot.getBoundingClientRect().left, status: status.getBoundingClientRect().left }
  })
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
        return {
          transition: style.transitionDuration,
          animation: style.animationName,
          running: hand.getAnimations().length,
        }
      }),
    )
  const jump = { transition: '0s', animation: 'none', running: 0 }
  expect(motion).toEqual([jump, jump, jump])

  // Chưa tới đầu giây kế: chữ và kim giữ nguyên (đọc một lần, không chờ: toHaveText thử lại tới khi khớp). Đọc trước
  // visibilitychange canh hẹn giờ bắn sớm / đếm +1 mỗi lần bắn. Hẹn giờ bắn đúng .000 nên mọi lần React tự đọc giờ đều ở
  // số chẵn giây (làm tròn lên = làm tròn xuống): visibilitychange bắt React đọc lại giờ ở .999 → đọc sau đó canh làm
  // tròn lên.
  await page.clock.runFor(999)
  expect(await time.textContent()).toBe('14:35:05 giờ Việt Nam')
  expect((await handAngles(page)).second).toBeCloseTo(30, 1)
  await setVisibility(page, 'visible')
  expect(await time.textContent()).toBe('14:35:05 giờ Việt Nam')
  expect(await time.getAttribute('datetime')).toBe('2026-10-22T14:35:05+07:00')
  expect((await handAngles(page)).second).toBeCloseTo(30, 1)

  await page.clock.runFor(1)
  await expect(time).toHaveText('14:35:06 giờ Việt Nam')
  await expect(time).toHaveAttribute('datetime', '2026-10-22T14:35:06+07:00')
  // Transition / animation chỉ có trong getAnimations() khi đang chạy: câu đọc ở trên (kim chưa đổi) luôn ra 0, phải đọc
  // ngay sau lần kim đổi
  const runningAfterTick = await clockFace(page)
    .locator('[data-hand]')
    .evaluateAll((hands) => hands.map((hand) => hand.getAnimations().length))
  expect(runningAfterTick).toEqual([0, 0, 0])
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
    // Đọc một lần ngay trước 22:00:00: chưa đổi giờ, chưa đóng cửa (trước visibilitychange: hẹn giờ bắn sớm; sau: làm
    // tròn lên, xem test nhịp giây)
    await page.clock.runFor(999)
    expect(await line.locator('time').textContent()).toMatch(before)
    expect(await line.textContent()).toContain(open)
    await setVisibility(page, 'visible')
    const lineText = await line.textContent()
    expect(lineText).toContain(open)
    expect(lineText).not.toContain(closed)
    expect(await line.locator('time').textContent()).toMatch(before)
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
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    const start = await dotAndStatusLeft(page)
    // Đọc một lần ngay trước 22:00: chưa đổi giờ, chưa đóng cửa (trước visibilitychange: hẹn giờ bắn sớm; sau: làm
    // tròn lên, xem test nhịp giây)
    await page.clock.runFor(29_999)
    expect(await line.locator('time').textContent()).toBe('21:59 giờ Việt Nam')
    expect(await line.textContent()).toContain(OPEN_VI)
    await setVisibility(page, 'visible')
    const lineText = await line.textContent()
    expect(lineText).toContain(OPEN_VI)
    expect(lineText).not.toContain(CLOSED_VI)
    expect(await line.locator('time').textContent()).toBe('21:59 giờ Việt Nam')
    await page.clock.runFor(1)
    await expect(line.locator('time')).toHaveText('22:00 giờ Việt Nam')
    await expect(line.locator('time')).toHaveAttribute('datetime', '2026-10-22T22:00+07:00')
    await expect(line).toContainText(CLOSED_VI)
    // Ô giờ rộng cố định: "21:59" → "22:00" khác bề rộng nhưng dấu chấm và trạng thái đứng yên
    const end = await dotAndStatusLeft(page)
    expect(Math.abs(end.dot - start.dot)).toBeLessThan(0.01)
    expect(Math.abs(end.status - start.status)).toBeLessThan(0.01)
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

  await setVisibility(page, 'hidden')
  await page.clock.runFor(5000)
  // Đọc một lần, không chờ: toHaveText thử lại tới khi khớp nên không bắt được chữ đã đổi
  expect(await time.textContent()).toBe('14:35:05 giờ Việt Nam')
  expect((await handAngles(page)).second).toBeCloseTo(30, 1)

  // Không runFor: hiện lại là tính giờ ngay
  await setVisibility(page, 'visible')
  await expect(time).toHaveText('14:35:10 giờ Việt Nam')
  expect((await handAngles(page)).second).toBeCloseTo(60, 1)
  expect(errors).toEqual([])
})

for (const { path, installUtc, pauseUtc, firstText, lastText, lastStatus } of [
  {
    path: '/',
    installUtc: '2026-10-21T18:56:00Z',
    pauseUtc: '2026-10-21T18:59:55Z',
    firstText: /^01:59:55 giờ Việt Nam$/,
    lastText: /^02:00:05 giờ Việt Nam$/,
    lastStatus: CLOSED_VI,
  },
  {
    // 9:59:55 PM → 10:00:05 PM: giờ thêm một chữ số, trạng thái sang đóng cửa
    path: '/en',
    installUtc: '2026-10-22T14:56:00Z',
    pauseUtc: '2026-10-22T14:59:55Z',
    firstText: /^9:59:55\sPM in Vietnam$/,
    lastText: /^10:00:05\sPM in Vietnam$/,
    lastStatus: 'Store is closed',
  },
]) {
  test(`dấu chấm và trạng thái đứng yên 10 giây liên tiếp: ${path}`, async ({ page }) => {
    const errors = collectErrors(page)
    await openPausedAt(page, path, installUtc, pauseUtc)
    // Ô giờ đo theo font đã tải: trước đó (display: swap) đo theo font dự phòng
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    const line = clock(page)
    const time = line.locator('time')
    await expect(time).toHaveText(firstText)
    // Mẫu (chữ ở ::after) không vào textContent; mọi mẫu ẩn khỏi trình đọc màn hình; <p> vẫn 3 phần tử
    expect(await time.textContent()).toMatch(firstText)
    const samples = await line
      .locator('[data-clock-sample]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-hidden')))
    expect(samples.length).toBe(1)
    expect(samples.every((value) => value === 'true')).toBe(true)
    expect(await line.evaluate((element) => element.children.length)).toBe(3)

    const start = await dotAndStatusLeft(page)
    for (let second = 1; second <= 10; second++) {
      await page.clock.runFor(1000)
      await expect(time).toHaveAttribute('datetime', vnDateTime(Date.parse(pauseUtc) + second * 1000))
      const now = await dotAndStatusLeft(page)
      expect(Math.abs(now.dot - start.dot), `giây ${second}`).toBeLessThan(0.01)
      expect(Math.abs(now.status - start.status), `giây ${second}`).toBeLessThan(0.01)
    }
    await expect(time).toHaveText(lastText)
    await expect(line).toContainText(lastStatus)
    expect(errors).toEqual([])
  })
}

for (const { path, locale, reduced } of [
  { path: '/', locale: 'vi', reduced: false },
  { path: '/', locale: 'vi', reduced: true },
  { path: '/en', locale: 'en', reduced: false },
  { path: '/en', locale: 'en', reduced: true },
]) {
  test(`ô giờ rộng ≥ mọi chuỗi giờ trong ngày: ${path}${reduced ? ', giảm chuyển động' : ''}`, async ({ page }) => {
    const errors = collectErrors(page)
    // Mốc ô giờ (WIDEST_TIME_UTC) đo bằng script ngoài repo; test này đo lại cả ngày bằng font của trang
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' })
    await page.clock.setFixedTime(new Date('2026-10-22T07:35:00Z'))
    await page.goto(path)
    const time = clock(page).locator('time')
    await expect(time).toHaveText(reduced ? /^\d{1,2}:\d{2}(\sPM)? / : /^\d{1,2}:\d{2}:\d{2}(\sPM)? /)
    await waitForSettled(page)
    const result = await time.evaluate(
      async (element, { locale, withSeconds }) => {
        await document.fonts.ready
        const cell = element.querySelector('[data-clock-sample]')?.parentElement
        const value = cell?.lastElementChild
        if (!cell || !value) throw new Error('Thiếu ô giờ trong <time>')
        const sample = cell.firstElementChild?.getAttribute('data-clock-sample')
        if (!sample) throw new Error('Thiếu chữ mẫu data-clock-sample của ô giờ')
        const style = getComputedStyle(value)
        const context = document.createElement('canvas').getContext('2d')
        if (!context) throw new Error('Không có canvas 2d')
        context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        // Cùng định dạng với formatVnTime (src/features/store/hours.ts)
        const format = new Intl.DateTimeFormat(locale, {
          timeZone: 'Asia/Ho_Chi_Minh',
          timeStyle: withSeconds ? 'medium' : 'short',
        })
        const step = withSeconds ? 1000 : 60_000
        const start = Date.UTC(2026, 0, 1) - 7 * 3600_000
        let widest = { text: '', width: 0 }
        for (let at = start; at < start + 86_400_000; at += step) {
          const text = format.format(new Date(at))
          const width = context.measureText(text).width
          if (width > widest.width) widest = { text, width }
        }
        return {
          widest,
          cellWidth: cell.getBoundingClientRect().width,
          sampleWidth: context.measureText(sample).width,
        }
      },
      { locale, withSeconds: !reduced },
    )
    // Ô giờ rộng bằng chữ mẫu: canvas đo mẫu phải ra đúng bề rộng ô. Gán context.font sai cú pháp thì canvas lặng lẽ giữ
    // 10px sans-serif, canvas chưa nhận webfont thì đo bằng font dự phòng: số nhỏ hơn thật làm câu dưới xanh giả.
    expect(Math.abs(result.sampleWidth - result.cellWidth), 'canvas đo đúng font của ô').toBeLessThan(0.05)
    // Canvas lệch DOM tối đa ~0.016px (đo 2026-10-23)
    expect(result.widest.width, result.widest.text).toBeLessThanOrEqual(result.cellWidth + 0.05)
    expect(errors).toEqual([])
  })
}

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

for (const { path, utc, text } of [
  { path: '/', utc: '2025-12-31T21:44:44Z', text: /^04:44:44 giờ Việt Nam$/ },
  { path: '/en', utc: '2026-01-01T03:44:44Z', text: /^10:44:44\sAM in Vietnam$/ },
  { path: '/en', utc: '2025-12-31T17:00:00Z', text: /^12:00:00\sAM in Vietnam$/ },
]) {
  test(`màn hình 320px, chữ đồng hồ phóng to, ${utc}: xuống dòng, không tràn ngang: ${path}`, async ({ page }) => {
    const errors = collectErrors(page)
    await page.setViewportSize({ width: 320, height: 640 })
    await page.clock.setFixedTime(new Date(utc))
    await page.goto(path)
    const line = clock(page)
    await expect(line.locator('time')).toHaveText(text)
    await waitForSettled(page)
    // Chỉ phóng to đồng hồ, không phóng cả html: spacing Tailwind tính bằng rem, phóng cả trang thì phần khác có thể tràn.
    // Style tiêm nằm ngoài @layer nên thắng class Tailwind. 1.5rem = 200% text-xs: cả câu không vừa một dòng 288px.
    // Ô giờ luôn rộng bằng giờ rộng nhất trong ngày nên đo ở mốc nào cũng là bề rộng lớn nhất; vẫn đặt giờ rộng nhất
    // (vi 04:44:44, en 10:44:44 AM) và thêm 12:00:00 AM (nửa đêm) cho en. Đo 2026-10-23, Chromium, Be Vietnam Pro: vi ô
    // giờ + "giờ Việt Nam" + dấu chấm 283 / 288px → 2 dòng (ngắt sau dấu chấm); en 292 > 288px → thêm chỗ ngắt sau ô giờ,
    // 3 dòng: giờ / "in Vietnam ·" / trạng thái. Trạng thái vi ~271px.
    await page.addStyleTag({ content: '[data-testid="store-clock"] { font-size: 1.5rem }' })
    const size = await line.evaluate((element) => {
      const time = element.querySelector('time')
      const cell = time?.querySelector('[data-clock-sample]')?.parentElement
      const words = time?.lastElementChild
      const dot = element.children[1]
      const status = element.lastElementChild
      if (!time || !cell || !words || !dot || !status) {
        throw new Error('Thiếu <time>, ô giờ, chữ sau giờ, dấu chấm hoặc trạng thái trong đồng hồ')
      }
      return {
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        // Đo mép phải của chữ, không của <p>: <p> là khối rộng cả dòng nên mép phải luôn trong màn hình dù chữ tràn
        statusRight: status.getBoundingClientRect().right,
        dotRight: dot.getBoundingClientRect().right,
        cellRight: cell.getBoundingClientRect().right,
        viewportWidth: window.innerWidth,
        timeRects: time.getClientRects().length,
        cellRects: cell.getClientRects().length,
        wordsText: words.textContent,
        wordsRects: words.getClientRects().length,
        wordsTop: words.getBoundingClientRect().top,
        statusRects: status.getClientRects().length,
        dotText: dot.textContent,
        dotTop: dot.getBoundingClientRect().top,
        statusTop: status.getBoundingClientRect().top,
      }
    })
    expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth)
    expect(size.statusRight).toBeLessThanOrEqual(size.viewportWidth)
    expect(size.dotRight).toBeLessThanOrEqual(size.viewportWidth)
    // Ô inline-grid không bao giờ tách dòng (cellRects luôn 1): phải đo mép phải để biết ô có tràn khỏi màn hình
    expect(size.cellRight).toBeLessThanOrEqual(size.viewportWidth)
    // Ô giờ, chữ sau giờ và trạng thái mỗi thứ nguyên một dòng; trạng thái xuống dòng dưới dấu chấm
    expect(size.cellRects).toBe(1)
    expect(size.wordsText).toBe(path === '/' ? 'giờ Việt Nam' : 'in Vietnam')
    expect(size.wordsRects).toBe(1)
    expect(size.statusRects).toBe(1)
    expect(size.statusTop).toBeGreaterThan(size.dotTop + 1)
    // vi vừa 283 / 288px: cả <time> một dòng (en không khẳng định: ngắt sau ô giờ)
    if (path === '/') expect(size.timeRects).toBe(1)
    // Khoảng trắng trước dấu chấm là \u00a0 (dấu chấm dính với chữ sau giờ khi dòng gần đầy). Ở 1.5rem dòng còn thừa
    // chỗ nên trình duyệt không ngắt trước dấu chấm kể cả với khoảng trắng thường → câu so top không canh được \u00a0,
    // phải so textContent (không dùng toHaveText: Playwright gộp khoảng trắng, coi \u00a0 như dấu cách).
    expect(size.dotText).toBe('\u00a0· ')
    // Dấu chấm cùng dòng với "giờ Việt Nam" / "in Vietnam", không bị tách sang dòng riêng
    expect(Math.abs(size.dotTop - size.wordsTop)).toBeLessThan(1)
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
