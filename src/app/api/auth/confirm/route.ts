import { NextResponse, type NextRequest } from 'next/server'
import { parseConfirmLink } from '@/features/auth/confirm-link'
import { isAuthUnreachable } from '@/features/auth/errors'
import { toOtpType, toTokenHash } from '@/features/auth/otp'
import { safeNextPath } from '@/features/auth/next-path'
import { parseLocale } from '@/features/auth/schemas'
import { localizedPath } from '@/i18n/paths'
import { createClient } from '@/lib/supabase/server'

// Link trong email xác nhận đăng ký / đặt lại mật khẩu, hai dạng (features/auth/confirm-link.ts):
// - Template riêng (supabase/templates/*.html): /api/auth/confirm?token_hash=…&type=email|recovery&locale=vi|en[&next=…]
//   GET KHÔNG tiêu thụ token: trình quét link trong hộp thư (Outlook Safe Links…) mở link trước người dùng sẽ dùng mất
//   token một lần. GET chỉ chuyển sang trang trung gian /xac-nhan (/en/confirm) có nút "Xác nhận"; nút gửi POST về
//   đây mới gọi verifyOtp.
// - Template mặc định của Supabase ({{ .ConfirmationURL }}): Supabase đã xác thực token ở /auth/v1/verify rồi chuyển về
//   `redirectTo` của app (authCallbackUrl) kèm ?code= → GET đổi code lấy phiên ngay (code chỉ dùng được với code
//   verifier PKCE trong cookie của trình duyệt đã yêu cầu link, trình quét link không có).
// Nằm dưới /api: proxy bỏ qua /api nên next-intl không rewrite sang /vi/… .

type ConfirmError = 'LINK_EXPIRED' | 'NETWORK_ERROR'

function retryUrl(
  request: NextRequest,
  recovery: boolean,
  locale: ReturnType<typeof parseLocale>,
  error: ConfirmError = 'LINK_EXPIRED',
) {
  // Link hỏng / hết hạn / đã dùng → trang yêu cầu lại kèm thông báo. Không tới được Supabase → link chưa bị dùng, báo
  // lỗi mạng (khách mở lại link) thay vì bảo xin link mới
  return new URL(localizedPath(recovery ? '/forgot-password' : '/login', locale, { error }), request.url)
}

const confirmError = (error: { name?: string; status?: number }): ConfirmError =>
  isAuthUnreachable(error) ? 'NETWORK_ERROR' : 'LINK_EXPIRED'

export async function GET(request: NextRequest) {
  const link = parseConfirmLink(request.nextUrl.searchParams)
  if (link.kind === 'token') {
    return NextResponse.redirect(new URL(localizedPath('/confirm', link.locale, link.query), request.url))
  }
  if (link.kind === 'error') return NextResponse.redirect(retryUrl(request, link.recovery, link.locale))

  const supabase = await createClient()
  // exchangeCodeForSession tạo phiên; cookie ghi qua cookies() được Next gắn vào response chuyển hướng
  const { error } = await supabase.auth.exchangeCodeForSession(link.code)
  if (error) {
    // Có ?code= nghĩa là Supabase đã xác thực link; lỗi thường do mở link ở trình duyệt khác với lúc yêu cầu (thiếu
    // code verifier). Đăng ký: email đã xác nhận → đăng nhập bằng tay. Đặt lại mật khẩu: cần phiên → yêu cầu link mới.
    if (!link.recovery && error.code === 'pkce_code_verifier_not_found') {
      return NextResponse.redirect(new URL(localizedPath('/login', link.locale, { confirmed: '1' }), request.url))
    }
    return NextResponse.redirect(retryUrl(request, link.recovery, link.locale, confirmError(error)))
  }
  const fallback = localizedPath(link.recovery ? '/reset-password' : '/account', link.locale)
  return NextResponse.redirect(new URL(safeNextPath(link.next, fallback), request.url))
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
  if (error && isAuthUnreachable(error)) {
    // Token chưa bị dùng: quay lại trang xác nhận (cùng token) để bấm lại khi có mạng
    const query: Record<string, string> = { token_hash: tokenHash, type, locale, error: 'NETWORK_ERROR' }
    const next = form.get('next')
    if (typeof next === 'string' && next) query.next = next
    return redirect(new URL(localizedPath('/confirm', locale, query), request.url))
  }
  if (error) return redirect(retryUrl(request, recovery, locale))

  const fallback = localizedPath(recovery ? '/reset-password' : '/account', locale)
  return redirect(new URL(safeNextPath(form.get('next'), fallback), request.url))
}
