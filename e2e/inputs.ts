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
  await expect(fields, `${label}: không thấy ô nhập nào`).not.toHaveCount(0)
  const sizes = await fields.evaluateAll((elements) =>
    elements.map((element) => ({
      field: element.getAttribute('name') ?? element.getAttribute('id') ?? element.tagName.toLowerCase(),
      size: Number.parseFloat(getComputedStyle(element).fontSize),
    })),
  )
  for (const { field, size } of sizes) {
    expect(size, `${label} → ${field}: ${size}px`).toBeGreaterThanOrEqual(MIN_INPUT_FONT_PX)
  }
  return sizes.length
}
