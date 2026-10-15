import { describe, expect, it } from 'vitest'
import { awaitingTransfer, canCancel } from './utils'

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

describe('awaitingTransfer', () => {
  const order = { status: 'pending', payment_method: 'bank_transfer', payment_status: 'unpaid' } as const

  it('chuyển khoản chưa trả, chưa hủy → hiện VietQR (kể cả khi cửa hàng đã xác nhận)', () => {
    expect(awaitingTransfer(order)).toBe(true)
    expect(awaitingTransfer({ ...order, status: 'confirmed' })).toBe(true)
  })

  it('COD, đã trả, đã hủy → không', () => {
    expect(awaitingTransfer({ ...order, payment_method: 'cod' })).toBe(false)
    expect(awaitingTransfer({ ...order, payment_status: 'paid' })).toBe(false)
    expect(awaitingTransfer({ ...order, status: 'cancelled' })).toBe(false)
  })
})
