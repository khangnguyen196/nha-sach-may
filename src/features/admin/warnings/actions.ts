'use server'

import { refresh, updateTag } from 'next/cache'
import { WARNING_LIMITS } from '@/features/chat/config'
import type { WarningBookInput } from '@/features/warnings/prompt'
import type { WarningSuggestion } from '@/features/warnings/schemas'
import { suggestWarnings, type SuggestResult } from '@/features/warnings/suggest'
import { invalidInput, toFailure, type Failure, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '../auth'
import { CHAT_CATALOG_TAG } from '../cache-tags'
import { rowIdSchema } from '../schemas'
import { warningQuotaFailure } from './quota-message'
import { reviewRpcArgs, reviewSuggestionInput, reviewSuggestionSchema, type BatchOutcome } from './schemas'

// Gợi ý nhãn cảnh báo bằng AI (docs/plans/so-thich-canh-bao.md → P-B). Mỗi action gọi suggestWarnings tối đa MỘT lần
// (= một lượt trừ của consume_warning_quota); lô nhiều lượt do trình duyệt admin gọi lần lượt. Client theo phiên: RLS /
// quyền cột của admin. Log chỉ ghi mã lỗi, không ghi tên / mô tả sách.

type Supabase = Awaited<ReturnType<typeof createClient>>

const UNKNOWN: Failure = { ok: false, code: 'UNKNOWN' }
const ITEM_DELETED: Failure = { ok: false, code: 'ITEM_DELETED' }
const AI_FAILED: Failure = { ok: false, code: 'WARNING_AI_FAILED' }
// Sách đã có gợi ý chờ duyệt (unique index content_warning_suggestions_one_pending): tab / lô khác vừa tạo
const UNIQUE_VIOLATION = '23505'

const PROMPT_COLUMNS = 'id, title, description, categories(name), book_authors(role, authors(name))'

type PromptRow = {
  id: number
  title: string
  description: string | null
  categories: { name: string } | null
  book_authors: { role: string; authors: { name: string } | null }[]
}

/** Dữ liệu gửi AI: tác giả vai trò author (như thẻ sách), tên danh mục lá */
function toWarningInput(row: PromptRow): WarningBookInput {
  return {
    id: row.id,
    title: row.title,
    authors: row.book_authors.flatMap((entry) => (entry.role === 'author' && entry.authors ? [entry.authors.name] : [])),
    category: row.categories?.name ?? null,
    description: row.description,
  }
}

async function suggestFailure(result: Extract<SuggestResult, { ok: false }>): Promise<Failure> {
  if (result.code === 'WARNING_QUOTA_EXCEEDED') return warningQuotaFailure(result.scope, result.resetsAt)
  return { ok: false, code: result.code }
}

/** Id gợi ý chờ duyệt của sách, không có → null */
async function readPendingId(supabase: Supabase, bookId: number): Promise<number | null | Failure> {
  const { data, error } = await supabase
    .from('content_warning_suggestions')
    .select('id')
    .eq('book_id', bookId)
    .eq('status', 'pending')
    .maybeSingle()
  if (error) {
    console.error(`[warnings] đọc gợi ý chờ duyệt: ${error.code || '-'}`)
    return toFailure(error)
  }
  return data?.id ?? null
}

type InsertOutcome = { kind: 'inserted'; id: number } | { kind: 'conflict' } | { kind: 'failed'; failure: Failure }

/** Ghi một gợi ý (cột được grant: book_id, labels, reason, model); 23505 = sách vừa có gợi ý chờ duyệt ở nơi khác */
async function insertSuggestion(supabase: Supabase, suggestion: WarningSuggestion, model: string): Promise<InsertOutcome> {
  const { data, error } = await supabase
    .from('content_warning_suggestions')
    .insert({ book_id: suggestion.bookId, labels: suggestion.labels, reason: suggestion.reason, model })
    .select('id')
    .single()
  if (!error) return { kind: 'inserted', id: data.id }
  if (error.code === UNIQUE_VIOLATION) return { kind: 'conflict' }
  console.error(`[warnings] ghi gợi ý: ${error.code || '-'}`)
  return { kind: 'failed', failure: toFailure(error) }
}

/**
 * "Gợi ý bằng AI" cho một sách (form sửa sách; sách đã xét cũng gợi ý lại được). Đã có gợi ý chờ duyệt → trả id gợi ý
 * đó, không gọi AI (không tốn lượt). AI không trả mục nào cho sách → WARNING_AI_FAILED.
 */
export async function suggestOneBook(bookId: number): Promise<Result<{ suggestionId: number }>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const id = rowIdSchema.safeParse(bookId)
  if (!id.success) return UNKNOWN

  const supabase = await createClient()
  const pending = await readPendingId(supabase, id.data)
  if (typeof pending === 'number') {
    // Trang đang mở chưa biết gợi ý này (tạo ở tab / lô khác): làm mới để hiện link "Xem gợi ý"
    refresh()
    return { ok: true, data: { suggestionId: pending } }
  }
  if (pending !== null) return pending

  const book = await supabase.from('books').select(PROMPT_COLUMNS).eq('id', id.data).maybeSingle()
  if (book.error) {
    console.error(`[warnings] đọc sách: ${book.error.code || '-'}`)
    return toFailure(book.error)
  }
  if (!book.data) return ITEM_DELETED

  const result = await suggestWarnings([toWarningInput(book.data)])
  if (!result.ok) return suggestFailure(result)
  const suggestion = result.results.find((item) => item.bookId === id.data)
  if (!suggestion) return AI_FAILED

  const outcome = await insertSuggestion(supabase, suggestion, result.model)
  if (outcome.kind === 'failed') return outcome.failure
  refresh()
  if (outcome.kind === 'inserted') return { ok: true, data: { suggestionId: outcome.id } }
  // Tab khác vừa tạo gợi ý cho đúng sách này: trả gợi ý đó (bản của mình bỏ, lượt đã trừ)
  const existing = await readPendingId(supabase, id.data)
  if (typeof existing === 'number') return { ok: true, data: { suggestionId: existing } }
  return existing ?? UNKNOWN
}

/**
 * Một lượt của lô "Gợi ý cho sách chưa xét". SERVER tự chọn ≤ booksPerCall sách chưa xét, chưa có gợi ý chờ duyệt, theo
 * id (client không gửi id). Không còn sách → trả ngay, không gọi AI (không trừ lượt). AI không trả mục nào dùng được →
 * WARNING_AI_FAILED (lô dừng: tránh gọi lại mãi đúng nhóm sách AI không trả lời).
 */
export async function suggestNextBatch(): Promise<Result<BatchOutcome>> {
  const denied = await assertAdmin()
  if (denied) return denied

  const supabase = await createClient()
  // Một query: lọc gợi ý của sách còn 'pending' rồi chỉ giữ sách không có gợi ý nào như vậy (anti-join của PostgREST).
  // Lấy thêm một cuốn để biết còn sách sau lượt này không.
  const { data, error } = await supabase
    .from('books')
    .select(`${PROMPT_COLUMNS}, content_warning_suggestions(id)`)
    .is('content_warnings_reviewed_at', null)
    .eq('content_warning_suggestions.status', 'pending')
    .is('content_warning_suggestions', null)
    .order('id', { ascending: true })
    .limit(WARNING_LIMITS.booksPerCall + 1)
  if (error) {
    console.error(`[warnings] chọn sách cho lô: ${error.code || '-'}`)
    return toFailure(error)
  }
  if (data.length === 0) return { ok: true, data: { inserted: 0, missing: 0, remaining: false } }

  const batch = data.slice(0, WARNING_LIMITS.booksPerCall)
  const result = await suggestWarnings(batch.map(toWarningInput))
  if (!result.ok) return suggestFailure(result)
  if (result.results.length === 0) return AI_FAILED

  // Từng gợi ý ghi riêng: một sách vừa có gợi ý ở nơi khác (23505) không làm hỏng cả lượt
  const outcomes = await Promise.all(result.results.map((item) => insertSuggestion(supabase, item, result.model)))
  const failed = outcomes.find((outcome) => outcome.kind === 'failed')
  if (failed?.kind === 'failed') return failed.failure

  return {
    ok: true,
    data: {
      inserted: outcomes.filter((outcome) => outcome.kind === 'inserted').length,
      missing: result.missing.length,
      remaining: data.length > batch.length || result.missing.length > 0,
    },
  }
}

/**
 * Duyệt (ghi nhãn admin đã sửa vào sách) / bỏ qua (sách thành đã xét, nhãn không đổi) một gợi ý qua RPC
 * review_warning_suggestion. Thời điểm xét của sách lúc mở trang đi qua ô ẩn, nguyên chuỗi PostgREST; sách chưa xét thì
 * bỏ hẳn tham số (reviewRpcArgs). Gợi ý / nhãn vừa đổi ở nơi khác → SUGGESTION_STATUS_CHANGED + làm mới trang.
 */
export async function reviewSuggestion(
  suggestionId: number,
  _prev: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const id = rowIdSchema.safeParse(suggestionId)
  if (!id.success) return UNKNOWN
  const parsed = reviewSuggestionSchema.safeParse(reviewSuggestionInput(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  const supabase = await createClient()
  const { data: bookId, error } = await supabase.rpc('review_warning_suggestion', reviewRpcArgs(id.data, parsed.data))
  if (error) {
    const failure = toFailure(error)
    if (failure.code === 'SUGGESTION_STATUS_CHANGED') refresh()
    else if (failure.code === 'UNKNOWN') console.error(`[warnings] duyệt gợi ý: ${error.code || '-'}`)
    return failure
  }
  // Nhãn của sách: trang sách + danh sách đang chứa sách (book:{id}); catalog của Mây không gắn tag từng sách
  updateTag(`book:${bookId}`)
  updateTag(CHAT_CATALOG_TAG)
  refresh()
  return { ok: true, data: null }
}

/**
 * "Đánh dấu đã xét (không có cảnh báo)": action DUY NHẤT của admin ghi content_warnings_reviewed_at (Vitest
 * reviewed-at.test.ts). Giờ server; chỉ khi sách còn chưa xét (`.is(…, null)`), mà chưa xét thì nhãn luôn rỗng (check
 * books_content_warnings_reviewed_check: có nhãn ⇒ đã xét). Không bao giờ gửi lại giá trị đã đọc (tránh quay về mốc cũ).
 * 0 dòng = đã có người xét (hoặc sách vừa bị xóa) → làm mới trang, coi như xong.
 */
export async function markReviewedNoWarnings(bookId: number): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const id = rowIdSchema.safeParse(bookId)
  if (!id.success) return UNKNOWN

  const supabase = await createClient()
  const { error } = await supabase
    .from('books')
    .update({ content_warnings_reviewed_at: new Date().toISOString() })
    .eq('id', id.data)
    .is('content_warnings_reviewed_at', null)
  if (error) return toFailure(error)
  // Nhãn vẫn rỗng: cửa hàng không đổi gì → không làm mới cache catalog
  refresh()
  return { ok: true, data: null }
}
