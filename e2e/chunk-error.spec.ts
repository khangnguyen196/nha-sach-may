import { expect, test, type Page } from '@playwright/test'
import { bubble } from './chat'
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

// Như openChat (e2e/chat.ts): chờ React gắn handler lên đúng bong bóng đang hiển thị
async function waitForBubble(page: Page) {
  await expect(bubble(page)).toBeVisible()
  await expect
    .poll(() => bubble(page).evaluate((element) => Object.keys(element).some((key) => key.startsWith('__reactProps'))))
    .toBe(true)
}
