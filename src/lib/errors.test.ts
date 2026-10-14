import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import vi from '../../messages/vi.json'
import { ERROR_CODES, toFailure } from './errors'

describe('toFailure', () => {
  it('nhận mã lỗi và parse detail JSON', () => {
    expect(
      toFailure({ message: 'OUT_OF_STOCK', details: '{"book_id": 3, "title": "Dế Mèn", "stock": 2}' }),
    ).toEqual({ ok: false, code: 'OUT_OF_STOCK', details: { book_id: 3, title: 'Dế Mèn', stock: 2 } })
  })

  it('lỗi lạ → UNKNOWN, không lộ chi tiết', () => {
    expect(toFailure({ message: 'duplicate key value violates unique constraint', details: 'Key (id)=(1)' })).toEqual({
      ok: false,
      code: 'UNKNOWN',
    })
  })

  it('detail không phải JSON object → bỏ qua', () => {
    expect(toFailure({ message: 'CART_EMPTY', details: 'not json' })).toEqual({ ok: false, code: 'CART_EMPTY' })
    expect(toFailure({ message: 'CART_EMPTY', details: '[1, 2]' })).toEqual({ ok: false, code: 'CART_EMPTY' })
  })
})

describe('ERROR_CODES', () => {
  it('mỗi mã có bản dịch ở cả hai ngôn ngữ, không thừa không thiếu', () => {
    const codes = [...ERROR_CODES].sort()
    expect(Object.keys(vi.errors).sort()).toEqual(codes)
    expect(Object.keys(en.errors).sort()).toEqual(codes)
  })
})
