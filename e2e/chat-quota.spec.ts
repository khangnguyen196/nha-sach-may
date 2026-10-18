import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import type { Database } from '../src/types/database'
import { E2E_CHAT_QUOTA_TOKEN, loadLocalSupabase } from '../scripts/e2e-env'

// RPC consume_chat_quota trên DB local (dựng từ schema.sql), gọi bằng khóa publishable như server web. Không qua UI.
// Khách / IP giả ngẫu nhiên mỗi lần chạy → retry / --repeat-each vẫn qua.

const { url, publishableKey } = loadLocalSupabase()
const anon = createClient<Database>(url, publishableKey, { auth: { persistSession: false } })

const LIMITS = {
  visitorPerHour: 1,
  visitorPerDay: 30,
  ipPerHour: 60,
  ipPerDay: 200,
  geminiCallsPerMinute: 100_000,
  geminiCallsPerDay: 100_000,
}

const hex32 = () => randomBytes(16).toString('hex')

async function consume(args: { token?: string; visitor?: string; ip?: string; limits?: Record<string, number> }) {
  const { error } = await anon.rpc('consume_chat_quota', {
    p_token: args.token ?? E2E_CHAT_QUOTA_TOKEN,
    p_visitor: args.visitor,
    p_ip: args.ip,
    p_limits: args.limits ?? LIMITS,
  })
  return error ? { code: error.message, details: error.details } : { code: 'ok', details: null }
}

test('token sai → FORBIDDEN, không ghi gì', async () => {
  expect((await consume({ token: 'f'.repeat(64), visitor: hex32() })).code).toBe('FORBIDDEN')
})

test('khách: câu thứ hai vượt 1 / giờ → CHAT_QUOTA_EXCEEDED kèm scope + resets_at', async () => {
  const visitor = hex32()
  expect((await consume({ visitor, ip: hex32() })).code).toBe('ok')
  const second = await consume({ visitor, ip: hex32() })
  expect(second.code).toBe('CHAT_QUOTA_EXCEEDED')
  expect(JSON.parse(second.details ?? '{}')).toMatchObject({ scope: 'visitor_hour', resets_at: expect.any(String) })
})

test('trần chung bị chặn → rollback, không trừ oan lượt của khách', async () => {
  const visitor = hex32()
  // Trần 1 / phút: bucket phút dùng chung với spec khác → lần đầu có thể đã vượt; lần thứ hai chắc chắn vượt
  const tight = { ...LIMITS, geminiCallsPerMinute: 1 }
  await consume({ visitor: hex32(), limits: tight })
  const blocked = await consume({ visitor, limits: tight })
  expect(blocked.code).toBe('CHAT_FREE_QUOTA')
  expect(JSON.parse(blocked.details ?? '{}')).toMatchObject({ scope: 'gemini_minute' })
  // Khách này chưa bị trừ lượt nào (giới hạn 1 / giờ): câu tiếp theo vẫn qua, câu sau nữa mới vượt
  expect((await consume({ visitor })).code).toBe('ok')
  expect((await consume({ visitor })).code).toBe('CHAT_QUOTA_EXCEEDED')
})

test('vé gọi lại (không có khách) chỉ cộng trần chung; có IP mà không có khách → INVALID_INPUT', async () => {
  expect((await consume({})).code).toBe('ok')
  expect((await consume({ ip: hex32() })).code).toBe('INVALID_INPUT')
})

test('tham số sai → INVALID_INPUT (thiếu giới hạn, định danh không phải 32 hex)', async () => {
  const missing: Record<string, number> = { ...LIMITS }
  delete missing.geminiCallsPerDay
  expect((await consume({ visitor: hex32(), limits: missing })).code).toBe('INVALID_INPUT')
  expect((await consume({ visitor: 'khong-phai-hex' })).code).toBe('INVALID_INPUT')
})
