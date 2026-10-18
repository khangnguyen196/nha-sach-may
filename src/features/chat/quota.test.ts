import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: vi.fn() }))

const { clientIp, hashId, mapQuotaError, quotaLimits, vietnamDay } = await import('./quota')

const SECRET = 'a'.repeat(64)

describe('định danh băm', () => {
  it('ngày giờ VN: 16:59 UTC vẫn là ngày cũ, 17:00 UTC sang ngày mới', () => {
    expect(vietnamDay(new Date('2026-10-18T16:59:59Z'))).toBe('2026-10-18')
    expect(vietnamDay(new Date('2026-10-18T17:00:00Z'))).toBe('2026-10-19')
  })

  it('HMAC 32 hex, ổn định trong ngày, đổi khi sang ngày, không chứa IP thô', () => {
    const morning = hashId(SECRET, 'ip', '203.0.113.7', new Date('2026-10-18T01:00:00Z'))
    const evening = hashId(SECRET, 'ip', '203.0.113.7', new Date('2026-10-18T16:00:00Z'))
    const tomorrow = hashId(SECRET, 'ip', '203.0.113.7', new Date('2026-10-18T17:00:00Z'))
    expect(morning).toMatch(/^[0-9a-f]{32}$/)
    expect(evening).toBe(morning)
    expect(tomorrow).not.toBe(morning)
    expect(morning).not.toContain('203')
  })

  it('cùng giá trị nhưng khác loại (khách / tài khoản / IP) → hash khác nhau', () => {
    const now = new Date('2026-10-18T01:00:00Z')
    const values = new Set([hashId(SECRET, 'visitor', 'x', now), hashId(SECRET, 'user', 'x', now), hashId(SECRET, 'ip', 'x', now)])
    expect(values.size).toBe(3)
  })

  it('IP: giá trị đầu của x-forwarded-for, rồi x-real-ip, không có → null', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
    expect(clientIp(new Headers())).toBeNull()
  })
})

describe('mapQuotaError', () => {
  it('vượt lượt của khách → CHAT_QUOTA_EXCEEDED + scope + resets_at', () => {
    expect(
      mapQuotaError({
        message: 'CHAT_QUOTA_EXCEEDED',
        code: 'P0001',
        details: '{"scope" : "visitor_hour", "resets_at" : "2026-10-18T05:00:00+00:00"}',
      }),
    ).toEqual({ code: 'CHAT_QUOTA_EXCEEDED', scope: 'visitor_hour', resetsAt: new Date('2026-10-18T05:00:00Z') })
  })

  it('vượt trần chung → CHAT_FREE_QUOTA', () => {
    expect(
      mapQuotaError({ message: 'CHAT_FREE_QUOTA', code: 'P0001', details: '{"scope":"gemini_day","resets_at":"2026-10-18T07:00:00+00:00"}' }),
    ).toMatchObject({ code: 'CHAT_FREE_QUOTA', scope: 'gemini_day' })
  })

  it.each([
    ['FORBIDDEN', 'P0001'],
    ['CHAT_DISABLED', 'P0001'],
    ['INVALID_INPUT', 'P0001'],
    ['permission denied for function consume_chat_quota', '42501'],
    ['TypeError: fetch failed', ''],
  ])('%s → CHAT_UNAVAILABLE (lỗi cấu hình / mạng, không lộ cho khách)', (message, code) => {
    expect(mapQuotaError({ message, code, details: null })).toEqual({ code: 'CHAT_UNAVAILABLE', scope: null, resetsAt: null })
  })

  it('detail hỏng → vẫn đúng mã, scope / resets_at null', () => {
    expect(mapQuotaError({ message: 'CHAT_FREE_QUOTA', code: 'P0001', details: 'không phải JSON' })).toEqual({
      code: 'CHAT_FREE_QUOTA',
      scope: null,
      resetsAt: null,
    })
  })
})

describe('quotaLimits', () => {
  it('thật: đúng số trong config', () => {
    expect(quotaLimits(false)).toEqual({
      visitorPerHour: 10,
      visitorPerDay: 30,
      ipPerHour: 60,
      ipPerDay: 200,
      geminiCallsPerMinute: 10,
      geminiCallsPerDay: 400,
    })
  })

  it('AI giả: nới IP + trần chung ×100, giữ giới hạn khách (e2e "hết lượt" kiểm đúng 10)', () => {
    expect(quotaLimits(true)).toEqual({
      visitorPerHour: 10,
      visitorPerDay: 30,
      ipPerHour: 6000,
      ipPerDay: 20000,
      geminiCallsPerMinute: 1000,
      geminiCallsPerDay: 40000,
    })
  })
})
