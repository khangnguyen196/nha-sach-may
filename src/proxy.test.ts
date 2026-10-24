import { NextRequest, type NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// proxy (ux-messages mục 6, 9): trang thiếu → rewrite 404 kèm x-not-found đúng loại; header x-not-found do khách tự
// gửi không bao giờ tới trang. Supabase giả lập: slug có / không, phiên, số đơn của user.
const state = vi.hoisted(() => ({
  slugExists: true,
  userId: null as string | null,
  orderCount: 0,
}))

// next-intl/middleware (ESM) không resolve được `next/server` trong Vitest. Bản giả làm đúng phần proxy dựa vào: rewrite
// sang /<locale>/… và chép header của request nhận được vào request của trang (như next-intl `next()`).
vi.mock('next-intl/middleware', async () => {
  const { NextResponse } = await import('next/server')
  return {
    default: () => (request: NextRequest) => {
      const headers = new Headers(request.headers)
      headers.set('x-next-intl-locale', 'vi')
      return NextResponse.rewrite(new URL(`/vi${request.nextUrl.pathname}`, request.url), { request: { headers } })
    },
  }
})
vi.mock('@/lib/supabase/env', () => ({ supabaseEnv: () => ({ url: 'http://127.0.0.1:54321', publishableKey: 'test' }) }))
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => ({}) }))
vi.mock('@/lib/slug-guard', () => ({ createSlugGuard: () => async () => state.slugExists }))
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => {
    const query = {
      select: () => query,
      eq: () => query,
      in: () => query,
      then: (resolve: (value: { count: number; error: null }) => void) => resolve({ count: state.orderCount, error: null }),
    }
    return {
      auth: {
        getClaims: async () => ({ data: state.userId ? { claims: { sub: state.userId } } : null }),
      },
      from: () => query,
      rpc: async () => ({ data: false }),
    }
  },
}))

const { proxy } = await import('./proxy')

const ORDER = 'NS26101800001'

function get(path: string, headers: Record<string, string> = {}) {
  return proxy(new NextRequest(`http://localhost:3000${path}`, { headers }))
}

/** Header của request mà trang sẽ nhận (Next đọc từ x-middleware-request-*) */
function forwarded(response: NextResponse, name: string) {
  const overrides = response.headers.get('x-middleware-override-headers')?.split(',') ?? []
  return overrides.includes(name) ? response.headers.get(`x-middleware-request-${name}`) : null
}

const rewriteTo = (response: NextResponse) => new URL(response.headers.get('x-middleware-rewrite') ?? 'http://x/').pathname

describe('proxy: trang thiếu → 404 kèm loại', () => {
  beforeEach(() => {
    state.slugExists = true
    state.userId = null
    state.orderCount = 0
  })

  it.each([
    ['/sach/khong-co', '/vi/__not-found', 'book'],
    ['/en/books/khong-co', '/en/__not-found', 'book'],
    ['/danh-muc/khong-co', '/vi/__not-found', 'category'],
    ['/tac-gia/khong-co', '/vi/__not-found', 'author'],
    ['/en/authors/khong-co', '/en/__not-found', 'author'],
  ])('%s → %s, x-not-found: %s', async (path, target, kind) => {
    state.slugExists = false
    const response = await get(path)
    expect(rewriteTo(response)).toBe(target)
    expect(forwarded(response, 'x-not-found')).toBe(kind)
  })

  it('đơn không có, của tài khoản khác, mã sai dạng → cùng một loại "order" ở cả hai trang đơn', async () => {
    state.userId = 'user-1'
    for (const path of [
      `/tai-khoan/don-hang/${ORDER}`,
      `/thanh-toan/thanh-cong/${ORDER}`,
      '/tai-khoan/don-hang/ABC',
      `/en/account/orders/${ORDER}`,
      `/en/checkout/success/${ORDER}`,
    ]) {
      const response = await get(path)
      expect(rewriteTo(response), path).toMatch(/^\/(vi|en)\/__not-found$/)
      expect(forwarded(response, 'x-not-found'), path).toBe('order')
    }
  })

  it('trang có thật → không rewrite 404, không có x-not-found', async () => {
    state.userId = 'user-1'
    state.orderCount = 1
    for (const path of ['/sach/sapiens', `/tai-khoan/don-hang/${ORDER}`]) {
      const response = await get(path)
      expect(rewriteTo(response), path).not.toContain('__not-found')
      expect(forwarded(response, 'x-not-found'), path).toBeNull()
    }
  })
})

describe('proxy: x-not-found do khách tự gửi', () => {
  beforeEach(() => {
    state.slugExists = true
    state.userId = null
  })

  it('/abc kèm x-not-found: order → header bị bỏ, not-found.tsx nhận câu chung', async () => {
    const response = await get('/abc', { 'x-not-found': 'order' })
    expect(forwarded(response, 'x-not-found')).toBeNull()
    // Các header khác của khách vẫn tới trang
    const withOther = await get('/abc', { 'x-not-found': 'order', 'accept-language': 'vi' })
    expect(forwarded(withOther, 'accept-language')).toBe('vi')
  })

  it('trang thiếu thật: giá trị của proxy thắng giá trị khách gửi', async () => {
    state.slugExists = false
    const response = await get('/sach/khong-co', { 'x-not-found': 'order' })
    expect(forwarded(response, 'x-not-found')).toBe('book')
  })

  it('POST (Server Action) kèm header: vẫn bỏ header', async () => {
    const response = await proxy(
      new NextRequest('http://localhost:3000/abc', { method: 'POST', body: 'a=1', headers: { 'x-not-found': 'book' } }),
    )
    expect(forwarded(response, 'x-not-found')).toBeNull()
  })
})

describe('proxy: trang mua sách cũ (/cho-sach-cu/<id>/mua)', () => {
  beforeEach(() => {
    state.slugExists = true
    state.userId = null
    state.orderCount = 0
  })

  it.each([
    ['/cho-sach-cu/12/mua', '/dang-nhap?next=%2Fcho-sach-cu%2F12%2Fmua'],
    ['/en/used-books/12/buy', '/en/login?next=%2Fen%2Fused-books%2F12%2Fbuy'],
    ['/cho-sach-cu/abc/mua', '/dang-nhap?next=%2Fcho-sach-cu%2Fabc%2Fmua'],
  ])('chưa đăng nhập GET %s → %s', async (path, login) => {
    const response = await get(path)
    const location = new URL(response.headers.get('location') ?? 'http://x/')
    expect(`${location.pathname}${location.search}`).toBe(login)
  })

  it('chưa đăng nhập POST (Server Action) → không chuyển hướng, action tự trả AUTH_REQUIRED', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/cho-sach-cu/12/mua', { method: 'POST', body: 'a=1' }))
    expect(response.headers.get('location')).toBeNull()
    expect(rewriteTo(response)).not.toContain('__not-found')
  })

  it('đã đăng nhập: tin không công khai / id sai dạng → 404 used-market (như trang tin)', async () => {
    state.userId = 'user-1'
    for (const [path, target] of [
      ['/cho-sach-cu/12/mua', '/vi/__not-found'],
      ['/en/used-books/12/buy', '/en/__not-found'],
      ['/cho-sach-cu/abc/mua', '/vi/__not-found'],
      ['/cho-sach-cu/0/mua', '/vi/__not-found'],
    ] as const) {
      const response = await get(path)
      expect(rewriteTo(response), path).toBe(target)
      expect(forwarded(response, 'x-not-found'), path).toBe('used-market')
    }
  })

  it('đã đăng nhập, tin đã duyệt / đã bán → vào trang (không 404)', async () => {
    state.userId = 'user-1'
    state.orderCount = 1
    const response = await get('/cho-sach-cu/12/mua')
    expect(response.headers.get('location')).toBeNull()
    expect(rewriteTo(response)).not.toContain('__not-found')
    expect(forwarded(response, 'x-not-found')).toBeNull()
  })
})
