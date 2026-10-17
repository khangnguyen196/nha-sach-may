import { createServerClient, type CookieOptions } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import type { Locale } from 'next-intl'
import { NextResponse, type NextRequest } from 'next/server'
import { safeNextPath } from '@/features/auth/next-path'
import { catalogParamsSchema, pageExistsResponseSchema } from '@/features/books/schemas'
import { localizedPath, matchListingPath, matchSlugPath, type ListingMatch, type SlugPathname } from '@/i18n/paths'
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

async function missingSlug(pathname: string) {
  const match = matchSlugPath(pathname)
  return match && !(await slugExists(match.kind, match.slug)) ? match.locale : null
}

const LISTING_KINDS = {
  '/books': 'books',
  '/search': 'search',
  '/categories/[slug]': 'category',
  '/authors/[slug]': 'author',
} as const satisfies Record<ListingMatch['kind'], string>

/**
 * `?page=` > 1 của trang lưới mà trang đó không có sách. Trang 1 / không có `page` đi thẳng, không thêm request.
 * Proxy không dùng được cache của app (trên Vercel chạy tách khỏi runtime của app) → hỏi /api/catalog/page-exists,
 * nơi listBooks trả từ cache có tag. Lỗi / hết giờ → cho qua: trang tự hiện UI 404 + noindex (InlineNotFound).
 */
async function missingListingPage(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  if (catalogParamsSchema.shape.page.parse(searchParams.get('page')) === 1) return null
  const match = matchListingPath(pathname)
  if (!match) return null

  const url = new URL('/api/catalog/page-exists', request.url)
  for (const [key, value] of searchParams) url.searchParams.append(key, value)
  url.searchParams.set('listing', LISTING_KINDS[match.kind])
  if ('slug' in match) url.searchParams.set('slug', match.slug)
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) })
    const body = pageExistsResponseSchema.safeParse(await response.json())
    if (!body.success) throw new Error(`HTTP ${response.status}`)
    return body.data.data.exists ? null : match.locale
  } catch (error) {
    console.error('page-guard:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Slug không tồn tại, `?page=` vượt quá → rewrite sang một đường dẫn không khớp
 * route nào của locale đó: catch-all `[locale]/[...rest]` gọi notFound() trước khi stream → HTTP 404 thật +
 * not-found.tsx đúng ngôn ngữ. Trang tự kiểm thì đã stream (Cache Components) nên chỉ trả được 200.
 */
async function notFoundRewrite(request: NextRequest) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const { pathname } = request.nextUrl
  const locale = (await missingSlug(pathname)) ?? (await missingListingPage(request))
  return locale ? NextResponse.rewrite(new URL(`/${locale}/__not-found`, request.url)) : null
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
