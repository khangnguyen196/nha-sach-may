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

/**
 * Không gọi được Supabase Auth: supabase-js ném AuthRetryableFetchError (fetch lỗi → status 0; 502 / 503 / 504), các
 * lỗi 5xx khác là lỗi phía máy chủ → cùng báo "không kết nối được máy chủ".
 */
function isAuthUnreachable(error: { name?: string; status?: number }) {
  return error.name === 'AuthRetryableFetchError' || error.status === 0 || (error.status ?? 0) >= 500
}

export function authErrorCode(error: { code?: string; name?: string; status?: number }): ErrorCode {
  const mapped = error.code ? AUTH_ERROR_CODES[error.code] : undefined
  if (mapped) return mapped
  return isAuthUnreachable(error) ? 'NETWORK_ERROR' : 'UNKNOWN'
}
