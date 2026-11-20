import { afterEach, describe, expect, it, vi } from 'vitest'
import { getShippingTermsOrNull } from './queries'

// Thẻ "Miễn phí giao hàng" (docs/plans/trang-chu-khuyen-mai.md vòng 2): getShippingTerms chạy thật trên client Supabase
// giả; lỗi query sách / RPC quote_items → hàm bọc trả null (ẩn thẻ) thay vì làm hỏng cả trang chủ.

const fake = vi.hoisted(() => ({
  book: { data: { id: 5 } as { id: number } | null, error: null as { message: string } | null },
  quote: {
    data: { free_ship_from: 300_000, shipping_fee: 30_000 } as { free_ship_from: number; shipping_fee: number } | null,
    error: null as { message: string } | null,
  },
}))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ cacheLife: () => {} }))
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => {
    const books = {
      select: () => books,
      order: () => books,
      limit: () => books,
      maybeSingle: async () => fake.book,
    }
    return {
      from: () => books,
      rpc: () => ({ single: async () => fake.quote }),
    }
  },
}))

afterEach(() => {
  fake.book = { data: { id: 5 }, error: null }
  fake.quote = { data: { free_ship_from: 300_000, shipping_fee: 30_000 }, error: null }
  vi.restoreAllMocks()
})

describe('getShippingTermsOrNull', () => {
  it('RPC trả mốc + phí → điều kiện giao hàng', async () => {
    await expect(getShippingTermsOrNull()).resolves.toEqual({ freeShipFrom: 300_000, fee: 30_000 })
  })

  it('RPC quote_items lỗi → null (ẩn thẻ), ghi log ngắn', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    fake.quote = { data: null, error: { message: 'connection reset' } }
    await expect(getShippingTermsOrNull()).resolves.toBeNull()
    expect(log).toHaveBeenCalledOnce()
    expect(log.mock.calls[0]?.[0]).toBe('getShippingTermsOrNull:')
  })

  it('query sách lỗi → null', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fake.book = { data: null, error: { message: 'timeout' } }
    await expect(getShippingTermsOrNull()).resolves.toBeNull()
  })
})
