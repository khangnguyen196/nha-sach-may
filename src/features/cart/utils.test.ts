import { describe, expect, it } from 'vitest'
import { freeShipStatus } from './utils'

describe('freeShipStatus', () => {
  it('còn thiếu', () => {
    expect(freeShipStatus({ subtotal: 255_000, free_ship_from: 300_000 })).toEqual({
      reached: false,
      remaining: 45_000,
      progress: 0.85,
    })
  })

  it('giỏ rỗng', () => {
    expect(freeShipStatus({ subtotal: 0, free_ship_from: 300_000 })).toEqual({ reached: false, remaining: 300_000, progress: 0 })
  })

  it('đúng mốc và vượt mốc → đã đủ', () => {
    expect(freeShipStatus({ subtotal: 300_000, free_ship_from: 300_000 })).toEqual({ reached: true, remaining: 0, progress: 1 })
    expect(freeShipStatus({ subtotal: 420_000, free_ship_from: 300_000 })).toEqual({ reached: true, remaining: 0, progress: 1 })
  })

  it('mốc 0 (luôn miễn phí) → đã đủ', () => {
    expect(freeShipStatus({ subtotal: 0, free_ship_from: 0 })).toEqual({ reached: true, remaining: 0, progress: 1 })
  })
})
