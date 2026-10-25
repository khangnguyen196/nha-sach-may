import 'server-only'
import { z } from 'zod'
import { WARNING_GEMINI } from '@/features/chat/config'
import { cleanOutput } from '@/features/chat/sanitize'
import { CONTENT_WARNINGS, type ContentWarning } from './labels'

// Kết quả gợi ý của Gemini là dữ liệu không tin cậy (mô tả sách có thể chứa câu lệnh): chỉ nhận đúng sách của lô, đúng
// 5 nhãn, một câu lý do vừa cột reason. Mục hỏng thì bỏ mục đó (sách rơi vào `missing`), không bỏ cả lô.

/** Trường lạ bị bỏ (z.object mặc định strip); từng mục parse riêng để một mục hỏng không kéo cả lô */
const replySchema = z.object({ books: z.array(z.unknown()) })
const itemSchema = z.object({ id: z.string(), labels: z.array(z.unknown()), reason: z.string() })

export type WarningSuggestion = { bookId: number; labels: ContentWarning[]; reason: string }
export type ParsedWarnings = { results: WarningSuggestion[]; missing: number[] }

/**
 * Lý do: làm sạch như chữ AI viết cho khách (bỏ thẻ / link / ký tự điều khiển, gộp khoảng trắng), rồi cắt ≤ reasonMax
 * đơn vị UTF-16 theo từng code point: không bao giờ cắt giữa cặp surrogate, và số ký tự (char_length của Postgres)
 * cũng ≤ reasonMax.
 */
export function clampReason(text: string, max: number = WARNING_GEMINI.reasonMax): string {
  const cleaned = cleanOutput(text, Number.POSITIVE_INFINITY)
  if (cleaned.length <= max) return cleaned
  let out = ''
  for (const char of cleaned) {
    if (out.length + char.length > max) break
    out += char
  }
  return out.trimEnd()
}

/** Nhãn lạ → bỏ nhãn đó (mục vẫn giữ: admin duyệt lại); trùng → bỏ trùng; xếp theo thứ tự enum như trigger của DB */
function normalizeLabels(labels: readonly unknown[]): ContentWarning[] {
  return CONTENT_WARNINGS.filter((label) => labels.includes(label))
}

/**
 * Parse câu trả lời của một lô. JSON hỏng / sai khung → null (WARNING_AI_FAILED). id không thuộc lô → bỏ; id xuất hiện
 * > 1 lần → bỏ mọi lần (không biết lần nào đúng); lý do rỗng sau khi làm sạch → bỏ mục. Sách của lô không còn mục nào
 * → `missing` (theo thứ tự của lô).
 */
export function parseWarningReply(text: string, batchIds: readonly number[]): ParsedWarnings | null {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  const reply = replySchema.safeParse(json)
  if (!reply.success) return null

  const batch = new Map(batchIds.map((id) => [String(id), id]))
  const items = reply.data.books.flatMap((raw) => {
    const item = itemSchema.safeParse(raw)
    return item.success ? [item.data] : []
  })
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.id, (counts.get(item.id) ?? 0) + 1)

  const results = items.flatMap((item): WarningSuggestion[] => {
    const bookId = batch.get(item.id)
    if (bookId === undefined || counts.get(item.id) !== 1) return []
    const reason = clampReason(item.reason)
    if (!reason) return []
    return [{ bookId, labels: normalizeLabels(item.labels), reason }]
  })
  const answered = new Set(results.map((result) => result.bookId))
  return { results, missing: batchIds.filter((id) => !answered.has(id)) }
}
