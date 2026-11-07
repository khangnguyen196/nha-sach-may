import { expect, test, type Locator, type Page } from '@playwright/test'
import { collectErrors, FOCUS_RING_PX, waitForSettled } from './helpers'

// Nghiêng bìa sách (đợt sach-nghieng-3d): .book-tilt trên link thẻ, .book-tilt-cover trên khung bìa (src/app/globals.css).
// Máy tính (hover: hover, pointer: fine): hover + focus-visible thì bìa nghiêng + bóng; giảm chuyển động chỉ đổi bóng.
// Điện thoại (hover: none): chỉ :active, nhả tay là về. Giả định dữ liệu (lưới /sach ≥ 2 thẻ, kệ đầu trang chủ ≥ 2 thẻ):
// scripts/e2e-seed.test.ts (book-tilt).

const cards = (scope: Locator) => scope.locator('[data-book-slot] > a.book-tilt')
const coverOf = (card: Locator) => card.locator('.book-tilt-cover')
const transformOf = (cover: Locator) => cover.evaluate((element) => getComputedStyle(element).transform)
const shadowOf = (cover: Locator) => cover.evaluate((element) => getComputedStyle(element).boxShadow)
/** Chỗ trống trên header (không thuộc thẻ sách nào): đưa chuột ra khỏi thẻ */
const moveAway = (page: Page) => page.mouse.move(1, 1)

/** Chờ transition của bìa chạy xong (CSS transition nằm trong getAnimations) */
async function settleCover(cover: Locator) {
  await cover.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)))
}

/** Focus bằng bàn phím (focus-visible): focus thẻ kế tiếp rồi Shift+Tab về thẻ cần thử */
async function keyboardFocus(page: Page, card: Locator, next: Locator) {
  await next.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(card).toBeFocused()
  expect(await card.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
}

async function openGrid(page: Page) {
  await page.goto('/sach')
  await waitForSettled(page)
  const grid = cards(page.getByRole('main'))
  expect(await grid.count()).toBeGreaterThanOrEqual(2)
  return grid
}

test('(a) desktop /sach: rê chuột → bìa nghiêng 3D + có bóng; rời chuột → về none', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Hover chỉ có ở máy tính; điện thoại: (f)')
  const errors = collectErrors(page)
  const grid = await openGrid(page)
  const cover = coverOf(grid.first())
  expect(await transformOf(cover)).toBe('none')
  expect(await shadowOf(cover)).toBe('none')

  await grid.first().hover()
  await expect.poll(() => transformOf(cover)).toMatch(/^matrix3d\(/)
  expect(await shadowOf(cover)).not.toBe('none')

  await moveAway(page)
  await expect.poll(() => transformOf(cover)).toBe('none')
  await expect.poll(() => shadowOf(cover)).toBe('none')
  expect(errors).toEqual([])
})

test('(b) desktop, giảm chuyển động: hover / focus bàn phím chỉ đổi bóng, transform luôn none', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Hover / focus-visible chỉ có ở máy tính')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const grid = await openGrid(page)
  const card = grid.first()
  const cover = coverOf(card)

  await card.hover()
  // Bóng đổi = quy tắc hover đã áp → lúc đó transform phải vẫn none
  await expect.poll(() => shadowOf(cover)).not.toBe('none')
  expect(await transformOf(cover)).toBe('none')

  await moveAway(page)
  await expect.poll(() => shadowOf(cover)).toBe('none')
  await keyboardFocus(page, card, grid.nth(1))
  await expect.poll(() => shadowOf(cover)).not.toBe('none')
  expect(await transformOf(cover)).toBe('none')
})

test('(c) desktop: focus bàn phím (focus-visible) → bìa nghiêng', async ({ page, isMobile }) => {
  test.skip(isMobile, 'focus-visible nghiêng chỉ ở máy tính (hover: hover)')
  const grid = await openGrid(page)
  await moveAway(page)
  await keyboardFocus(page, grid.first(), grid.nth(1))
  await expect.poll(() => transformOf(coverOf(grid.first()))).toMatch(/^matrix3d\(/)
})

test('(d) desktop 390 / 1280: đang rê chuột thẻ, trang không tràn ngang (/, /sach, /cho-sach-cu)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Hover chỉ có ở máy tính; khổ 390 đặt bằng setViewportSize')
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    // /cho-sach-cu: lưới tin dùng chung DB của mọi project (tin do spec *-account tạo, chạy song song) nên có thể
    // rỗng → chỉ đo trang khi có thẻ để rê chuột; đo không tràn vẫn chạy ở mọi lượt
    for (const path of ['/', '/sach', '/cho-sach-cu']) {
      await page.goto(path)
      await waitForSettled(page)
      const visible = cards(page.getByRole('main')).filter({ visible: true })
      if (path !== '/cho-sach-cu') expect(await visible.count(), path).toBeGreaterThan(0)
      if ((await visible.count()) > 0) {
        await visible.first().hover()
        await expect.poll(() => transformOf(coverOf(visible.first())), `${width} ${path}`).toMatch(/^matrix3d\(/)
        await settleCover(coverOf(visible.first()))
      }
      const { innerWidth, scrollWidth, viewport } = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }))
      expect(innerWidth, `${width} ${path}`).toBe(width)
      expect(scrollWidth, `${width} ${path}`).toBeLessThanOrEqual(viewport)
    }
  }
})

type Edges = { top: number; right: number; bottom: number; left: number }

/**
 * Hộp đã biến đổi của bìa nới thêm phần bóng (mỗi lớp của box-shadow: lệch + blur + spread, kể cả ánh cam --glow) và
 * vòng focus của link; trả kèm hộp của danh sách cuộn (vùng cắt: overflow-x-auto cắt cả chiều dọc).
 */
async function shelfEdges(card: Locator): Promise<{ outer: Edges; clip: Edges; layers: number; scrollLeft: number }> {
  return card.evaluate((link, ring) => {
    const cover = link.querySelector('.book-tilt-cover')
    const scroller = link.closest('ul')
    if (!cover || !scroller) throw new Error('Thiếu .book-tilt-cover hoặc ul của kệ')
    // Tách lớp bóng ở dấu phẩy ngoài ngoặc, bỏ mọi chữ trong ngoặc (màu rgb(…), oklab(…), color-mix(…) lồng nhau)
    const layers: string[] = ['']
    let depth = 0
    for (const char of getComputedStyle(cover).boxShadow) {
      if (char === '(') depth += 1
      if (depth === 0 && char === ',') layers.push('')
      else if (depth === 0) layers[layers.length - 1] += char
      if (char === ')') depth -= 1
    }
    const extent = { top: 0, right: 0, bottom: 0, left: 0 }
    for (const layer of layers) {
      if (layer.trim() === 'none' || layer.includes('inset')) continue
      const numbers = layer.match(/-?[\d.]+px/g)?.map((value) => Number.parseFloat(value))
      if (!numbers || numbers.length < 2) throw new Error(`Không đọc được lớp bóng: ${layer}`)
      const [x = 0, y = 0, blur = 0, spread = 0] = numbers
      extent.top = Math.max(extent.top, blur + spread - y)
      extent.bottom = Math.max(extent.bottom, blur + spread + y)
      extent.left = Math.max(extent.left, blur + spread - x)
      extent.right = Math.max(extent.right, blur + spread + x)
    }
    const box = cover.getBoundingClientRect()
    const linkBox = link.getBoundingClientRect()
    const clip = scroller.getBoundingClientRect()
    return {
      outer: {
        top: Math.min(box.top - extent.top, linkBox.top - ring),
        right: Math.max(box.right + extent.right, linkBox.right + ring),
        bottom: Math.max(box.bottom + extent.bottom, linkBox.bottom + ring),
        left: Math.min(box.left - extent.left, linkBox.left - ring),
      },
      clip: { top: clip.top, right: clip.right, bottom: clip.bottom, left: clip.left },
      layers: layers.length,
      scrollLeft: scroller.scrollLeft,
    }
  }, FOCUS_RING_PX)
}

test('(e) desktop 1280, kệ đầu trang chủ: bìa nghiêng + bóng + vòng focus của thẻ đầu nằm trọn trong vùng cuộn', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Hover / focus-visible chỉ có ở máy tính')
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await waitForSettled(page)
  const list = page.getByRole('main').locator('ul[id$="-list"]').first()
  const shelfCards = cards(list)
  expect(await shelfCards.count()).toBeGreaterThanOrEqual(2)
  const card = shelfCards.first()
  const cover = coverOf(card)

  const expectInside = async (label: string) => {
    await expect.poll(() => transformOf(cover), label).toMatch(/^matrix3d\(/)
    await settleCover(cover)
    const { outer, clip, layers, scrollLeft } = await shelfEdges(card)
    expect(scrollLeft, label).toBe(0)
    // shadow-lg 2 lớp + --glow (giao diện tối mặc định)
    expect(layers, label).toBe(3)
    expect(outer.top, `${label}: trên`).toBeGreaterThanOrEqual(clip.top)
    expect(outer.left, `${label}: trái`).toBeGreaterThanOrEqual(clip.left)
    expect(outer.right, `${label}: phải`).toBeLessThanOrEqual(clip.right)
    expect(outer.bottom, `${label}: dưới`).toBeLessThanOrEqual(clip.bottom)
  }

  await card.hover()
  await expectInside('hover')

  await moveAway(page)
  await expect.poll(() => transformOf(cover)).toBe('none')
  await keyboardFocus(page, card, shelfCards.nth(1))
  await expectInside('focus-visible')
})

test('(f) điện thoại: chạm thẻ → nhả tay bìa về none (không giữ nghiêng)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Chạm (hasTouch) chỉ ở project mobile')
  const errors = collectErrors(page)
  const grid = await openGrid(page)
  // Giữ trang: chặn điều hướng của link thẻ (capture trên window chạy trước listener của React / Link)
  await page.evaluate(() =>
    window.addEventListener(
      'click',
      (event) => {
        if (event.target instanceof Element && event.target.closest('a[data-book-link]')) event.preventDefault()
      },
      true,
    ),
  )
  const url = page.url()
  const card = grid.first()
  const cover = coverOf(card)
  expect(await transformOf(cover)).toBe('none')
  // Giới hạn: tap() nhả ngay và Chromium chạy ẩn không bật :active bằng chạm giả lập → test chỉ chứng minh không giữ
  // nghiêng sau khi nhả; nghiêng lúc :active đã kiểm tay (D:/Bán sách-backup/sach-nghieng-3d/sau/active-check.txt)
  await card.tap()
  await expect.poll(() => transformOf(cover)).toBe('none')
  await settleCover(cover)
  expect(await transformOf(cover)).toBe('none')
  expect(page.url()).toBe(url)
  expect(errors).toEqual([])
})
