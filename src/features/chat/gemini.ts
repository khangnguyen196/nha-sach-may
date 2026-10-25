import 'server-only'
import { COOLDOWN, GEMINI, type GeminiModel } from './config'
import type { GeminiTicket } from './ticket'

// Gọi Gemini REST bằng fetch (không SDK), dùng chung cho Mây và gợi ý cảnh báo của admin (features/warnings). Mỗi lượt
// gọi cần một vé (ticket.ts) từ consume_chat_quota (Mây) hoặc consume_warning_quota (gợi ý): trần chung đếm lượt gọi
// Gemini, không đếm tin nhắn. Không gọi lại, không đổi model khi gặp 429.

export type QuotaScope = 'gemini_minute' | 'gemini_day'

export type Usage = { prompt: number | null; candidates: number | null; thoughts: number | null }

export type GeminiOutcome =
  | { ok: true; text: string; finishReason: string | null; usage: Usage }
  | { ok: false; kind: 'quota'; scope: QuotaScope; resetsAt: Date }
  | { ok: false; kind: 'error'; reason: string }

// ---- Phân loại 429 theo body (docs/plans/phase-11.md → "Phân loại 429") ----

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** quotaId trong google.rpc.QuotaFailure, retryDelay (giây) trong google.rpc.RetryInfo */
export function parse429(body: unknown): { quotaIds: string[]; retryDelayMs: number | null } {
  const error = isRecord(body) ? body.error : undefined
  const details = isRecord(error) && Array.isArray(error.details) ? error.details : []
  const quotaIds: string[] = []
  let retryDelayMs: number | null = null
  for (const detail of details) {
    if (!isRecord(detail)) continue
    const type = detail['@type']
    if (type === 'type.googleapis.com/google.rpc.QuotaFailure' && Array.isArray(detail.violations)) {
      for (const violation of detail.violations) {
        if (isRecord(violation) && typeof violation.quotaId === 'string') quotaIds.push(violation.quotaId)
      }
    }
    if (type === 'type.googleapis.com/google.rpc.RetryInfo' && typeof detail.retryDelay === 'string') {
      const seconds = /^(\d+(?:\.\d+)?)s$/.exec(detail.retryDelay)?.[1]
      if (seconds) retryDelayMs = Math.round(Number(seconds) * 1000)
    }
  }
  return { quotaIds, retryDelayMs }
}

/** 0h America/Los_Angeles kế tiếp (lúc Google reset RPD), tính đúng cả ngày đổi giờ */
export function nextPacificMidnight(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  // Ngày mai theo lịch Los Angeles; thử hai offset (PDT −7, PST −8), lấy cái cho đúng 0h giờ địa phương
  const tomorrow = Date.UTC(get('year'), get('month') - 1, get('day') + 1)
  for (const offsetHours of [7, 8]) {
    const candidate = new Date(tomorrow + offsetHours * 3_600_000)
    const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', hourCycle: 'h23' }).format(candidate)
    if (Number(hour) === 0) return candidate
  }
  return new Date(tomorrow + 8 * 3_600_000)
}

export type Cooldown = { until: number; scope: QuotaScope; resetsAt: Date }

/**
 * Có quotaId chứa "PerDay" (kể cả khi có thêm PerMinute) → hết lượt trong ngày, cooldown tới 0h Los Angeles.
 * Chỉ PerMinute → retryDelay kẹp 10–60 giây. Không đọc được → 60 giây, như loại phút. retryDelay luôn có kể cả khi
 * đã hết lượt trong ngày, nên không dùng nó để phân loại.
 */
export function classify429(body: unknown, now: Date): Cooldown {
  const { quotaIds, retryDelayMs } = parse429(body)
  if (quotaIds.some((id) => id.includes('PerDay'))) {
    const resetsAt = nextPacificMidnight(now)
    return { until: resetsAt.getTime(), scope: 'gemini_day', resetsAt }
  }
  const perMinute = quotaIds.some((id) => id.includes('PerMinute'))
  const delay =
    perMinute && retryDelayMs !== null
      ? Math.min(COOLDOWN.minuteMaxMs, Math.max(COOLDOWN.minuteMinMs, retryDelayMs))
      : COOLDOWN.unknownMs
  const until = now.getTime() + delay
  return { until, scope: 'gemini_minute', resetsAt: new Date(until) }
}

// Cooldown trong bộ nhớ instance (không cần DB): mỗi instance tự học sau 429 đầu tiên của nó. Khóa 'global' với Gemini
// thật, dùng chung cho Mây và gợi ý cảnh báo (quota của Google là của cả project). AI giả (e2e) dùng khóa theo khách
// (Mây) / theo lô (gợi ý, `warnings:<ids>`): 429 giả của một test không chặn các test khác chạy song song trên cùng
// server.
export const GLOBAL_COOLDOWN = 'global'
const cooldowns = new Map<string, Cooldown>()

export function activeCooldown(key: string = GLOBAL_COOLDOWN, now: Date = new Date()): Cooldown | null {
  const cooldown = cooldowns.get(key)
  if (cooldown && cooldown.until > now.getTime()) return cooldown
  cooldowns.delete(key)
  return null
}

export function resetCooldownForTests() {
  cooldowns.clear()
}

function googleStatus(body: unknown) {
  const error = isRecord(body) ? body.error : undefined
  const status = isRecord(error) ? error.status : undefined
  return typeof status === 'string' && /^[A-Z_]{1,40}$/.test(status) ? status : '-'
}

function quotaIdsForLog(body: unknown) {
  return parse429(body).quotaIds.join(',') || '-'
}

function readText(body: unknown) {
  const candidate = isRecord(body) && Array.isArray(body.candidates) ? body.candidates[0] : undefined
  const content = isRecord(candidate) ? candidate.content : undefined
  const parts = isRecord(content) && Array.isArray(content.parts) ? content.parts : []
  const text = parts
    .flatMap((part) => (isRecord(part) && typeof part.text === 'string' && part.thought !== true ? [part.text] : []))
    .join('')
  const finishReason = isRecord(candidate) && typeof candidate.finishReason === 'string' ? candidate.finishReason : null
  return { text, finishReason }
}

function readUsage(body: unknown): Usage {
  const usage = isRecord(body) && isRecord(body.usageMetadata) ? body.usageMetadata : {}
  const count = (key: string) => (typeof usage[key] === 'number' ? usage[key] : null)
  return { prompt: count('promptTokenCount'), candidates: count('candidatesTokenCount'), thoughts: count('thoughtsTokenCount') }
}

function blockReason(body: unknown) {
  const feedback = isRecord(body) && isRecord(body.promptFeedback) ? body.promptFeedback : undefined
  return feedback && typeof feedback.blockReason === 'string' ? feedback.blockReason : null
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

type Part = { text: string }

/**
 * Body generateContent mà callGemini nhận: kiểu chung của buildRequestBody (Mây, chat/prompt.ts) và
 * buildWarningRequestBody (gợi ý cảnh báo, warnings/prompt.ts). safetySettings chỉ request gợi ý có.
 */
export type GeminiBody = {
  systemInstruction: { parts: readonly Part[] }
  contents: readonly { role: 'user' | 'model'; parts: readonly Part[] }[]
  generationConfig: {
    responseMimeType: string
    responseJsonSchema: Record<string, unknown>
    maxOutputTokens: number
    temperature: number
    thinkingConfig: { thinkingLevel: string }
  }
  safetySettings?: readonly { category: string; threshold: string }[]
}

export type GeminiCall = {
  model: GeminiModel
  apiKey: string
  body: GeminiBody
  fetchImpl?: typeof fetch
  now?: () => Date
  cooldownKey?: string
  /** Mặc định GEMINI.timeoutMs (Mây); gợi ý cảnh báo dùng WARNING_GEMINI.timeoutMs */
  timeoutMs?: number
  /** Tiền tố dòng log */
  logTag?: 'chat' | 'warnings'
}

/** Một lượt gọi generateContent. Log chỉ status / quotaId / finishReason / số token, không log nội dung. */
export async function callGemini(ticket: GeminiTicket, call: GeminiCall): Promise<GeminiOutcome> {
  ticket.use()
  const {
    model,
    apiKey,
    body,
    fetchImpl = fetch,
    now = () => new Date(),
    cooldownKey = GLOBAL_COOLDOWN,
    timeoutMs = GEMINI.timeoutMs,
    logTag = 'chat',
  } = call
  const tag = `[${logTag}]`
  let response: Response
  try {
    response = await fetchImpl(`${GEMINI.endpoint}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    })
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network'
    console.warn(`${tag} gemini ${reason}`)
    return { ok: false, kind: 'error', reason }
  }

  const json = await readJson(response)
  if (response.status === 429) {
    const cooldown = classify429(json, now())
    cooldowns.set(cooldownKey, cooldown)
    console.warn(`${tag} gemini 429 quotaId=${quotaIdsForLog(json)}`)
    return { ok: false, kind: 'quota', scope: cooldown.scope, resetsAt: cooldown.resetsAt }
  }
  if (!response.ok) {
    // error.status của Google (VD INVALID_ARGUMENT khi một tham số của request bị từ chối): mã, không có nội dung
    console.warn(`${tag} gemini HTTP ${response.status} ${googleStatus(json)}`)
    return { ok: false, kind: 'error', reason: `http_${response.status}` }
  }

  const blocked = blockReason(json)
  const { text, finishReason } = readText(json)
  const usage = readUsage(json)
  console.info(
    `${tag} gemini ok model=${model} finish=${finishReason ?? '-'} prompt=${usage.prompt ?? '-'} candidates=${usage.candidates ?? '-'} thoughts=${usage.thoughts ?? '-'}`,
  )
  if (blocked) return { ok: false, kind: 'error', reason: `blocked_${blocked}` }
  if (finishReason && finishReason !== 'STOP') return { ok: false, kind: 'error', reason: `finish_${finishReason}` }
  if (!text) return { ok: false, kind: 'error', reason: 'empty' }
  return { ok: true, text, finishReason, usage }
}
