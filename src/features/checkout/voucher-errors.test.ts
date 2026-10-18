import { describe, expect, it } from 'vitest'
import { minOrderShortfall, VOUCHER_ERRORS } from './voucher-errors'

describe('minOrderShortfall', () => {
  it('DB trước migration B (chỉ có min_order_value) → tự tính từ tạm tính', () => {
    expect(minOrderShortfall({ min_order_value: 150_000 }, 100_000)).toEqual({ shortfall: 50_000, min_order_value: 150_000 })
  })

  it('migration B gửi shortfall → dùng số của DB', () => {
    expect(minOrderShortfall({ min_order_value: 150_000, shortfall: 30_000 }, 100_000)).toEqual({
      shortfall: 30_000,
      min_order_value: 150_000,
    })
  })

  it('tạm tính đã đủ (giỏ vừa đổi) → còn thiếu 0, không âm', () => {
    expect(minOrderShortfall({ min_order_value: 150_000 }, 200_000)).toEqual({ shortfall: 0, min_order_value: 150_000 })
  })

  it('thiếu min_order_value → null (dùng câu errors.VOUCHER_MIN_ORDER)', () => {
    expect(minOrderShortfall(undefined, 100_000)).toBeNull()
    expect(minOrderShortfall({ min_order_value: '150000' }, 100_000)).toBeNull()
  })
})

describe('VOUCHER_ERRORS', () => {
  it('có cả mã cũ (trước migration B) lẫn mã mới', () => {
    for (const code of ['INVALID_VOUCHER', 'VOUCHER_MIN_ORDER', 'VOUCHER_NOT_FOUND', 'VOUCHER_EXPIRED'] as const) {
      expect(VOUCHER_ERRORS.has(code)).toBe(true)
    }
  })
})
