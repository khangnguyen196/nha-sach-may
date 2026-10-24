import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { signUsedPhotoUrls } from './signed-urls'

// Phần người bán: theo phiên (client đọc cookies), KHÔNG 'use cache' → chỉ gọi trong <Suspense>. Link ảnh ký theo từng
// request (RLS: người bán đọc mọi tin của mình; policy ảnh: chủ thư mục đọc / ký được ảnh của mình).

/** Trang "Sách tôi bán" hiện tối đa ngần này tin mới nhất (tin chờ duyệt tối đa 10; tin cũ đã bán / đã rút ít khi cần) */
const MY_LISTINGS_LIMIT = 100

export async function listMyListings(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('used_listings')
    .select('id, book_id, condition, price, fee, status, reject_reason, photos, created_at, books(title, slug)')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MY_LISTINGS_LIMIT)
  if (error) throw new Error(`listMyListings: ${error.message}`)

  // Ảnh bìa tin = ảnh đầu. Tin đã rút: ảnh đã xóa lúc rút → không ký
  const signable = data.filter((listing) => listing.status !== 'withdrawn' && listing.photos[0])
  const urls = await signUsedPhotoUrls(
    supabase,
    signable.map((listing) => listing.photos[0] ?? ''),
  )
  const photoUrls = new Map(signable.map((listing, index) => [listing.id, urls[index] ?? null]))

  return data.map((listing) => ({
    id: listing.id,
    bookId: listing.book_id,
    // Sách ngừng bán: RLS của books ẩn dòng → null
    book: listing.books,
    condition: listing.condition,
    price: listing.price,
    fee: listing.fee,
    status: listing.status,
    rejectReason: listing.reject_reason,
    createdAt: listing.created_at,
    photoUrl: photoUrls.get(listing.id) ?? null,
  }))
}

export type MyListing = Awaited<ReturnType<typeof listMyListings>>[number]

/** Số tin đang chờ duyệt của người bán (đủ USED_PENDING_LIMIT thì chưa đăng tin mới được) */
export async function countMyPendingListings(userId: string) {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('used_listings')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', userId)
    .eq('status', 'pending')
  if (error) throw new Error(`countMyPendingListings: ${error.message}`)
  return count ?? 0
}

/** Một tin của chính người bán để sửa (kèm mọi ảnh đã ký); không có / của người khác → null */
export async function getMyListing(id: number, userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('used_listings')
    .select(
      'id, book_id, condition, price, fee, description, photos, status, reject_reason, books(title, slug, cover_url, price, original_price)',
    )
    .eq('id', id)
    .eq('seller_id', userId)
    .maybeSingle()
  if (error) throw new Error(`getMyListing: ${error.message}`)
  if (!data) return null

  const urls = data.status === 'withdrawn' ? [] : await signUsedPhotoUrls(supabase, data.photos)
  return {
    id: data.id,
    bookId: data.book_id,
    book: data.books && {
      title: data.books.title,
      slug: data.books.slug,
      coverUrl: data.books.cover_url,
      // Trần giá của tin = giá gốc của sách (như used_check_book_price)
      maxPrice: data.books.original_price ?? data.books.price,
    },
    condition: data.condition,
    price: data.price,
    fee: data.fee,
    description: data.description,
    photos: data.photos.map((path, index) => ({ path, url: urls[index] ?? null })),
    status: data.status,
    rejectReason: data.reject_reason,
  }
}

export type MyListingDetail = NonNullable<Awaited<ReturnType<typeof getMyListing>>>
