import { describe, expect, it } from 'vitest'
import { toOtpType, toTokenHash } from './otp'

describe('toOtpType', () => {
  it('chỉ nhận loại link app xử lý', () => {
    expect(toOtpType('recovery')).toBe('recovery')
    expect(toOtpType('email')).toBe('email')
    expect(toOtpType('magiclink')).toBeUndefined()
    expect(toOtpType(null)).toBeUndefined()
  })
})

describe('toTokenHash', () => {
  it('hex / base64url hợp lệ; chuỗi lạ, quá ngắn / dài → undefined', () => {
    expect(toTokenHash('pkce_0a1b2c3d4e5f')).toBe('pkce_0a1b2c3d4e5f')
    expect(toTokenHash('abc')).toBeUndefined()
    expect(toTokenHash('<script>alert(1)</script>')).toBeUndefined()
    expect(toTokenHash('a'.repeat(201))).toBeUndefined()
    expect(toTokenHash(undefined)).toBeUndefined()
  })
})
