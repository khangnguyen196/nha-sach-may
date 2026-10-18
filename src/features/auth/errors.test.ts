import { describe, expect, it } from 'vitest'
import { authFailure, retryAfterSeconds } from './errors'

describe('authFailure', () => {
  it('lỗi gắn với một ô → hiện dưới ô đó (không còn "Dữ liệu không hợp lệ." chung chung)', () => {
    expect(authFailure({ code: 'email_address_invalid', status: 400 })).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
      fieldErrors: { email: 'emailRejected' },
    })
    expect(authFailure({ code: 'email_address_not_authorized', status: 400 }).fieldErrors).toEqual({ email: 'emailRejected' })
    expect(authFailure({ code: 'weak_password', status: 422 })).toEqual({
      ok: false,
      code: 'WEAK_PASSWORD',
      fieldErrors: { password: 'passwordWeak' },
    })
    expect(authFailure({ code: 'same_password', status: 422 }).fieldErrors).toEqual({ password: 'passwordSame' })
  })

  it('sai email / mật khẩu: báo chung ở đầu form, không chỉ ra ô nào (tránh dò email)', () => {
    expect(authFailure({ code: 'invalid_credentials', status: 400 })).toEqual({ ok: false, code: 'INVALID_CREDENTIALS' })
  })

  it('mã trước đây rơi vào UNKNOWN giờ có mã riêng', () => {
    expect(authFailure({ code: 'signup_disabled', status: 422 }).code).toBe('SIGNUP_DISABLED')
    expect(authFailure({ code: 'email_provider_disabled', status: 422 }).code).toBe('SIGNUP_DISABLED')
    expect(authFailure({ code: 'user_banned', status: 400 }).code).toBe('ACCOUNT_LOCKED')
    expect(authFailure({ code: 'validation_failed', status: 400 }).code).toBe('INVALID_INPUT')
    expect(authFailure({ code: 'request_timeout', status: 504 }).code).toBe('NETWORK_ERROR')
  })

  it('phiên mất giữa chừng: đặt lại mật khẩu → xin link mới; chỗ khác → đăng nhập lại', () => {
    for (const code of ['session_not_found', 'session_expired', 'reauthentication_needed', 'flow_state_expired']) {
      expect(authFailure({ code, status: 403 }, { recovery: true }).code, code).toBe('LINK_EXPIRED')
      expect(authFailure({ code, status: 403 }).code, code).toBe('SESSION_EXPIRED')
    }
  })

  it('giới hạn tần suất: kèm số giây chờ khi GoTrue báo', () => {
    expect(
      authFailure({
        code: 'over_email_send_rate_limit',
        status: 429,
        message: 'For security purposes, you can only request this after 52 seconds.',
      }),
    ).toEqual({ ok: false, code: 'RATE_LIMITED', details: { seconds: 52 } })
    expect(authFailure({ code: 'over_request_rate_limit', status: 429, message: 'Request rate limit reached' })).toEqual({
      ok: false,
      code: 'RATE_LIMITED',
    })
  })

  it('lỗi phía máy chủ / mã lạ', () => {
    expect(authFailure({ name: 'AuthRetryableFetchError', status: 0 }).code).toBe('NETWORK_ERROR')
    expect(authFailure({ code: 'hook_timeout', status: 422 }).code).toBe('UNKNOWN')
  })
})

describe('retryAfterSeconds', () => {
  it('đọc số giây trong câu của GoTrue, không có thì null', () => {
    expect(retryAfterSeconds('For security purposes, you can only request this after 1 second.')).toBe(1)
    expect(retryAfterSeconds('…after 59 seconds')).toBe(59)
    expect(retryAfterSeconds('Email rate limit exceeded')).toBeNull()
    expect(retryAfterSeconds(undefined)).toBeNull()
  })
})
