import { z } from 'zod'
import { optionalMultilineText } from '@/lib/text-schema'

// Chỉ import ở server (zod không vào bundle client); form client nhận REVIEW_CONTENT_MAX qua props.

/** Cùng giới hạn với ràng buộc reviews_content_length trong schema.sql */
export const REVIEW_CONTENT_MAX = 2000

const rating = { error: 'rating' } as const

export const reviewSchema = z.object({
  rating: z.coerce.number(rating).int(rating).min(1, rating).max(5, rating),
  content: optionalMultilineText(REVIEW_CONTENT_MAX, 'reviewContent'),
})

export const bookIdSchema = z.number().int().positive()
