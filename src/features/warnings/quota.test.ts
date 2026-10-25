import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc }) }))

const { consumeWarningQuota, mapWarningQuotaError, warningQuotaLimits } = await import('./quota')
const { issuedTickets } = await import('@/features/chat/ticket')

describe('warningQuotaLimits', () => {
  it('thật: đúng số trong config (trần phút chung 10, riêng 2 / phút, 30 / ngày)', () => {
    expect(warningQuotaLimits(false)).toEqual({ geminiCallsPerMinute: 10, warnCallsPerMinute: 2, warnCallsPerDay: 30 })
  })

  it('AI giả: nhân 100 hai trần phút, KHÔNG nhân trần ngày (SQL chỉ nhận ≤ 60)', () => {
    expect(warningQuotaLimits(true)).toEqual({ geminiCallsPerMinute: 1000, warnCallsPerMinute: 200, warnCallsPerDay: 30 })
  })
})

describe('mapWarningQuotaError', () => {
  it.each(['warn_minute', 'warn_day', 'gemini_minute', 'chat_reserve'])('WARNING_QUOTA_EXCEEDED scope %s + resets_at', (scope) => {
    expect(
      mapWarningQuotaError({
        message: 'WARNING_QUOTA_EXCEEDED',
        code: 'P0001',
        details: `{"scope" : "${scope}", "resets_at" : "2026-10-25T07:00:00+00:00"}`,
      }),
    ).toEqual({ code: 'WARNING_QUOTA_EXCEEDED', scope, resetsAt: new Date('2026-10-25T07:00:00Z') })
  })

  it('detail hỏng / scope lạ → vẫn đúng mã, scope / resetsAt null', () => {
    expect(mapWarningQuotaError({ message: 'WARNING_QUOTA_EXCEEDED', code: 'P0001', details: 'không phải JSON' })).toEqual({
      code: 'WARNING_QUOTA_EXCEEDED',
      scope: null,
      resetsAt: null,
    })
    expect(
      mapWarningQuotaError({ message: 'WARNING_QUOTA_EXCEEDED', code: 'P0001', details: '{"scope":"visitor_hour","resets_at":"x"}' }),
    ).toEqual({ code: 'WARNING_QUOTA_EXCEEDED', scope: null, resetsAt: null })
  })

  it('FORBIDDEN (không phải admin) và 42501 (chưa đăng nhập) → FORBIDDEN', () => {
    expect(mapWarningQuotaError({ message: 'FORBIDDEN', code: 'P0001' })).toEqual({ code: 'FORBIDDEN' })
    expect(mapWarningQuotaError({ message: 'permission denied for function consume_warning_quota', code: '42501' })).toEqual({
      code: 'FORBIDDEN',
    })
  })

  it.each([
    ['INVALID_INPUT', 'P0001'],
    ['CHAT_FREE_QUOTA', 'P0001'],
    ['canceling statement due to statement timeout', '57014'],
    ['TypeError: fetch failed', ''],
  ])('%s → UNKNOWN', (message, code) => {
    expect(mapWarningQuotaError({ message, code, details: null })).toEqual({ code: 'UNKNOWN' })
  })
})

describe('consumeWarningQuota', () => {
  beforeEach(() => {
    rpc.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('gọi consume_warning_quota một lần với p_limits; thành công → đúng một vé', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null })
    const before = issuedTickets()
    const result = await consumeWarningQuota(false)
    expect(result.ok).toBe(true)
    expect(issuedTickets() - before).toBe(1)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('consume_warning_quota', {
      p_limits: { geminiCallsPerMinute: 10, warnCallsPerMinute: 2, warnCallsPerDay: 30 },
    })
  })

  it('lỗi → không cấp vé; log chỉ mã, không detail', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'INVALID_INPUT', code: 'P0001', details: '{"field":"warnCallsPerDay","max":60}' },
    })
    const before = issuedTickets()
    expect(await consumeWarningQuota(true)).toEqual({ ok: false, code: 'UNKNOWN' })
    expect(issuedTickets()).toBe(before)
    expect(vi.mocked(console.warn).mock.calls.flat().join(' ')).toBe('[warnings] consume_warning_quota: P0001 INVALID_INPUT')
  })

  it('hết lượt → WARNING_QUOTA_EXCEEDED + scope, không log', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'WARNING_QUOTA_EXCEEDED', code: 'P0001', details: '{"scope":"chat_reserve","resets_at":"2026-10-26T07:00:00+00:00"}' },
    })
    expect(await consumeWarningQuota(false)).toEqual({
      ok: false,
      code: 'WARNING_QUOTA_EXCEEDED',
      scope: 'chat_reserve',
      resetsAt: new Date('2026-10-26T07:00:00Z'),
    })
    expect(console.warn).not.toHaveBeenCalled()
  })
})
