import { describe, expect, it } from 'vitest'
import { invalidInput } from '@/lib/errors'
import { REVIEW_CONTENT_MAX, reviewSchema } from './schemas'

function fieldErrors(input: Record<string, unknown>) {
  const result = reviewSchema.safeParse(input)
  return result.success ? {} : invalidInput(result.error).fieldErrors
}

describe('reviewSchema', () => {
  it('ép số sao, cắt khoảng trắng nhận xét, rỗng → null', () => {
    expect(reviewSchema.parse({ rating: '5', content: '  Hay  ' })).toEqual({ rating: 5, content: 'Hay' })
    expect(reviewSchema.parse({ rating: '3', content: '   ' })).toEqual({ rating: 3, content: null })
    expect(reviewSchema.parse({ rating: '1' })).toEqual({ rating: 1, content: null })
  })

  it.each([[undefined], [''], ['0'], ['6'], ['4.5'], ['abc']])('số sao không hợp lệ (%j)', (rating) => {
    expect(fieldErrors({ rating })).toEqual({ rating: 'rating' })
  })

  it(`nhận xét tối đa ${REVIEW_CONTENT_MAX} ký tự (CRLF đếm như LF)`, () => {
    expect(reviewSchema.parse({ rating: '4', content: 'a'.repeat(REVIEW_CONTENT_MAX) }).content).toHaveLength(REVIEW_CONTENT_MAX)
    expect(fieldErrors({ rating: '4', content: 'a'.repeat(REVIEW_CONTENT_MAX + 1) })).toEqual({ content: 'reviewContent' })
    const lines = Array.from({ length: 400 }, () => 'abcd').join('\r\n')
    expect(reviewSchema.parse({ rating: '4', content: lines }).content).toHaveLength(1999)
  })
})
