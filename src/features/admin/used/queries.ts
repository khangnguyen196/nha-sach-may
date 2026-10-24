import 'server-only'
import { signUsedPhotoUrls } from '@/features/used/signed-urls'
import { ADMIN_PAGE_SIZE } from '../params'
import { createAdminQueryClient } from '../supabase'
import type { UsedListingListParams } from './params'

// Duyệt tin sách cũ. Client theo phiên, KHÔNG 'use cache' (admin cần thấy trạng thái mới ngay; link ảnh ký theo từng
// request, quyết định 7a). RLS: admin đọc mọi tin; policy ảnh: admin ký được mọi ảnh. Không select email / điện thoại
// / địa chỉ người bán: chỉ tên hiển thị (seller_name). Chỉ gọi trong <Suspense>.

const RANGE_NOT_SATISFIABLE = 'PGRST103'

/** Tin theo trạng thái: chờ duyệt thì cũ nhất trước (duyệt theo thứ tự đăng), trạng thái khác mới nhất trước */
export async function listAdminUsedListings(params: UsedListingListParams) {
  const supabase = await createAdminQueryClient()
  const ascending = params.status === 'pending'
  const from = ((params.page ?? 1) - 1) * ADMIN_PAGE_SIZE
  const { data, count, error } = await supabase
    .from('used_listings')
    .select('id, condition, price, fee, photos, status, seller_name, created_at, books(title, slug)', { count: 'exact' })
    .eq('status', params.status)
    .order('created_at', { ascending })
    .order('id', { ascending })
    .range(from, from + ADMIN_PAGE_SIZE - 1)
  if (error?.code === RANGE_NOT_SATISFIABLE) return { listings: [], total: count ?? 0 }
  if (error) throw new Error(`listAdminUsedListings: ${error.message}`)

  // Ảnh đầu của mỗi tin (tin đã rút: ảnh đã xóa lúc rút → không ký)
  const signable = data.filter((listing) => listing.status !== 'withdrawn' && listing.photos[0])
  const urls = await signUsedPhotoUrls(
    supabase,
    signable.map((listing) => listing.photos[0] ?? ''),
  )
  const photoUrls = new Map(signable.map((listing, index) => [listing.id, urls[index] ?? null]))

  return {
    listings: data.map((listing) => ({
      id: listing.id,
      book: listing.books,
      condition: listing.condition,
      price: listing.price,
      fee: listing.fee,
      status: listing.status,
      sellerName: listing.seller_name,
      createdAt: listing.created_at,
      photoUrl: photoUrls.get(listing.id) ?? null,
    })),
    total: count ?? data.length,
  }
}

export type AdminUsedListingRow = Awaited<ReturnType<typeof listAdminUsedListings>>['listings'][number]

/** Một tin kèm mọi ảnh (ký theo request; ảnh không còn → url null) và trần giá hiện tại của sách; không có → null */
export async function getAdminUsedListing(id: number) {
  const supabase = await createAdminQueryClient()
  const { data, error } = await supabase
    .from('used_listings')
    .select(
      `id, book_id, condition, price, fee, description, photos, status, reject_reason, seller_name, approved_at,
      created_at, updated_at, books(title, slug, price, original_price, is_active)`,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`getAdminUsedListing: ${error.message}`)
  if (!data) return null

  const urls = data.status === 'withdrawn' ? [] : await signUsedPhotoUrls(supabase, data.photos)
  return {
    id: data.id,
    bookId: data.book_id,
    book: data.books && {
      title: data.books.title,
      slug: data.books.slug,
      isActive: data.books.is_active,
      // Trần giá hiện tại (như used_check_book_price lúc duyệt): giá gốc, không có thì giá bán
      maxPrice: data.books.original_price ?? data.books.price,
    },
    condition: data.condition,
    price: data.price,
    fee: data.fee,
    description: data.description,
    photos: data.photos.map((path, index) => ({ path, url: urls[index] ?? null })),
    status: data.status,
    rejectReason: data.reject_reason,
    sellerName: data.seller_name,
    approvedAt: data.approved_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export type AdminUsedListing = NonNullable<Awaited<ReturnType<typeof getAdminUsedListing>>>
