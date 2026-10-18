import { describe, expect, it } from 'vitest'
import { isBlockedCountry } from './region'

describe('isBlockedCountry', () => {
  it.each(['DE', 'FR', 'IE', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH'])('%s bị chặn', (code) => {
    expect(isBlockedCountry(code)).toBe(true)
  })

  it.each(['VN', 'US', 'JP', 'SG'])('%s qua', (code) => {
    expect(isBlockedCountry(code)).toBe(false)
  })

  it('không có header (chạy local) → qua; mã viết thường / có khoảng trắng → chuẩn hóa', () => {
    expect(isBlockedCountry(null)).toBe(false)
    expect(isBlockedCountry(undefined)).toBe(false)
    expect(isBlockedCountry('')).toBe(false)
    expect(isBlockedCountry(' de ')).toBe(true)
  })
})
