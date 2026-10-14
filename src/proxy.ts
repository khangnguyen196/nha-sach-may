import { createServerClient, type CookieOptions } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from '@/i18n/routing'
import type { Database } from '@/types/database'
import { supabaseEnv } from '@/lib/supabase/env'

const handleI18nRouting = createIntlMiddleware(routing)

const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/')

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
    response = handleI18nRouting(request)
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
