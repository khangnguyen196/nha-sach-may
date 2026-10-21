import { expect, type Locator, type Page, type Route } from '@playwright/test'

export function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    // "Failed to load resource" của Chromium không ghi URL trong chữ: kèm URL của request lỗi để biết request nào
    // (chẩn đoán mục 15 ux-messages). Không bỏ / lọc dòng nào: mọi lỗi console vẫn làm test fail như cũ.
    const { url } = message.location()
    const resource = message.text().startsWith('Failed to load resource') && url ? ` [${url}]` : ''
    errors.push(`${message.text()}${resource}`)
  })
  return errors
}

/**
 * collectErrors cho trang trả 404 thật: Chromium log "Failed to load resource" cho chính tài liệu 404 → bỏ dòng đó,
 * thay bằng ghi mọi response lỗi không phải điều hướng (chunk, RSC, prefetch…).
 */
export function collectErrorsAllow404(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) errors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.request().isNavigationRequest()) {
      errors.push(`${response.status()} ${response.url()}`)
    }
  })
  return errors
}

/**
 * Trang đã ổn định để đo / bấm phím tắt: mọi Suspense đã stream và đã hiện (không còn comment `$?` chờ dữ liệu hay `$~`
 * chờ `$RV` của React hiện ra), font đã tải, main thread rảnh (requestIdleCallback: React hydrate xong, effect đã chạy).
 * Thay waitForLoadState('networkidle'): trang có nhiều Link (kệ, lưới sách) prefetch `_rsc` liên tục nên mạng có thể không
 * bao giờ yên (flaky layout.spec.ts run 39527729395: quá 30 s, mọi request 200).
 */
export async function waitForSettled(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT)
          let pending = 0
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.nodeValue === '$?' || node.nodeValue === '$~') pending += 1
          }
          return pending
        }),
      // Thay networkidle (vốn chờ tới hết 30 s của test), không phải tăng timeout: phần stream chậm nhất (kệ "Cùng danh
      // mục", lưới) lần đầu chưa có cache
      { timeout: 15_000 },
    )
    .toBe(0)
  await page.evaluate(async () => {
    await document.fonts.ready
    // Hai lần: giảm (không loại bỏ) khả năng rơi vào khoảng main thread rảnh vì chờ chunk JS giữa lúc hydrate
    for (let round = 0; round < 2; round++) await new Promise((resolve) => requestIdleCallback(() => resolve(null)))
  })
}

// Phím tắt chỉ có tác dụng sau hydration. Không bấm lặp tới khi mở: ⌘K là toggle, nếu chunk palette tải chậm
// thì lần bấm thứ hai đóng nó lại. React gắn `__reactProps$…` lên DOM node khi hydrate nút, nhưng listener ⌘K
// gắn trong useEffect, chạy sau khi cả cây hydrate xong: trang nhiều card (nhiều Link) + máy bận thì khoảng hở
// này đủ dài để phím bị nuốt → chờ trang ổn định (waitForSettled: main thread rảnh tức effect đã chạy).
export async function openPalette(page: Page) {
  await waitForHydration(page, 'header button[aria-haspopup="dialog"]')
  await waitForSettled(page)
  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  return dialog
}

export async function waitForHydration(page: Page, selector: string) {
  await page.waitForFunction((sel) => {
    const element = document.querySelector(sel)
    return element !== null && Object.keys(element).some((key) => key.startsWith('__reactProps'))
  }, selector)
}

/** Form địa chỉ (Phase 4), dùng ở sổ địa chỉ và luồng "Thêm địa chỉ" từ trang thanh toán */
export async function fillAddress(
  page: Page,
  address: { name: string; phone: string; province: string; ward: string; street: string },
) {
  // Ô tỉnh nạp phường qua fetch trong onChange → phải chờ hydrate trước khi chọn
  await waitForHydration(page, 'main form select[name="province"]')
  await page.getByRole('main').getByLabel('Tên người nhận').fill(address.name)
  await page.getByRole('main').getByLabel('Số điện thoại').fill(address.phone)
  await page.getByRole('main').getByLabel('Tỉnh/Thành phố').selectOption({ label: address.province })
  const ward = page.getByRole('main').getByLabel('Phường/Xã')
  await expect(ward.locator('option', { hasText: address.ward })).toHaveCount(1)
  await ward.selectOption({ label: address.ward })
  await page.getByRole('main').getByLabel('Số nhà, tên đường').fill(address.street)
}

/**
 * Mất mạng đúng lúc gửi form: chặn request Server Action (POST có header `next-action`) tới `url`, các request khác (trang,
 * RSC, ảnh) đi bình thường. Trả về hàm bỏ chặn.
 */
export async function failServerActions(page: Page, url: string) {
  const handler = async (route: Route) => {
    const request = route.request()
    if (request.method() !== 'POST' || !request.headers()['next-action']) return route.continue()
    await route.abort('internetdisconnected')
  }
  await page.route(url, handler)
  return () => page.unroute(url, handler)
}

/**
 * Chunk tải lười hỏng (LazyBoundary, `components/lazy-boundary.tsx`). Gọi khi trang đã tải xong và CHƯA rê chuột / focus
 * vào `trigger` (rê chuột / focus tải trước chunk → bấm sẽ không cần request nào, test qua giả). Chặn mọi chunk tải sau
 * lúc này → bấm `trigger` → khối lỗi tại chỗ: có request bị chặn thật, trang không thành trang lỗi / global-error, header
 * còn; "Đóng" → focus về nút, bấm lại vẫn lỗi (React.lazy giữ lỗi tới khi tải lại trang), Esc cũng đóng. Cuối cùng bỏ
 * chặn + bấm "Tải lại trang"; người gọi chờ hydrate rồi kiểm phần tải lười mở được.
 * `open`: cách mở (mặc định bấm `trigger`; palette còn mở bằng Ctrl K, focus về phần tử đang focus lúc nhấn: `returnTo`).
 */
export async function expectLazyChunkError(
  page: Page,
  trigger: Locator,
  {
    open: customOpen,
    returnTo = trigger,
    expanded = false,
  }: {
    open?: () => Promise<void>
    returnTo?: Locator
    /** Nút có aria-expanded (sheet, chat): phải là false khi khối lỗi hiện, kể cả khi bấm lại */
    expanded?: boolean
  } = {},
) {
  const open = customOpen ?? (() => trigger.click())
  // Khối lỗi nổi dưới header có thể che nút mở (sheet bộ lọc trên mobile) → khi khối lỗi còn hiện, mở lại bằng bàn phím
  const reopenWhileShown =
    customOpen ??
    (async () => {
      await trigger.focus()
      await page.keyboard.press('Enter')
    })
  const pageErrors: string[] = []
  const onPageError = (error: Error) => pageErrors.push(error.message)
  page.on('pageerror', onPageError)
  const pattern = '**/_next/static/chunks/**'
  let aborted = 0
  const abort = (route: Route) => {
    aborted += 1
    return route.abort('internetdisconnected')
  }
  await page.route(pattern, abort)

  await open()
  const alert = page.getByTestId('lazy-error')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('Không tải được phần này. Kiểm tra kết nối mạng rồi tải lại trang.')
  expect(aborted).toBeGreaterThan(0)
  await expect(page.getByTestId('error-page')).toHaveCount(0)
  await expect(page.getByRole('banner').locator('a[href="/"]')).toBeVisible()
  await expect(alert.getByRole('button', { name: 'Tải lại trang' })).toBeFocused()
  const expectNotExpanded = () =>
    expanded
      ? expect(trigger).toHaveAttribute('aria-expanded', 'false')
      : expect(trigger).not.toHaveAttribute('aria-expanded')
  // Không có gì mở ra → nút mở không báo "đang mở"; mở lại khi khối lỗi còn hiện cũng không đổi gì
  await expectNotExpanded()
  await reopenWhileShown()
  await expect(alert).toBeVisible()
  await expectNotExpanded()
  await alert.getByRole('button', { name: 'Tải lại trang' }).focus()

  await alert.getByRole('button', { name: 'Đóng' }).click()
  await expect(alert).toHaveCount(0)
  await expect(returnTo).toBeFocused()
  await open()
  await expect(alert).toBeVisible()
  await expect(page.getByTestId('error-page')).toHaveCount(0)
  await expect(alert.getByRole('button', { name: 'Tải lại trang' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(alert).toHaveCount(0)
  await expect(returnTo).toBeFocused()
  await open()
  await expect(alert).toBeVisible()

  await page.unroute(pattern, abort)
  const reloaded = page.waitForEvent('load')
  await alert.getByRole('button', { name: 'Tải lại trang' }).click()
  await reloaded
  page.off('pageerror', onPageError)
  // Lỗi tải chunk được LazyBoundary bắt (console.error của React), không có lỗi nào lọt ra ngoài (pageerror)
  expect(pageErrors).toEqual([])
}

/**
 * ★8 (docs/plans/no-js.md): chặn mọi chunk JS TRƯỚC khi vào trang (không chặn CSS: CSS trong <head> chặn hiển thị, mạng
 * chậm thật vẫn có CSS trước khi khách bấm được) → React không hydrate, script inline `$RC` vẫn lộ phần stream. Đếm
 * request POST để chứng minh bấm nút khóa không gửi gì.
 */
export async function blockHydration(page: Page) {
  const pattern = /\/_next\/static\/chunks\/.*\.js(\?|$)/
  const abort = (route: Route) => route.abort()
  await page.route(pattern, abort)
  let posts = 0
  page.on('request', (request) => {
    if (request.method() === 'POST') posts += 1
  })
  return {
    posts: () => posts,
    /** Đếm lại từ 0 (bỏ POST của bước trước, VD trang vừa đăng nhập còn chạy effect lúc vào trang cần đo) */
    resetPosts: () => {
      posts = 0
    },
    unblock: () => page.unroute(pattern, abort),
  }
}

/**
 * Nút gửi khóa khi chưa hydrate (disabled + aria-disabled), bấm (cả Enter trong ô nhập nếu có) không gửi POST, trang
 * không trắng (`visible` vẫn hiện). Sau đó bỏ chặn, tải lại, chờ hydrate → nút bật.
 */
export async function expectLockedUntilHydrated(
  page: Page,
  blocked: Awaited<ReturnType<typeof blockHydration>>,
  { submit, selector, input, visible }: { submit: Locator; selector: string; input?: Locator; visible: Locator },
) {
  await expect(submit).toBeVisible()
  await expect(submit).toBeDisabled()
  await expect(submit).toHaveAttribute('aria-disabled', 'true')
  await submit.click({ force: true })
  if (input) await input.press('Enter')
  // Request (nếu có) đi ngay khi bấm; 500 ms đủ để trình duyệt phát POST ra mạng (chỉ đo có / không, không chờ phản hồi)
  await page.waitForTimeout(500)
  expect(blocked.posts()).toBe(0)
  await expect(visible).toBeVisible()

  await blocked.unblock()
  await page.reload()
  await waitForHydration(page, selector)
  await expect(page.locator(selector).first()).toBeEnabled()
  await expect(page.locator(selector).first()).toHaveAttribute('aria-disabled', 'false')
}
