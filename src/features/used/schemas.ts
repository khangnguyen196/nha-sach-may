import { z } from 'zod'
import { searchQuerySchema } from '@/features/books/schemas'
import type { ValidationKey } from '@/lib/errors'
import { optionalMultilineText } from '@/lib/text-schema'
import { Constants } from '@/types/database'
import { MARKET_SORTS } from './market-params'

// Chỉ import ở server (actions.ts): form đăng / sửa tin là client leaf không kéo zod (CLAUDE.md → Hiệu năng). Form dùng
// thuộc tính HTML (maxLength…) cho phản hồi nhanh; kiểm tra thật ở đây và ở RPC (create / update_used_listing).

const error = (key: ValidationKey) => ({ error: key })

/** Mô tả tối đa 500 ký tự (= check của bảng used_listings) */
export const LISTING_DESCRIPTION_MAX = 500
/** 1–3 ảnh mỗi tin (= check của bảng used_listings) */
export const LISTING_PHOTOS_MAX = 3

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
/** `<seller_id>/<uuid>.webp` như used_check_listing_input; thư mục = người đang đăng nhập kiểm ở action */
export const LISTING_PHOTO_PATH = new RegExp(`^${UUID}/${UUID}\\.webp$`)

/** Thư mục đầu của đường dẫn ảnh (= id người bán) */
export function photoFolder(path: string) {
  return path.slice(0, path.indexOf('/'))
}

const positiveId = (key: ValidationKey) =>
  z
    .string(error(key))
    .trim()
    .regex(/^[1-9]\d{0,15}$/, error(key))
    .transform(Number)

/** Giá: số nguyên dương VND, chỉ chữ số (không nhận "25.000", "25000.5", "-1"); ≤ int4 của Postgres */
export const listingPriceSchema = z
  .string(error('listingPrice'))
  .trim()
  .regex(/^\d{1,10}$/, error('listingPrice'))
  .transform(Number)
  .pipe(z.number().int().min(1, error('listingPrice')).max(2_147_483_647, error('listingPrice')))

const listingFields = {
  condition: z.enum(Constants.public.Enums.used_condition, error('listingCondition')),
  price: listingPriceSchema,
  // .trim() của JS cắt cả xuống dòng / tab (btrim của RPC chỉ cắt dấu cách); rỗng → null
  description: optionalMultilineText(LISTING_DESCRIPTION_MAX, 'listingDescription'),
  photos: z
    .array(z.string().regex(LISTING_PHOTO_PATH, error('listingPhotos')), error('listingPhotos'))
    .min(1, error('listingPhotos'))
    .max(LISTING_PHOTOS_MAX, error('listingPhotos'))
    .refine((photos) => new Set(photos).size === photos.length, error('listingPhotos')),
}

export const createListingSchema = z.object({ book_id: positiveId('listingBook'), ...listingFields })
/** Sửa tin: không đổi sách (update_used_listing không nhận book_id) */
export const updateListingSchema = z.object(listingFields)

export type ListingInput = z.output<typeof updateListingSchema>

/** FormData của form đăng / sửa tin → object cho schema (ảnh là nhiều ô ẩn cùng tên `photos`) */
export function listingFormValues(formData: FormData) {
  const text = (name: string) => {
    const value = formData.get(name)
    return typeof value === 'string' ? value : undefined
  }
  return {
    book_id: text('book_id'),
    condition: text('condition'),
    price: text('price'),
    description: text('description'),
    photos: formData.getAll('photos').filter((value) => typeof value === 'string'),
  }
}

/** id tin (tham số bind / URL) */
export const listingIdSchema = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER)

/**
 * `updated_at` của bản tin đang hiển thị (ô ẩn `expected_updated_at` ở trang admin duyệt tin và trang mua): nguyên chuỗi
 * PostgREST trả về, không qua Date (mất micro giây → luôn lệch). VD `2026-10-24T05:05:00.123456+00:00`; phần lẻ của giây
 * bằng 0 thì Postgres bỏ hẳn (`2026-10-24T05:05:00+00:00`). Bắt buộc có múi giờ: RPC so với giá trị thật sau khi khóa
 * dòng, chuỗi không múi giờ sẽ được đọc theo múi giờ của phiên DB.
 */
export const expectedUpdatedAtSchema = z.iso.datetime({ offset: true })

/** Giá gửi từ ô giá để xem phí (quoteListing) */
export const quotePriceSchema = z.number().int().min(1).max(2_147_483_647)

/** Từ khóa tìm sách ở form đăng tin: cùng quy tắc với tìm kiếm của cửa hàng */
export const listingSearchSchema = searchQuerySchema

// ---------- Tham số URL của Chợ sách cũ (/cho-sach-cu) ----------

/** searchParams có thể lặp key (`?a=1&a=2`) → chỉ lấy giá trị đầu */
const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value)
const optionalParam = <T extends z.ZodType>(schema: T) => z.preprocess(firstValue, schema.optional()).catch(undefined)
const slugParam = z
  .string()
  .max(100)
  .regex(/^[a-z0-9-]+$/)

/** Như catalogParamsSchema của /sach: giá trị sai → bỏ qua về mặc định, không throw (URL sửa tay không làm vỡ trang) */
export const marketParamsSchema = z.object({
  cat: optionalParam(slugParam),
  book: optionalParam(slugParam),
  sort: optionalParam(z.enum(MARKET_SORTS)),
  page: z.preprocess(firstValue, z.coerce.number().int().min(1).max(10_000)).catch(1),
})
