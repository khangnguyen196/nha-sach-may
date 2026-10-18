import type { ErrorCode, ErrorDetails } from '@/lib/errors'

// Lỗi của mã giảm giá khi báo giá: hiện dưới ô mã, tổng tính lại không voucher (không làm vỡ trang).
// INVALID_VOUCHER: bản DB trước migration B (ux-messages) gộp mọi lý do vào một mã; production chạy mã cũ từ lúc deploy
// bản app này tới lúc chạy B.
export const VOUCHER_ERRORS: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'VOUCHER_NOT_FOUND',
  'VOUCHER_INACTIVE',
  'VOUCHER_NOT_STARTED',
  'VOUCHER_EXPIRED',
  'VOUCHER_EXHAUSTED',
  'INVALID_VOUCHER',
  'VOUCHER_MIN_ORDER',
])

/**
 * VOUCHER_MIN_ORDER: số tiền còn thiếu + đơn tối thiểu. Migration B gửi `shortfall` trong detail; DB trước B chỉ có
 * `min_order_value` → tính từ tạm tính (cùng tạm tính quote_order vừa trả). Không có `min_order_value` → null.
 */
export function minOrderShortfall(
  details: ErrorDetails | undefined,
  subtotal: number,
): { shortfall: number; min_order_value: number } | null {
  const min = details?.min_order_value
  if (typeof min !== 'number') return null
  const fromDb = details?.shortfall
  return { shortfall: typeof fromDb === 'number' ? fromDb : Math.max(min - subtotal, 0), min_order_value: min }
}
