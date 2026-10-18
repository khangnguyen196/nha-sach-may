import { describe, expect, it } from 'vitest'
import { rankVouchers, voucherCard, type CheckoutVoucherRow } from './voucher-suggestions'

function row(input: Partial<CheckoutVoucherRow>): CheckoutVoucherRow {
  return {
    code: 'MA',
    description: null,
    description_en: null,
    discount_type: 'fixed',
    discount_value: 10_000,
    max_discount: null,
    min_order_value: 0,
    ends_at: null,
    discount: 10_000,
    shortfall: 0,
    ...input,
  }
}

const text = {
  t: (key: string, values?: Record<string, string | number>) => (values ? `${key} ${JSON.stringify(values)}` : key),
  price: (value: number) => `${value}đ`,
  date: (iso: string) => iso.slice(0, 10),
  note: (r: CheckoutVoucherRow) => r.description,
}

describe('rankVouchers', () => {
  it('đủ điều kiện: còn thiếu 0 và có mức giảm; chưa đủ: còn thiếu > 0', () => {
    const [ok, missing] = rankVouchers([row({ code: 'DU' }), row({ code: 'THIEU', discount: null, shortfall: 50_000 })])
    expect(ok).toMatchObject({ code: 'DU', eligible: true, discount: 10_000 })
    expect(missing).toMatchObject({ code: 'THIEU', eligible: false, shortfall: 50_000 })
  })

  it('mã đủ điều kiện lên đầu, giảm nhiều nhất trước; mã chưa đủ: còn thiếu ít nhất trước', () => {
    const ranked = rankVouchers([
      row({ code: 'THIEU-NHIEU', discount: null, shortfall: 90_000 }),
      row({ code: 'GIAM-IT', discount: 5_000 }),
      row({ code: 'THIEU-IT', discount: null, shortfall: 10_000 }),
      row({ code: 'GIAM-NHIEU', discount: 30_000 }),
    ])
    expect(ranked.map((v) => v.code)).toEqual(['GIAM-NHIEU', 'GIAM-IT', 'THIEU-IT', 'THIEU-NHIEU'])
  })

  it('dữ liệu lạ (không có mã, đủ tối thiểu mà không có mức giảm) → không gợi ý', () => {
    expect(rankVouchers([row({ code: null }), row({ discount: null, shortfall: 0 })])).toEqual([])
  })
})

describe('voucherCard', () => {
  it('đủ điều kiện: không có lý do (bấm Áp dụng được)', () => {
    const [voucher] = rankVouchers([row({ code: 'GIAM10K' })])
    if (!voucher) throw new Error('thiếu mã')
    expect(voucherCard(voucher, text)).toEqual({
      code: 'GIAM10K',
      benefit: 'voucherFixed {"amount":"10000đ"}',
      note: null,
      condition: 'voucherNoMin',
      expires: 'voucherNoExpiry',
      reason: null,
    })
  })

  it('chưa đủ điều kiện: lý do nói rõ số tiền còn thiếu; % có trần, đơn tối thiểu, hạn dùng', () => {
    const [voucher] = rankVouchers([
      row({
        code: 'CHAOBAN10',
        description: 'Chào bạn mới',
        discount_type: 'percent',
        discount_value: 10,
        max_discount: 50_000,
        min_order_value: 150_000,
        ends_at: '2026-12-31T16:59:59+00:00',
        discount: null,
        shortfall: 50_000,
      }),
    ])
    if (!voucher) throw new Error('thiếu mã')
    expect(voucherCard(voucher, text)).toEqual({
      code: 'CHAOBAN10',
      benefit: 'voucherPercentCapped {"value":10,"max":"50000đ"}',
      note: 'Chào bạn mới',
      condition: 'voucherMinOrder {"amount":"150000đ"}',
      expires: 'voucherExpires {"date":"2026-12-31"}',
      reason: 'voucherShortfall {"amount":"50000đ"}',
    })
  })

  it('% không trần', () => {
    const [voucher] = rankVouchers([row({ discount_type: 'percent', discount_value: 5 })])
    if (!voucher) throw new Error('thiếu mã')
    expect(voucherCard(voucher, text).benefit).toBe('voucherPercent {"value":5}')
  })
})
