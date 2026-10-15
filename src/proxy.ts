import { createServerClient, type CookieOptions } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import type { Locale } from 'next-intl'
import { NextResponse, type NextRequest } from 'next/server'
import { safeNextPath } from '@/features/auth/next-path'
import { localizedPath, matchSlugPath, type SlugPathname } from '@/i18n/paths'
import { routing } from '@/i18n/routing'
import type { Database } from '@/types/database'
import { createSlugGuard } from '@/lib/slug-guard'
import { createPublicClient } from '@/lib/supabase/public'
import { supabaseEnv } from '@/lib/supabase/env'

const handleI18nRouting = createIntlMiddleware(routing)

const SLUG_TABLES = { '/books/[slug]': 'books', '/categories/[slug]': 'categories', '/authors/[slug]': 'authors' } as const

// Client anon: RLS chỉ trả sách / danh mục đang hiện → sách ẩn cũng là 404, như trang tự gọi notFound()
const slugExists = createSlugGuard({
  async all(kind: SlugPathname) {
    const { data, error } = await createPublicClient().from(SLUG_TABLES[kind]).select('slug')
    if (error) throw new Error(error.message)
    return data.map((row) => row.slug)
  },
  async one(kind: SlugPathname, slug: string) {
    const { data, error } = await createPublicClient().from(SLUG_TABLES[kind]).select('slug').eq('slug', slug).maybeSingle()
    if (error) throw new Error(error.message)
    return data !== null
  },
})

/**
 * Trang sách / danh mục / tác giả với slug không tồn tại → rewrite sang một đường dẫn không khớp route nào của locale
 * đó: catch-all `[locale]/[...rest]` gọi notFound() trước khi stream → HTTP 404 thật + not-found.tsx đúng ngôn ngữ.
 */
async function notFoundRewrite(request: NextRequest) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const match = matchSlugPath(request.nextUrl.pathname)
  if (!match || (await slugExists(match.kind, match.slug))) return null
  return NextResponse.rewrite(new URL(`/${match.locale}/__not-found`, request.url))
}

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
    response =
      authRedirect(request, Boolean(auth?.claims)) ?? (await notFoundRewrite(request)) ?? handleI18nRouting(request)
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
