import { describe, expect, it } from 'vitest'
import { resolveSort, toQuery, withParams } from './catalog-params'
import { catalogParamsSchema } from './schemas'

const parse = (searchParams: Record<string, string | string[] | undefined>) => catalogParamsSchema.parse(searchParams)

describe('catalogParamsSchema', () => {
  it('URL rỗng → mặc định', () => {
    expect(parse({})).toEqual({ page: 1 })
  })

  it('giá trị hợp lệ được giữ', () => {
    expect(
      parse({ sort: 'price-asc', page: '3', price: '100-200', lang: 'en', cat: 'tieu-thuyet', stock: '1', q: ' Nam  Cao ' }),
    ).toEqual({ sort: 'price-asc', page: 3, price: '100-200', lang: 'en', cat: 'tieu-thuyet', stock: '1', q: 'nam cao' })
  })

  it('giá trị lạ → bỏ qua về mặc định, không throw', () => {
    expect(
      parse({ sort: 'cheapest', page: '-2', price: '50-60', lang: 'fr', cat: '../admin', stock: 'yes', q: 'a' }),
    ).toEqual({ page: 1 })
    expect(parse({ page: '1.5' }).page).toBe(1)
    expect(parse({ page: 'abc' }).page).toBe(1)
    expect(parse({ page: '99999999' }).page).toBe(1)
  })

  it('key lặp → lấy giá trị đầu', () => {
    expect(parse({ sort: ['newest', 'price-asc'], page: ['2', '5'] })).toEqual({ sort: 'newest', page: 2 })
  })
})

describe('resolveSort', () => {
  it('relevance chỉ hợp lệ ở tìm kiếm', () => {
    expect(resolveSort({ page: 1, sort: 'relevance' }, 'browse')).toBe('bestselling')
    expect(resolveSort({ page: 1, sort: 'relevance' }, 'search')).toBe('relevance')
    expect(resolveSort({ page: 1 }, 'search')).toBe('relevance')
    expect(resolveSort({ page: 1 }, 'browse')).toBe('bestselling')
  })
})

describe('withParams', () => {
  const current = { page: 4, sort: 'newest' as const, price: '0-100' as const }

  it('đổi filter hoặc sort → reset về trang 1', () => {
    expect(withParams(current, { lang: 'vi' })).toEqual({ ...current, lang: 'vi', page: 1 })
    expect(withParams(current, { sort: 'price-desc' }).page).toBe(1)
    expect(withParams(current, { price: undefined })).toEqual({ page: 1, sort: 'newest', price: undefined })
  })

  it('đổi trang → giữ filter', () => {
    expect(withParams(current, { page: 5 })).toEqual({ ...current, page: 5 })
  })
})

describe('toQuery', () => {
  it('bỏ giá trị mặc định: trang 1, sort mặc định của ngữ cảnh', () => {
    expect(toQuery({ page: 1, sort: 'bestselling' }, 'browse')).toEqual({})
    expect(toQuery({ page: 1, sort: 'relevance', q: 'nam cao' }, 'search')).toEqual({ q: 'nam cao' })
    expect(toQuery({ page: 1, sort: 'bestselling', q: 'nam cao' }, 'search')).toEqual({ q: 'nam cao', sort: 'bestselling' })
  })

  it('giữ filter và trang', () => {
    expect(toQuery({ page: 2, cat: 'tho', price: '300-up', lang: 'en', stock: '1', sort: 'newest' }, 'browse')).toEqual({
      cat: 'tho',
      price: '300-up',
      lang: 'en',
      stock: '1',
      sort: 'newest',
      page: '2',
    })
  })
})
