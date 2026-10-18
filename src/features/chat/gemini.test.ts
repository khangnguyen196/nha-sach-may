import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { activeCooldown, callGemini, classify429, nextPacificMidnight, resetCooldownForTests } = await import('./gemini')
const { GeminiTicket, issuedTickets } = await import('./ticket')
const { buildRequestBody } = await import('./prompt')
const { mockFetch } = await import('./mock')

const PER_DAY = 'GenerateRequestsPerDayPerProjectPerModel-FreeTier'
const PER_MINUTE = 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier'
const TOKENS_PER_MINUTE = 'GenerateContentInputTokensPerModelPerMinute-FreeTier'

function body429(quotaIds: string[], retryDelay?: string) {
  return {
    error: {
      code: 429,
      status: 'RESOURCE_EXHAUSTED',
      details: [
        { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: quotaIds.map((quotaId) => ({ quotaId })) },
        ...(retryDelay ? [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay }] : []),
      ],
    },
  }
}

// 2026-10-20 10:00 giờ VN = 03:00 UTC; Los Angeles đang PDT → 0h kế tiếp = 07:00 UTC = 14:00 VN
const NOW = new Date('2026-10-20T03:00:00Z')

describe('classify429', () => {
  it('chỉ PerDay → hết lượt trong ngày, tới 0h Los Angeles kế tiếp', () => {
    expect(classify429(body429([PER_DAY], '55s'), NOW)).toEqual({
      scope: 'gemini_day',
      until: Date.parse('2026-10-20T07:00:00Z'),
      resetsAt: new Date('2026-10-20T07:00:00Z'),
    })
  })

  it('cả PerDay + PerMinute → vẫn là hết lượt trong ngày (retryDelay không dùng để phân loại)', () => {
    expect(classify429(body429([PER_MINUTE, PER_DAY], '55s'), NOW).scope).toBe('gemini_day')
  })

  it.each([
    ['55s', 55_000],
    ['3s', 10_000],
    ['120s', 60_000],
    ['12.5s', 12_500],
    [undefined, 60_000],
  ])('chỉ PerMinute, retryDelay %s → cooldown %d ms', (retryDelay, ms) => {
    const cooldown = classify429(body429([PER_MINUTE], retryDelay), NOW)
    expect(cooldown.scope).toBe('gemini_minute')
    expect(cooldown.until - NOW.getTime()).toBe(ms)
  })

  it('token / phút cũng là loại phút', () => {
    expect(classify429(body429([TOKENS_PER_MINUTE], '20s'), NOW)).toMatchObject({ scope: 'gemini_minute', until: NOW.getTime() + 20_000 })
  })

  it.each([[null], ['không phải JSON'], [{}], [{ error: { details: [{ '@type': 'lạ' }] } }], [body429(['SomethingElse'], '5s')]])(
    'body không đọc được (%#) → 60 giây, loại phút',
    (body) => {
      expect(classify429(body, NOW)).toMatchObject({ scope: 'gemini_minute', until: NOW.getTime() + 60_000 })
    },
  )
})

describe('nextPacificMidnight', () => {
  it('reset ngày 1/11/2026 vẫn là 14:00 giờ VN (Mỹ đổi giờ lúc 2h sáng 1/11), từ 2/11 là 15:00', () => {
    // 07:00 UTC = 14:00 giờ VN; 08:00 UTC = 15:00 giờ VN
    expect(nextPacificMidnight(new Date('2026-10-31T20:00:00Z')).toISOString()).toBe('2026-11-01T07:00:00.000Z')
    expect(nextPacificMidnight(new Date('2026-11-01T10:00:00Z')).toISOString()).toBe('2026-11-02T08:00:00.000Z')
    expect(nextPacificMidnight(new Date('2026-12-15T03:00:00Z')).toISOString()).toBe('2026-12-15T08:00:00.000Z')
  })
})

const okResponse = (text: string, finishReason = 'STOP') =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] }, finishReason }],
      usageMetadata: { promptTokenCount: 5000, candidatesTokenCount: 300, thoughtsTokenCount: 20 },
    }),
    { status: 200 },
  )

const body = buildRequestBody({ message: 'x', candidates: [], currentBook: null, history: [], knownSlugs: new Set() })
const call = (fetchImpl: typeof fetch) => ({ model: 'gemini-3.5-flash-lite' as const, apiKey: 'k', body, fetchImpl, now: () => NOW })

describe('callGemini', () => {
  beforeEach(() => {
    resetCooldownForTests()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('gọi đúng endpoint + model, header key, một lần; trả text + số token', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => okResponse('{"a":1}'))
    const outcome = await callGemini(GeminiTicket.issue(), call(fetchImpl))
    expect(outcome).toEqual({ ok: true, text: '{"a":1}', finishReason: 'STOP', usage: { prompt: 5000, candidates: 300, thoughts: 20 } })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent')
    expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('k')
  })

  it('429 → quota + cooldown đúng loại, chỉ gọi một lần, log chỉ status + quotaId', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body429([PER_MINUTE, PER_DAY], '55s')), { status: 429 }))
    const outcome = await callGemini(GeminiTicket.issue(), call(fetchImpl))
    expect(outcome).toMatchObject({ ok: false, kind: 'quota', scope: 'gemini_day' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(activeCooldown(NOW)).toMatchObject({ scope: 'gemini_day' })
    expect(vi.mocked(console.warn).mock.calls.flat().join(' ')).toBe(`[chat] gemini 429 quotaId=${PER_MINUTE},${PER_DAY}`)
  })

  it('cooldown hết hạn thì tự xóa', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body429([PER_MINUTE], '30s')), { status: 429 }))
    await callGemini(GeminiTicket.issue(), call(fetchImpl))
    expect(activeCooldown(new Date(NOW.getTime() + 29_000))).not.toBeNull()
    expect(activeCooldown(new Date(NOW.getTime() + 30_000))).toBeNull()
  })

  it.each([
    ['timeout', async () => Promise.reject(new DOMException('t', 'TimeoutError')), 'timeout'],
    ['mạng', async () => Promise.reject(new TypeError('fetch failed')), 'network'],
    ['500', async () => new Response('{}', { status: 500 }), 'http_500'],
    ['bị chặn', async () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }), 'blocked_SAFETY'],
    ['SAFETY', async () => okResponse('', 'SAFETY'), 'finish_SAFETY'],
    ['MAX_TOKENS', async () => okResponse('{"a"', 'MAX_TOKENS'), 'finish_MAX_TOKENS'],
    ['rỗng', async () => okResponse(''), 'empty'],
  ])('%s → lỗi, không cooldown', async (_label, impl, reason) => {
    const outcome = await callGemini(GeminiTicket.issue(), call(vi.fn<typeof fetch>(impl)))
    expect(outcome).toEqual({ ok: false, kind: 'error', reason })
    expect(activeCooldown(NOW)).toBeNull()
  })

  it('vé chỉ dùng một lần; số lần fetch luôn bằng số vé đã cấp', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => okResponse('{}'))
    const before = issuedTickets()
    const ticket = GeminiTicket.issue()
    await callGemini(ticket, call(fetchImpl))
    await expect(callGemini(ticket, call(fetchImpl))).rejects.toThrow('vé')
    // giả lập gọi lại: mỗi lần gọi lại phải xin vé mới
    await callGemini(GeminiTicket.issue(), call(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledTimes(issuedTickets() - before)
  })
})

describe('mockFetch (AI giả của e2e) đi qua đúng đường code thật, không gọi mạng', () => {
  beforeEach(() => {
    resetCooldownForTests()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  const mockBody = (message: string) =>
    buildRequestBody({
      message,
      candidates: ['a', 'b', 'c', 'd', 'e'].map((slug) => ({ slug, title: slug, authors: [], category: '', language: 'vi', description: '' })),
      currentBook: null,
      history: [],
      knownSlugs: new Set(),
    })

  it('mặc định 3 slug ứng viên đầu; [mock:5-books] → 5 slug gồm 1 slug lạ; [mock:429] → 429 theo phút', async () => {
    const global = vi.spyOn(globalThis, 'fetch')
    const ok = await callGemini(GeminiTicket.issue(), { ...call(mockFetch), body: mockBody('buồn') })
    expect(ok.ok && JSON.parse(ok.text).books.map((b: { slug: string }) => b.slug)).toEqual(['a', 'b', 'c'])
    const five = await callGemini(GeminiTicket.issue(), { ...call(mockFetch), body: mockBody('[mock:5-books]') })
    expect(five.ok && JSON.parse(five.text).books).toHaveLength(5)
    const limited = await callGemini(GeminiTicket.issue(), { ...call(mockFetch), body: mockBody('[mock:429]') })
    expect(limited).toMatchObject({ ok: false, kind: 'quota', scope: 'gemini_minute' })
    expect(global).not.toHaveBeenCalled()
  })
})
