import type { NextRequest } from 'next/server'
import { listingPageExists, type ListingKind } from '@/features/books/listing'

// Proxy hỏi trước khi render `?page=` > 1 của trang lưới (proxy không đọc được cache của app). listBooks có
// 'use cache' + tag `books` / `book:{id}` → cùng mục cache với lần render trang sau đó, admin sửa sách là làm mới.
// Không cho CDN cache response: cache theo URL không biết tag, sẽ lệch khi admin sửa.
const NO_STORE = { 'Cache-Control': 'no-store' }
const KINDS: readonly ListingKind[] = ['books', 'search', 'category', 'author']

const isKind = (value: string | null): value is ListingKind => KINDS.some((kind) => kind === value)

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const kind = searchParams.get('listing')
  if (!isKind(kind)) return Response.json({ ok: false, code: 'INVALID_INPUT' }, { status: 400, headers: NO_STORE })

  try {
    // Key lặp (`?page=2&page=9`) → lấy giá trị đầu, như trang
    const raw = Object.fromEntries([...searchParams.keys()].map((key) => [key, searchParams.get(key) ?? undefined]))
    const exists = await listingPageExists(kind, searchParams.get('slug') ?? '', raw)
    return Response.json({ ok: true, data: { exists } }, { headers: NO_STORE })
  } catch (error) {
    console.error(error)
    return Response.json({ ok: false, code: 'UNKNOWN' }, { status: 500, headers: NO_STORE })
  }
}
