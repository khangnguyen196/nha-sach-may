import { ALLOWED_MODELS, DEFAULT_MODEL, type GeminiModel } from './config'

export type Env = Record<string, string | undefined>

export type ChatMode =
  | { kind: 'gemini'; apiKey: string; model: GeminiModel; quotaToken: string }
  | { kind: 'mock'; quotaToken: string }
  | { kind: 'off' }

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

function isLocalSupabase(url: string | undefined) {
  if (!url) return false
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

function isAllowedModel(value: string): value is GeminiModel {
  return ALLOWED_MODELS.some((model) => model === value)
}

const warned = new Set<string>()
/** Cảnh báo một lần mỗi instance; không bao giờ in giá trị env */
function warnOnce(key: string, message: string, warn: (message: string) => void) {
  if (warned.has(key)) return
  warned.add(key)
  warn(message)
}

export function resolveModel(value: string | undefined, warn: (message: string) => void = console.warn): GeminiModel {
  const model = value?.trim()
  if (!model) return DEFAULT_MODEL
  if (isAllowedModel(model)) return model
  warnOnce('model', `[chat] GEMINI_MODEL không nằm trong danh sách cho phép, dùng ${DEFAULT_MODEL}`, warn)
  return DEFAULT_MODEL
}

/**
 * Chốt chặn AI giả, dùng chung cho Mây và gợi ý cảnh báo (features/warnings/mode.ts): CHAT_AI_MOCK=1 chỉ có hiệu lực
 * khi Supabase là local VÀ không chạy trên Vercel, cùng kiểu chốt chặn với scripts/e2e-env.ts: biến đặt nhầm trên
 * production không bao giờ bật được AI giả.
 */
export function aiMockEnabled(env: Env = process.env, warn: (message: string) => void = console.warn): boolean {
  if (env.CHAT_AI_MOCK !== '1') return false
  if (isLocalSupabase(env.NEXT_PUBLIC_SUPABASE_URL) && !env.VERCEL) return true
  warnOnce('mock', '[chat] CHAT_AI_MOCK bị bỏ qua (chỉ dùng với Supabase local, ngoài Vercel)', warn)
  return false
}

/**
 * Chế độ chạy của chatbot.
 * - AI giả: aiMockEnabled.
 * - Thiếu GEMINI_API_KEY hoặc CHAT_QUOTA_TOKEN → tắt (không có bong bóng).
 */
export function resolveChatMode(env: Env = process.env, warn: (message: string) => void = console.warn): ChatMode {
  const quotaToken = env.CHAT_QUOTA_TOKEN?.trim()
  if (aiMockEnabled(env, warn)) return quotaToken ? { kind: 'mock', quotaToken } : { kind: 'off' }
  const apiKey = env.GEMINI_API_KEY?.trim()
  if (!apiKey || !quotaToken) return { kind: 'off' }
  return { kind: 'gemini', apiKey, model: resolveModel(env.GEMINI_MODEL, warn), quotaToken }
}

export function chatEnabled(env: Env = process.env): boolean {
  return resolveChatMode(env).kind !== 'off'
}
