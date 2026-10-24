import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { saleStatusWithPaidAt } from './sales'
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

/**
 * Tin để mua (trang /cho-sach-cu/[id]/mua): đọc theo request bằng client theo phiên, KHÔNG cache (không dùng
 * getMarketListing của trang tin: bản cache có thể cũ hơn tin thật vài giờ). `updated_at` đọc cùng lần với nội dung đang
 * hiện, gửi nguyên chuỗi vào place_used_order (so sau khi khóa tin). BẮT BUỘC lọc status: RLS cho người bán / admin đọc
 * cả tin chờ duyệt / bị từ chối / đã rút của mình. Không có → null. Sách ngừng bán: RLS của books ẩn dòng → book null.
 */
export async function getListingForPurchase(id: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('used_listings')
    // Không lấy giá tin: số tiền trang mua hiện lấy từ quote_used_order
    .select('id, seller_id, seller_name, condition, description, status, updated_at, books(title, cover_url, is_active)')
    .eq('id', id)
    .in('status', ['approved', 'sold'])
    .maybeSingle()
  if (error) throw new Error(`getListingForPurchase: ${error.message}`)
  if (!data) return null
  return {
    id: data.id,
    sellerId: data.seller_id,
    sellerName: data.seller_name,
    condition: data.condition,
    description: data.description,
    sold: data.status === 'sold',
    updatedAt: data.updated_at,
    book: data.books && {
      title: data.books.title,
      coverUrl: data.books.cover_url,
      active: data.books.is_active,
    },
  }
}

export type PurchaseListing = NonNullable<Awaited<ReturnType<typeof getListingForPurchase>>>

/**
 * Tin đã bán của người bán (đơn chưa hủy, mới nhất trước) + tiền sẽ nhận: RPC my_used_sales (không trả mã đơn, không
 * gì của người mua) + ngày trả của khoản đã trả (seller_payouts: quyền cột không có order_id). Lọc seller_id dù RLS đã
 * lọc: policy cho admin đọc mọi khoản. Một tin có tối đa một khoản (khoản chỉ ghi cho đơn đã giao, đơn đã giao không
 * hủy được) → ghép theo listing_id; ngày trả chỉ giữ khi trạng thái là "Đã trả" (saleStatusWithPaidAt). Theo phiên, không
 * cache.
 */
export async function getMySales(userId: string) {
  const supabase = await createClient()
  const [sales, payouts] = await Promise.all([
    supabase.rpc('my_used_sales'),
    supabase.from('seller_payouts').select('listing_id, paid_at').eq('seller_id', userId).eq('status', 'paid'),
  ])
  if (sales.error) throw new Error(`getMySales: ${sales.error.message}`)
  if (payouts.error) throw new Error(`getMySales (payouts): ${payouts.error.message}`)
  const paidAt = new Map(payouts.data.map((payout) => [payout.listing_id, payout.paid_at]))

  return sales.data.map((sale) => ({
    listingId: sale.listing_id,
    title: sale.title,
    price: sale.price,
    fee: sale.fee,
    amount: sale.amount,
    soldAt: sale.sold_at,
    ...saleStatusWithPaidAt({
      orderStatus: sale.order_status,
      paymentStatus: sale.payment_status,
      payoutStatus: sale.payout_status,
      paidAt: paidAt.get(sale.listing_id) ?? null,
    }),
  }))
}

export type MySale = Awaited<ReturnType<typeof getMySales>>[number]

/**
 * Tiền của đơn sách cũ (quote_used_order: giá tin + ship cố định, không voucher / freeship) + `available` (tin đang bán
 * và sách còn bán). Trang mua hiện đúng các số này, client không tự tính. Tin không có / không công khai → null.
 */
export async function getUsedOrderQuote(id: number) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('quote_used_order', { p_listing_id: id }).maybeSingle()
  if (error) throw new Error(`getUsedOrderQuote: ${error.message}`)
  return data
}

export type UsedOrderQuote = NonNullable<Awaited<ReturnType<typeof getUsedOrderQuote>>>
