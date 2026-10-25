import 'server-only'
import type { GeminiModel } from '@/features/chat/config'
import { aiMockEnabled, resolveModel, type Env } from '@/features/chat/env'

// Chế độ của gợi ý cảnh báo. Cùng chốt chặn AI giả với Mây (aiMockEnabled: CHAT_AI_MOCK=1 + Supabase local + không
// VERCEL), cùng GEMINI_API_KEY + cùng model (resolveModel). Không cần CHAT_QUOTA_TOKEN: consume_warning_quota kiểm
// is_admin() bằng phiên của admin, không dùng token.

export type WarningMode = { kind: 'gemini'; apiKey: string; model: GeminiModel } | { kind: 'mock' } | { kind: 'off' }

export function resolveWarningMode(env: Env = process.env, warn: (message: string) => void = console.warn): WarningMode {
  if (aiMockEnabled(env, warn)) return { kind: 'mock' }
  const apiKey = env.GEMINI_API_KEY?.trim()
  if (!apiKey) return { kind: 'off' }
  return { kind: 'gemini', apiKey, model: resolveModel(env.GEMINI_MODEL, warn) }
}

/** Trang admin ẩn nút "Gợi ý bằng AI" khi tắt (Preview / máy dev không có GEMINI_API_KEY): thử lại không bao giờ được */
export function warningSuggestEnabled(env: Env = process.env): boolean {
  return resolveWarningMode(env).kind !== 'off'
}
