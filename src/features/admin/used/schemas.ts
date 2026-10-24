import { z } from 'zod'
import { LISTING_STATUSES } from '@/features/used/status'
import { rowIdSchema } from '../schemas'

/** = check used_listings_reject_reason_length và giới hạn của review_used_listing */
export const REJECT_REASON_MAX = 500

/** Đủ cho chuỗi timestamptz của PostgREST (VD `2026-10-24T05:05:00.123456+00:00`, 32 ký tự) */
export const EXPECTED_UPDATED_AT_MAX = 64

/**
 * Tin admin đang xem: id do page bind, trạng thái + `updated_at` đang hiển thị gửi qua ô ẩn `expected_status`,
 * `expected_updated_at` (đều đi qua client nên parse lại). RPC review_used_listing so cả hai với giá trị thật sau khi
 * khóa dòng (`updated_at` gửi nguyên chuỗi PostgREST trả về, DB đọc thành timestamptz). Khác → LISTING_STATUS_CHANGED.
 */
export const reviewTargetSchema = z.object({
  id: rowIdSchema,
  expected_status: z.enum(LISTING_STATUSES),
  expected_updated_at: z.string().min(1).max(EXPECTED_UPDATED_AT_MAX),
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
