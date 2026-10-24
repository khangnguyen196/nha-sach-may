import { beforeEach, describe, expect, it, vi } from 'vitest'

// expireOrderBooks với Supabase giả: tag nào bị làm mới theo từng loại dòng đơn (sách mới / sách cũ)
const updateTag = vi.fn()
const eq = vi.fn()
const select = vi.fn<(columns: string) => { eq: typeof eq }>(() => ({ eq }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ updateTag }))
// Client giả chỉ có đúng chuỗi from('order_items').select(…).eq('order_id', id) mà expireOrderBooks gọi
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => ({ select }) }) }))

const { expireOrderBooks } = await import('./cache')
const { createClient } = await import('@/lib/supabase/server')

type Line = { book_id: number | null; used_listing_id: number | null }

async function supabaseWith(lines: Line[], error: { message: string } | null = null) {
  eq.mockResolvedValue({ data: error ? null : lines, error })
  return createClient()
}

const expired = () => updateTag.mock.calls.map(([tag]) => String(tag)).sort()

beforeEach(() => {
  updateTag.mockReset()
  eq.mockReset()
  select.mockClear()
})

describe('expireOrderBooks', () => {
  it('đơn thường → chỉ tag book:{id} của từng sách', async () => {
    const client = await supabaseWith([
      { book_id: 3, used_listing_id: null },
      { book_id: 8, used_listing_id: null },
    ])
    await expireOrderBooks(client, 41)
    expect(select).toHaveBeenCalledWith('book_id, used_listing_id')
    expect(eq).toHaveBeenCalledWith('order_id', 41)
    expect(expired()).toEqual(['book:3', 'book:8'])
  })

  it('đơn sách cũ → tag chợ, trang tin, "Có N bản cũ" của sách; không tag book:{id} (tồn kho không đổi)', async () => {
    const client = await supabaseWith([{ book_id: 5, used_listing_id: 12 }])
    await expireOrderBooks(client, 42)
    expect(expired()).toEqual(['used-book:5', 'used-listing:12', 'used-listings'])
  })

  it('đơn có cả hai loại dòng → đủ tag của mỗi loại, mỗi tag một lần', async () => {
    const client = await supabaseWith([
      { book_id: 5, used_listing_id: 12 },
      { book_id: 6, used_listing_id: 13 },
      { book_id: 7, used_listing_id: null },
      { book_id: null, used_listing_id: null },
    ])
    await expireOrderBooks(client, 43)
    expect(expired()).toEqual([
      'book:7',
      'used-book:5',
      'used-book:6',
      'used-listing:12',
      'used-listing:13',
      'used-listings',
    ])
  })

  it('đọc dòng đơn lỗi → không làm mới gì, không throw', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const client = await supabaseWith([], { message: 'network' })
    await expect(expireOrderBooks(client, 44)).resolves.toBeUndefined()
    expect(updateTag).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
