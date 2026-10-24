import { describe, expect, it } from 'vitest'
import { parseNotFoundKind } from './not-found-kind'

describe('parseNotFoundKind', () => {
  it('loại hợp lệ giữ nguyên, còn lại → trang chung', () => {
    expect(parseNotFoundKind('book')).toBe('book')
    expect(parseNotFoundKind('order')).toBe('order')
    expect(parseNotFoundKind('used-listing')).toBe('used-listing')
    expect(parseNotFoundKind('used-market')).toBe('used-market')
    expect(parseNotFoundKind('BOOK')).toBe('page')
    expect(parseNotFoundKind('<script>')).toBe('page')
    expect(parseNotFoundKind(null)).toBe('page')
    expect(parseNotFoundKind(undefined)).toBe('page')
  })
})
