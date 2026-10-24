'use server'

import { randomUUID } from 'node:crypto'
import { refresh, updateTag } from 'next/cache'
import { after } from 'next/server'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { parseLocale } from '@/features/auth/schemas'
import { expireOrderBooks } from '@/features/orders/cache'
import { notifyOrder, ownRecipient } from '@/features/orders/emails'
import { getPathname, redirect } from '@/i18n/navigation'
import { getCurrentUser } from '@/lib/auth'
import { withMessage } from '@/lib/error-message'
import { invalidInput, toFailure, type Failure, type Result, type ValidationKey } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/public'
import { LISTING_PHOTO_INPUT_MAX_BYTES, toListingPhotoWebp } from './photos'
import { removeUnusedPhotos } from './photo-storage'
import {
  createListingSchema,
  LISTING_PHOTO_PATH,
  listingFormValues,
  listingIdSchema,
  listingSearchSchema,
  photoFolder,
  quotePriceSchema,
  updateListingSchema,
  usedOrderSchema,
  type ListingInput,
} from './schemas'
import { signUsedPhotoUrls, USED_PHOTO_BUCKET } from './signed-urls'
import { usedListingTags } from './tags'
import { uploadFailure } from './upload-errors'

// Chợ sách cũ, phần người bán (docs/plans/cho-sach-cu.md). locale / id do page bind sẵn (Server Action không đọc được
// next/root-params; tham số bind đi qua client nên vẫn parse lại). seller_id không bao giờ nhận từ client: RPC lấy
// auth.uid(), đường dẫn ảnh phải nằm trong thư mục của người đang đăng nhập.

const AUTH_REQUIRED: Failure = { ok: false, code: 'AUTH_REQUIRED' }
const PHOTOS_INVALID: Failure = { ok: false, code: 'LISTING_PHOTOS_INVALID' }

export type UploadedPhoto = { path: string; url: string | null }

/**
 * Tải MỘT ảnh lên (mỗi lần gọi một ảnh: body của mọi Server Action tối đa 4.5MB). Kiểm cỡ trước khi đọc, kiểm loại bằng
 * nội dung, nén về WebP bỏ EXIF / GPS (toListingPhotoWebp), lưu `<uid>/<uuid mới>.webp` bằng client theo phiên (policy
 * của bucket kiểm thư mục, mẫu tên, trần 30 ảnh). Trả đường dẫn + link ký để form xem trước.
 */
export async function uploadListingPhoto(_locale: Locale, formData: FormData): Promise<Result<UploadedPhoto>> {
  const user = await getCurrentUser()
  if (!user) return AUTH_REQUIRED
  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0 || file.size > LISTING_PHOTO_INPUT_MAX_BYTES) return PHOTOS_INVALID

  const webp = await toListingPhotoWebp(Buffer.from(await file.arrayBuffer()))
  if (!webp) return PHOTOS_INVALID

  const supabase = await createClient()
  const path = `${user.id}/${randomUUID()}.webp`
  try {
    const { error } = await supabase.storage
      .from(USED_PHOTO_BUCKET)
      .upload(path, webp, { contentType: 'image/webp', upsert: false })
    if (error) return uploadFailure(error)
  } catch (error) {
    console.error('uploadListingPhoto:', error)
    return { ok: false, code: 'NETWORK_ERROR' }
  }
  const [url] = await signUsedPhotoUrls(supabase, [path])
  return { ok: true, data: { path, url: url ?? null } }
}

/**
 * Bỏ một ảnh vừa tải lên khỏi form (chưa lưu tin): xóa ngay khỏi bucket để không chiếm trần 30 ảnh. Chỉ ảnh trong thư
 * mục của mình và không nằm trong tin chưa rút nào của mình (ảnh của tin đang sửa chỉ xóa sau khi lưu tin).
 */
export async function deleteListingPhoto(_locale: Locale, path: string): Promise<Result<null>> {
  const user = await getCurrentUser()
  if (!user) return AUTH_REQUIRED
  if (typeof path !== 'string' || !LISTING_PHOTO_PATH.test(path) || photoFolder(path) !== user.id) return PHOTOS_INVALID
  await removeUnusedPhotos(await createClient(), user.id, [path])
  return { ok: true, data: null }
}

/** Phí sàn + số tiền người bán nhận cho một mức giá (form hiện "bạn nhận được X ₫" bằng số của DB, không tự tính) */
export async function quoteListing(_locale: Locale, price: number): Promise<Result<{ fee: number; payout: number }>> {
  const parsed = quotePriceSchema.safeParse(price)
  if (!parsed.success) return { ok: false, code: 'LISTING_PRICE_INVALID' }
  if (!(await getCurrentUser())) return AUTH_REQUIRED
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('used_listing_quote', { p_price: parsed.data }).single()
  if (error) return toFailure(error)
  return { ok: true, data: { fee: data.fee, payout: data.payout } }
}

const RPC_FIELD_KEYS: Partial<Record<string, ValidationKey>> = {
  book_id: 'listingBook',
  condition: 'listingCondition',
  description: 'listingDescription',
}

/**
 * Lỗi RPC đăng / sửa tin → Result của form: giá vượt trần hiện dưới ô giá (giữ chữ đã gõ), dữ liệu sai (INVALID_INPUT
 * kèm `field`) dưới ô tương ứng, sách ngừng bán dịch sẵn kèm tên sách.
 */
async function listingFailure(
  locale: Locale,
  error: { message: string; details?: string | null; code?: string | null },
): Promise<Failure> {
  const failure = toFailure(error)
  if (failure.code === 'LISTING_PRICE_INVALID') return { ...failure, fieldErrors: { price: 'listingPriceMax' } }
  const field = failure.code === 'INVALID_INPUT' ? failure.details?.field : undefined
  const key = typeof field === 'string' ? RPC_FIELD_KEYS[field] : undefined
  if (typeof field === 'string' && key) return { ...failure, fieldErrors: { [field]: key } }
  if (failure.code === 'BOOK_UNAVAILABLE') return withMessage(locale, failure)
  return failure
}

/** Ảnh phải nằm trong thư mục của người đang đăng nhập (RPC cũng kiểm; báo sớm, không gọi DB) */
function ownPhotos(input: ListingInput, userId: string) {
  return input.photos.every((path) => photoFolder(path) === userId)
}

const rpcArgs = (input: ListingInput) => ({
  p_condition: input.condition,
  p_price: input.price,
  p_description: input.description ?? '',
  p_photos: input.photos,
})

function expireListing(listingId: number, bookId: number) {
  for (const tag of usedListingTags(listingId, bookId)) updateTag(tag)
}

/** Đăng tin (chờ duyệt) → về "Sách tôi bán" */
export async function createListing(locale: Locale, _prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const parsed = createListingSchema.safeParse(listingFormValues(formData))
  if (!parsed.success) return invalidInput(parsed.error)
  const user = await getCurrentUser()
  if (!user) return AUTH_REQUIRED
  if (!ownPhotos(parsed.data, user.id)) return PHOTOS_INVALID

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_used_listing', { p_book_id: parsed.data.book_id, ...rpcArgs(parsed.data) })
  if (error) return listingFailure(parseLocale(locale), error)
  return redirect({ href: '/account/my-listings', locale: parseLocale(locale) })
}

/**
 * Sửa tin (về chờ duyệt). Ảnh cũ không còn trong tin thì xóa sau khi lưu. RPC thành công → luôn làm mới cache của trang
 * công khai: trạng thái đọc trước RPC có thể đã cũ (admin duyệt tin giữa lúc đọc và lúc sửa → tin vừa công khai rồi về
 * chờ duyệt).
 */
export async function updateListing(
  locale: Locale,
  id: number,
  _prev: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const listingId = listingIdSchema.safeParse(id)
  if (!listingId.success) return { ok: false, code: 'LISTING_NOT_EDITABLE' }
  const parsed = updateListingSchema.safeParse(listingFormValues(formData))
  if (!parsed.success) return invalidInput(parsed.error)
  const user = await getCurrentUser()
  if (!user) return AUTH_REQUIRED
  if (!ownPhotos(parsed.data, user.id)) return PHOTOS_INVALID

  const supabase = await createClient()
  const before = await supabase
    .from('used_listings')
    .select('book_id, photos')
    .eq('id', listingId.data)
    .eq('seller_id', user.id)
    .maybeSingle()
  if (before.error) return toFailure(before.error)
  if (!before.data) return { ok: false, code: 'LISTING_NOT_EDITABLE' }

  const { error } = await supabase.rpc('update_used_listing', { p_id: listingId.data, ...rpcArgs(parsed.data) })
  if (error) return listingFailure(parseLocale(locale), error)

  expireListing(listingId.data, before.data.book_id)
  const kept = new Set(parsed.data.photos)
  await removeUnusedPhotos(
    supabase,
    user.id,
    before.data.photos.filter((path) => !kept.has(path)),
  )
  return redirect({ href: '/account/my-listings', locale: parseLocale(locale) })
}

/**
 * Rút tin chưa bán. Tin đã rút là trạng thái cuối → xóa ảnh của tin (trả lại chỗ trong trần 30 ảnh). RPC thành công →
 * luôn làm mới cache công khai (như updateListing: admin có thể vừa duyệt tin).
 */
export async function withdrawListing(_locale: Locale, id: number): Promise<Result<null>> {
  const listingId = listingIdSchema.safeParse(id)
  if (!listingId.success) return { ok: false, code: 'LISTING_NOT_EDITABLE' }
  const user = await getCurrentUser()
  if (!user) return AUTH_REQUIRED

  const supabase = await createClient()
  const before = await supabase
    .from('used_listings')
    .select('book_id, photos')
    .eq('id', listingId.data)
    .eq('seller_id', user.id)
    .maybeSingle()
  if (before.error) return toFailure(before.error)
  if (!before.data) return { ok: false, code: 'LISTING_NOT_EDITABLE' }

  const { error } = await supabase.rpc('withdraw_used_listing', { p_id: listingId.data })
  if (error) return toFailure(error)

  expireListing(listingId.data, before.data.book_id)
  await removeUnusedPhotos(supabase, user.id, before.data.photos)
  refresh()
  return { ok: true, data: null }
}

/** Một sách để chọn khi đăng tin. Không gửi giá lên server: trần giá chỉ để hiện, RPC tự đọc giá của sách */
export type ListingBookOption = {
  id: number
  title: string
  slug: string
  coverUrl: string | null
  author: string | null
  /** Trần giá = giá gốc của sách (coalesce(original_price, price)) */
  maxPrice: number
}

const SEARCH_LIMIT = 10

/** Tìm sách đang bán để đăng tin (RPC search_books, client anon: RLS chỉ trả sách đang bán) */
export async function searchBooksForListing(_locale: Locale, q: string): Promise<Result<ListingBookOption[]>> {
  const parsed = listingSearchSchema.safeParse(q)
  if (!parsed.success) return { ok: true, data: [] }
  if (!(await getCurrentUser())) return AUTH_REQUIRED

  const { data, error } = await createPublicClient()
    .rpc('search_books', { q: parsed.data })
    .select('id, title, slug, cover_url, price, original_price, book_authors(role, authors(name))')
    .eq('is_active', true)
    .range(0, SEARCH_LIMIT - 1)
  if (error) return toFailure(error)

  return {
    ok: true,
    data: data.map((book) => ({
      id: book.id,
      title: book.title,
      slug: book.slug,
      coverUrl: book.cover_url,
      author: book.book_authors.find((ba) => ba.role === 'author')?.authors?.name ?? null,
      maxPrice: book.original_price ?? book.price,
    })),
  }
}

// ---------- Mua một tin (/cho-sach-cu/[id]/mua) ----------

type Supabase = Awaited<ReturnType<typeof createClient>>

function redirectToBuyLogin(locale: Locale, listingId: number): never {
  const next = getPathname({ href: { pathname: '/used-books/[id]/buy', params: { id: String(listingId) } }, locale })
  return redirect({ href: { pathname: '/login', query: { next } }, locale })
}

/** Lỗi do tin / sách / địa chỉ vừa đổi: trang mua đang hiện bản cũ → làm mới cache công khai của tin + trang mua */
const STALE_PAGE_CODES = new Set(['LISTING_UNAVAILABLE', 'LISTING_OWN', 'BOOK_UNAVAILABLE', 'LISTING_CHANGED', 'INVALID_ADDRESS'])

/**
 * book_id của tin đọc lại ở server (không nhận từ client) để làm mới "Có N bản cũ" của sách. Tin không còn đọc được
 * (đã rút / bị gỡ: RLS chỉ cho người mua đọc tin đã duyệt / đã bán) → null: tag của tin đó đã được làm mới lúc rút / gỡ.
 */
async function listingBookId(supabase: Supabase, listingId: number) {
  const { data, error } = await supabase.from('used_listings').select('book_id').eq('id', listingId).maybeSingle()
  if (error) {
    console.error('listingBookId:', error.message)
    return null
  }
  return data?.book_id ?? null
}

async function usedOrderFailed(locale: Locale, supabase: Supabase, listingId: number, failure: Failure): Promise<Failure> {
  if (failure.code === 'AUTH_REQUIRED') redirectToBuyLogin(locale, listingId)
  if (failure.code === 'INVALID_INPUT') {
    // Ràng buộc của place_used_order trùng usedOrderSchema (chỉ ghi chú có ô) → hiện tại ô
    return failure.details?.field === 'note' ? { ok: false, code: 'INVALID_INPUT', fieldErrors: { note: 'note' } } : failure
  }
  // UNKNOWN / lỗi mạng / mã khác: KHÔNG làm mới trang → lần bấm lại giữ nguyên idempotency key (đơn có thể đã tạo mà
  // mất phản hồi: place_used_order trả đúng đơn đó)
  if (!STALE_PAGE_CODES.has(failure.code)) return withMessage(locale, failure)

  const bookId = await listingBookId(supabase, listingId)
  if (bookId !== null) for (const tag of usedListingTags(listingId, bookId)) updateTag(tag)
  // Trang render lại trạng thái thật: tin đã bán / của mình (không còn form), tổng + updated_at mới và key mới trong ô
  // ẩn (LISTING_CHANGED: đặt lại là mua bản đang hiện), địa chỉ còn lại
  refresh()

  if (failure.code === 'INVALID_ADDRESS') {
    const t = await getTranslations({ locale, namespace: 'checkout' })
    return { ...failure, message: t('addressGone') }
  }
  return withMessage(locale, failure)
}

/**
 * Đặt mua một tin (đơn riêng, không qua giỏ, không voucher). locale + id tin do page bind (đi qua client nên parse lại).
 * Client chỉ gửi địa chỉ, phương thức thanh toán, ghi chú, idempotency key, tổng + updated_at của bản tin đang hiện (để
 * place_used_order so); giá, phí ship, tổng do RPC tính. Xong → trang đặt hàng thành công như đơn thường.
 */
export async function placeUsedOrder(
  locale: Locale,
  listingId: number,
  _prev: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const safeLocale = parseLocale(locale)
  const id = listingIdSchema.safeParse(listingId)
  if (!id.success) return withMessage(safeLocale, { ok: false, code: 'LISTING_UNAVAILABLE' })
  const parsed = usedOrderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)
  const user = await getCurrentUser()
  if (!user) redirectToBuyLogin(safeLocale, id.data)

  const supabase = await createClient()
  const { data: order, error } = await supabase.rpc('place_used_order', {
    p_listing_id: id.data,
    p_address_id: parsed.data.address_id,
    p_expected_updated_at: parsed.data.expected_updated_at,
    p_payment_method: parsed.data.payment_method,
    p_note: parsed.data.note ?? undefined,
    // Gửi lại cùng key (double submit, mất phản hồi) → trả đúng đơn đã tạo
    p_idempotency_key: parsed.data.idempotency_key,
    p_expected_total: parsed.data.expected_total,
  })
  if (error) return usedOrderFailed(safeLocale, supabase, id.data, toFailure(error))

  // Tin → đã bán: chợ, trang tin, "Có N bản cũ" của sách
  await expireOrderBooks(supabase, order.id)
  // Gửi lại cùng key (đơn đã có) vẫn vào đây: email "đã nhận đơn" có thể gửi hai lần, chấp nhận (như placeOrder)
  after(async () => {
    const recipient = await ownRecipient(supabase, user)
    if (recipient) await notifyOrder(supabase, order.id, 'placed', recipient)
  })
  return redirect({
    href: { pathname: '/checkout/success/[code]', params: { code: order.order_code } },
    locale: safeLocale,
  })
}
