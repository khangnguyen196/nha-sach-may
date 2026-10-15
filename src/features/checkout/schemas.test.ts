import { describe, expect, it } from 'vitest'
import { invalidInput } from '@/lib/errors'
import { checkoutSchema, NOTE_MAX } from './schemas'

const KEY = '0b6f1c1e-6a59-4f7e-9d43-3f7f2b8f2a10'
const valid = { address_id: '12', note: '  Giao giờ hành chính  ', idempotency_key: KEY, expected_total: '128000' }

function fieldErrors(input: Record<string, unknown>) {
  const result = checkoutSchema.safeParse(input)
  return result.success ? {} : invalidInput(result.error).fieldErrors
}

describe('checkoutSchema', () => {
  it('ép kiểu số, cắt khoảng trắng ghi chú', () => {
    expect(checkoutSchema.parse(valid)).toEqual({
      address_id: 12,
      note: 'Giao giờ hành chính',
      idempotency_key: KEY,
      expected_total: 128000,
      payment_method: 'cod',
      voucher_code: null,
    })
  })

  it('phương thức thanh toán: COD mặc định, chuyển khoản, giá trị lạ → lỗi', () => {
    expect(checkoutSchema.parse({ ...valid, payment_method: 'bank_transfer' }).payment_method).toBe('bank_transfer')
    expect(checkoutSchema.safeParse({ ...valid, payment_method: 'momo' }).success).toBe(false)
  })

  it('mã voucher: viết HOA; rỗng → null; sai dạng → lỗi', () => {
    expect(checkoutSchema.parse({ ...valid, voucher_code: ' giam10 ' }).voucher_code).toBe('GIAM10')
    expect(checkoutSchema.parse({ ...valid, voucher_code: '' }).voucher_code).toBeNull()
    expect(fieldErrors({ ...valid, voucher_code: 'GIẢM' })).toEqual({ voucher_code: 'invalid' })
  })

  it.each([[''], ['   '], [undefined]])('ghi chú rỗng (%j) → null', (note) => {
    expect(checkoutSchema.parse({ ...valid, note }).note).toBeNull()
  })

  it(`ghi chú tối đa ${NOTE_MAX} ký tự`, () => {
    expect(checkoutSchema.parse({ ...valid, note: 'a'.repeat(NOTE_MAX) }).note).toHaveLength(NOTE_MAX)
    expect(fieldErrors({ ...valid, note: 'a'.repeat(NOTE_MAX + 1) })).toEqual({ note: 'note' })
  })

  it('xuống dòng CRLF (trình duyệt gửi) đếm như LF', () => {
    const lines = Array.from({ length: 100 }, () => 'abcd').join('\r\n')
    const parsed = checkoutSchema.parse({ ...valid, note: lines })
    expect(parsed.note).toHaveLength(499)
    expect(parsed.note).not.toContain('\r')
  })

  it.each([[undefined], [''], ['0'], ['-1'], ['1.5'], ['abc']])('address_id không hợp lệ (%j)', (address_id) => {
    expect(fieldErrors({ ...valid, address_id })).toEqual({ address_id: 'address' })
  })

  it.each([[undefined], [''], ['not-a-uuid']])('idempotency_key không phải uuid (%j)', (idempotency_key) => {
    expect(checkoutSchema.safeParse({ ...valid, idempotency_key }).success).toBe(false)
  })

  it.each([['-1'], ['1.5'], ['abc']])('expected_total không hợp lệ (%j)', (expected_total) => {
    expect(checkoutSchema.safeParse({ ...valid, expected_total }).success).toBe(false)
  })
})
