import { describe, expect, it } from 'vitest'
import { currentHref } from './locale-href'

describe('currentHref (LocaleSwitcher)', () => {
  it('query rỗng → bỏ hẳn (getPathname không ra dấu ? thừa)', () => {
    expect(currentHref('/', {}, {})).toEqual({ pathname: '/', query: undefined })
    expect(currentHref('/books/[slug]', { slug: 'sapiens' }, {})).toEqual({
      pathname: '/books/[slug]',
      params: { slug: 'sapiens' },
      query: undefined,
    })
  })

  it('giữ query khi có', () => {
    expect(currentHref('/books', {}, { page: ['2'], sort: ['price-asc'] })).toEqual({
      pathname: '/books',
      query: { page: ['2'], sort: ['price-asc'] },
    })
  })

  it('thiếu param của route động → về trang chủ', () => {
    expect(currentHref('/books/[slug]', {}, { page: ['2'] })).toEqual({ pathname: '/' })
    expect(currentHref('/account/orders/[code]', { code: ['a', 'b'] }, undefined)).toEqual({ pathname: '/' })
  })
})
