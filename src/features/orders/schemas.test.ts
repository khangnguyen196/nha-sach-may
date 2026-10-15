import { describe, expect, it } from 'vitest'
import { invalidInput } from '@/lib/errors'
import { cancelOrderSchema, orderIdSchema, REASON_MAX } from './schemas'

function fieldErrors(input: Record<string, unknown>) {
  const result = cancelOrderSchema.safeParse(input)
  return result.success ? {} : invalidInput(result.error).fieldErrors
}

describe('cancelOrderSchema', () => {
  it('cắt khoảng trắng lý do', () => {
    expect(cancelOrderSchema.parse({ reason: '  Đặt nhầm sách  ' })).toEqual({ reason: 'Đặt nhầm sách' })
  })

  it.each([[''], ['   '], [undefined]])('lý do rỗng (%j) → null', (reason) => {
    expect(cancelOrderSchema.parse({ reason }).reason).toBeNull()
  })

  it(`lý do tối đa ${REASON_MAX} ký tự`, () => {
    expect(cancelOrderSchema.parse({ reason: 'a'.repeat(REASON_MAX) }).reason).toHaveLength(REASON_MAX)
    expect(fieldErrors({ reason: 'a'.repeat(REASON_MAX + 1) })).toEqual({ reason: 'reason' })
  })

  it('xuống dòng CRLF (trình duyệt gửi) đếm như LF', () => {
    const lines = Array.from({ length: 100 }, () => 'abcd').join('\r\n')
    const parsed = cancelOrderSchema.parse({ reason: lines })
    expect(parsed.reason).toHaveLength(499)
    expect(parsed.reason).not.toContain('\r')
  })
})

describe('orderIdSchema', () => {
  it.each([[0], [-1], [1.5], ['12'], [null]])('không hợp lệ (%j)', (id) => {
    expect(orderIdSchema.safeParse(id).success).toBe(false)
  })
})
