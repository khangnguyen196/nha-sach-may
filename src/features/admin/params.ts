import { z } from 'zod'

// Tham số URL của các danh sách admin. searchParams lặp khóa (?q=a&q=b) → lấy giá trị đầu; giá trị lạ → coi như
// không có (không lỗi trang).

export const ADMIN_PAGE_SIZE = 25

const single = (value: unknown) => (Array.isArray(value) ? value[0] : value)

export const searchParam = z.preprocess(
  single,
  z
    .string()
    .trim()
    .max(100)
    .optional()
    .catch(undefined)
    .transform((value) => value || undefined),
)

export const idParam = z.preprocess(single, z.coerce.number().int().positive().optional().catch(undefined))

export const pageParam = z.preprocess(single, z.coerce.number().int().min(1).max(1000).optional().catch(undefined))

export function enumParam<const T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess(single, z.enum(values).optional().catch(undefined))
}

/** Query string từ các giá trị có mặt (bỏ rỗng, bỏ `page` = 1) */
export function toSearch(values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === '' || (key === 'page' && value === 1)) continue
    query.set(key, String(value))
  }
  const search = query.toString()
  return search ? `?${search}` : ''
}
