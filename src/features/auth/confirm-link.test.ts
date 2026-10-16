import { describe, expect, it } from 'vitest'
import { authCallbackUrl, parseConfirmLink } from './confirm-link'

const parse = (query: string) => parseConfirmLink(new URLSearchParams(query))
const CODE = '0b6f1c1e-6a59-4f7e-9d43-3f7f2b8f2a10'

describe('parseConfirmLink', () => {
  it('?code= (template mặc định, PKCE) → đổi code; giữ next, locale, loại link', () => {
    expect(parse(`code=${CODE}&locale=en&type=recovery&next=%2Fen%2Freset-password`)).toEqual({
      kind: 'code',
      code: CODE,
      recovery: true,
      next: '/en/reset-password',
      locale: 'en',
    })
    expect(parse(`code=${CODE}&type=signup`)).toMatchObject({ kind: 'code', recovery: false, next: null, locale: 'vi' })
  })

  it('code sai dạng → lỗi (không gửi chuỗi tùy ý cho Supabase)', () => {
    expect(parse('code=%3Cscript%3E&type=recovery')).toEqual({ kind: 'error', recovery: true, locale: 'vi' })
  })

  it('Supabase báo lỗi (link hết hạn / đã dùng) → lỗi theo loại link', () => {
    expect(parse('error=access_denied&error_code=otp_expired&type=recovery&locale=en')).toEqual({
      kind: 'error',
      recovery: true,
      locale: 'en',
    })
  })

  it('?token_hash= (template riêng) → trang trung gian, chỉ giữ token_hash, type, next', () => {
    expect(parse('token_hash=abc12345&type=email&locale=en&next=%2Fen%2Faccount&x=1')).toEqual({
      kind: 'token',
      query: { token_hash: 'abc12345', type: 'email', next: '/en/account' },
      locale: 'en',
    })
  })
})

describe('authCallbackUrl', () => {
  it('trỏ route confirm kèm locale, loại link, trang đích theo locale', () => {
    expect(authCallbackUrl('https://example.com', 'vi', 'recovery')).toBe(
      'https://example.com/api/auth/confirm?locale=vi&type=recovery&next=%2Fdat-lai-mat-khau',
    )
    expect(authCallbackUrl('http://localhost:3000', 'en', 'signup')).toBe(
      'http://localhost:3000/api/auth/confirm?locale=en&type=signup&next=%2Fen%2Faccount',
    )
  })
})
