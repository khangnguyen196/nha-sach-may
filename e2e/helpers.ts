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

// Phím tắt chỉ có tác dụng sau hydration. Không bấm lặp tới khi mở: ⌘K là toggle, nếu chunk palette tải chậm
// thì lần bấm thứ hai đóng nó lại. React gắn `__reactProps$…` lên DOM node khi hydrate nút, nhưng listener ⌘K
// gắn trong useEffect, chạy sau khi cả cây hydrate xong: trang nhiều card (nhiều Link) + máy bận thì khoảng hở
// này đủ dài để phím bị nuốt → chờ thêm networkidle.
export async function openPalette(page: Page) {
  await waitForHydration(page, 'header button[aria-haspopup="dialog"]')
  await page.waitForLoadState('networkidle')
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
 * còn; "Đóng" → focus về nút, bấm lại vẫn lỗi (React.lazy giữ lỗi tới khi tải lại trang). Cuối cùng bỏ chặn + bấm
 * "Tải lại trang"; người gọi chờ hydrate rồi kiểm phần tải lười mở được.
 */
export async function expectLazyChunkError(page: Page, trigger: Locator) {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const pattern = '**/_next/static/chunks/**'
  let aborted = 0
  const abort = (route: Route) => {
    aborted += 1
    return route.abort('internetdisconnected')
  }
  await page.route(pattern, abort)

  await trigger.click()
  const alert = page.getByTestId('lazy-error')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('Không tải được phần này. Kiểm tra kết nối mạng rồi tải lại trang.')
  expect(aborted).toBeGreaterThan(0)
  await expect(page.getByTestId('error-page')).toHaveCount(0)
  await expect(page.getByRole('banner').locator('a[href="/"]')).toBeVisible()
  await expect(alert.getByRole('button', { name: 'Tải lại trang' })).toBeFocused()

  await alert.getByRole('button', { name: 'Đóng' }).click()
  await expect(alert).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(alert).toBeVisible()
  await expect(page.getByTestId('error-page')).toHaveCount(0)

  await page.unroute(pattern, abort)
  const reloaded = page.waitForEvent('load')
  await alert.getByRole('button', { name: 'Tải lại trang' }).click()
  await reloaded
  // Lỗi tải chunk được LazyBoundary bắt (console.error của React), không có lỗi nào lọt ra ngoài (pageerror)
  expect(pageErrors).toEqual([])
}
