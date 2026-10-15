import type { NextRequest } from 'next/server'
import { parseItemsParam } from '@/features/cart/guest-cart'
import { getGuestCart } from '@/features/cart/queries'

// Kết quả chỉ phụ thuộc `items` (đã sắp theo book_id ở client) → CDN cache ngắn theo URL, dùng chung giữa các khách
// có cùng giỏ. Ngắn vì tồn kho / giá đổi; giá chốt lúc đặt hàng do place_order tính lại.
const CACHE_HIT = 'public, s-maxage=60, stale-while-revalidate=300'

export async function GET(request: NextRequest) {
  const items = parseItemsParam(request.nextUrl.searchParams.get('items'))
  if (!items) {
    return Response.json({ ok: false, code: 'INVALID_INPUT' }, { status: 400 })
  }

  try {
    const data = await getGuestCart(items)
    return Response.json({ ok: true, data }, { headers: { 'Cache-Control': CACHE_HIT } })
  } catch (error) {
    console.error(error)
    return Response.json({ ok: false, code: 'UNKNOWN' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
