import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCategoryShelfOrEmpty } from './queries'

// Kệ danh mục trang chủ (docs/plans/ke-danh-muc.md vòng 2): getCategoryShelf chạy thật trên client Supabase giả; lỗi
// truy vấn → hàm bọc trả [] (ẩn đúng kệ đó) thay vì làm hỏng cả trang chủ. Mẫu: features/home/queries.test.ts.

type Row = { id: number; stock: number }

const fake = vi.hoisted(() => ({
  result: { data: [] as Row[] | null, error: null as { message: string } | null },
  /** Truy vấn ném thẳng (không trả { error }): lỗi nội bộ của Next đi qua đây */
  throws: null as Error | null,
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ cacheLife: () => {}, cacheTag: () => {} }))
vi.mock('@/lib/cover-image', () => ({ SHARP_COVER_WIDTH: 300 }))
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => {
    const books = {
      select: () => books,
      in: () => books,
      order: () => books,
      limit: async () => {
        if (fake.throws) throw fake.throws
        return fake.result
      },
    }
    return { from: () => books }
  },
}))

const rows = (count: number): Row[] => Array.from({ length: count }, (_, i) => ({ id: i + 1, stock: 5 }))

afterEach(() => {
  fake.result = { data: [], error: null }
  fake.throws = null
  vi.restoreAllMocks()
})

describe('getCategoryShelfOrEmpty', () => {
  it('truy vấn ok → sách của kệ', async () => {
    fake.result = { data: rows(5), error: null }
    const shelf = await getCategoryShelfOrEmpty([1, 2])
    expect(shelf.map((book) => book.id)).toEqual([1, 2, 3, 4, 5])
  })

  it('truy vấn lỗi → [] (ẩn kệ), ghi log ngắn đúng tiền tố', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    fake.result = { data: null, error: { message: 'connection reset' } }
    await expect(getCategoryShelfOrEmpty([1, 2])).resolves.toEqual([])
    expect(log).toHaveBeenCalledOnce()
    expect(log.mock.calls[0]?.[0]).toBe('getCategoryShelfOrEmpty:')
    expect(log.mock.calls[0]?.[1]).toContain('connection reset')
  })

  it('lỗi dài → log cắt 200 ký tự', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    fake.throws = new Error('x'.repeat(500))
    await expect(getCategoryShelfOrEmpty([1])).resolves.toEqual([])
    expect(log.mock.calls[0]?.[1]).toHaveLength(200)
  })

  it('lỗi redirect của Next → ném tiếp, không thành [], không ghi log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/x;307;' })
    fake.throws = redirect
    await expect(getCategoryShelfOrEmpty([1])).rejects.toBe(redirect)
    expect(log).not.toHaveBeenCalled()
  })

  it('lỗi prerender của Next (dùng dữ liệu động) → ném tiếp', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dynamic = Object.assign(new Error('Dynamic server usage'), { digest: 'DYNAMIC_SERVER_USAGE' })
    fake.throws = dynamic
    await expect(getCategoryShelfOrEmpty([1])).rejects.toBe(dynamic)
    expect(log).not.toHaveBeenCalled()
  })
})
