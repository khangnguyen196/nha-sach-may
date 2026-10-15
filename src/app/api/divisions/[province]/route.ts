import type { NextRequest } from 'next/server'
import { getWardOptions } from '@/features/account/divisions'
import { parseLocale } from '@/features/auth/schemas'

// Dữ liệu cố định theo commit nguồn (scripts/build-divisions.ts) → cache dài ở trình duyệt và CDN.
// Không immutable: đổi commit nguồn rồi deploy thì nội dung đổi (Vercel xóa cache CDN khi deploy).
const CACHE = 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400'

/** Phường/xã của một tỉnh cho form địa chỉ: `/api/divisions/<mã tỉnh>?locale=vi|en` */
export async function GET(request: NextRequest, { params }: RouteContext<'/api/divisions/[province]'>) {
  const { province } = await params
  const wards = getWardOptions(province, parseLocale(request.nextUrl.searchParams.get('locale')))
  if (!wards) return Response.json({ ok: false, code: 'INVALID_INPUT' }, { status: 404 })
  return Response.json({ ok: true, data: wards }, { headers: { 'Cache-Control': CACHE } })
}
