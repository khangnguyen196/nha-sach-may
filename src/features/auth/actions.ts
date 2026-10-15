'use server'

// `next` đã là URL hiển thị (/tai-khoan/dia-chi, /en/account…) chứ không phải pathname nội bộ nên không đi qua
// redirect của next-intl được; safeNextPath đảm bảo nó là đường dẫn nội bộ.
// eslint-disable-next-line no-restricted-imports
import { redirect as redirectToPath } from 'next/navigation'
import type { Locale } from 'next-intl'
import { getPathname, redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'
import { invalidInput, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { authErrorCode } from './errors'
import { safeNextPath } from './next-path'
import {
  parseLocale,
  passwordResetRequestSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from './schemas'

// Server Action không đọc được next/root-params → locale do page bind sẵn (`signIn.bind(null, locale)`)
// và được parse lại (parseLocale) vì tham số bind đi qua client.

export async function signIn(locale: Locale, _prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error) return { ok: false, code: authErrorCode(error) }

  redirectToPath(safeNextPath(parsed.data.next, getPathname({ href: '/account', locale: parseLocale(locale) })))
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
    // trigger handle_new_user tạo profiles từ metadata này (locale dùng cho email sau này)
    options: { data: { full_name: parsed.data.full_name, locale: target } },
  })
  // Email đã có: trả lời y như đăng ký mới để không lộ email nào đã có tài khoản
  if (error && authErrorCode(error) !== 'EMAIL_TAKEN') return { ok: false, code: authErrorCode(error) }

  // Project tắt xác nhận email thì signUp đăng nhập luôn
  if (data.session) redirect({ href: '/account', locale: target })
  return { ok: true, data: { email: parsed.data.email } }
}

export async function requestPasswordReset(
  _prev: Result<{ email: string }> | null,
  formData: FormData,
): Promise<Result<{ email: string }>> {
  const parsed = passwordResetRequestSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)

  const supabase = await createClient()
  // Link trong email do template "Reset password" dựng (→ /api/auth/confirm), không cần redirectTo
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email)
  if (error) {
    const code = authErrorCode(error)
    // Chỉ báo lỗi giới hạn tần suất; lỗi khác vẫn hiện "đã gửi" để không lộ email nào có tài khoản
    if (code === 'RATE_LIMITED') return { ok: false, code }
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
  if (error) return { ok: false, code: authErrorCode(error) }

  // Thu hồi mọi phiên khác (người đang giữ phiên cũ ở thiết bị khác), giữ phiên hiện tại.
  // Lỗi ở bước này không làm hỏng việc đổi mật khẩu đã xong → vẫn báo thành công, ghi log.
  const { error: revokeError } = await supabase.auth.signOut({ scope: 'others' })
  if (revokeError) console.error('signOut(others) sau khi đổi mật khẩu:', revokeError.code ?? revokeError.message)

  return { ok: true, data: null }
}

export async function signOut(locale: Locale) {
  const supabase = await createClient()
  // Chỉ kết thúc phiên trên thiết bị này
  await supabase.auth.signOut({ scope: 'local' })
  redirect({ href: '/', locale: parseLocale(locale) })
}
