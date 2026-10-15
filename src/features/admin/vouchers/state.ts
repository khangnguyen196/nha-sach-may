import type { Database } from '@/types/database'

type Voucher = Pick<
  Database['public']['Tables']['vouchers']['Row'],
  'is_active' | 'starts_at' | 'ends_at' | 'usage_limit' | 'used_count'
>

export type VoucherState = 'inactive' | 'scheduled' | 'expired' | 'exhausted' | 'active'

/**
 * Trạng thái hiển thị ở danh sách admin, cùng thứ tự kiểm tra với `private.voucher_discount` (đã tắt → chưa tới giờ →
 * hết hạn → hết lượt). Chỉ để hiển thị: khách dùng được mã hay không do DB quyết định lúc tính tiền.
 */
export function voucherState(voucher: Voucher, now: Date): VoucherState {
  if (!voucher.is_active) return 'inactive'
  if (voucher.starts_at && now < new Date(voucher.starts_at)) return 'scheduled'
  if (voucher.ends_at && now > new Date(voucher.ends_at)) return 'expired'
  if (voucher.usage_limit !== null && voucher.used_count >= voucher.usage_limit) return 'exhausted'
  return 'active'
}
