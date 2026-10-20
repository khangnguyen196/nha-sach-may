import { expect, type Locator } from '@playwright/test'

// iOS Safari tự phóng to khi chạm vào ô nhập có cỡ chữ < 16px (khung bị zoom, nút trôi ra ngoài). Không chặn zoom ở
// viewport (lỗi accessibility) → mọi ô nhập phải ≥ 16px trên mobile.
export const MIN_INPUT_FONT_PX = 16

/** Ô người dùng gõ / chọn được (bỏ ô ẩn, radio, checkbox, nút) */
export const TYPEABLE =
  'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]), textarea, select'

/** Mọi ô nhập đang hiển thị trong `scope` có cỡ chữ ≥ 16px; trả số ô đã kiểm (phải > 0) */
export async function expectReadableInputs(scope: Locator, label: string) {
  const fields = scope.locator(TYPEABLE).filter({ visible: true })
  let checked = 0
  // Ô trong Suspense có thể bị script `$RC` thay đúng lúc đo: ô cũ tách khỏi DOM → fontSize rỗng → NaN (flaky ở /tim-kiem).
  // Lượt nào có ô đã bị tách thì đo lại cả lượt (query lại locator); chỉ qua khi cả lượt đo trọn: số ô > 0, mọi ô ≥ 16px.
  // 5 s = timeout mặc định của expect (bản cũ chờ ô hiện bằng toHaveCount; config không đặt expect.timeout, đặt thì sửa
  // theo); không đặt thì toPass chờ tới hết giờ của test.
  await expect(async () => {
    const sizes = await fields.evaluateAll((elements) =>
      elements.map((element) => ({
        field: element.getAttribute('name') ?? element.getAttribute('id') ?? element.tagName.toLowerCase(),
        connected: element.isConnected,
        size: Number.parseFloat(getComputedStyle(element).fontSize),
      })),
    )
    expect(sizes.length, `${label}: không thấy ô nhập nào`).toBeGreaterThan(0)
    const detached = sizes.filter(({ connected }) => !connected).map(({ field }) => field)
    expect(detached, `${label}: ô bị thay giữa lúc đo`).toEqual([])
    for (const { field, size } of sizes) {
      expect(Number.isFinite(size), `${label} → ${field}: không đo được cỡ chữ (${size})`).toBe(true)
      expect(size, `${label} → ${field}: ${size}px`).toBeGreaterThanOrEqual(MIN_INPUT_FONT_PX)
    }
    checked = sizes.length
  }).toPass({ timeout: 5_000 })
  return checked
}
