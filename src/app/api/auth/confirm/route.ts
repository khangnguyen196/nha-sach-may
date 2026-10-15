import { NextResponse, type NextRequest } from 'next/server'
import { toOtpType, toTokenHash } from '@/features/auth/otp'
import { safeNextPath } from '@/features/auth/next-path'
import { parseLocale } from '@/features/auth/schemas'
import { localizedPath } from '@/i18n/paths'
import { createClient } from '@/lib/supabase/server'

// Link trong email xác nhận đăng ký / đặt lại mật khẩu (template Supabase, supabase/templates/*.html):
//   /api/auth/confirm?token_hash=…&type=email|recovery&locale=vi|en[&next=/duong-dan]
// GET KHÔNG tiêu thụ token: trình quét link trong hộp thư (Outlook Safe Links…) mở link trước người dùng sẽ dùng mất
// token một lần. GET chỉ chuyển sang trang trung gian /xac-nhan (/en/confirm) có nút "Xác nhận"; nút gửi POST về
// đây mới gọi verifyOtp. Nằm dưới /api: proxy bỏ qua /api nên next-intl không rewrite sang /vi/… .

function retryUrl(request: NextRequest, recovery: boolean, locale: ReturnType<typeof parseLocale>) {
  // Link hỏng / hết hạn / đã dùng → trang yêu cầu lại kèm thông báo
  return new URL(localizedPath(recovery ? '/forgot-password' : '/login', locale, { error: 'LINK_EXPIRED' }), request.url)
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const locale = parseLocale(params.get('locale'))
  const query: Record<string, string> = {}
  for (const key of ['token_hash', 'type', 'next']) {
    const value = params.get(key)
    if (value) query[key] = value
  }
  return NextResponse.redirect(new URL(localizedPath('/confirm', locale, query), request.url))
}

/** Form chỉ gửi từ trang của chính site: chặn trang khác tự POST token của kẻ tấn công (đăng nhập người dùng vào tài khoản lạ) */
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  return origin === null || origin === request.nextUrl.origin
}

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const type = toOtpType(form.get('type'))
  const tokenHash = toTokenHash(form.get('token_hash'))
  const locale = parseLocale(form.get('locale'))
  const recovery = type === 'recovery'
  // 303: trình duyệt đổi POST thành GET khi theo chuyển hướng
  const redirect = (url: URL) => NextResponse.redirect(url, 303)

  if (!type || !tokenHash || !sameOrigin(request)) return redirect(retryUrl(request, recovery, locale))

  const supabase = await createClient()
  // verifyOtp tạo phiên; cookie ghi qua cookies() được Next gắn vào response chuyển hướng
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) return redirect(retryUrl(request, recovery, locale))

  const fallback = localizedPath(recovery ? '/reset-password' : '/account', locale)
  return redirect(new URL(safeNextPath(form.get('next'), fallback), request.url))
}
