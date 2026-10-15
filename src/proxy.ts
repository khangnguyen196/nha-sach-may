import { createServerClient, type CookieOptions } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import type { Locale } from 'next-intl'
import { NextResponse, type NextRequest } from 'next/server'
import { safeNextPath } from '@/features/auth/next-path'
import { localizedPath } from '@/i18n/paths'
import { routing } from '@/i18n/routing'
import type { Database } from '@/types/database'
import { supabaseEnv } from '@/lib/supabase/env'

const handleI18nRouting = createIntlMiddleware(routing)

const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/')

/** Locale của URL nếu nó là (hoặc nằm dưới) một trong các trang `hrefs`, theo pathname đã dịch: /tai-khoan, /en/account… */
function matchLocalized(pathname: string, hrefs: Parameters<typeof localizedPath>[0][]): Locale | undefined {
  for (const locale of routing.locales) {
    for (const href of hrefs) {
      const base = localizedPath(href, locale)
      if (pathname === base || pathname.startsWith(`${base}/`)) return locale
    }
  }
}

/** Chưa đăng nhập vào khu tài khoản / thanh toán → trang đăng nhập; đã đăng nhập vào đăng nhập/đăng ký → trang muốn tới */
function authRedirect(request: NextRequest, signedIn: boolean) {
  const { pathname, search, searchParams } = request.nextUrl
  if (!signedIn) {
    const locale = matchLocalized(pathname, ['/account', '/checkout'])
    if (!locale) return null
    const login = localizedPath('/login', locale, { next: `${pathname}${search}` })
    return NextResponse.redirect(new URL(login, request.url))
  }
  const locale = matchLocalized(pathname, ['/login', '/register'])
  if (!locale) return null
  const next = safeNextPath(searchParams.get('next'), localizedPath('/account', locale))
  return NextResponse.redirect(new URL(next, request.url))
}

export async function proxy(request: NextRequest) {
  // 1. Refresh phiên Supabase TRƯỚC next-intl: cookie mới được ghi vào request, và next-intl
  //    chuyển tiếp nguyên header của request → Server Component đọc được token mới ngay lượt này.
  const { url, publishableKey } = supabaseEnv()
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = []
  const pendingHeaders: Record<string, string> = {}

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value)
          pendingCookies.push({ name, value, options })
        }
        Object.assign(pendingHeaders, headers)
      },
    },
  })
  const { data: auth } = await supabase.auth.getClaims()

  // 2. /admin không đi qua next-intl (không có [locale]) nhưng vẫn cần phiên đã refresh ở trên.
  //    Kiểm tra quyền ở đây chỉ là lớp ngoài; layout admin kiểm tra lại ở server.
  const admin = isAdminPath(request.nextUrl.pathname)
  let response: NextResponse
  if (admin) {
    const allowed = auth?.claims ? (await supabase.rpc('is_admin')).data === true : false
    response = allowed ? NextResponse.next({ request }) : NextResponse.redirect(new URL('/', request.url))
  } else {
    // Lớp ngoài; trang tài khoản kiểm tra lại ở server (requireUser)
    response = authRedirect(request, Boolean(auth?.claims)) ?? handleI18nRouting(request)
  }

  // 3. Trả cookie mới về trình duyệt, kèm header chống cache của Supabase (không để CDN cache token)
  for (const { name, value, options } of pendingCookies) response.cookies.set(name, value, options)
  for (const [key, value] of Object.entries(pendingHeaders)) response.headers.set(key, value)
  return response
}

export const config = {
  // Bỏ qua API, file nội bộ của Next/Vercel và mọi đường dẫn có đuôi file (ảnh, favicon…)
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
