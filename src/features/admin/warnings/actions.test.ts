import { beforeEach, describe, expect, it, vi } from 'vitest'

// Logic của action gợi ý cảnh báo với Supabase giả (ghi lại chuỗi lời gọi PostgREST) + suggestWarnings giả: không gọi
// Gemini, không DB. Phần SQL / RLS kiểm ở e2e (admin-prefs-warnings-rls.spec.ts).

type Op = [method: string, args: unknown[]]
type Query = { table: string; ops: Op[] }
type Response = { data: unknown; error: { code: string; message: string } | null }

const queries: Query[] = []
let respond: (query: Query) => Response = () => ({ data: null, error: null })
const rpc = vi.fn()
const suggestWarnings = vi.fn()
const refresh = vi.fn()
const updateTag = vi.fn()

/** Builder giả: mọi phương thức trả lại chính nó và ghi lại lời gọi; `await` → respond(query) */
function from(table: string) {
  const query: Query = { table, ops: [] }
  queries.push(query)
  const builder: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (value: Response) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(respond(query)).then(resolve, reject)
        }
        return (...args: unknown[]) => {
          query.ops.push([String(prop), args])
          return builder
        }
      },
    },
  )
  return builder
}

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ refresh, updateTag }))
vi.mock('../auth', () => ({ assertAdmin: async () => null }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from, rpc }) }))
vi.mock('@/features/warnings/suggest', () => ({ suggestWarnings }))
vi.mock('./quota-message', () => ({
  warningQuotaFailure: async (scope: string | null) => ({ ok: false, code: 'WARNING_QUOTA_EXCEEDED', message: `quota:${scope}` }),
}))

const { markReviewedNoWarnings, reviewSuggestion, suggestNextBatch, suggestOneBook } = await import('./actions')

const has = (query: Query, method: string) => query.ops.some(([name]) => name === method)
const argsOf = (query: Query, method: string) => query.ops.filter(([name]) => name === method).map(([, args]) => args)

const bookRow = (id: number) => ({
  id,
  title: `Sách ${id}`,
  description: null,
  categories: { name: 'Văn học' },
  book_authors: [
    { role: 'author', authors: { name: 'Tác giả' } },
    { role: 'translator', authors: { name: 'Dịch giả' } },
  ],
})

const okSuggest = (ids: number[], missing: number[] = []) => ({
  ok: true,
  model: 'mock',
  results: ids.map((bookId) => ({ bookId, labels: ['loss'], reason: 'Có mất mát.' })),
  missing,
})

beforeEach(() => {
  queries.length = 0
  respond = () => ({ data: null, error: null })
  for (const mock of [rpc, suggestWarnings, refresh, updateTag]) mock.mockReset()
})

describe('suggestNextBatch', () => {
  it('không còn sách chưa xét → trả ngay, không gọi AI (không trừ lượt)', async () => {
    respond = () => ({ data: [], error: null })
    expect(await suggestNextBatch()).toEqual({ ok: true, data: { inserted: 0, missing: 0, remaining: false } })
    expect(suggestWarnings).not.toHaveBeenCalled()
  })

  it('server tự chọn: chưa xét + không có gợi ý pending, theo id, lấy thêm 1 cuốn; 23505 bỏ qua; còn sách → remaining', async () => {
    let inserts = 0
    respond = (query) => {
      if (query.table === 'books') return { data: Array.from({ length: 13 }, (_, index) => bookRow(index + 1)), error: null }
      inserts += 1
      return inserts === 2
        ? { data: null, error: { code: '23505', message: 'duplicate key' } }
        : { data: { id: 100 + inserts }, error: null }
    }
    suggestWarnings.mockResolvedValue(okSuggest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [12]))

    expect(await suggestNextBatch()).toEqual({ ok: true, data: { inserted: 10, missing: 1, remaining: true } })

    const [select] = queries
    expect(select?.table).toBe('books')
    expect(argsOf(select!, 'is')).toEqual([
      ['content_warnings_reviewed_at', null],
      ['content_warning_suggestions', null],
    ])
    expect(argsOf(select!, 'eq')).toEqual([['content_warning_suggestions.status', 'pending']])
    expect(argsOf(select!, 'order')).toEqual([['id', { ascending: true }]])
    expect(argsOf(select!, 'limit')).toEqual([[13]])
    // Lô 12 cuốn đầu, chỉ tác giả vai trò author
    const [batch] = suggestWarnings.mock.calls[0] ?? []
    expect(batch).toHaveLength(12)
    expect(batch[0]).toEqual({ id: 1, title: 'Sách 1', authors: ['Tác giả'], category: 'Văn học', description: null })
    expect(queries.filter((query) => query.table === 'content_warning_suggestions')).toHaveLength(11)
    expect(argsOf(queries[1]!, 'insert')).toEqual([[{ book_id: 1, labels: ['loss'], reason: 'Có mất mát.', model: 'mock' }]])
  })

  it('lượt cuối đủ mục → remaining = false', async () => {
    respond = (query) =>
      query.table === 'books'
        ? { data: [bookRow(1), bookRow(2)], error: null }
        : { data: { id: 9 }, error: null }
    suggestWarnings.mockResolvedValue(okSuggest([1, 2]))
    expect(await suggestNextBatch()).toEqual({ ok: true, data: { inserted: 2, missing: 0, remaining: false } })
  })

  it('AI không trả mục nào dùng được → WARNING_AI_FAILED (lô dừng), không ghi gì', async () => {
    respond = () => ({ data: [bookRow(1), bookRow(2)], error: null })
    suggestWarnings.mockResolvedValue(okSuggest([], [1, 2]))
    expect(await suggestNextBatch()).toEqual({ ok: false, code: 'WARNING_AI_FAILED' })
    expect(queries.filter((query) => query.table === 'content_warning_suggestions')).toHaveLength(0)
  })

  it('hết lượt → câu theo scope, không ghi gì', async () => {
    respond = () => ({ data: [bookRow(1)], error: null })
    suggestWarnings.mockResolvedValue({ ok: false, code: 'WARNING_QUOTA_EXCEEDED', scope: 'chat_reserve', resetsAt: null })
    expect(await suggestNextBatch()).toEqual({ ok: false, code: 'WARNING_QUOTA_EXCEEDED', message: 'quota:chat_reserve' })
    expect(queries).toHaveLength(1)
  })
})

describe('suggestOneBook', () => {
  it('sách đã có gợi ý pending → trả id đó, không gọi AI', async () => {
    respond = () => ({ data: { id: 55 }, error: null })
    expect(await suggestOneBook(3)).toEqual({ ok: true, data: { suggestionId: 55 } })
    expect(suggestWarnings).not.toHaveBeenCalled()
    expect(argsOf(queries[0]!, 'eq')).toEqual([
      ['book_id', 3],
      ['status', 'pending'],
    ])
  })

  it('sách nằm trong missing → WARNING_AI_FAILED, không ghi', async () => {
    respond = (query) => (query.table === 'books' ? { data: bookRow(3), error: null } : { data: null, error: null })
    suggestWarnings.mockResolvedValue(okSuggest([], [3]))
    expect(await suggestOneBook(3)).toEqual({ ok: false, code: 'WARNING_AI_FAILED' })
    expect(queries.some((query) => has(query, 'insert'))).toBe(false)
  })

  it('23505 (tab khác vừa tạo) → đọc lại, trả gợi ý pending đó', async () => {
    let pendingReads = 0
    respond = (query) => {
      if (query.table === 'books') return { data: bookRow(3), error: null }
      if (has(query, 'insert')) return { data: null, error: { code: '23505', message: 'duplicate key' } }
      pendingReads += 1
      return { data: pendingReads === 1 ? null : { id: 77 }, error: null }
    }
    suggestWarnings.mockResolvedValue(okSuggest([3]))
    expect(await suggestOneBook(3)).toEqual({ ok: true, data: { suggestionId: 77 } })
    expect(refresh).toHaveBeenCalled()
  })
})

describe('reviewSuggestion', () => {
  const form = (entries: [string, string][]) => {
    const data = new FormData()
    for (const [key, value] of entries) data.append(key, value)
    return data
  }

  it('sách chưa xét: RPC không có khóa p_expected_reviewed_at; xong → book:{id} + chat-catalog', async () => {
    rpc.mockResolvedValue({ data: 42, error: null })
    const result = await reviewSuggestion(9, null, form([['labels', 'loss'], ['decision', 'approve']]))
    expect(result).toEqual({ ok: true, data: null })
    expect(rpc).toHaveBeenCalledWith('review_warning_suggestion', { p_id: 9, p_labels: ['loss'], p_approve: true })
    expect(updateTag.mock.calls).toEqual([['book:42'], ['chat-catalog']])
    expect(refresh).toHaveBeenCalled()
  })

  it('SUGGESTION_STATUS_CHANGED → làm mới trang, không làm mới cache', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'SUGGESTION_STATUS_CHANGED' } })
    const raw = '2026-10-25T09:42:01.123456+00:00'
    const result = await reviewSuggestion(9, null, form([['decision', 'dismiss'], ['expected_reviewed_at', raw]]))
    expect(result).toEqual({ ok: false, code: 'SUGGESTION_STATUS_CHANGED' })
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_approve: false, p_expected_reviewed_at: raw })
    expect(refresh).toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })
})

describe('markReviewedNoWarnings', () => {
  it('ghi giờ server, chỉ khi sách còn chưa xét; 0 dòng vẫn coi như xong', async () => {
    expect(await markReviewedNoWarnings(5)).toEqual({ ok: true, data: null })
    const [update] = queries
    const [[values]] = argsOf(update!, 'update') as [[{ content_warnings_reviewed_at: string }]]
    expect(Number.isNaN(Date.parse(values.content_warnings_reviewed_at))).toBe(false)
    expect(argsOf(update!, 'eq')).toEqual([['id', 5]])
    expect(argsOf(update!, 'is')).toEqual([['content_warnings_reviewed_at', null]])
    expect(refresh).toHaveBeenCalled()
  })
})
