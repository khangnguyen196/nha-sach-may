import { describe, expect, it } from 'vitest'
import { invalidInput } from '@/lib/errors'
import { rejectReasonSchema, REJECT_REASON_MAX, reviewTargetSchema } from './schemas'

describe('rejectReasonSchema (lý do từ chối / gỡ tin)', () => {
  const reason = (value: unknown) => rejectReasonSchema.safeParse({ reason: value })

  it('cắt khoảng trắng hai đầu, CRLF → LF', () => {
    expect(reason('  Ảnh mờ, chụp lại bìa\r\nnhé  ').data).toEqual({ reason: 'Ảnh mờ, chụp lại bìa\nnhé' })
  })

  it('trống / chỉ khoảng trắng / thiếu → lỗi listingRejectReason ở ô reason', () => {
    for (const value of ['', '   ', '\r\n\t ', undefined]) {
      const parsed = reason(value)
      expect(parsed.success, JSON.stringify(value)).toBe(false)
      if (!parsed.success) expect(invalidInput(parsed.error).fieldErrors).toEqual({ reason: 'listingRejectReason' })
    }
  })

  it('tối đa 500 ký tự sau khi cắt: 500 qua, 501 lỗi; khoảng trắng thừa hai đầu không tính', () => {
    expect(REJECT_REASON_MAX).toBe(500)
    expect(reason('a'.repeat(500)).success).toBe(true)
    expect(reason(`  ${'a'.repeat(500)}  `).success).toBe(true)
    const tooLong = reason('a'.repeat(501))
    expect(tooLong.success).toBe(false)
    if (!tooLong.success) expect(invalidInput(tooLong.error).fieldErrors).toEqual({ reason: 'listingRejectReason' })
  })

  it('500 ký tự có xuống dòng CRLF: đếm như LF (trình duyệt gửi CRLF)', () => {
    const value = `${'a'.repeat(249)}\r\n${'b'.repeat(250)}`
    expect(reason(value).data?.reason).toHaveLength(500)
  })
})

describe('reviewTargetSchema (tin + trạng thái đang hiển thị)', () => {
  it('nhận id dương + trạng thái của enum used_listing_status', () => {
    for (const status of ['pending', 'approved', 'rejected', 'sold', 'withdrawn']) {
      expect(reviewTargetSchema.safeParse({ id: 12, expected_status: status }).success, status).toBe(true)
    }
    expect(reviewTargetSchema.safeParse({ id: '12', expected_status: 'pending' }).data).toEqual({
      id: 12,
      expected_status: 'pending',
    })
  })

  it('trạng thái lạ / thiếu, id không dương → lỗi', () => {
    for (const expected of ['PENDING', 'cancelled', '', null, undefined]) {
      expect(reviewTargetSchema.safeParse({ id: 1, expected_status: expected }).success, String(expected)).toBe(false)
    }
    for (const id of [0, -1, 1.5, 'abc', Number.MAX_SAFE_INTEGER + 2]) {
      expect(reviewTargetSchema.safeParse({ id, expected_status: 'pending' }).success, String(id)).toBe(false)
    }
  })
})
