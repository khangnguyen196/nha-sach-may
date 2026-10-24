import 'server-only'
import sharp, { type Metadata } from 'sharp'

/**
 * Ảnh tin sách cũ trước khi lưu vào bucket `used-listing-photos` (không công khai, chỉ nhận image/webp ≤ 1MB). Theo mẫu
 * lib/cover-image.ts. Bỏ mọi metadata (EXIF, GPS, ICC…): sharp mặc định không chép metadata sang ảnh ra, KHÔNG gọi
 * withMetadata / keepExif (ảnh chụp điện thoại thường có tọa độ GPS nơi chụp).
 */

/** Cạnh dài tối đa của ảnh lưu (px) */
export const LISTING_PHOTO_MAX_SIDE = 1200
/** = file_size_limit của bucket */
export const LISTING_PHOTO_MAX_BYTES = 1_048_576
/** File nhận từ form: mỗi lần gọi Server Action một ảnh, body tối đa 4.5MB (next.config.ts, giới hạn của Vercel) */
export const LISTING_PHOTO_INPUT_MAX_BYTES = 4 * 1024 * 1024
/** Chống ảnh bom (file nhỏ nhưng giải nén ra hàng trăm triệu điểm ảnh), như lib/cover-image.ts */
const MAX_INPUT_PIXELS = 40_000_000
/** Ảnh ra quá cỡ thì hạ dần chất lượng (hiếm: WebP 1200px q80 thường dưới 500KB) */
const QUALITIES = [80, 70, 60, 50, 40] as const

/** Định dạng nhận, xác định bằng nội dung file (không tin `file.type` / đuôi): JPEG, PNG, WebP */
function isAcceptedFormat({ format }: Metadata) {
  return format === 'jpeg' || format === 'png' || format === 'webp'
}

/**
 * JPEG / PNG / WebP → WebP cạnh dài ≤ 1200px (không phóng to), xoay theo EXIF, không metadata, ≤ `maxBytes`.
 * Không phải ảnh, định dạng khác (GIF, SVG, HEIC…), ảnh hỏng, quá nhiều điểm ảnh, hay hạ chất lượng vẫn quá cỡ → null.
 * `maxBytes` chỉ để Vitest thử nhánh hạ chất lượng.
 */
export async function toListingPhotoWebp(
  input: Buffer,
  { maxBytes = LISTING_PHOTO_MAX_BYTES }: { maxBytes?: number } = {},
): Promise<Buffer | null> {
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    if (!isAcceptedFormat(await image.metadata())) return null
    const resized = image.rotate().resize({
      width: LISTING_PHOTO_MAX_SIDE,
      height: LISTING_PHOTO_MAX_SIDE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    for (const quality of QUALITIES) {
      const data = await resized.clone().webp({ quality }).toBuffer()
      if (data.length <= maxBytes) return data
    }
    return null
  } catch {
    return null
  }
}
