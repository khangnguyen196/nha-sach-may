import 'server-only'
import { createHmac } from 'node:crypto'
import { isErrorCode, isNetworkFailure, type ErrorCode } from '@/lib/errors'
import { createPublicClient } from '@/lib/supabase/public'
import { CHAT_LIMITS, MOCK_LIMIT_MULTIPLIER, type ChatLimits } from './config'
import { GeminiTicket } from './ticket'

// Trừ lượt qua RPC consume_chat_quota (security definer, cần CHAT_QUOTA_TOKEN). IP và định danh khách chỉ đi vào DB
// dưới dạng HMAC (khóa = token, kèm ngày giờ VN → hash đổi mỗi ngày); không lưu, không log IP thô.

/** Ngày theo giờ Việt Nam (+07:00 cố định), dạng YYYY-MM-DD */
export function vietnamDay(now: Date): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10)
}

export function hashId(secret: string, kind: 'visitor' | 'user' | 'ip', value: string, now: Date): string {
  return createHmac('sha256', secret).update(`${kind}:${vietnamDay(now)}:${value}`).digest('hex').slice(0, 32)
}

/** IP của khách: Vercel ghi đè x-forwarded-for (giá trị đầu là IP thật), x-real-ip dự phòng */
export function clientIp(headers: Pick<Headers, 'get'>): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || null
}

export function quotaLimits(mock: boolean): ChatLimits {
  if (!mock) return { ...CHAT_LIMITS }
  return {
    ...CHAT_LIMITS,
    ipPerHour: CHAT_LIMITS.ipPerHour * MOCK_LIMIT_MULTIPLIER,
    ipPerDay: CHAT_LIMITS.ipPerDay * MOCK_LIMIT_MULTIPLIER,
    geminiCallsPerMinute: CHAT_LIMITS.geminiCallsPerMinute * MOCK_LIMIT_MULTIPLIER,
    geminiCallsPerDay: CHAT_LIMITS.geminiCallsPerDay * MOCK_LIMIT_MULTIPLIER,
  }
}

export type QuotaFailure = {
  code: Extract<ErrorCode, 'CHAT_QUOTA_EXCEEDED' | 'CHAT_FREE_QUOTA' | 'CHAT_UNAVAILABLE'>
  scope: string | null
  resetsAt: Date | null
}

export type QuotaResult = { ok: true; ticket: GeminiTicket } | ({ ok: false } & QuotaFailure)

function parseDetail(details: string | null | undefined): { scope: string | null; resetsAt: Date | null } {
  try {
    const parsed: unknown = details ? JSON.parse(details) : null
    if (typeof parsed !== 'object' || parsed === null) return { scope: null, resetsAt: null }
    const scope = 'scope' in parsed && typeof parsed.scope === 'string' ? parsed.scope : null
    const raw = 'resets_at' in parsed && typeof parsed.resets_at === 'string' ? new Date(parsed.resets_at) : null
    return { scope, resetsAt: raw && !Number.isNaN(raw.getTime()) ? raw : null }
  } catch {
    return { scope: null, resetsAt: null }
  }
}

/** Lỗi RPC → mã cho khách. FORBIDDEN / CHAT_DISABLED / INVALID_INPUT / lỗi mạng là lỗi cấu hình → CHAT_UNAVAILABLE */
export function mapQuotaError(error: { message: string; details?: string | null; code?: string | null }): QuotaFailure {
  if (!isNetworkFailure(error) && isErrorCode(error.message)) {
    if (error.message === 'CHAT_QUOTA_EXCEEDED' || error.message === 'CHAT_FREE_QUOTA') {
      return { code: error.message, ...parseDetail(error.details) }
    }
  }
  return { code: 'CHAT_UNAVAILABLE', scope: null, resetsAt: null }
}

export type QuotaRequest = {
  token: string
  /** Định danh đã băm: khách (cookie) hoặc tài khoản */
  visitor: string
  /** IP đã băm; null với khách đã đăng nhập (chỉ đếm theo user id) */
  ip: string | null
  limits: ChatLimits
}

/** Trừ lượt cho câu hỏi mới + một lượt gọi Gemini; thành công → vé cho đúng một lần gọi */
export async function consumeQuota({ token, visitor, ip, limits }: QuotaRequest): Promise<QuotaResult> {
  // Không retry: RPC có ghi, gọi lại sau timeout có thể trừ hai lần
  const { error } = await createPublicClient({ retry: false }).rpc('consume_chat_quota', {
    p_token: token,
    p_visitor: visitor,
    p_ip: ip ?? undefined,
    p_limits: limits,
  })
  if (!error) return { ok: true, ticket: GeminiTicket.issue() }
  const failure = mapQuotaError(error)
  if (failure.code === 'CHAT_UNAVAILABLE') console.warn(`[chat] consume_chat_quota: ${error.code ?? '-'} ${isErrorCode(error.message) ? error.message : 'lỗi khác'}`)
  return { ok: false, ...failure }
}
