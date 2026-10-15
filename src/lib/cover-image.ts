import sharp, { type Metadata } from 'sharp'

/**
 * Xử lý ảnh bìa trước khi lưu vào Storage `book-covers` (bucket chỉ nhận image/webp ≤ 1MB). Dùng chung cho
 * `scripts/import-books.ts` và upload bìa ở admin, nên không `server-only` (chỉ import ở server / script).
 */

export const COVER_WIDTH = 600
/** Giới hạn file gốc khi admin upload: body request của Vercel tối đa 4.5MB */
export const COVER_MAX_BYTES = 4 * 1024 * 1024
/** Chống ảnh bom (file nhỏ nhưng giải nén ra hàng trăm triệu điểm ảnh) */
const MAX_INPUT_PIXELS = 40_000_000

/** Định dạng nhận, xác định bằng nội dung file (không tin `file.type` / đuôi). AVIF được sharp báo là heif + av1. */
function isAcceptedFormat({ format, compression }: Metadata) {
  if (format === 'heif') return compression === 'av1'
  return format === 'jpeg' || format === 'png' || format === 'webp'
}

/**
 * Ảnh JPEG / PNG / WebP / AVIF → WebP rộng tối đa 600px (ảnh nhỏ hơn giữ nguyên cỡ: phóng to chỉ nặng hơn chứ không
 * nét hơn), xoay theo EXIF. Không phải ảnh, định dạng khác (GIF, SVG…), ảnh hỏng hoặc quá nhiều điểm ảnh → null.
 */
export async function toCoverWebp(input: Buffer): Promise<Buffer | null> {
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    if (!isAcceptedFormat(await image.metadata())) return null
    return await image
      .rotate()
      .resize({ width: COVER_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
  } catch {
    return null
  }
}
