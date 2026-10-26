import { beforeEach, describe, expect, it, vi } from 'vitest'

// Thứ tự các bước của askMay (docs/plans/phase-11.md → Luồng). Phụ thuộc ngoài đều giả lập.
const state = vi.hoisted(() => ({
  country: null as string | null,
  cooldown: null as null | { scope: 'gemini_minute' | 'gemini_day'; resetsAt: Date; until: number },
  // null = catalog mặc định (1 cuốn); test đầu vào lớn nhất thay bằng 40 cuốn dài
  catalog: null as null | unknown[],
  current: null as null | unknown,
  // null = khách; có user → askMay đọc mục chặn (getMyBlocks giả trả `blocks`, hoặc ném lỗi khi `blocks` là Error)
  user: null as null | { id: string },
  blocks: [] as unknown[] | Error,
  // null = thẻ mặc định (mat-biec); test lọc thẻ thay bằng dòng riêng
  cards: null as null | { slug: string }[],
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
vi.mock('@/lib/auth', () => ({ getCurrentUser: async () => state.user }))
const getMyBlocks = vi.fn(async () => {
  if (state.blocks instanceof Error) throw state.blocks
  return state.blocks
})
vi.mock('@/features/prefs/queries', () => ({ getMyBlocks }))
vi.mock('@/features/books/queries', () => ({
  getCategories: async () => [
    { id: 1, parent_id: null, name: 'Văn học', slug: 'truyen-ngan-tan-van' },
    { id: 2, parent_id: 1, name: 'Truyện ngắn', slug: 'truyen-ngan' },
    { id: 3, parent_id: null, name: 'Kinh tế', slug: 'kinh-te' },
  ],
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
      publisher_id: 7,
      content_warnings: [],
      stock: 5,
      sold_count: 1,
      is_featured: false,
      cover_width: 600,
      description: 'Tình yêu tuổi học trò.',
      book_authors: [{ role: 'author', author_id: 70, authors: { name: 'Nguyễn Nhật Ánh' } }],
    },
  ],
  getChatBookCards: async (slugs: string[]) =>
    (
      state.cards ?? [
        {
          id: 1,
          slug: 'mat-biec',
          title: 'Mắt biếc',
          cover_url: null,
          price: 98000,
          original_price: null,
          stock: 5,
          category_id: 1,
          publisher_id: 7,
          content_warnings: [],
          book_authors: [{ role: 'author', author_id: 70, authors: { name: 'Nguyễn Nhật Ánh' } }],
        },
      ]
    ).filter((card) => slugs.includes(card.slug)),
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
  state.user = null
  state.blocks = []
  state.cards = null
  getMyBlocks.mockClear()
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
  describe('chặn theo sở thích (câu 10): không gợi ý sách bị chặn', () => {
    type Author = { role: string; author_id: number; authors: { name: string } }
    const author = (author_id: number, role = 'author'): Author => ({ role, author_id, authors: { name: `Người ${author_id}` } })
    const catalogBook = (
      slug: string,
      { category_id = 3, publisher_id = 8, content_warnings = [] as string[], authors = [author(60)] } = {},
    ) => ({
      id: slug.length * 100 + slug.charCodeAt(0),
      slug,
      title: `Tựa ${slug}`,
      language: 'vi',
      category_id,
      publisher_id,
      content_warnings,
      stock: 5,
      sold_count: 1,
      is_featured: false,
      cover_width: 600,
      description: 'Tình yêu tuổi học trò.',
      book_authors: authors,
    })
    const cardRow = (book: ReturnType<typeof catalogBook>) => ({ ...book, cover_url: null, price: 50000, original_price: null })
    // Danh mục 2 là con của 1 (chặn danh mục cha); tác giả 50, NXB 9, nhãn adult bị chặn; dịch giả 50 không tính (câu 9)
    const BLOCKED = ['con-cua-cha', 'tac-gia-chan', 'nxb-chan', 'nhan-chan'] as const
    const KEPT = ['dich-gia', 'khong-chan'] as const
    const CATALOG = [
      catalogBook('con-cua-cha', { category_id: 2 }),
      catalogBook('tac-gia-chan', { authors: [author(50)] }),
      catalogBook('dich-gia', { authors: [author(50, 'translator'), author(51)] }),
      catalogBook('nxb-chan', { publisher_id: 9 }),
      catalogBook('nhan-chan', { content_warnings: ['loss', 'adult'] }),
      catalogBook('khong-chan'),
    ]
    const RULES = [
      { kind: 'category', id: 1, rowId: 1 },
      { kind: 'author', id: 50, rowId: 2 },
      { kind: 'publisher', id: 9, rowId: 3 },
      { kind: 'warning', warning: 'adult', rowId: 4 },
    ]
    const ALL = CATALOG.map((book) => book.slug).toSorted()
    const aiReply = (slugs: readonly string[], intent = 'recommend') => ({
      ok: true,
      finishReason: 'STOP',
      usage: {},
      text: JSON.stringify({
        intent,
        message: 'Mây gợi ý.',
        books: slugs.map((slug) => ({ slug, reason: 'Hợp.' })),
        follow_up: '',
        non_vietnamese: false,
      }),
    })
    const sentBody = () => callGemini.mock.calls[0]?.[1].body
    /** Tập slug cho phép trong schema đầu ra (enum) của request vừa gửi */
    const enumOf = (body: unknown): string[] =>
      JSON.parse(JSON.stringify(body)).generationConfig.responseJsonSchema.properties.books.items.properties.slug.enum
    const cardSlugs = (result: Awaited<ReturnType<typeof askMay>>) => (result.ok ? result.data.books.map((book) => book.slug) : null)

    beforeEach(() => {
      state.catalog = CATALOG
      state.cards = CATALOG.map(cardRow)
    })

    it('lớp 1: sách bị chặn (danh mục cha → con, tác giả vai trò author, NXB, nhãn) không vào ứng viên / enum / prompt; không gửi mục chặn cho AI', async () => {
      state.user = { id: 'user-1' }
      state.blocks = RULES
      callGemini.mockResolvedValueOnce(aiReply(['dich-gia']))
      const result = await ask('sách tình yêu')
      expect(getMyBlocks).toHaveBeenCalledWith('user-1')
      const body = sentBody()
      expect(enumOf(body).toSorted()).toEqual([...KEPT].toSorted())
      const text = JSON.stringify(body)
      for (const slug of BLOCKED) {
        expect(text, slug).not.toContain(slug)
        expect(text, slug).not.toContain(`Tựa ${slug}`)
      }
      for (const slug of KEPT) expect(text, slug).toContain(slug)
      // Khóa chặn / mục chặn / id người hỏi không đi vào request (chỉ dữ liệu sách công khai đã rút gọn)
      for (const key of ['publisher_id', 'author_id', 'content_warnings', 'adult', 'user-1']) expect(text, key).not.toContain(key)
      expect(cardSlugs(result)).toEqual(['dich-gia'])
    })

    it('lớp 2: thẻ bị chặn bị bỏ dù ứng viên có (catalog cache cũ, dữ liệu thẻ mới đã đổi tác giả)', async () => {
      state.user = { id: 'user-1' }
      state.blocks = RULES
      state.cards = [{ ...cardRow(catalogBook('khong-chan')), book_authors: [author(50)] }, cardRow(catalogBook('dich-gia'))]
      callGemini.mockResolvedValueOnce(aiReply(['khong-chan', 'dich-gia']))
      const result = await ask('sách tình yêu')
      expect(enumOf(sentBody())).toContain('khong-chan')
      expect(result).toMatchObject({ ok: true, data: { turn: { model: { slugs: ['dich-gia'] } } } })
      expect(cardSlugs(result)).toEqual(['dich-gia'])
    })

    it('sách đang xem bị chặn: vẫn là SÁCH ĐANG XEM (aboutBook), slug không nằm trong enum / tập validate → không thành thẻ', async () => {
      state.user = { id: 'user-1' }
      state.blocks = RULES
      state.current = {
        slug: 'tac-gia-chan',
        title: 'Tựa tac-gia-chan',
        language: 'vi',
        description: 'Một câu chuyện dài.',
        book_authors: [{ role: 'author', authors: { name: 'Người 50' } }],
      }
      // Thẻ của cuốn đang xem không bị lớp 2 bắt (dữ liệu thẻ không còn tác giả bị chặn): chỉ tập slug cho phép chặn được
      state.cards = [{ ...cardRow(catalogBook('tac-gia-chan')), book_authors: [author(61)] }, cardRow(catalogBook('khong-chan'))]
      callGemini.mockResolvedValueOnce(aiReply(['tac-gia-chan', 'khong-chan'], 'about_book'))
      const result = await askMay({ message: 'Cuốn này nói về gì?', slug: 'tac-gia-chan', ageConfirmed: true })
      const body = sentBody()
      expect(enumOf(body)).not.toContain('tac-gia-chan')
      const lastTurn: string = body.contents.at(-1).parts[0].text
      expect(lastTurn).toMatch(/^SÁCH ĐANG XEM: .*"s":"tac-gia-chan"/m)
      expect(lastTurn).toMatch(/^DANH SÁCH SÁCH: (?!.*tac-gia-chan)/m)
      expect(result).toMatchObject({ ok: true, data: { aboutBook: 'Tựa tac-gia-chan' } })
      expect(cardSlugs(result)).toEqual(['khong-chan'])
    })

    it('đọc mục chặn lỗi → không lọc, chỉ log mã lỗi, vẫn trả lời', async () => {
      state.user = { id: 'user-1' }
      state.blocks = new Error('getMyBlocks: 42501')
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      callGemini.mockResolvedValueOnce(aiReply(['tac-gia-chan']))
      const result = await ask('sách tình yêu')
      expect(logged).toHaveBeenCalledWith('[chat] getMyBlocks:', 'getMyBlocks: 42501')
      expect(enumOf(sentBody()).toSorted()).toEqual(ALL)
      expect(cardSlugs(result)).toEqual(['tac-gia-chan'])
    })

    it('khách: không đọc mục chặn, không lọc; thành viên chưa chặn gì: như khách', async () => {
      await ask('sách tình yêu')
      expect(getMyBlocks).not.toHaveBeenCalled()
      expect(enumOf(sentBody()).toSorted()).toEqual(ALL)

      callGemini.mockClear()
      state.user = { id: 'user-2' }
      state.blocks = []
      await ask('sách tình yêu')
      expect(getMyBlocks).toHaveBeenCalledWith('user-2')
      expect(enumOf(sentBody()).toSorted()).toEqual(ALL)
    })
  })
})
