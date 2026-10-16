import type { Locale } from 'next-intl'
import { localizedPath } from '@/i18n/paths'
import { toOtpType, toTokenHash } from './otp'
import { parseLocale } from './schemas'

/**
 * Link trong email auth tới `/api/auth/confirm` có hai dạng, tùy template email của Supabase:
 * - Template riêng (`supabase/templates/*.html`, cần custom SMTP): `?token_hash=…&type=…` → trang trung gian có nút
 *   "Xác nhận" (POST mới gọi verifyOtp, trình quét link không dùng mất token).
 * - Template mặc định (`{{ .ConfirmationURL }}`): Supabase tự xác thực ở /auth/v1/verify rồi chuyển về `redirectTo` mà
 *   app gửi lúc signUp / resetPasswordForEmail, kèm `?code=` (PKCE) → đổi code lấy phiên ngay ở GET. Link hỏng / hết
 *   hạn thì Supabase chuyển về kèm `?error=…&error_code=…`.
 */
export type ConfirmLink =
  | { kind: 'code'; code: string; recovery: boolean; next: string | null; locale: Locale }
  | { kind: 'token'; query: Record<string, string>; locale: Locale }
  | { kind: 'error'; recovery: boolean; locale: Locale }

export function parseConfirmLink(params: URLSearchParams): ConfirmLink {
  const locale = parseLocale(params.get('locale'))
  const recovery = toOtpType(params.get('type')) === 'recovery'
  const code = params.get('code')
  if (code !== null) {
    // Mã PKCE của Supabase là UUID; cùng kiểm tra độ dài / ký tự như token_hash để không đưa chuỗi tùy ý vào Supabase
    const valid = toTokenHash(code)
    return valid ? { kind: 'code', code: valid, recovery, next: params.get('next'), locale } : { kind: 'error', recovery, locale }
  }
  if (!params.has('token_hash') && (params.has('error') || params.has('error_code'))) {
    return { kind: 'error', recovery, locale }
  }
  const query: Record<string, string> = {}
  for (const key of ['token_hash', 'type', 'next']) {
    const value = params.get(key)
    if (value) query[key] = value
  }
  return { kind: 'token', query, locale }
}

export type ConfirmPurpose = 'signup' | 'recovery'

/**
 * `redirectTo` / `emailRedirectTo` gửi cho Supabase: link trong email (template mặc định) quay về route confirm với
 * locale lúc yêu cầu, loại link và trang đích (xác nhận đăng ký → tài khoản, đặt lại mật khẩu → trang đặt mật khẩu mới).
 * Supabase chỉ nhận URL nằm trong Redirect URLs của project (docs/plans/owner-todo.md), không thì về Site URL.
 */
export function authCallbackUrl(origin: string, locale: Locale, purpose: ConfirmPurpose) {
  const next = localizedPath(purpose === 'recovery' ? '/reset-password' : '/account', locale)
  return `${origin}/api/auth/confirm?${new URLSearchParams({ locale, type: purpose, next })}`
}
