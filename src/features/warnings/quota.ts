import 'server-only'
import { CHAT_LIMITS, MOCK_LIMIT_MULTIPLIER, WARNING_LIMITS } from '@/features/chat/config'
import { GeminiTicket } from '@/features/chat/ticket'
import { isErrorCode, isNetworkFailure } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'

// Trừ lượt cho MỘT lượt gọi Gemini của gợi ý cảnh báo qua RPC consume_warning_quota (schema.sql mục 16, chỉ admin):
// warn:minute → warn:day → bucket CHUNG gemini:minute → gemini:day (≤ 300, chừa 100 lượt / ngày cho Mây). Cùng khóa
// GEMINI_API_KEY + cùng model với Mây nên mỗi lượt gợi ý tính như một lượt của Mây (features/chat/config.ts →
// WARNING_LIMITS). Client theo phiên: RPC tự kiểm is_admin() bằng phiên của người gọi.

export type WarningQuotaLimits = { geminiCallsPerMinute: number; warnCallsPerMinute: number; warnCallsPerDay: number }

/** AI giả (e2e): nhân trần phút như quotaLimits(mock) của chat; trần ngày KHÔNG nhân (SQL chỉ nhận ≤ 60) */
export function warningQuotaLimits(mock: boolean): WarningQuotaLimits {
  const multiplier = mock ? MOCK_LIMIT_MULTIPLIER : 1
  return {
    geminiCallsPerMinute: CHAT_LIMITS.geminiCallsPerMinute * multiplier,
    warnCallsPerMinute: WARNING_LIMITS.callsPerMinute * multiplier,
    warnCallsPerDay: WARNING_LIMITS.callsPerDay,
  }
}

/** scope trong detail của WARNING_QUOTA_EXCEEDED (consume_warning_quota) */
export const WARNING_QUOTA_SCOPES = ['warn_minute', 'warn_day', 'gemini_minute', 'chat_reserve'] as const
export type WarningQuotaScope = (typeof WARNING_QUOTA_SCOPES)[number]

export type WarningQuotaFailure =
  | { code: 'WARNING_QUOTA_EXCEEDED'; scope: WarningQuotaScope | null; resetsAt: Date | null }
  | { code: 'FORBIDDEN' | 'UNKNOWN' }

export type WarningQuotaResult = { ok: true; ticket: GeminiTicket } | ({ ok: false } & WarningQuotaFailure)

const isScope = (value: unknown): value is WarningQuotaScope => WARNING_QUOTA_SCOPES.some((scope) => scope === value)

function parseDetail(details: string | null | undefined): { scope: WarningQuotaScope | null; resetsAt: Date | null } {
  try {
    const parsed: unknown = details ? JSON.parse(details) : null
    if (typeof parsed !== 'object' || parsed === null) return { scope: null, resetsAt: null }
    const scope = 'scope' in parsed && isScope(parsed.scope) ? parsed.scope : null
    const raw = 'resets_at' in parsed && typeof parsed.resets_at === 'string' ? new Date(parsed.resets_at) : null
    return { scope, resetsAt: raw && !Number.isNaN(raw.getTime()) ? raw : null }
  } catch {
    return { scope: null, resetsAt: null }
  }
}

// Postgres insufficient_privilege: khách chưa đăng nhập không có quyền execute
const PRIVILEGE_DENIED = '42501'

/** Lỗi RPC → mã cho admin. INVALID_INPUT (p_limits sai: lỗi lập trình), lỗi mạng, lỗi lạ → UNKNOWN */
export function mapWarningQuotaError(error: { message: string; details?: string | null; code?: string | null }): WarningQuotaFailure {
  if (isNetworkFailure(error)) return { code: 'UNKNOWN' }
  if (error.message === 'WARNING_QUOTA_EXCEEDED') return { code: 'WARNING_QUOTA_EXCEEDED', ...parseDetail(error.details) }
  if (error.message === 'FORBIDDEN' || error.code === PRIVILEGE_DENIED) return { code: 'FORBIDDEN' }
  return { code: 'UNKNOWN' }
}

/** Trừ lượt cho một lượt gọi Gemini của gợi ý; thành công → vé cho đúng một lần gọi. Chỉ suggest.ts gọi, `mock` lấy
 * từ resolveWarningMode (true trên production không thể xảy ra: aiMockEnabled chặn; trần ngày cũng không nhân). */
export async function consumeWarningQuota(mock: boolean): Promise<WarningQuotaResult> {
  const supabase = await createClient()
  // Client theo phiên không retry (lib/supabase/server.ts): RPC có ghi, gọi lại sau timeout có thể trừ hai lần
  const { error } = await supabase.rpc('consume_warning_quota', { p_limits: warningQuotaLimits(mock) })
  if (!error) return { ok: true, ticket: GeminiTicket.issue() }
  const failure = mapWarningQuotaError(error)
  if (failure.code === 'UNKNOWN') {
    console.warn(`[warnings] consume_warning_quota: ${error.code || '-'} ${isErrorCode(error.message) ? error.message : 'lỗi khác'}`)
  }
  return { ok: false, ...failure }
}
