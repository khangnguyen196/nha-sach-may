import { describe, expect, it } from 'vitest'
import { orderListQuery, parseOrderListParams } from './params'

describe('parseOrderListParams', () => {
  it('mặc định: tất cả, trang 1', () => {
    expect(parseOrderListParams({})).toEqual({ status: undefined, page: 1 })
  })

  it.each(['pending', 'processing', 'delivered', 'cancelled'] as const)('nhận bộ lọc %s', (status) => {
    expect(parseOrderListParams({ status, page: '3' })).toEqual({ status, page: 3 })
  })

  it.each([['confirmed'], ['shipping'], ['PENDING'], ['']])('bộ lọc lạ (%j) → bỏ qua', (status) => {
    expect(parseOrderListParams({ status }).status).toBeUndefined()
  })

  it.each([['0'], ['-1'], ['1.5'], ['abc'], ['10001'], ['']])('trang không hợp lệ (%j) → 1', (page) => {
    expect(parseOrderListParams({ page }).page).toBe(1)
  })

  it('key lặp → lấy giá trị đầu', () => {
    expect(parseOrderListParams({ status: ['cancelled', 'pending'], page: ['2', '5'] })).toEqual({
      status: 'cancelled',
      page: 2,
    })
  })
})

describe('orderListQuery', () => {
  it('bỏ giá trị mặc định', () => {
    expect(orderListQuery({ page: 1 })).toEqual({})
    expect(orderListQuery({ status: 'delivered', page: 1 })).toEqual({ status: 'delivered' })
    expect(orderListQuery({ status: 'cancelled', page: 2 })).toEqual({ status: 'cancelled', page: '2' })
  })

  it('đi vòng qua parse không đổi', () => {
    const params = { status: 'processing', page: 4 } as const
    expect(parseOrderListParams(orderListQuery(params))).toEqual(params)
  })
})
