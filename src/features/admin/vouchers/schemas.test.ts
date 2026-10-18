import { describe, expect, it } from 'vitest'
import { invalidInput } from '@/lib/errors'
import { voucherFormSchema } from './schemas'

const valid = {
  code: '  chao-ban_10 ',
  description: ' Giảm 10% ',
  description_en: '',
  discount_type: 'percent',
  discount_value: '10',
  max_discount: '50.000',
  min_order_value: '',
  usage_limit: '',
  starts_at: '2026-10-20T08:00',
  ends_at: '',
  is_active: 'on',
}

function fieldErrors(input: Record<string, unknown>) {
  const result = voucherFormSchema.safeParse({ ...valid, ...input })
  return result.success ? {} : invalidInput(result.error).fieldErrors
}

describe('voucherFormSchema', () => {
  it('chuẩn hóa: mã viết HOA, rỗng → null / 0, giờ VN → UTC, ô chọn → boolean', () => {
    expect(voucherFormSchema.parse(valid)).toEqual({
      code: 'CHAO-BAN_10',
      description: 'Giảm 10%',
      description_en: null,
      discount_type: 'percent',
      discount_value: 10,
      max_discount: 50_000,
      min_order_value: 0,
      usage_limit: null,
      starts_at: '2026-10-20T01:00:00.000Z',
      ends_at: null,
      is_active: true,
      is_public: false,
    })
  })

  it('"Hiện trong gợi ý ở trang thanh toán": tick → is_public = true, không tick → false', () => {
    expect(voucherFormSchema.parse({ ...valid, is_public: 'on' }).is_public).toBe(true)
    expect(voucherFormSchema.parse(valid).is_public).toBe(false)
  })

  it('giảm theo số tiền: bỏ trần giảm; bỏ chọn → tắt', () => {
    const parsed = voucherFormSchema.parse({ ...valid, is_active: undefined, discount_type: 'fixed', discount_value: '20000' })
    expect(parsed).toMatchObject({ discount_type: 'fixed', discount_value: 20_000, max_discount: null, is_active: false })
  })

  it('mã sai dạng (có dấu, khoảng trắng, quá ngắn / dài)', () => {
    for (const code of ['', 'ab', 'GIẢM10', 'GIAM 10', 'A'.repeat(31)]) {
      expect(fieldErrors({ code }), code).toEqual({ code: 'voucherCode' })
    }
  })

  it('% > 100 → lỗi tại ô; số tiền thì không giới hạn 100', () => {
    expect(fieldErrors({ discount_value: '101' })).toEqual({ discount_value: 'discountPercent' })
    expect(fieldErrors({ discount_type: 'fixed', discount_value: '101' })).toEqual({})
    expect(fieldErrors({ discount_value: '0' })).toEqual({ discount_value: 'discountValue' })
  })

  it('kết thúc phải sau bắt đầu; giờ không có thật → lỗi', () => {
    expect(fieldErrors({ ends_at: '2026-10-20T08:00' })).toEqual({ ends_at: 'endsAfterStarts' })
    expect(fieldErrors({ ends_at: '2026-10-20T07:59' })).toEqual({ ends_at: 'endsAfterStarts' })
    expect(fieldErrors({ ends_at: '2026-10-20T08:01' })).toEqual({})
    expect(fieldErrors({ starts_at: '2026-02-30T08:00' })).toEqual({ starts_at: 'dateTime' })
  })

  it('loại giảm lạ, số âm / không phải số', () => {
    expect(fieldErrors({ discount_type: 'free' })).toEqual({ discount_type: 'discountType' })
    expect(fieldErrors({ min_order_value: '-1' })).toEqual({ min_order_value: 'minOrder' })
    expect(fieldErrors({ usage_limit: 'abc' })).toEqual({ usage_limit: 'positiveInt' })
  })
})
