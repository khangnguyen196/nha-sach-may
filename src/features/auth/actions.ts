'use server'

// `next` đã là URL hiển thị (/tai-khoan/dia-chi, /en/account…) chứ không phải pathname nội bộ nên không đi qua
// redirect của next-intl được; safeNextPath đảm bảo nó là đường dẫn nội bộ.
// eslint-disable-next-line no-restricted-imports
import { redirect as redirectToPath } from 'next/navigation'
import { headers } from 'next/headers'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { getPathname, redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'
import { invalidInput, type Failure, type Result } from '@/lib/errors'
import { requestOrigin } from '@/lib/site-url'
import { createClient } from '@/lib/supabase/server'
import { authCallbackUrl, type ConfirmPurpose } from './confirm-link'
import { authFailure, PRE_LOOKUP_SIGNUP_CODES } from './errors'
import { nextFromReferer, safeNextPath } from './next-path'
import {
  parseLocale,
  passwordResetRequestSchema,
  resendConfirmationSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from './schemas'

// Server Action không đọc được next/root-params → locale do page bind sẵn (`signIn.bind(null, locale)`)
// và được parse lại (parseLocale) vì tham số bind đi qua client.

/** Link trong email theo template mặc định của Supabase quay về /api/auth/confirm (?code=, xem confirm-link.ts) */
async function callbackUrl(locale: Locale, purpose: ConfirmPurpose) {
  return authCallbackUrl(requestOrigin((await headers()).get('origin')), locale, purpose)
}

/** RATE_LIMITED có số giây chờ (GoTrue báo) → câu nói rõ chờ bao lâu; còn lại form tự dịch theo mã */
async function withAuthMessage(locale: Locale, failure: Failure): Promise<Failure> {
  const seconds = failure.details?.seconds
  if (failure.code !== 'RATE_LIMITED' || typeof seconds !== 'number') return failure
  const t = await getTranslations({ locale, namespace: 'auth' })
  return { ...failure, message: t('rateLimitedSeconds', { seconds }) }
}

export async function signIn(locale: Locale, _prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error) {
    const failure = authFailure(error)
    // Chưa xác nhận email: form hiện nút "Gửi lại email xác nhận" cho đúng địa chỉ khách vừa gõ
    if (failure.code === 'EMAIL_NOT_CONFIRMED') return { ...failure, details: { email: parsed.data.email } }
    return withAuthMessage(parseLocale(locale), failure)
  }

  // Gửi trước khi JS điền input `next` (hoặc tắt JS) → lấy từ URL trang đăng nhập
  const next = parsed.data.next || nextFromReferer((await headers()).get('referer'))
  redirectToPath(safeNextPath(next, getPathname({ href: '/account', locale: parseLocale(locale) })))
}

export async function signUp(
  locale: Locale,
  _prev: Result<{ email: string }> | null,
  formData: FormData,
): Promise<Result<{ email: string }>> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  const target = parseLocale(locale)
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // trigger handle_new_user tạo profiles từ metadata này (locale dùng cho email sau này)
      data: { full_name: parsed.data.full_name, locale: target },
      emailRedirectTo: await callbackUrl(target, 'signup'),
    },
  })
  // Chỉ báo lỗi GoTrue kiểm trước khi tìm user (mật khẩu yếu, dữ liệu sai, tắt đăng ký); còn lại như đăng ký mới
  if (error?.code && PRE_LOOKUP_SIGNUP_CODES.has(error.code)) return authFailure(error)
  const unreachable = unreachableOnly('signUp:', error)
  if (unreachable) return unreachable

  // Project tắt xác nhận email thì signUp đăng nhập luôn
  if (data.session) redirect({ href: '/account', locale: target })
  return { ok: true, data: { email: parsed.data.email } }
}

/**
 * Quên mật khẩu / gửi lại email xác nhận / đăng ký: chỉ báo lỗi khi KHÔNG tới được máy chủ (fetch lỗi, không có response). Mọi
 * phản hồi của GoTrue (email_address_invalid, email_address_not_authorized, mọi 429 kể cả giới hạn theo từng tài khoản,
 * 5xx khi gửi thư, user không có, mã lạ) cùng một kết quả "đã gửi": nhiều phản hồi trong số đó chỉ xảy ra khi email ĐÃ có
 * tài khoản (GoTrue tìm user trước rồi mới gửi thư / kiểm tần suất), báo khác đi là lộ email nào có tài khoản.
 * Quyết định 2026-10-19, xem docs/plans/ux-messages.md → "Bổ sung" và docs/plans/sau-ux.md mục 1 (đăng ký còn báo các mã
 * kiểm trước khi tìm user: PRE_LOOKUP_SIGNUP_CODES). Lỗi nhập (zod) vẫn báo, trước khi gọi GoTrue.
 * Trả Failure khi phải báo, null khi coi như "đã gửi" (log chỉ ghi mã: message của GoTrue có thể chứa địa chỉ email).
 */
function unreachableOnly(label: string, error: Parameters<typeof authFailure>[0] | null): Failure | null {
  if (!error) return null
  if (error.status === 0) return { ok: false, code: 'NETWORK_ERROR' }
  console.error(label, error.code ?? `${error.name ?? 'AuthError'} ${error.status ?? ''}`.trim())
  return null
}

export async function requestPasswordReset(
  locale: Locale,
  _prev: Result<{ email: string }> | null,
  formData: FormData,
): Promise<Result<{ email: string }>> {
  const parsed = passwordResetRequestSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  const target = parseLocale(locale)
  const supabase = await createClient()
  // Template riêng dựng link token_hash; template mặc định dùng redirectTo này (→ trang đặt mật khẩu mới đúng ngôn ngữ)
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await callbackUrl(target, 'recovery'),
  })
  // Mọi kết quả khác "không tới được máy chủ" đều "đã gửi" (unreachableOnly)
  const unreachable = unreachableOnly('resetPasswordForEmail:', error)
  if (unreachable) return unreachable
  return { ok: true, data: { email: parsed.data.email } }
}

export async function updatePassword(_prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  // Phiên recovery do /api/auth/confirm tạo; mất phiên (hết hạn, đã đăng xuất) → yêu cầu link mới
  if (!(await getCurrentUser())) return { ok: false, code: 'LINK_EXPIRED' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  // Mật khẩu yếu / trùng mật khẩu cũ → lỗi dưới ô; phiên khôi phục mất giữa chừng → xin link mới
  if (error) return authFailure(error, { recovery: true })

  // Thu hồi mọi phiên khác (người đang giữ phiên cũ ở thiết bị khác), giữ phiên hiện tại.
  // Lỗi ở bước này không làm hỏng việc đổi mật khẩu đã xong → vẫn báo thành công, ghi log.
  const { error: revokeError } = await supabase.auth.signOut({ scope: 'others' })
  if (revokeError) console.error('signOut(others) sau khi đổi mật khẩu:', revokeError.code ?? revokeError.message)

  return { ok: true, data: null }
}

/**
 * Gửi lại email xác nhận đăng ký. Như quên mật khẩu (unreachableOnly): chỉ báo khi không tới được máy chủ, còn lại
 * "đã gửi", không lộ email nào đã đăng ký / đã xác nhận. Nút khóa 60 giây ở client sau mỗi lần gửi (số cố định, không
 * lấy từ GoTrue).
 */
export async function resendConfirmation(
  locale: Locale,
  _prev: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = resendConfirmationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  const target = parseLocale(locale)
  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: await callbackUrl(target, 'signup') },
  })
  const unreachable = unreachableOnly('resend(signup):', error)
  if (unreachable) return unreachable
  return { ok: true, data: null }
}

export async function signOut(locale: Locale) {
  const supabase = await createClient()
  // Chỉ kết thúc phiên trên thiết bị này
  await supabase.auth.signOut({ scope: 'local' })
  redirect({ href: '/', locale: parseLocale(locale) })
}
