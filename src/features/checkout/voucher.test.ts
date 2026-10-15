import { describe, expect, it } from 'vitest'
import { normalizeVoucherCode } from './voucher'

describe('normalizeVoucherCode', () => {
  it('bỏ khoảng trắng, viết HOA', () => {
    expect(normalizeVoucherCode('  giam10 ')).toBe('GIAM10')
    expect(normalizeVoucherCode('E2E-ADMIN_1')).toBe('E2E-ADMIN_1')
  })

  it('key lặp → giá trị đầu', () => {
    expect(normalizeVoucherCode(['freeship', 'khac'])).toBe('FREESHIP')
  })

  it('sai dạng / rỗng / không phải chuỗi → null', () => {
    expect(normalizeVoucherCode('ab')).toBeNull()
    expect(normalizeVoucherCode('GIẢM10')).toBeNull()
    expect(normalizeVoucherCode('a'.repeat(31))).toBeNull()
    expect(normalizeVoucherCode('')).toBeNull()
    expect(normalizeVoucherCode(undefined)).toBeNull()
    expect(normalizeVoucherCode(42)).toBeNull()
  })
})
