import type { ErrorCode } from '@/lib/errors'

// AuthError.code của Supabase → mã lỗi của app (có bản dịch ở messages/*.json → errors)
const AUTH_ERROR_CODES: Partial<Record<string, ErrorCode>> = {
  invalid_credentials: 'INVALID_CREDENTIALS',
  user_already_exists: 'EMAIL_TAKEN',
  email_exists: 'EMAIL_TAKEN',
  email_not_confirmed: 'EMAIL_NOT_CONFIRMED',
  weak_password: 'WEAK_PASSWORD',
  same_password: 'SAME_PASSWORD',
  over_email_send_rate_limit: 'RATE_LIMITED',
  over_request_rate_limit: 'RATE_LIMITED',
  otp_expired: 'LINK_EXPIRED',
  email_address_invalid: 'INVALID_INPUT',
}

export function authErrorCode(error: { code?: string }): ErrorCode {
  return (error.code && AUTH_ERROR_CODES[error.code]) || 'UNKNOWN'
}
