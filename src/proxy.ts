import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import createIntlMiddleware from 'next-intl/middleware'
import type { Locale } from 'next-intl'
import { NextRequest, NextResponse } from 'next/server'
import { safeNextPath } from '@/features/auth/next-path'
import { ORDER_CODE } from '@/features/orders/params'
import {
  localizedPath,
  matchAddressPath,
  matchOrderPath,
  matchSlugPath,
  matchUsedListingBuyPath,
  matchUsedListingPath,
  type SlugPathname,
} from '@/i18n/paths'
import { routing } from '@/i18n/routing'
import type { Database } from '@/types/database'
import { NOT_FOUND_HEADER, type NotFoundKind } from '@/lib/not-found-kind'
import { createSlugGuard } from '@/lib/slug-guard'
import { createPublicClient } from '@/lib/supabase/public'
import { supabaseEnv } from '@/lib/supabase/env'

const handleI18nRouting = createIntlMiddleware(routing)

const SLUG_TABLES = { '/books/[slug]': 'books', '/categories/[slug]': 'categories', '/authors/[slug]': 'authors' } as const
const SLUG_KINDS = { '/books/[slug]': 'book', '/categories/[slug]': 'category', '/authors/[slug]': 'author' } as const

type Missing = { locale: Locale; kind: NotFoundKind }

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

async function missingSlug(pathname: string): Promise<Missing | null> {
  const match = matchSlugPath(pathname)
  return match && !(await slugExists(match.kind, match.slug)) ? { locale: match.locale, kind: SLUG_KINDS[match.kind] } : null
}

/**
 * Trang một đơn (đặt hàng thành công, chi tiết đơn) mà đơn không có hoặc của người khác. Lọc user_id như
 * getOrderByCode (RLS cho admin đọc mọi đơn). Lỗi → cho qua: trang tự hiện UI 404 + noindex.
 */
async function missingOrder(pathname: string, supabase: SupabaseClient<Database>, userId: string): Promise<Missing | null> {
  const match = matchOrderPath(pathname)
  if (!match) return null
  // Mã sai dạng, không có, của tài khoản khác: cùng một trang 404 (không lộ mã đơn nào tồn tại)
  const missing = { locale: match.locale, kind: 'order' } as const
  if (!ORDER_CODE.test(match.code)) return missing
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('order_code', match.code)
    .eq('user_id', userId)
  if (error) {
    console.error('order-guard:', error.message)
    return null
  }
  return count === 0 ? missing : null
}

/**
 * Trang sửa địa chỉ mà địa chỉ không có hoặc của người khác (RLS addresses chỉ trả địa chỉ của chính mình). Trước đây
 * trang tự gọi notFound() trong Suspense (soft 404 + React #419). Lỗi → cho qua: trang tự hiện UI 404.
 */
async function missingAddress(pathname: string, supabase: SupabaseClient<Database>, userId: string): Promise<Missing | null> {
  const match = matchAddressPath(pathname)
  if (!match) return null
  const missing = { locale: match.locale, kind: 'address' } as const
  if (!/^[1-9]\d{0,17}$/.test(match.id)) return missing
  const { count, error } = await supabase
    .from('addresses')
    .select('id', { count: 'exact', head: true })
    .eq('id', Number(match.id))
    .eq('user_id', userId)
  if (error) {
    console.error('address-guard:', error.message)
    return null
  }
  return count === 0 ? missing : null
}

/**
 * Trang sửa một tin sách cũ (/tai-khoan/sach-toi-ban/<id>, /en/account/my-listings/<id>) → id (chưa kiểm định dạng),
 * locale. Trang đăng tin (/tai-khoan/sach-toi-ban/dang-tin, /en/account/my-listings/new) cùng tiền tố nhưng không phải
 * trang này. id hợp lệ chỉ có chữ số nên không cần giải mã %.
 */
function matchMyListingPath(pathname: string): { id: string; locale: Locale } | null {
  for (const locale of routing.locales) {
    const prefix = `${localizedPath('/account/my-listings', locale)}/`
    if (!pathname.startsWith(prefix)) continue
    const id = pathname.slice(prefix.length)
    if (!id || id.includes('/') || pathname === localizedPath('/account/my-listings/new', locale)) return null
    return { id, locale }
  }
  return null
}

/**
 * Trang sửa tin sách cũ mà tin không có hoặc của người khác: như trang sửa địa chỉ, cùng một trang 404 (không lộ tin nào
 * tồn tại). Lọc seller_id: RLS cho admin đọc mọi tin, và tin đã duyệt / đã bán ai cũng đọc được. Lỗi → cho qua: trang
 * tự hiện UI 404.
 */
async function missingListing(pathname: string, supabase: SupabaseClient<Database>, userId: string): Promise<Missing | null> {
  const match = matchMyListingPath(pathname)
  if (!match) return null
  const missing = { locale: match.locale, kind: 'used-listing' } as const
  if (!/^[1-9]\d{0,17}$/.test(match.id)) return missing
  const { count, error } = await supabase
    .from('used_listings')
    .select('id', { count: 'exact', head: true })
    .eq('id', Number(match.id))
    .eq('seller_id', userId)
  if (error) {
    console.error('listing-guard:', error.message)
    return null
  }
  return count === 0 ? missing : null
}

/**
 * Trang công khai một tin sách cũ hoặc trang mua của tin mà tin không công khai: không có, chờ duyệt, bị từ chối, đã rút
 * → cùng một trang 404. Tin đã bán không 404 (trang tin hiện "Đã bán", trang mua hiện câu không mua được). BẮT BUỘC lọc
 * status: client theo phiên, RLS cho người bán / admin đọc cả tin chờ duyệt / bị từ chối của mình (trang công khai thì
 * không hiện các tin đó). Trang tin chạy cả khi chưa đăng nhập (anon đọc được tin đã duyệt / đã bán); trang mua thì
 * authRedirect chuyển sang đăng nhập trước. Lỗi → cho qua: trang tự hiện UI 404.
 */
async function missingUsedListing(pathname: string, supabase: SupabaseClient<Database>): Promise<Missing | null> {
  const match = matchUsedListingPath(pathname) ?? matchUsedListingBuyPath(pathname)
  if (!match) return null
  const missing = { locale: match.locale, kind: 'used-market' } as const
  if (!/^[1-9]\d{0,17}$/.test(match.id)) return missing
  const { count, error } = await supabase
    .from('used_listings')
    .select('id', { count: 'exact', head: true })
    .eq('id', Number(match.id))
    .in('status', ['approved', 'sold'])
  if (error) {
    console.error('used-market-guard:', error.message)
    return null
  }
  return count === 0 ? missing : null
}

/**
 * Slug không tồn tại, đơn không thuộc người đang đăng nhập → rewrite sang một đường dẫn không khớp
 * route nào của locale đó: catch-all `[locale]/[...rest]` gọi notFound() trước khi stream → HTTP 404 thật +
 * not-found.tsx đúng ngôn ngữ. Trang tự kiểm thì đã stream (Cache Components) nên chỉ trả được 200.
 * Header x-not-found cho not-found.tsx biết thiếu cái gì (sách ngừng bán, đơn của tài khoản khác…).
 */
async function notFoundRewrite(request: NextRequest, supabase: SupabaseClient<Database>, userId: string | undefined) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const { pathname } = request.nextUrl
  const missing =
    (await missingSlug(pathname)) ??
    (await missingUsedListing(pathname, supabase)) ??
    (userId
      ? ((await missingOrder(pathname, supabase, userId)) ??
        (await missingAddress(pathname, supabase, userId)) ??
        (await missingListing(pathname, supabase, userId)))
      : null)
  if (!missing) return null
  const headers = new Headers(request.headers)
  headers.set(NOT_FOUND_HEADER, missing.kind)
  return NextResponse.rewrite(new URL(`/${missing.locale}/__not-found`, request.url), { request: { headers } })
}

/**
 * x-not-found chỉ do proxy đặt (notFoundRewrite). Khách tự gửi header này thì bỏ trước mọi bước của proxy: next-intl và
 * NextResponse.next({ request }) chép header từ request này sang trang. Đường dẫn proxy không chạy (matcher bỏ qua
 * đường dẫn có dấu chấm) vẫn mang header của khách tới not-found.tsx: chấp nhận, chỉ đổi được câu giải thích của
 * chính request đó (parseNotFoundKind chỉ nhận loại có sẵn, trang động nên không cache chung).
 */
function withoutClientNotFoundKind(request: NextRequest): NextRequest {
  if (!request.headers.has(NOT_FOUND_HEADER)) return request
  const headers = new Headers(request.headers)
  headers.delete(NOT_FOUND_HEADER)
  return new NextRequest(request, { headers })
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

/**
 * Chưa đăng nhập vào khu tài khoản / thanh toán / trang mua sách cũ → trang đăng nhập; đã đăng nhập vào đăng nhập/đăng ký → trang muốn tới.
 * Chỉ GET / HEAD: POST là Server Action, tự kiểm phiên và trả AUTH_REQUIRED (form hiện "Đăng nhập lại"). Chuyển hướng
 * một Server Action sang trang HTML làm client coi là lỗi mạng ("Không kết nối được máy chủ") dù chỉ là phiên hết hạn.
 */
function authRedirect(request: NextRequest, signedIn: boolean) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const { pathname, search, searchParams } = request.nextUrl
  if (!signedIn) {
    const locale = matchLocalized(pathname, ['/account', '/checkout']) ?? matchUsedListingBuyPath(pathname)?.locale
    if (!locale) return null
    const login = localizedPath('/login', locale, { next: `${pathname}${search}` })
    return NextResponse.redirect(new URL(login, request.url))
  }
  const locale = matchLocalized(pathname, ['/login', '/register'])
  if (!locale) return null
  const next = safeNextPath(searchParams.get('next'), localizedPath('/account', locale))
  return NextResponse.redirect(new URL(next, request.url))
}

export async function proxy(incoming: NextRequest) {
  const request = withoutClientNotFoundKind(incoming)
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
      authRedirect(request, Boolean(auth?.claims)) ??
      (await notFoundRewrite(request, supabase, auth?.claims.sub)) ??
      handleI18nRouting(request)
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
