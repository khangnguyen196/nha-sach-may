import { expect, test } from '@playwright/test'
import { bubble, waitForBubble } from './chat'
import { expectLazyChunkError, waitForHydration } from './helpers'

// Chunk JS tải lười hỏng khi bấm (mạng chập chờn, bản deploy mới): LazyBoundary giữ lỗi tại chỗ, không lên error
// boundary của route / global-error. Gợi ý mã ở trang thanh toán: checkout.spec.ts (cần user).

const SEARCH_TRIGGER = 'header button[aria-haspopup="dialog"]'

test('palette: chunk tải lỗi → khối lỗi, header còn (không global-error); tải lại trang → mở được', async ({ page }) => {
  await page.goto('/')
  await waitForHydration(page, SEARCH_TRIGGER)
  await page.waitForLoadState('networkidle')
  const trigger = page.locator(SEARCH_TRIGGER)

  await expectLazyChunkError(page, trigger)

  await waitForHydration(page, SEARCH_TRIGGER)
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByTestId('lazy-error')).toHaveCount(0)
})

test('palette mở bằng Ctrl K: chunk tải lỗi → khối lỗi; Đóng / Esc → focus về phần tử đang focus lúc nhấn', async ({
  page,
}) => {
  await page.goto('/')
  await waitForHydration(page, SEARCH_TRIGGER)
  await page.waitForLoadState('networkidle')
  // Phần tử đang focus lúc nhấn Ctrl K: logo (link đầu header), không phải nút tìm kiếm (focus nút sẽ tải trước chunk)
  const logo = page.getByRole('banner').locator('a[href="/"]')
  await logo.focus()

  await expectLazyChunkError(page, page.locator(SEARCH_TRIGGER), {
    open: () => page.keyboard.press('ControlOrMeta+k'),
    returnTo: logo,
  })

  // Sau khi tải lại: mở bằng nút như test trên (Ctrl K đã kiểm ở phần lỗi; chờ listener Ctrl K cần networkidle, sau
  // tải lại có thể không bao giờ tới trong thời gian của test)
  await waitForHydration(page, SEARCH_TRIGGER)
  await page.locator(SEARCH_TRIGGER).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('sheet bộ lọc: chunk tải lỗi → khối lỗi tại chỗ; tải lại trang → mở được', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Nút "Bộ lọc" chỉ hiện dưới md')
  const selector = 'main button[aria-haspopup="dialog"]'
  await page.goto('/sach')
  await waitForHydration(page, selector)
  await page.waitForLoadState('networkidle')
  const trigger = page.locator(selector)
  await expect(trigger).toHaveText('Bộ lọc')

  await expectLazyChunkError(page, trigger)

  await waitForHydration(page, selector)
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Bộ lọc' })).toBeVisible()
})

test('khung chat: chunk tải lỗi → khối lỗi tại chỗ; tải lại trang → mở được', async ({ page }) => {
  await page.goto('/')
  await waitForBubble(page)
  await page.waitForLoadState('networkidle')

  await expectLazyChunkError(page, bubble(page))

  await waitForBubble(page)
  await bubble(page).click()
  await expect(page.getByTestId('chat-panel')).toBeVisible()
})
