import { describe, expect, it } from 'vitest'
import { normalizeVoucherCode, parseVoucherInput } from './voucher'

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

describe('parseVoucherInput', () => {
  it('trống / không phải chuỗi → null (không nhập mã)', () => {
    for (const value of ['', '   ', undefined, 42, null]) expect(parseVoucherInput(value), String(value)).toBeNull()
  })

  it('đúng dạng → mã viết HOA', () => {
    expect(parseVoucherInput('  giam10 ')).toEqual({ code: 'GIAM10' })
    expect(parseVoucherInput(['freeship', 'khac'])).toEqual({ code: 'FREESHIP' })
  })

  it('sai dạng → trả lại để báo lỗi dưới ô (không bỏ qua im lặng), cắt 30 ký tự', () => {
    expect(parseVoucherInput('ab')).toEqual({ invalid: 'AB' })
    expect(parseVoucherInput('giảm10')).toEqual({ invalid: 'GIẢM10' })
    expect(parseVoucherInput('a'.repeat(40))).toEqual({ invalid: 'A'.repeat(30) })
  })
})
