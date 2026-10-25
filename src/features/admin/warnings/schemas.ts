import { z } from 'zod'
import { CONTENT_WARNINGS, type ContentWarning } from '@/features/warnings/labels'
import { Constants, type Database } from '@/types/database'

// Input của action gợi ý cảnh báo; contentWarningsSchema dùng chung cho schema form sửa sách (books/schemas.ts, file đó
// cũng bị form client import để lấy hằng: zod đã nằm trong bundle admin từ trước, không vào trang cửa hàng).

/**
 * Ô chọn nhãn (`name` lặp lại, FormData.getAll): chỉ 5 nhãn của enum, ≤ 5 phần tử; bỏ trùng + xếp theo thứ tự enum như
 * trigger của DB (so sánh với nhãn đang lưu không lệch vì thứ tự).
 */
export const contentWarningsSchema = z
  .array(z.enum(Constants.public.Enums.content_warning, { error: 'invalid' }), { error: 'invalid' })
  .max(CONTENT_WARNINGS.length, { error: 'invalid' })
  .transform((labels): ContentWarning[] => CONTENT_WARNINGS.filter((label) => labels.includes(label)))

export const reviewSuggestionSchema = z.object({
  labels: contentWarningsSchema,
  decision: z.enum(['approve', 'dismiss'], { error: 'invalid' }),
  /**
   * content_warnings_reviewed_at của sách lúc mở trang; null = sách chưa xét. timestamptz như PostgREST trả về
   * ("2026-10-25T09:42:01.123456+00:00", cùng kiểu expected_updated_at của chợ sách cũ); form gửi lại nguyên chuỗi, không
   * qua Date của JS (mất phần micro giây → review_warning_suggestion luôn thấy lệch)
   */
  expectedReviewedAt: z.iso.datetime({ offset: true }).nullable(),
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
  /** Sách của lượt mà AI không trả mục dùng được (vẫn chưa xét, lượt sau chọn lại); tên chỉ để hiện cho admin */
  missing: { id: number; title: string }[]
  /** Sách của lượt vừa có gợi ý chờ duyệt (mình ghi, hoặc nơi khác vừa ghi: 23505): client bỏ khỏi danh sách `missing` cũ */
  suggested: number[]
  /** Còn sách chưa xét và chưa có gợi ý chờ duyệt */
  remaining: boolean
}
