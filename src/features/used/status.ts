/**
 * Trạng thái tin sách cũ (enum public.used_listing_status). Chép tay vì types sinh từ DB (src/types/database.ts) chưa có
 * enum này tới khi tải artifact database-types của CI; Vitest đối chiếu với schema.sql.
 */
export const LISTING_STATUSES = ['pending', 'approved', 'rejected', 'sold', 'withdrawn'] as const

export type ListingStatus = (typeof LISTING_STATUSES)[number]

/**
 * Trạng thái tin được phép chuyển tới, trùng bảng `private.used_listing_transition_allowed` (trigger chặn ở DB với mọi
 * role; Vitest đối chiếu với schema.sql). approved → pending: người bán sửa tin; approved → rejected: admin gỡ tin;
 * sold → approved: đơn bị hủy (trigger của đơn làm).
 */
const TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  pending: ['approved', 'rejected', 'withdrawn'],
  approved: ['pending', 'sold', 'withdrawn', 'rejected'],
  rejected: ['pending', 'withdrawn'],
  sold: ['approved'],
  withdrawn: [],
}

export function nextListingStatuses(status: ListingStatus): readonly ListingStatus[] {
  return TRANSITIONS[status]
}
