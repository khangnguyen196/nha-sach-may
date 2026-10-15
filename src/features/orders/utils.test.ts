import { describe, expect, it } from 'vitest'
import { canCancel } from './utils'

describe('canCancel', () => {
  it('chỉ đơn chờ xác nhận, chưa thanh toán', () => {
    expect(canCancel({ status: 'pending', payment_status: 'unpaid' })).toBe(true)
  })

  it('đơn đã thanh toán không tự hủy được (chưa có quy trình hoàn tiền)', () => {
    expect(canCancel({ status: 'pending', payment_status: 'paid' })).toBe(false)
  })

  it.each(['confirmed', 'shipping', 'delivered', 'cancelled'] as const)('đơn %s không hủy được', (status) => {
    expect(canCancel({ status, payment_status: 'unpaid' })).toBe(false)
  })
})
