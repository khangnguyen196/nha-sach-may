import type { NextRequest } from 'next/server'
import { searchBookHits } from '@/features/books/queries'
import { searchQuerySchema } from '@/features/books/schemas'

// Kết quả chỉ phụ thuộc q (tên sách, tác giả không dịch) → CDN cache theo URL, dùng chung mọi locale
const CACHE_HIT = 'public, s-maxage=300, stale-while-revalidate=3600'

export async function GET(request: NextRequest) {
  const parsed = searchQuerySchema.safeParse(request.nextUrl.searchParams.get('q') ?? '')
  if (!parsed.success) {
    return Response.json({ ok: false, code: 'INVALID_INPUT' }, { status: 400 })
  }

  try {
    const data = await searchBookHits(parsed.data)
    return Response.json({ ok: true, data }, { headers: { 'Cache-Control': CACHE_HIT } })
  } catch (error) {
    console.error(error)
    return Response.json({ ok: false, code: 'UNKNOWN' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
