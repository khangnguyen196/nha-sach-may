import { z } from 'zod'
import { LISTING_STATUSES } from '@/features/used/status'
import { rowIdSchema } from '../schemas'

/** = check used_listings_reject_reason_length và giới hạn của review_used_listing */
export const REJECT_REASON_MAX = 500

/**
 * Tin admin đang xem: id do page bind, trạng thái đang hiển thị gửi qua ô ẩn `expected_status` (cả hai đi qua client nên
 * parse lại). RPC review_used_listing so `expected_status` với trạng thái thật: khác → LISTING_STATUS_CHANGED.
 */
export const reviewTargetSchema = z.object({
  id: rowIdSchema,
  expected_status: z.enum(LISTING_STATUSES),
})

/**
 * Lý do từ chối / gỡ tin (bắt buộc; người bán đọc ở "Sách tôi bán"). CRLF của textarea → LF, cắt khoảng trắng hai đầu
 * trước khi đếm.
 */
export const rejectReasonSchema = z.object({
  reason: z
    .string({ error: 'listingRejectReason' })
    .transform((value) => value.replace(/\r\n?/g, '\n').trim())
    .pipe(
      z
        .string()
        .min(1, { error: 'listingRejectReason' })
        .max(REJECT_REASON_MAX, { error: 'listingRejectReason' }),
    ),
})
