import { describe, expect, it } from 'vitest'
import { payoutListHref, payoutListParamsSchema } from './params'
import { payoutIdSchema } from './schemas'

describe('payoutIdSchema (id khoản trả bind vào markPayoutPaid)', () => {
  it('nhận số nguyên dương an toàn', () => {
    expect(payoutIdSchema.parse(1)).toBe(1)
    expect(payoutIdSchema.parse(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER)
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY, '12', null, undefined])(
    'từ chối %j',
    (value) => {
      expect(payoutIdSchema.safeParse(value).success).toBe(false)
    },
  )
})

describe('payoutListParamsSchema (?trang-thai=, ?page=)', () => {
  it('cho-tra / da-tra → pending / paid; không có → tất cả', () => {
    expect(payoutListParamsSchema.parse({ 'trang-thai': 'cho-tra' })).toEqual({ status: 'pending', page: undefined })
    expect(payoutListParamsSchema.parse({ 'trang-thai': 'da-tra', page: '2' })).toEqual({ status: 'paid', page: 2 })
    expect(payoutListParamsSchema.parse({})).toEqual({ status: undefined, page: undefined })
  })

  it('giá trị lạ → bỏ qua, khóa lặp → lấy giá trị đầu', () => {
    expect(payoutListParamsSchema.parse({ 'trang-thai': 'pending', page: '0' })).toEqual({
      status: undefined,
      page: undefined,
    })
    expect(payoutListParamsSchema.parse({ 'trang-thai': ['da-tra', 'cho-tra'] })).toEqual({
      status: 'paid',
      page: undefined,
    })
  })
})

describe('payoutListHref', () => {
  it('giữ bộ lọc; đổi bộ lọc về trang 1, trang 1 không ghi vào URL', () => {
    const params = { status: 'pending', page: 3 } as const
    expect(payoutListHref(params)).toBe('/admin/tra-nguoi-ban?trang-thai=cho-tra&page=3')
    expect(payoutListHref(params, { status: 'paid', page: undefined })).toBe('/admin/tra-nguoi-ban?trang-thai=da-tra')
    expect(payoutListHref(params, { status: undefined, page: 1 })).toBe('/admin/tra-nguoi-ban')
  })
})
