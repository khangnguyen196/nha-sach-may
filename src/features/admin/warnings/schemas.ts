import { z } from 'zod'
import { CONTENT_WARNINGS, type ContentWarning } from '@/features/warnings/labels'
import { Constants, type Database } from '@/types/database'

// Input của action gợi ý cảnh báo (chỉ server import: action + test). Nhãn dùng chung cho form sửa sách.

/**
 * Ô chọn nhãn (`name` lặp lại, FormData.getAll): chỉ 5 nhãn của enum, ≤ 5 phần tử; bỏ trùng + xếp theo thứ tự enum như
 * trigger của DB (so sánh với nhãn đang lưu không lệch vì thứ tự).
 */
export const contentWarningsSchema = z
  .array(z.enum(Constants.public.Enums.content_warning, { error: 'invalid' }), { error: 'invalid' })
  .max(CONTENT_WARNINGS.length, { error: 'invalid' })
  .transform((labels): ContentWarning[] => CONTENT_WARNINGS.filter((label) => labels.includes(label)))

// timestamptz như PostgREST trả về ("2026-10-25T09:42:01.123456+00:00"); form gửi lại nguyên chuỗi, không qua Date của JS
// (mất phần micro giây → review_warning_suggestion luôn thấy lệch)
const TIMESTAMPTZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/

export const reviewSuggestionSchema = z.object({
  labels: contentWarningsSchema,
  decision: z.enum(['approve', 'dismiss'], { error: 'invalid' }),
  /** content_warnings_reviewed_at của sách lúc mở trang; null = sách chưa xét */
  expectedReviewedAt: z.string().max(40).regex(TIMESTAMPTZ).nullable(),
})

export type ReviewSuggestionInput = z.output<typeof reviewSuggestionSchema>

/** FormData của form duyệt: ô nhãn lặp lại, nút bấm (`decision`), ô ẩn thời điểm xét (rỗng / không có = chưa xét) */
export function reviewSuggestionInput(formData: FormData) {
  const expected = formData.get('expected_reviewed_at')
  return {
    labels: formData.getAll('labels'),
    decision: formData.get('decision'),
    expectedReviewedAt: expected === null || expected === '' ? null : expected,
  }
}

type ReviewArgs = Database['public']['Functions']['review_warning_suggestion']['Args']

/**
 * Tham số RPC review_warning_suggestion. Sách chưa xét → BỎ HẲN khóa p_expected_reviewed_at (SQL `default null`; kiểu
 * CLI sinh là `?: string`, không nhận null), không gửi null. Sách đã xét → nguyên chuỗi đọc từ PostgREST.
 */
export function reviewRpcArgs(id: number, input: ReviewSuggestionInput): ReviewArgs {
  const args: ReviewArgs = { p_id: id, p_labels: input.labels, p_approve: input.decision === 'approve' }
  return input.expectedReviewedAt === null ? args : { ...args, p_expected_reviewed_at: input.expectedReviewedAt }
}

/** Kết quả một lượt của lô gợi ý (suggestNextBatch) */
export type BatchOutcome = {
  /** Số gợi ý vừa ghi */
  inserted: number
  /** Số sách của lượt mà AI không trả mục dùng được (vẫn chưa xét, lượt sau chọn lại) */
  missing: number
  /** Còn sách chưa xét và chưa có gợi ý chờ duyệt */
  remaining: boolean
}
