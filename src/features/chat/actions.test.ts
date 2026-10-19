import { beforeEach, describe, expect, it, vi } from 'vitest'

// Thứ tự các bước của askMay (docs/plans/phase-11.md → Luồng). Phụ thuộc ngoài đều giả lập.
const state = vi.hoisted(() => ({
  country: null as string | null,
  cooldown: null as null | { scope: 'gemini_minute' | 'gemini_day'; resetsAt: Date; until: number },
  // null = catalog mặc định (1 cuốn); test đầu vào lớn nhất thay bằng 40 cuốn dài
  catalog: null as null | unknown[],
  current: null as null | unknown,
}))

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(state.country ? { 'x-vercel-ip-country': state.country } : {}),
  cookies: async () => ({ get: () => ({ value: 'abcdefghijklmnopqrstuv' }), set: vi.fn() }),
}))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => `chat.${key}`,
  getFormatter: async () => ({ number: (value: number) => `${value} ₫` }),
}))
vi.mock('@/lib/auth', () => ({ getCurrentUser: async () => null }))
vi.mock('@/features/books/queries', () => ({
  getCategories: async () => [{ id: 1, parent_id: null, name: 'Văn học', slug: 'truyen-ngan-tan-van' }],
  getBookBySlug: async () => state.current,
}))
vi.mock('./queries', () => ({
  getChatCatalog: async () => state.catalog ?? [
    {
      id: 1,
      slug: 'mat-biec',
      title: 'Mắt biếc',
      language: 'vi',
      category_id: 1,
      stock: 5,
      sold_count: 1,
      is_featured: false,
      cover_width: 600,
      description: 'Tình yêu tuổi học trò.',
      book_authors: [{ role: 'author', authors: { name: 'Nguyễn Nhật Ánh' } }],
    },
  ],
  getChatBookCards: async () => [
    {
      id: 1,
      slug: 'mat-biec',
      title: 'Mắt biếc',
      cover_url: null,
      price: 98000,
      original_price: null,
      stock: 5,
      book_authors: [{ role: 'author', authors: { name: 'Nguyễn Nhật Ánh' } }],
    },
  ],
}))
vi.mock('./env', () => ({ resolveChatMode: () => ({ kind: 'gemini', apiKey: 'k', model: 'gemini-3.5-flash-lite', quotaToken: 'a'.repeat(64) }) }))

const consumeQuota = vi.fn()
const callGemini = vi.fn()
vi.mock('./quota', async (importOriginal) => ({ ...(await importOriginal<typeof import('./quota')>()), consumeQuota }))
vi.mock('./gemini', () => ({ activeCooldown: () => state.cooldown, callGemini, GLOBAL_COOLDOWN: 'global' }))

const { askMay } = await import('./actions')

const ask = (message: string) => askMay({ message, ageConfirmed: true })

beforeEach(() => {
  state.country = null
  state.cooldown = null
  state.catalog = null
  state.current = null
  consumeQuota.mockReset().mockResolvedValue({ ok: true, ticket: {} })
  callGemini.mockReset().mockResolvedValue({
    ok: true,
    finishReason: 'STOP',
    usage: { prompt: 1, candidates: 1, thoughts: 0 },
    text: JSON.stringify({
      intent: 'recommend',
      message: 'Mây gợi ý.',
      books: [{ slug: 'mat-biec', reason: 'Hoài niệm.' }],
      follow_up: 'Thêm nữa không?',
      non_vietnamese: false,
    }),
  })
})

describe('askMay', () => {
  it('chưa xác nhận 18+ → INVALID_INPUT, không trừ lượt', async () => {
    expect(await askMay({ message: 'x' })).toEqual({ ok: false, code: 'INVALID_INPUT' })
    expect(consumeQuota).not.toHaveBeenCalled()
  })

  it('câu tự hại → câu hỗ trợ cố định, không trừ lượt, không gọi AI', async () => {
    const result = await ask('tôi muốn chết')
    expect(result).toMatchObject({ ok: true, data: { kind: 'crisis', message: 'chat.crisis', books: [] } })
    expect(consumeQuota).not.toHaveBeenCalled()
    expect(callGemini).not.toHaveBeenCalled()
  })

  it('câu tự hại từ nước bị chặn vẫn nhận câu hỗ trợ (bộ lọc chạy trước bước khu vực)', async () => {
    state.country = 'DE'
    expect(await ask('tôi muốn chết')).toMatchObject({ ok: true, data: { kind: 'crisis' } })
  })

  it('câu thường từ nước bị chặn → CHAT_REGION, không trừ lượt, không gọi AI', async () => {
    state.country = 'GB'
    expect(await ask('gợi ý sách')).toEqual({ ok: false, code: 'CHAT_REGION' })
    expect(consumeQuota).not.toHaveBeenCalled()
    expect(callGemini).not.toHaveBeenCalled()
  })

  it('đang cooldown sau 429 → CHAT_FREE_QUOTA đúng scope, không trừ lượt, không gọi AI', async () => {
    state.cooldown = { scope: 'gemini_day', resetsAt: new Date('2026-10-20T07:00:00Z'), until: Date.now() + 1000 }
    expect(await ask('gợi ý sách')).toEqual({
      ok: false,
      code: 'CHAT_FREE_QUOTA',
      details: { scope: 'gemini_day', resetTime: '14:00' },
    })
    expect(consumeQuota).not.toHaveBeenCalled()
  })

  it('hết lượt của khách → CHAT_QUOTA_EXCEEDED, không gọi AI', async () => {
    consumeQuota.mockResolvedValue({ ok: false, code: 'CHAT_QUOTA_EXCEEDED', scope: 'visitor_hour', resetsAt: null })
    expect(await ask('gợi ý sách')).toEqual({ ok: false, code: 'CHAT_QUOTA_EXCEEDED', details: { scope: 'visitor_hour' } })
    expect(callGemini).not.toHaveBeenCalled()
  })

  it('bình thường: trừ lượt một lần (khách chưa đăng nhập: có IP băm), gọi AI một lần, thẻ sách từ DB', async () => {
    const result = await ask('sách tình yêu tuổi học trò')
    expect(consumeQuota).toHaveBeenCalledTimes(1)
    expect(consumeQuota.mock.calls[0]?.[0]).toMatchObject({ visitor: expect.stringMatching(/^[0-9a-f]{32}$/), ip: expect.stringMatching(/^[0-9a-f]{32}$/) })
    expect(callGemini).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      ok: true,
      data: {
        kind: 'answer',
        message: 'Mây gợi ý.',
        books: [{ slug: 'mat-biec', title: 'Mắt biếc', authors: 'Nguyễn Nhật Ánh', coverUrl: null, priceLabel: '98000 ₫', reason: 'Hoài niệm.' }],
        followUp: 'Thêm nữa không?',
        languageNotice: false,
        aboutBook: null,
        turn: { user: 'sách tình yêu tuổi học trò', model: { message: 'Mây gợi ý.', follow_up: 'Thêm nữa không?', slugs: ['mat-biec'] } },
      },
    })
  })

  it('AI trả 429 → CHAT_FREE_QUOTA; JSON sai → CHAT_UNAVAILABLE; intent crisis → câu hỗ trợ cố định', async () => {
    callGemini.mockResolvedValueOnce({ ok: false, kind: 'quota', scope: 'gemini_minute', resetsAt: new Date('2026-10-20T03:01:00Z') })
    expect(await ask('gợi ý sách')).toMatchObject({ ok: false, code: 'CHAT_FREE_QUOTA', details: { scope: 'gemini_minute' } })
    callGemini.mockResolvedValueOnce({ ok: true, text: '{"sai"', finishReason: 'STOP', usage: {} })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await ask('gợi ý sách')).toEqual({ ok: false, code: 'CHAT_UNAVAILABLE' })
    callGemini.mockResolvedValueOnce({
      ok: true,
      finishReason: 'STOP',
      usage: {},
      text: JSON.stringify({ intent: 'crisis', message: 'x', books: [], follow_up: '', non_vietnamese: false }),
    })
    expect(await ask('gợi ý sách')).toMatchObject({ ok: true, data: { kind: 'crisis', message: 'chat.crisis' } })
  })

  it('sách thuộc danh mục ẩn không vào ứng viên / enum slug; sách không có danh mục vẫn vào (docs/plans/sau-ux.md mục 6)', async () => {
    const book = (slug: string, category_id: number | null) => ({
      id: slug.length,
      slug,
      title: `Tình yêu ${slug}`,
      language: 'vi',
      category_id,
      stock: 5,
      sold_count: 1,
      is_featured: false,
      cover_width: 600,
      description: 'Tình yêu tuổi học trò.',
      book_authors: [],
    })
    // getCategories (giả) chỉ có danh mục 1: danh mục 10 coi như ẩn
    state.catalog = [book('mat-biec', 1), book('sach-an', 10), book('khong-danh-muc', null)]
    await ask('sách tình yêu')
    expect(callGemini).toHaveBeenCalledTimes(1)
    const body = JSON.stringify(callGemini.mock.calls[0]?.[1].body)
    expect(body).toContain('mat-biec')
    expect(body).toContain('khong-danh-muc')
    expect(body).not.toContain('sach-an')
  })

  it('lỗi bất ngờ → CHAT_UNAVAILABLE, không throw', async () => {
    consumeQuota.mockRejectedValue(new Error('boom'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await ask('gợi ý sách')).toEqual({ ok: false, code: 'CHAT_UNAVAILABLE' })
  })

  it('đầu vào lớn nhất (300 ký tự, 4 lượt lịch sử dài, sách đang xem, 40 sách dài) → vẫn gọi Gemini đúng 1 lần và trả ok', async () => {
    const longBook = (index: number) => ({
      id: index + 10,
      slug: `sach-tieng-viet-co-ten-kha-dai-so-${index}`,
      title: `Những ngày thơ ấu và những câu chuyện chưa kể số ${index}`,
      language: 'vi',
      category_id: 1,
      stock: 5,
      sold_count: index,
      is_featured: false,
      cover_width: 600,
      description: 'ứ'.repeat(2000),
      book_authors: [
        { role: 'author', authors: { name: 'Nguyễn Văn Một' } },
        { role: 'author', authors: { name: 'Trần Thị Hai' } },
      ],
    })
    state.catalog = Array.from({ length: 40 }, (_, index) => longBook(index))
    state.current = { ...longBook(0), description: 'ữ'.repeat(3000), book_authors: [] }
    const turn = {
      user: 'ữ'.repeat(300),
      model: { message: 'ữ'.repeat(600), follow_up: 'ữ'.repeat(200), slugs: ['sach-tieng-viet-co-ten-kha-dai-so-1'] },
    }
    const result = await askMay({
      message: 'ữ'.repeat(300),
      history: [turn, turn, turn, turn],
      slug: 'sach-tieng-viet-co-ten-kha-dai-so-0',
      ageConfirmed: true,
    })
    expect(callGemini).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
    const { estimatePromptTokens } = await import('./prompt')
    const body = callGemini.mock.calls[0]?.[1].body
    expect(estimatePromptTokens(body)).toBeLessThan(8_000)
    expect(body.contents.length).toBeGreaterThanOrEqual(1 + 2 * 2)
  })
})
