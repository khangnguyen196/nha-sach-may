import type { ErrorCode, Failure, ValidationKey } from '@/lib/errors'

type AuthErrorLike = { code?: string; name?: string; status?: number; message?: string }

// AuthError.code của Supabase → mã lỗi của app (có bản dịch ở messages/*.json → errors). Lỗi gắn với một ô (email,
// mật khẩu) kèm khóa validation để form hiện ngay dưới ô đó.
const AUTH_ERRORS: Partial<Record<string, { code: ErrorCode; field?: [name: string, key: ValidationKey] }>> = {
  invalid_credentials: { code: 'INVALID_CREDENTIALS' },
  email_not_confirmed: { code: 'EMAIL_NOT_CONFIRMED' },
  weak_password: { code: 'WEAK_PASSWORD', field: ['password', 'passwordWeak'] },
  same_password: { code: 'SAME_PASSWORD', field: ['password', 'passwordSame'] },
  validation_failed: { code: 'INVALID_INPUT' },
  signup_disabled: { code: 'SIGNUP_DISABLED' },
  email_provider_disabled: { code: 'SIGNUP_DISABLED' },
  user_banned: { code: 'ACCOUNT_LOCKED' },
  over_email_send_rate_limit: { code: 'RATE_LIMITED' },
  over_request_rate_limit: { code: 'RATE_LIMITED' },
  over_sms_send_rate_limit: { code: 'RATE_LIMITED' },
  otp_expired: { code: 'LINK_EXPIRED' },
  request_timeout: { code: 'NETWORK_ERROR' },
}

/**
 * Đăng ký: chỉ các mã GoTrue kiểm TRƯỚC khi tìm user được báo ra form (supabase/auth internal/api/signup.go, `Signup`:
 * DisableSignup → validateSignupParams (checkPasswordStrength) → email provider → validateEmail, rồi mới
 * IsDuplicatedEmail). Mọi mã sau bước tìm user (gửi thư, tần suất, user đã có…) có thể khác nhau giữa email có / không
 * có tài khoản → actions.ts coi như "đã gửi". Mã lạ mặc định "đã gửi".
 */
export const PRE_LOOKUP_SIGNUP_CODES: ReadonlySet<string> = new Set([
  'weak_password',
  'validation_failed',
  'signup_disabled',
  'email_provider_disabled',
])

// Phiên không còn dùng được (hết hạn, đã thu hồi, link PKCE mở ở trình duyệt khác…)
const SESSION_GONE = new Set([
  'session_not_found',
  'session_expired',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'reauthentication_needed',
  'flow_state_expired',
  'flow_state_not_found',
  'bad_code_verifier',
])

/**
 * Không gọi được Supabase Auth: supabase-js ném AuthRetryableFetchError khi fetch lỗi (status 0) và khi GoTrue trả
 * 500–504 hoặc 520–530 (auth-js lib/fetch.ts, NETWORK_ERROR_CODES; response này mất `code`); các 5xx khác là lỗi phía
 * máy chủ → cùng báo "không kết nối được máy chủ". Vì 504 mất `code`, mã `request_timeout` ở bảng trên gần như không tới.
 * Quên mật khẩu / gửi lại xác nhận / đăng ký KHÔNG dùng hàm này (unreachableOnly trong actions.ts: chỉ status 0).
 */
export function isAuthUnreachable(error: { name?: string; status?: number }) {
  return error.name === 'AuthRetryableFetchError' || error.status === 0 || (error.status ?? 0) >= 500
}

/** GoTrue báo thời gian chờ trong câu tiếng Anh: "…you can only request this after 52 seconds." */
export function retryAfterSeconds(message: string | undefined): number | null {
  const match = message ? /after (\d+) seconds?/i.exec(message) : null
  return match ? Number(match[1]) : null
}

/**
 * Lỗi của Supabase Auth → Failure của app. `recovery`: đang đặt lại mật khẩu bằng phiên khôi phục → phiên mất thì báo
 * link hết hạn (xin link mới) thay vì "đăng nhập lại".
 */
export function authFailure(error: AuthErrorLike, { recovery = false }: { recovery?: boolean } = {}): Failure {
  const known = error.code ? AUTH_ERRORS[error.code] : undefined
  if (known?.code === 'RATE_LIMITED') {
    const seconds = retryAfterSeconds(error.message)
    return seconds === null ? { ok: false, code: 'RATE_LIMITED' } : { ok: false, code: 'RATE_LIMITED', details: { seconds } }
  }
  if (known?.field) {
    const [name, key] = known.field
    return { ok: false, code: known.code, fieldErrors: { [name]: key } }
  }
  if (known) return { ok: false, code: known.code }
  if (error.code && SESSION_GONE.has(error.code)) return { ok: false, code: recovery ? 'LINK_EXPIRED' : 'SESSION_EXPIRED' }
  return { ok: false, code: isAuthUnreachable(error) ? 'NETWORK_ERROR' : 'UNKNOWN' }
}

export function authErrorCode(error: AuthErrorLike): ErrorCode {
  return authFailure(error).code
}
