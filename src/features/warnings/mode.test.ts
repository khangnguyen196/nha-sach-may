import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MODEL } from '@/features/chat/config'

vi.mock('server-only', () => ({}))

const LOCAL = 'http://127.0.0.1:54321'
const PRODUCTION = 'https://ylfgwcxddxvfxwldmwtf.supabase.co'

// Cảnh báo chỉ in một lần mỗi instance (chat/env.ts) → mỗi test nạp lại module
async function load() {
  vi.resetModules()
  return import('./mode')
}

describe('resolveWarningMode', () => {
  it('AI giả: cùng chốt chặn với Mây (Supabase local, không VERCEL), không cần CHAT_QUOTA_TOKEN', async () => {
    const { resolveWarningMode } = await load()
    expect(resolveWarningMode({ CHAT_AI_MOCK: '1', NEXT_PUBLIC_SUPABASE_URL: LOCAL }, vi.fn())).toEqual({ kind: 'mock' })
  })

  it('CHAT_AI_MOCK trên production / Vercel → bỏ qua; không có key → tắt, có key → Gemini thật', async () => {
    const { resolveWarningMode } = await load()
    expect(resolveWarningMode({ CHAT_AI_MOCK: '1', NEXT_PUBLIC_SUPABASE_URL: PRODUCTION }, vi.fn())).toEqual({ kind: 'off' })
    expect(resolveWarningMode({ CHAT_AI_MOCK: '1', VERCEL: '1', NEXT_PUBLIC_SUPABASE_URL: LOCAL }, vi.fn())).toEqual({ kind: 'off' })
    expect(
      resolveWarningMode({ CHAT_AI_MOCK: '1', VERCEL: '1', NEXT_PUBLIC_SUPABASE_URL: LOCAL, GEMINI_API_KEY: 'k' }, vi.fn()),
    ).toEqual({ kind: 'gemini', apiKey: 'k', model: DEFAULT_MODEL })
  })

  it('chỉ cần GEMINI_API_KEY (không cần CHAT_QUOTA_TOKEN); cùng model với Mây (GEMINI_MODEL lạ → mặc định)', async () => {
    const { resolveWarningMode } = await load()
    expect(resolveWarningMode({}, vi.fn())).toEqual({ kind: 'off' })
    expect(resolveWarningMode({ GEMINI_API_KEY: ' ' }, vi.fn())).toEqual({ kind: 'off' })
    expect(resolveWarningMode({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-3.1-flash-lite' }, vi.fn())).toEqual({
      kind: 'gemini',
      apiKey: 'k',
      model: 'gemini-3.1-flash-lite',
    })
    expect(resolveWarningMode({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-9' }, vi.fn())).toMatchObject({ model: DEFAULT_MODEL })
  })

  it('warningSuggestEnabled: tắt khi không có key và không bật AI giả (Preview / máy dev)', async () => {
    const { warningSuggestEnabled } = await load()
    expect(warningSuggestEnabled({})).toBe(false)
    expect(warningSuggestEnabled({ CHAT_QUOTA_TOKEN: 'a'.repeat(64) })).toBe(false)
    expect(warningSuggestEnabled({ GEMINI_API_KEY: 'k' })).toBe(true)
    expect(warningSuggestEnabled({ CHAT_AI_MOCK: '1', NEXT_PUBLIC_SUPABASE_URL: LOCAL })).toBe(true)
  })
})
