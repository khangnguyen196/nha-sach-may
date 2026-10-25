import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'

vi.mock('server-only', () => ({}))
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc }) }))
// Đếm số lần AI giả bị gọi (= số lần fetch) mà vẫn chạy đúng code thật của nó
vi.mock('./mock', async (importOriginal) => {
  const original = await importOriginal<typeof import('./mock')>()
  return { ...original, mockWarningFetch: vi.fn(original.mockWarningFetch) }
})

const { suggestWarnings } = await import('./suggest')
const { mockWarningFetch } = await import('./mock')
const { activeCooldown, resetCooldownForTests } = await import('@/features/chat/gemini')
const { issuedTickets } = await import('@/features/chat/ticket')
const { DEFAULT_MODEL } = await import('@/features/chat/config')

const book = (id: number, title = `Sách ${id}`) => ({ id, title, authors: ['Tác giả'], category: 'Văn học', description: 'Mô tả.' })

function useMock() {
  vi.stubEnv('CHAT_AI_MOCK', '1')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('GEMINI_API_KEY', '')
}

function useGemini() {
  vi.stubEnv('CHAT_AI_MOCK', '')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://ylfgwcxddxvfxwldmwtf.supabase.co')
  vi.stubEnv('GEMINI_API_KEY', 'khoa-gia')
  vi.stubEnv('GEMINI_MODEL', '')
}

const fetchCalls = () => vi.mocked(mockWarningFetch).mock.calls.length

let globalFetch: MockInstance<typeof fetch>

beforeEach(() => {
  resetCooldownForTests()
  rpc.mockReset()
  rpc.mockResolvedValue({ data: { ok: true }, error: null })
  vi.mocked(mockWarningFetch).mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  globalFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('không được gọi mạng'))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('suggestWarnings với AI giả: từng cụm qua callGemini + parse', () => {
  beforeEach(useMock)

  it('không cụm → labels [] + lý do giả, model "mock"; đúng một lượt trừ quota + một vé + một fetch', async () => {
    const tickets = issuedTickets()
    expect(await suggestWarnings([book(11), book(12)])).toEqual({
      ok: true,
      model: 'mock',
      results: [
        { bookId: 11, labels: [], reason: 'Lý do giả lập cho sách 11.' },
        { bookId: 12, labels: [], reason: 'Lý do giả lập cho sách 12.' },
      ],
      missing: [],
    })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('consume_warning_quota', {
      p_limits: { geminiCallsPerMinute: 1000, warnCallsPerMinute: 200, warnCallsPerDay: 30 },
    })
    expect(issuedTickets() - tickets).toBe(1)
    expect(fetchCalls()).toBe(1)
    expect(globalFetch).not.toHaveBeenCalled()
  })

  it('nhãn theo cụm: violence, self-harm, all (trùng, lộn thứ tự), bad-label, bad-id, long-reason', async () => {
    const result = await suggestWarnings([
      book(1, 'A [mock:warn-violence]'),
      book(2, 'B [mock:warn-self-harm]'),
      book(3, 'C [mock:warn-all]'),
      book(4, 'D [mock:warn-bad-label]'),
      book(5, 'E [mock:warn-bad-id]'),
      book(6, 'F [mock:warn-long-reason]'),
    ])
    if (!result.ok) throw new Error(`không mong đợi: ${result.code}`)
    expect(result.missing).toEqual([5])
    expect(result.results.map(({ bookId, labels }) => ({ bookId, labels }))).toEqual([
      { bookId: 1, labels: ['violence'] },
      { bookId: 2, labels: ['self_harm'] },
      { bookId: 3, labels: ['violence', 'loss', 'self_harm', 'adult', 'other_sensitive'] },
      { bookId: 4, labels: ['violence'] },
      { bookId: 6, labels: [] },
    ])
    const long = result.results.find((item) => item.bookId === 6)?.reason ?? ''
    expect(long).toBe('a'.repeat(199))
    expect(long.isWellFormed()).toBe(true)
  })

  it.each(['[mock:warn-bad-json]', '[mock:warn-blocked]', '[mock:warn-timeout]'])(
    '%s (một sách của lô là đủ) → WARNING_AI_FAILED, đã trừ lượt, không gọi lại',
    async (token) => {
      expect(await suggestWarnings([book(1), book(2, `X ${token}`)])).toEqual({ ok: false, code: 'WARNING_AI_FAILED' })
      expect(rpc).toHaveBeenCalledTimes(1)
      expect(fetchCalls()).toBe(1)
    },
  )

  it('[mock:warn-429] → WARNING_QUOTA_EXCEEDED gemini_minute; lô đó bị cooldown (không trừ lượt, không fetch), lô khác và khóa global không bị', async () => {
    const limited = await suggestWarnings([book(1, '[mock:warn-429]')])
    expect(limited).toMatchObject({ ok: false, code: 'WARNING_QUOTA_EXCEEDED', scope: 'gemini_minute' })
    expect(activeCooldown()).toBeNull()

    rpc.mockClear()
    vi.mocked(mockWarningFetch).mockClear()
    expect(await suggestWarnings([book(1, '[mock:warn-429]')])).toMatchObject({ code: 'WARNING_QUOTA_EXCEEDED', scope: 'gemini_minute' })
    expect(rpc).not.toHaveBeenCalled()
    expect(fetchCalls()).toBe(0)

    expect(await suggestWarnings([book(2)])).toMatchObject({ ok: true })
  })

  it('[mock:warn-429-day] → WARNING_QUOTA_EXCEEDED gemini_day kèm giờ reset', async () => {
    const result = await suggestWarnings([book(1, '[mock:warn-429-day]')])
    expect(result).toMatchObject({ ok: false, code: 'WARNING_QUOTA_EXCEEDED', scope: 'gemini_day' })
    expect(result.ok === false && 'resetsAt' in result && result.resetsAt instanceof Date).toBe(true)
  })

  it('consume_warning_quota từ chối → không fetch, không vé; mã + scope theo RPC', async () => {
    const tickets = issuedTickets()
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'WARNING_QUOTA_EXCEEDED', code: 'P0001', details: '{"scope":"warn_day","resets_at":"2026-10-26T07:00:00+00:00"}' },
    })
    expect(await suggestWarnings([book(1)])).toEqual({
      ok: false,
      code: 'WARNING_QUOTA_EXCEEDED',
      scope: 'warn_day',
      resetsAt: new Date('2026-10-26T07:00:00Z'),
    })
    rpc.mockResolvedValue({ data: null, error: { message: 'FORBIDDEN', code: 'P0001' } })
    expect(await suggestWarnings([book(1)])).toEqual({ ok: false, code: 'FORBIDDEN' })
    expect(fetchCalls()).toBe(0)
    expect(issuedTickets()).toBe(tickets)
  })

  it('mỗi lượt fetch có đúng một vé (qua nhiều lượt, kể cả lượt lỗi)', async () => {
    const tickets = issuedTickets()
    await suggestWarnings([book(1)])
    await suggestWarnings([book(2, '[mock:warn-bad-json]')])
    await suggestWarnings([book(3, '[mock:warn-429]')])
    await suggestWarnings([book(3, '[mock:warn-429]')])
    expect(fetchCalls()).toBe(3)
    expect(issuedTickets() - tickets).toBe(fetchCalls())
  })

  it('lô rỗng / > 12 sách → throw trước khi trừ lượt', async () => {
    await expect(suggestWarnings([])).rejects.toThrow('lô')
    await expect(suggestWarnings(Array.from({ length: 13 }, (_, index) => book(index + 1)))).rejects.toThrow('lô')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('log không chứa tên / mô tả sách', async () => {
    const secret = 'TÊN-SÁCH-BÍ-MẬT'
    await suggestWarnings([{ ...book(1, `${secret} [mock:warn-bad-json]`), description: secret }])
    await suggestWarnings([{ ...book(2, secret), description: secret }])
    const logs = [...vi.mocked(console.warn).mock.calls, ...vi.mocked(console.info).mock.calls].flat().join('\n')
    expect(logs).toContain('[warnings]')
    expect(logs).not.toContain(secret)
  })
})

describe('suggestWarnings với Gemini thật (fetch giả, không gọi mạng)', () => {
  beforeEach(useGemini)

  const okResponse = (text: string) =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }), { status: 200 })

  it('cùng khóa + model với Mây, request có safetySettings, trả model để ghi cột model', async () => {
    globalFetch.mockResolvedValue(okResponse(JSON.stringify({ books: [{ id: '7', labels: ['loss'], reason: 'Mất mát.' }] })))
    expect(await suggestWarnings([book(7)])).toEqual({
      ok: true,
      model: DEFAULT_MODEL,
      results: [{ bookId: 7, labels: ['loss'], reason: 'Mất mát.' }],
      missing: [],
    })
    expect(globalFetch).toHaveBeenCalledTimes(1)
    const [url, init] = globalFetch.mock.calls[0] ?? []
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent`)
    expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('khoa-gia')
    expect(JSON.parse(String(init?.body))).toHaveProperty('safetySettings')
    expect(fetchCalls()).toBe(0)
  })

  it('429 của Google → WARNING_QUOTA_EXCEEDED + cooldown CHUNG với Mây (khóa global)', async () => {
    globalFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            details: [
              { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] },
              { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '30s' },
            ],
          },
        }),
        { status: 429 },
      ),
    )
    expect(await suggestWarnings([book(7)])).toMatchObject({ ok: false, code: 'WARNING_QUOTA_EXCEEDED', scope: 'gemini_minute' })
    expect(activeCooldown()).toMatchObject({ scope: 'gemini_minute' })
    rpc.mockClear()
    expect(await suggestWarnings([book(8)])).toMatchObject({ code: 'WARNING_QUOTA_EXCEEDED' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('thiếu GEMINI_API_KEY → WARNING_AI_FAILED, không trừ lượt', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    expect(await suggestWarnings([book(7)])).toEqual({ ok: false, code: 'WARNING_AI_FAILED' })
    expect(rpc).not.toHaveBeenCalled()
    expect(globalFetch).not.toHaveBeenCalled()
  })
})
