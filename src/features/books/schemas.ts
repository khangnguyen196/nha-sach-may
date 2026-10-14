import { z } from 'zod'

/**
 * Từ khóa tìm kiếm, dùng chung palette (client) và /api/search (server).
 * Gộp khoảng trắng + chữ thường để cùng một từ khóa ra cùng một URL → CDN cache trúng nhiều hơn
 * (search_books không phân biệt hoa thường).
 */
export const searchQuerySchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .transform((q) => q.replace(/\s+/g, ' ').toLowerCase())

/** Một kết quả gợi ý trong palette: hợp đồng JSON giữa /api/search và client */
export const searchHitSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  coverUrl: z.string().nullable(),
  authors: z.array(z.string()),
})

export const searchResponseSchema = z.object({ ok: z.literal(true), data: z.array(searchHitSchema) })

export type SearchHit = z.infer<typeof searchHitSchema>
