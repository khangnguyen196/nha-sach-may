import { describe, expect, it } from 'vitest'
import { saleStatus, saleStatusWithPaidAt, saleTotals } from './sales'

describe('saleStatus (khối "Đã bán" ở Sách tôi bán)', () => {
  it.each(['pending', 'confirmed', 'shipping'] as const)('đơn %s → đang giao (kể cả đã thanh toán trước)', (orderStatus) => {
    expect(saleStatus({ orderStatus, paymentStatus: 'unpaid', payoutStatus: null })).toBe('shipping')
    expect(saleStatus({ orderStatus, paymentStatus: 'paid', payoutStatus: null })).toBe('shipping')
  })

  it('đã giao, chưa thanh toán (VietQR chưa đối soát) → chờ người mua thanh toán', () => {
    expect(saleStatus({ orderStatus: 'delivered', paymentStatus: 'unpaid', payoutStatus: null })).toBe('awaitingPayment')
  })

  it('đã giao + đã thanh toán: khoản chờ trả / đã trả', () => {
    expect(saleStatus({ orderStatus: 'delivered', paymentStatus: 'paid', payoutStatus: 'pending' })).toBe('payoutPending')
    expect(saleStatus({ orderStatus: 'delivered', paymentStatus: 'paid', payoutStatus: 'paid' })).toBe('payoutPaid')
    // Chưa có dòng khoản trả (không xảy ra: trigger ghi cùng lúc) → vẫn là tiền chờ trả
    expect(saleStatus({ orderStatus: 'delivered', paymentStatus: 'paid', payoutStatus: null })).toBe('payoutPending')
  })
})

describe('saleStatusWithPaidAt (ngày trả chỉ khi "Đã trả")', () => {
  const delivered = { orderStatus: 'delivered', paymentStatus: 'paid' } as const
  const paidAt = '2026-10-24T08:00:00Z'

  it('khoản đã trả → giữ ngày trả', () => {
    expect(saleStatusWithPaidAt({ ...delivered, payoutStatus: 'paid', paidAt })).toEqual({ status: 'payoutPaid', paidAt })
  })

  it('khoản còn chờ trả nhưng lần đọc seller_payouts đã thấy ngày trả (admin đánh dấu xen giữa) → không có ngày', () => {
    expect(saleStatusWithPaidAt({ ...delivered, payoutStatus: 'pending', paidAt })).toEqual({
      status: 'payoutPending',
      paidAt: null,
    })
  })

  it('đơn đang giao / chờ người mua thanh toán → không có ngày', () => {
    expect(saleStatusWithPaidAt({ orderStatus: 'shipping', paymentStatus: 'paid', payoutStatus: 'paid', paidAt })).toEqual({
      status: 'shipping',
      paidAt: null,
    })
    expect(saleStatusWithPaidAt({ orderStatus: 'delivered', paymentStatus: 'unpaid', payoutStatus: null, paidAt })).toEqual({
      status: 'awaitingPayment',
      paidAt: null,
    })
  })

  it('đã trả nhưng chưa đọc được ngày → null', () => {
    expect(saleStatusWithPaidAt({ ...delivered, payoutStatus: 'paid', paidAt: null })).toEqual({
      status: 'payoutPaid',
      paidAt: null,
    })
  })
})

describe('saleTotals', () => {
  it('chỉ cộng khoản chờ trả / đã trả', () => {
    expect(
      saleTotals([
        { status: 'shipping', amount: 10_000 },
        { status: 'awaitingPayment', amount: 20_000 },
        { status: 'payoutPending', amount: 36_000 },
        { status: 'payoutPending', amount: 45_000 },
        { status: 'payoutPaid', amount: 27_000 },
      ]),
    ).toEqual({ pending: 81_000, paid: 27_000 })
    expect(saleTotals([])).toEqual({ pending: 0, paid: 0 })
  })
})
