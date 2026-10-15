import { z } from 'zod'
import type { ValidationKey } from '@/lib/errors'
import { slugify } from '@/lib/slug'

// Khối dựng schema cho form admin (chỉ import ở server: action + test). Form gửi mọi ô dạng chuỗi; ô số để trống
// → null. Lỗi là khóa validation (dùng chung hoặc admin.validation), hiện tại từng ô.

const error = (key: ValidationKey) => ({ error: key })

/** Id trong URL / tham số bind (đi qua client nên parse lại) */
export const rowIdSchema = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER)

export function requiredText(max: number, key: ValidationKey) {
  return z.string(error(key)).trim().min(1, error(key)).max(max, error(key))
}

/** Một dòng, không bắt buộc: rỗng sau khi trim → null */
export function optionalText(max: number, key: ValidationKey) {
  return z
    .string(error(key))
    .optional()
    .transform((value) => value?.trim() ?? '')
    .pipe(z.string().max(max, error(key)))
    .transform((value) => value || null)
}

// Số nguyên: chữ số, có thể có dấu nhóm hàng nghìn kiểu VN (98.000) hoặc Anh (98,000)
const INTEGER = /^-?\d{1,12}$|^\d{1,3}(?:[.,]\d{3})+$/

function parseInteger(value: string, min: number, max: number) {
  if (!INTEGER.test(value)) return null
  const number = Number(value.replace(/[.,]/g, ''))
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null
}

/** Số nguyên bắt buộc trong [min, max] */
export function integer(key: ValidationKey, min: number, max: number) {
  return z
    .string(error(key))
    .optional()
    .transform((value, ctx) => {
      const number = parseInteger(value?.trim() ?? '', min, max)
      if (number !== null) return number
      ctx.addIssue({ code: 'custom', message: key })
      return z.NEVER
    })
}

/** Số nguyên không bắt buộc trong [min, max]: rỗng → null */
export function optionalInteger(key: ValidationKey, min: number, max: number) {
  return z
    .string(error(key))
    .optional()
    .transform((value, ctx) => {
      const trimmed = value?.trim() ?? ''
      if (!trimmed) return null
      const number = parseInteger(trimmed, min, max)
      if (number !== null) return number
      ctx.addIssue({ code: 'custom', message: key })
      return z.NEVER
    })
}

/** Ô chọn: có trong FormData (`on`) = true, không có = false */
export const checkbox = z
  .string()
  .optional()
  .transform((value) => value !== undefined)

/** Slug người nhập (để trống → tạo từ `fallback`, VD tên), chuẩn hóa bằng slugify; không còn ký tự nào → lỗi */
export function resolveSlug(input: string | undefined, fallback: string, ctx: z.RefinementCtx) {
  const slug = slugify(input?.trim() || fallback)
  if (!slug) ctx.addIssue({ code: 'custom', path: ['slug'], message: 'slug' })
  return slug
}
