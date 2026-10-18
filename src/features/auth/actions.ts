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
import { authFailure } from './errors'
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
  // Email đã có: trả lời y như đăng ký mới để không lộ email nào đã có tài khoản
  const failure = error ? authFailure(error) : null
  if (failure && failure.code !== 'EMAIL_TAKEN') return withAuthMessage(target, failure)

  // Project tắt xác nhận email thì signUp đăng nhập luôn
  if (data.session) redirect({ href: '/account', locale: target })
  return { ok: true, data: { email: parsed.data.email } }
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
  if (error) {
    const failure = authFailure(error)
    // Báo: giới hạn tần suất, không tới được máy chủ (không nói gì về tài khoản), và email_address_invalid dưới ô
    // Email (giữ theo yêu cầu đợt ux-messages, CHỜ QUYẾT: GoTrue trả mã này trong sendEmail, sau khi đã tìm thấy tài
    // khoản; sai dạng là validation_failed, trả trước khi tìm → có thể lộ email có tài khoản, xem docs/progress.md).
    // email_address_not_authorized cũng chỉ xảy ra khi đã có tài khoản (SMTP mặc định chỉ gửi cho thành viên
    // project) → như mọi lỗi khác: "đã gửi", giống email không có tài khoản.
    if (failure.code === 'RATE_LIMITED' || failure.code === 'NETWORK_ERROR' || error.code === 'email_address_invalid') {
      return withAuthMessage(target, failure)
    }
    console.error('resetPasswordForEmail:', error.code ?? error.message)
  }
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
 * Gửi lại email xác nhận đăng ký. Luôn báo "đã gửi" trừ lỗi không nói gì về tài khoản (giới hạn tần suất, mạng): không
 * lộ email nào đã đăng ký / đã xác nhận. Supabase tự giới hạn mỗi email (~60 giây); form khóa nút 60 giây.
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
  if (error) {
    const failure = authFailure(error)
    if (failure.code === 'RATE_LIMITED' || failure.code === 'NETWORK_ERROR') return withAuthMessage(target, failure)
    console.error('resend(signup):', error.code ?? error.message)
  }
  return { ok: true, data: null }
}

export async function signOut(locale: Locale) {
  const supabase = await createClient()
  // Chỉ kết thúc phiên trên thiết bị này
  await supabase.auth.signOut({ scope: 'local' })
  redirect({ href: '/', locale: parseLocale(locale) })
}
