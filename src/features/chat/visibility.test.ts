import { describe, expect, it } from 'vitest'
import { currentBookSlug, isChatHidden } from './visibility'

describe('isChatHidden', () => {
  it.each([
    '/checkout',
    '/checkout/success/[code]',
    '/checkout/success/NS2026101800001',
    '/used-books/[id]/buy',
    '/used-books/12/buy',
  ])('%s → ẩn', (pathname) => {
    expect(isChatHidden(pathname)).toBe(true)
  })

  it.each([
    '/',
    '/books',
    '/books/[slug]',
    '/cart',
    '/categories/[slug]',
    '/search',
    '/account',
    '/checkoutx',
    '/used-books',
    '/used-books/[id]',
    '/used-books/12',
    '/used-books/12/buyx',
    '/used-books/buy',
  ])('%s → hiện', (pathname) => {
    expect(isChatHidden(pathname)).toBe(false)
  })
})

describe('currentBookSlug', () => {
  it('trang sách (pathname mẫu hoặc đã điền) → slug', () => {
    expect(currentBookSlug('/books/[slug]', { slug: 'sapiens', locale: 'vi' })).toBe('sapiens')
    expect(currentBookSlug('/books/sapiens', { slug: 'sapiens' })).toBe('sapiens')
  })

  it('trang khác (kể cả danh mục / tác giả có slug) → null', () => {
    expect(currentBookSlug('/categories/[slug]', { slug: 'van-hoc' })).toBeNull()
    expect(currentBookSlug('/authors/[slug]', { slug: 'x' })).toBeNull()
    expect(currentBookSlug('/books', {})).toBeNull()
    expect(currentBookSlug('/books/[slug]', {})).toBeNull()
  })
})
