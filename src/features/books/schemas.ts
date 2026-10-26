import { z } from 'zod'

/**
 * Từ khóa tìm kiếm của /api/search và trang tìm kiếm (server). Palette (client) dùng normalizeSearchQuery
 * (search-input.ts, không zod), search-input.test.ts kiểm hai bên khớp nhau.
 * Gộp khoảng trắng + chữ thường để cùng một từ khóa ra cùng một URL → CDN cache trúng nhiều hơn
 * (search_books không phân biệt hoa thường).
 */
export const searchQuerySchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .transform((q) => q.replace(/\s+/g, ' ').toLowerCase())

/** Một kết quả gợi ý trong palette: hợp đồng JSON giữa /api/search và client (client kiểm bằng parseSearchResponse) */
export const searchHitSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  coverUrl: z.string().nullable(),
  authors: z.array(z.string()),
  /**
   * Khóa chặn theo sở thích (bookBlockKeys của prefs/blocks.ts, dữ liệu công khai): palette che dòng bị chặn ở client.
   * Không bắt buộc: CDN có thể còn phản hồi cũ chưa có trường này sau khi deploy → không che dòng đó.
   */
  blockKeys: z
    .object({
      categoryId: z.number().nullable(),
      publisherId: z.number().nullable(),
      authorIds: z.array(z.number()),
      warnings: z.array(z.string()),
    })
    .optional(),
})

export const searchResponseSchema = z.object({ ok: z.literal(true), data: z.array(searchHitSchema) })

export type SearchHit = z.infer<typeof searchHitSchema>

// ---------- Tham số URL của trang danh mục / tác giả / tìm kiếm ----------

export const SORTS = ['bestselling', 'newest', 'price-asc', 'price-desc', 'relevance'] as const
export const PRICE_RANGES = ['0-100', '100-200', '200-300', '300-up'] as const
export const BOOK_LANGUAGES = ['vi', 'en'] as const

/** searchParams có thể lặp key (`?a=1&a=2`) → chỉ lấy giá trị đầu */
const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value)
const optionalParam = <T extends z.ZodType>(schema: T) => z.preprocess(firstValue, schema.optional()).catch(undefined)

/**
 * Parse searchParams ở server. Giá trị sai → bỏ qua về mặc định, không throw (URL do người dùng sửa tay
 * không được làm vỡ trang). Mặc định của `sort` tùy trang nên để `undefined` ở đây (xem catalog-params.ts).
 */
export const catalogParamsSchema = z.object({
  sort: optionalParam(z.enum(SORTS)),
  page: z.preprocess(firstValue, z.coerce.number().int().min(1).max(10_000)).catch(1),
  price: optionalParam(z.enum(PRICE_RANGES)),
  lang: optionalParam(z.enum(BOOK_LANGUAGES)),
  cat: optionalParam(
    z
      .string()
      .max(100)
      .regex(/^[a-z0-9-]+$/),
  ),
  stock: z.preprocess(firstValue, z.literal('1').optional()).catch(undefined),
  q: optionalParam(searchQuerySchema),
})

export type CatalogParams = z.infer<typeof catalogParamsSchema>
export type Sort = (typeof SORTS)[number]
export type PriceRange = (typeof PRICE_RANGES)[number]
