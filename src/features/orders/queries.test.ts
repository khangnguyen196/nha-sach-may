import { beforeEach, describe, expect, it, vi } from 'vitest'

// Supabase giả ghi lại chuỗi lọc của query: trang tài khoản / đặt hàng thành công phải lọc theo user_id của phiên,
// không chỉ dựa vào RLS (policy orders_select_own_or_admin cho admin đọc mọi đơn).
type Call = [method: string, ...args: unknown[]]
let calls: Call[] = []
let result: { data: unknown; count?: number; error: null } = { data: null, error: null }

function builder() {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'order', 'range', 'maybeSingle']) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, ...args])
      return chain
    }
  }
  // await query → kết quả giả
  chain.then = (resolve: (value: typeof result) => unknown) => resolve(result)
  return chain
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      calls.push(['from', table])
      return builder()
    },
  }),
}))

const { getOrderByCode, listOrders } = await import('./queries')

const USER = '5f0c1f43-6a59-4f7e-9d43-3f7f2b8f2a10'

beforeEach(() => {
  calls = []
})

describe('query đơn phía khách lọc theo user_id', () => {
  it('getOrderByCode: lọc mã đơn + user_id', async () => {
    result = { data: { id: 1 }, error: null }
    await getOrderByCode('NS26101600001', USER)
    expect(calls).toContainEqual(['eq', 'order_code', 'NS26101600001'])
    expect(calls).toContainEqual(['eq', 'user_id', USER])
  })

  it('getOrderByCode: mã sai định dạng → null, không query', async () => {
    expect(await getOrderByCode('khong-phai-ma', USER)).toBeNull()
    expect(calls).toEqual([])
  })

  it('listOrders: lọc user_id cả khi có bộ lọc trạng thái', async () => {
    result = { data: [], count: 0, error: null }
    await listOrders({ page: 1 }, USER)
    expect(calls).toContainEqual(['eq', 'user_id', USER])

    calls = []
    await listOrders({ status: 'cancelled', page: 2 }, USER)
    expect(calls).toContainEqual(['eq', 'user_id', USER])
    expect(calls.some(([method]) => method === 'in')).toBe(true)
  })
})

describe('dòng sách cũ trong đơn phía khách', () => {
  /** Chuỗi select đã bỏ khoảng trắng / xuống dòng */
  const selected = () =>
    calls
      .filter(([method]) => method === 'select')
      .map(([, columns]) => String(columns).replace(/\s+/g, ''))
      .join('|')

  it('chi tiết + danh sách chỉ nhúng tình trạng của tin: không tên hiển thị, không seller_id người bán', async () => {
    result = { data: { id: 1 }, error: null }
    await getOrderByCode('NS26101600001', USER)
    result = { data: [], count: 0, error: null }
    await listOrders({ page: 1 }, USER)
    const [detail, list] = selected().split('|')
    for (const columns of [detail, list]) {
      expect(columns).toContain('used_listing_id,used_listings(condition)')
      expect(columns).not.toContain('seller_name')
      expect(columns).not.toContain('seller_id')
    }
  })
})
