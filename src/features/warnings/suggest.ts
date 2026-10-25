import 'server-only'
import { DEFAULT_MODEL, WARNING_GEMINI, WARNING_LIMITS } from '@/features/chat/config'
import { activeCooldown, callGemini, GLOBAL_COOLDOWN, type QuotaScope } from '@/features/chat/gemini'
import { mockWarningFetch } from './mock'
import { resolveWarningMode } from './mode'
import { buildWarningRequestBody, type WarningBookInput } from './prompt'
import { consumeWarningQuota, type WarningQuotaScope } from './quota'
import { parseWarningReply, type WarningSuggestion } from './schemas'

// Gợi ý nhãn cảnh báo cho ĐÚNG MỘT lượt gọi Gemini (≤ WARNING_LIMITS.booksPerCall sách). Lô nhiều lượt do trình duyệt
// admin gọi lần lượt (giãn ≥ 30 giây), dừng khi gặp WARNING_QUOTA_EXCEEDED. Không ghi DB (action admin insert gợi ý),
// không tự gọi lại. Thứ tự: chế độ → cooldown sau 429 → consume_warning_quota (vé) → Gemini một lần → parse.
// Không 'use server': chỉ action admin (features/admin/**/actions.ts, assertAdmin hai câu đầu) được gọi hàm này.
// Log không chứa tên / mô tả sách.

/** Scope của WARNING_QUOTA_EXCEEDED ở app: 4 scope của SQL + gemini_minute / gemini_day khi Google trả 429 */
export type SuggestQuotaScope = WarningQuotaScope | QuotaScope

export type SuggestResult =
  | { ok: true; model: string; results: WarningSuggestion[]; missing: number[] }
  | { ok: false; code: 'WARNING_QUOTA_EXCEEDED'; scope: SuggestQuotaScope | null; resetsAt: Date | null }
  | { ok: false; code: 'WARNING_AI_FAILED' | 'FORBIDDEN' | 'UNKNOWN' }

const aiFailed: SuggestResult = { ok: false, code: 'WARNING_AI_FAILED' }

/** Model ghi vào content_warning_suggestions.model (≤ 80 ký tự); AI giả ghi 'mock' cho dễ nhận ra */
export const MOCK_MODEL_LABEL = 'mock'

export async function suggestWarnings(books: readonly WarningBookInput[]): Promise<SuggestResult> {
  // Lỗi lập trình (action chia lô sai): throw trước khi trừ lượt
  if (books.length === 0 || books.length > WARNING_LIMITS.booksPerCall) {
    throw new Error(`[warnings] lô phải có 1–${WARNING_LIMITS.booksPerCall} sách, nhận ${books.length}`)
  }
  const mode = resolveWarningMode()
  if (mode.kind === 'off') {
    console.warn('[warnings] chưa cấu hình GEMINI_API_KEY')
    return aiFailed
  }

  // Gemini thật: cooldown chung với Mây (quota của Google là của cả project). AI giả: khóa riêng theo lô, 429 giả của
  // một test không chặn test khác chạy song song
  const mock = mode.kind === 'mock'
  const cooldownKey = mock ? `warnings:${books.map((book) => book.id).join(',')}` : GLOBAL_COOLDOWN
  const cooling = activeCooldown(cooldownKey)
  if (cooling) return { ok: false, code: 'WARNING_QUOTA_EXCEEDED', scope: cooling.scope, resetsAt: cooling.resetsAt }

  const quota = await consumeWarningQuota(mock)
  if (!quota.ok) return quota.code === 'WARNING_QUOTA_EXCEEDED' ? { ...quota } : { ok: false, code: quota.code }

  const body = buildWarningRequestBody(books)
  const shared = { body, cooldownKey, timeoutMs: WARNING_GEMINI.timeoutMs, logTag: 'warnings' } as const
  const outcome = await callGemini(
    quota.ticket,
    mock
      ? { ...shared, model: DEFAULT_MODEL, apiKey: 'mock', fetchImpl: mockWarningFetch }
      : { ...shared, model: mode.model, apiKey: mode.apiKey },
  )
  if (!outcome.ok) {
    return outcome.kind === 'quota'
      ? { ok: false, code: 'WARNING_QUOTA_EXCEEDED', scope: outcome.scope, resetsAt: outcome.resetsAt }
      : aiFailed
  }

  const parsed = parseWarningReply(outcome.text, books.map((book) => book.id))
  if (!parsed) {
    console.warn('[warnings] câu trả lời của AI sai schema')
    return aiFailed
  }
  return { ok: true, model: mock ? MOCK_MODEL_LABEL : mode.model, ...parsed }
}
