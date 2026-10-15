import { describe, expect, it } from 'vitest'
import { invalidInput } from '@/lib/errors'
import { authErrorCode } from './errors'
import { safeNextPath } from './next-path'
import { signInSchema, signUpSchema } from './schemas'

function fieldErrors(result: ReturnType<typeof signUpSchema.safeParse>) {
  return result.success ? {} : invalidInput(result.error).fieldErrors
}

describe('signUpSchema', () => {
  it('chuẩn hóa email: bỏ khoảng trắng, chữ thường', () => {
    const result = signUpSchema.parse({ email: '  An.Nguyen@Example.COM ', password: '12345678', full_name: ' An ' })
    expect(result).toEqual({ email: 'an.nguyen@example.com', password: '12345678', full_name: 'An' })
  })

  it('mật khẩu ngắn, email sai, thiếu tên → lỗi từng ô bằng khóa validation', () => {
    expect(fieldErrors(signUpSchema.safeParse({ email: 'khong-phai-email', password: '1234567', full_name: '  ' }))).toEqual({
      email: 'email',
      password: 'passwordMin',
      full_name: 'fullName',
    })
  })

  it('ô trống / thiếu ô → required', () => {
    expect(fieldErrors(signUpSchema.safeParse({ email: '   ' }))).toEqual({
      email: 'required',
      password: 'required',
      full_name: 'required',
    })
  })

  it('mật khẩu quá 72 ký tự', () => {
    const result = signUpSchema.safeParse({ email: 'a@b.vn', password: 'x'.repeat(73), full_name: 'An' })
    expect(fieldErrors(result)).toEqual({ password: 'passwordMax' })
  })
})

describe('signInSchema', () => {
  it('không áp độ dài mật khẩu khi đăng nhập', () => {
    expect(signInSchema.safeParse({ email: 'a@b.vn', password: '123' }).success).toBe(true)
    expect(signInSchema.safeParse({ email: 'a@b.vn', password: '' }).success).toBe(false)
  })
})

describe('safeNextPath', () => {
  const fallback = '/tai-khoan'

  it('nhận đường dẫn nội bộ, giữ query', () => {
    expect(safeNextPath('/tai-khoan/dia-chi', fallback)).toBe('/tai-khoan/dia-chi')
    expect(safeNextPath('/en/account?tab=1', fallback)).toBe('/en/account?tab=1')
  })

  it.each([
    ['//evil.com'],
    ['/..//evil.com'],
    ['/a/..//evil.com'],
    ['/%2e%2e//evil.com'],
    ['https://evil.com'],
    ['/\\evil.com'],
    ['\\\\evil.com'],
    ['/\t/evil.com'],
    ['/\n/evil.com'],
    ['javascript:alert(1)'],
    ['tai-khoan'],
    [''],
    [undefined],
    [42],
  ])('%j → mặc định', (value) => {
    expect(safeNextPath(value, fallback)).toBe(fallback)
  })
})

describe('authErrorCode', () => {
  it('map mã của Supabase sang mã app', () => {
    expect(authErrorCode({ code: 'invalid_credentials' })).toBe('INVALID_CREDENTIALS')
    expect(authErrorCode({ code: 'user_already_exists' })).toBe('EMAIL_TAKEN')
    expect(authErrorCode({ code: 'email_not_confirmed' })).toBe('EMAIL_NOT_CONFIRMED')
    expect(authErrorCode({ code: 'weak_password' })).toBe('WEAK_PASSWORD')
    expect(authErrorCode({ code: 'over_email_send_rate_limit' })).toBe('RATE_LIMITED')
    expect(authErrorCode({ code: 'otp_expired' })).toBe('LINK_EXPIRED')
  })

  it('mã lạ hoặc không có mã → UNKNOWN', () => {
    expect(authErrorCode({ code: 'hook_timeout' })).toBe('UNKNOWN')
    expect(authErrorCode({})).toBe('UNKNOWN')
  })
})
