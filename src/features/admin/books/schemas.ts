import { z } from 'zod'
import { optionalMultilineText } from '@/lib/text-schema'
import { Constants } from '@/types/database'
import { contentWarningsSchema } from '../warnings/schemas'
import {
  checkbox,
  integer,
  optionalInteger,
  optionalText,
  requiredText,
  resolveSlug,
} from '../schemas'

export const BOOK_FORMATS = Constants.public.Enums.book_format
export const BOOK_LANGUAGES = ['vi', 'en'] as const
/** Vai trò trong book_authors (check constraint của bảng) */
export const AUTHOR_ROLES = ['author', 'translator', 'illustrator'] as const
export const MAX_AUTHOR_ROWS = 20

const MAX_ID = Number.MAX_SAFE_INTEGER

// ISBN-10 (có thể kết thúc bằng X) hoặc ISBN-13; cho phép gõ kèm gạch ngang / khoảng trắng, lưu dạng liền
const isbn = z
  .string({ error: 'isbn' })
  .optional()
  .transform((value) => (value ?? '').replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().regex(/^$|^\d{9}[\dX]$|^\d{13}$/, { error: 'isbn' }))
  .transform((value) => value || null)

const authorRow = z.object({ author_id: z.unknown(), role: z.unknown() })

/**
 * Các dòng tác giả của form (`author_id[]` + `author_role[]`). Dòng bỏ trống tác giả → bỏ qua; trùng (tác giả, vai
 * trò) → gộp. Id / vai trò sai (sửa tay HTML) → lỗi ô.
 */
const authors = z
  .array(authorRow)
  .max(MAX_AUTHOR_ROWS, { error: 'invalid' })
  .transform((rows, ctx) => {
    const unique = new Map<string, { author_id: number; role: (typeof AUTHOR_ROLES)[number] }>()
    for (const row of rows) {
      if (row.author_id === '' || row.author_id === undefined) continue
      const authorId = z.coerce.number().int().positive().max(MAX_ID).safeParse(row.author_id)
      const role = z.enum(AUTHOR_ROLES).safeParse(row.role)
      if (!authorId.success || !role.success) {
        ctx.addIssue({ code: 'custom', message: 'invalid' })
        return z.NEVER
      }
      unique.set(`${authorId.data}:${role.data}`, { author_id: authorId.data, role: role.data })
    }
    return [...unique.values()]
  })

export const bookFormSchema = z
  .object({
    title: requiredText(300, 'title'),
    subtitle: optionalText(300, 'subtitle'),
    slug: z.string().optional(),
    description: optionalMultilineText(10_000, 'description'),
    description_en: optionalMultilineText(10_000, 'description'),
    isbn,
    price: integer('price', 0, 100_000_000),
    original_price: optionalInteger('price', 0, 100_000_000),
    stock: integer('stock', 0, 100_000),
    category_id: integer('category', 1, MAX_ID),
    publisher_id: optionalInteger('invalid', 1, MAX_ID),
    published_year: optionalInteger('year', 1800, 2100),
    page_count: optionalInteger('positiveInt', 1, 100_000),
    weight_grams: optionalInteger('positiveInt', 1, 100_000),
    dimensions: optionalText(50, 'dimensions'),
    format: z.enum(BOOK_FORMATS, { error: 'invalid' }),
    language: z.enum(BOOK_LANGUAGES, { error: 'invalid' }),
    is_featured: checkbox,
    authors,
    // Nhãn cảnh báo: ô chọn + bản lúc mở form (ô ẩn). Form KHÔNG gửi content_warnings_reviewed_at: DB tự ghi thời điểm
    // xét khi nhãn đổi (trigger books_content_warnings)
    content_warnings: contentWarningsSchema.default([]),
    content_warnings_before: contentWarningsSchema.default([]),
  })
  .transform(({ slug, content_warnings, content_warnings_before, ...data }, ctx) => {
    // Cùng ràng buộc với check constraint của books (original_price >= price), báo tại ô thay vì lỗi DB
    if (data.original_price !== null && data.original_price < data.price) {
      ctx.addIssue({ code: 'custom', path: ['original_price'], message: 'originalPrice' })
    }
    // Chỉ ghi nhãn khi admin đổi trong form: lưu form mở từ trước (sửa giá…) không đè nhãn vừa duyệt ở /admin/canh-bao.
    // Hai mảng đã chuẩn hóa (thứ tự enum, không trùng) nên so theo chuỗi được
    const labelsChanged = content_warnings.join() !== content_warnings_before.join()
    return { ...data, slug: resolveSlug(slug, data.title, ctx), ...(labelsChanged && { content_warnings }) }
  })

export type BookFormInput = z.output<typeof bookFormSchema>

/** FormData của form sách → input cho schema: các dòng tác giả ghép từ hai mảng cùng thứ tự; ô nhãn lặp lại (getAll) */
export function bookFormInput(formData: FormData) {
  const authorIds = formData.getAll('author_id')
  const roles = formData.getAll('author_role')
  return {
    ...Object.fromEntries(formData),
    authors: authorIds.map((authorId, index) => ({ author_id: authorId, role: roles[index] })),
    content_warnings: formData.getAll('content_warnings'),
    content_warnings_before: formData.getAll('content_warnings_before'),
  }
}

/** Ẩn / hiện sách: giá trị bind sẵn ở trang (đi qua client nên parse lại) */
export const bookActiveSchema = z.boolean()
