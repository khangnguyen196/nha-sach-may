import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MODEL } from './config'

const TOKEN = 'a'.repeat(64)
const LOCAL = 'http://127.0.0.1:54321'
const PRODUCTION = 'https://ylfgwcxddxvfxwldmwtf.supabase.co'

// Cảnh báo chỉ in một lần mỗi instance → mỗi test nạp lại module
async function load() {
  vi.resetModules()
  return import('./env')
}

describe('resolveChatMode', () => {
  it('mock + URL production → bỏ qua mock, cảnh báo đúng một lần, không có key → tắt', async () => {
    const { resolveChatMode } = await load()
    const warn = vi.fn()
    const env = { CHAT_AI_MOCK: '1', NEXT_PUBLIC_SUPABASE_URL: PRODUCTION, CHAT_QUOTA_TOKEN: TOKEN }
    expect(resolveChatMode(env, warn)).toEqual({ kind: 'off' })
    resolveChatMode(env, warn)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).not.toContain(TOKEN)
  })

  it('mock + VERCEL=1 (kể cả URL localhost) → bỏ qua mock', async () => {
    const { resolveChatMode } = await load()
    const env = { CHAT_AI_MOCK: '1', VERCEL: '1', NEXT_PUBLIC_SUPABASE_URL: LOCAL, CHAT_QUOTA_TOKEN: TOKEN }
    expect(resolveChatMode(env, vi.fn())).toEqual({ kind: 'off' })
  })

  it('mock + VERCEL=1 nhưng có key thật → dùng Gemini thật, không mock', async () => {
    const { resolveChatMode } = await load()
    const env = { CHAT_AI_MOCK: '1', VERCEL: '1', NEXT_PUBLIC_SUPABASE_URL: LOCAL, CHAT_QUOTA_TOKEN: TOKEN, GEMINI_API_KEY: 'k' }
    expect(resolveChatMode(env, vi.fn())).toMatchObject({ kind: 'gemini' })
  })

  it('mock + localhost, không VERCEL → bật mock', async () => {
    const { resolveChatMode } = await load()
    expect(
      resolveChatMode({ CHAT_AI_MOCK: '1', NEXT_PUBLIC_SUPABASE_URL: LOCAL, CHAT_QUOTA_TOKEN: TOKEN }, vi.fn()),
    ).toEqual({ kind: 'mock', quotaToken: TOKEN })
    expect(
      resolveChatMode({ CHAT_AI_MOCK: '1', NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321', CHAT_QUOTA_TOKEN: TOKEN }, vi.fn()),
    ).toMatchObject({ kind: 'mock' })
  })

  it('thiếu key hoặc token → tắt', async () => {
    const { resolveChatMode, chatEnabled } = await load()
    expect(resolveChatMode({ GEMINI_API_KEY: 'k' }, vi.fn())).toEqual({ kind: 'off' })
    expect(resolveChatMode({ CHAT_QUOTA_TOKEN: TOKEN }, vi.fn())).toEqual({ kind: 'off' })
    expect(chatEnabled({})).toBe(false)
  })

  it('đủ key + token → Gemini, model từ GEMINI_MODEL (lạ / rỗng → mặc định)', async () => {
    const { resolveChatMode } = await load()
    const base = { GEMINI_API_KEY: 'k', CHAT_QUOTA_TOKEN: TOKEN }
    expect(resolveChatMode(base, vi.fn())).toEqual({ kind: 'gemini', apiKey: 'k', model: DEFAULT_MODEL, quotaToken: TOKEN })
    expect(resolveChatMode({ ...base, GEMINI_MODEL: 'gemini-3.1-flash-lite' }, vi.fn())).toMatchObject({
      model: 'gemini-3.1-flash-lite',
    })
    expect(resolveChatMode({ ...base, GEMINI_MODEL: 'gemini-3.8-flash' }, vi.fn())).toMatchObject({ model: DEFAULT_MODEL })
    expect(resolveChatMode({ ...base, GEMINI_MODEL: ' ' }, vi.fn())).toMatchObject({ model: DEFAULT_MODEL })
  })
})
