import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { safeNextPath } from '@/features/auth/next-path'
import { localeSchema } from '@/features/auth/schemas'
import { localizedPath } from '@/i18n/paths'
import { createClient } from '@/lib/supabase/server'

// Link trong email xác nhận đăng ký / đặt lại mật khẩu (template Supabase, xem docs/plans/phase-4.md):
//   /api/auth/confirm?token_hash=…&type=email|recovery&locale=vi|en[&next=/duong-dan]
// Nằm dưới /api: proxy bỏ qua /api nên next-intl không rewrite sang /vi/… .
const OTP_TYPES = ['email', 'signup', 'recovery', 'email_change'] as const satisfies EmailOtpType[]

function toOtpType(value: string | null) {
  return OTP_TYPES.find((type) => type === value)
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const type = toOtpType(params.get('type'))
  const tokenHash = params.get('token_hash')
  const parsedLocale = localeSchema.safeParse(params.get('locale'))
  const locale = parsedLocale.success ? parsedLocale.data : 'vi'
  const recovery = type === 'recovery'

  if (type && tokenHash) {
    const supabase = await createClient()
    // verifyOtp tạo phiên; cookie ghi qua cookies() được Next gắn vào response redirect bên dưới
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      const fallback = localizedPath(recovery ? '/reset-password' : '/account', locale)
      return NextResponse.redirect(new URL(safeNextPath(params.get('next'), fallback), request.url))
    }
  }

  // Link hỏng / hết hạn / đã dùng → trang yêu cầu lại kèm thông báo
  const retry = localizedPath(recovery ? '/forgot-password' : '/login', locale, { error: 'LINK_EXPIRED' })
  return NextResponse.redirect(new URL(retry, request.url))
}
