import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import vi from '../../messages/vi.json'
import { ADMIN_VALIDATION_KEYS, ERROR_CODES, invalidInput, toFailure, VALIDATION_KEYS } from './errors'

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

  it('postgrest-js không gọi được server (code rỗng, message "TypeError: …") → NETWORK_ERROR', () => {
    expect(toFailure({ message: 'TypeError: fetch failed', details: 'TypeError: fetch failed at …', code: '' })).toEqual({
      ok: false,
      code: 'NETWORK_ERROR',
    })
    expect(toFailure({ message: 'TimeoutError: The operation was aborted due to timeout', code: '' }).code).toBe(
      'NETWORK_ERROR',
    )
    // Lỗi của Postgres / PostgREST luôn có code → không bị coi là lỗi mạng
    expect(toFailure({ message: 'TypeError: something', code: '22P02' }).code).toBe('UNKNOWN')
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

describe('VALIDATION_KEYS', () => {
  it('mỗi khóa có bản dịch ở cả hai ngôn ngữ, không thừa không thiếu', () => {
    const keys = [...VALIDATION_KEYS].sort()
    expect(Object.keys(vi.validation).sort()).toEqual(keys)
    expect(Object.keys(en.validation).sort()).toEqual(keys)
  })
})

describe('ADMIN_VALIDATION_KEYS', () => {
  it('mỗi khóa có bản dịch ở admin.validation (chỉ tiếng Việt), không thừa không thiếu', () => {
    expect(Object.keys(vi.admin.validation).sort()).toEqual([...ADMIN_VALIDATION_KEYS].sort())
  })

  it('không trùng khóa validation dùng chung', () => {
    const shared: readonly string[] = VALIDATION_KEYS
    expect(ADMIN_VALIDATION_KEYS.filter((key) => shared.includes(key))).toEqual([])
  })
})

describe('invalidInput', () => {
  it('lấy lỗi đầu tiên của từng ô; message không phải khóa validation → invalid', () => {
    expect(
      invalidInput({
        issues: [
          { path: ['email'], message: 'required' },
          { path: ['email'], message: 'email' },
          { path: ['phone'], message: 'Invalid input: expected string' },
        ],
      }),
    ).toEqual({ ok: false, code: 'INVALID_INPUT', fieldErrors: { email: 'required', phone: 'invalid' } })
  })

  it('nhận khóa validation của admin', () => {
    expect(invalidInput({ issues: [{ path: ['price'], message: 'price' }] })).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
      fieldErrors: { price: 'price' },
    })
  })
})
