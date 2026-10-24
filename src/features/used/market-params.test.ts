import { describe, expect, it } from 'vitest'
import type { Category } from '@/features/books/queries'
import { marketFilter, marketHref, marketQuery, withMarketParams } from './market-params'
import { marketParamsSchema } from './schemas'

const category = (id: number, slug: string, parent_id: number | null = null): Category => ({
  id,
  parent_id,
  slug,
  name: slug,
  name_en: null,
  description: null,
  description_en: null,
  sort_order: 0,
})

// Danh sách công khai (RLS chỉ trả danh mục đang bật): gốc 1 (con 2, 3), gốc 4 không con; con 10 của gốc 9 đang ẩn
const CATEGORIES = [
  category(1, 'van-hoc'),
  category(2, 'tieu-thuyet', 1),
  category(3, 'truyen-ngan', 1),
  category(4, 'thieu-nhi'),
  category(10, 'e2e-con', 9),
]

const filter = (search: Record<string, string | string[]>) => marketFilter(marketParamsSchema.parse(search), CATEGORIES)

describe('marketParamsSchema (tham số URL của Chợ sách cũ)', () => {
  it('giá trị sai → mặc định, không throw', () => {
    expect(marketParamsSchema.parse({ cat: 'Van Hoc', book: '<x>', sort: 'bestselling', page: '0' })).toEqual({
      cat: undefined,
      book: undefined,
      sort: undefined,
      page: 1,
    })
    expect(marketParamsSchema.parse({ page: 'abc' }).page).toBe(1)
  })

  it('giá trị đúng giữ nguyên; key lặp lấy giá trị đầu', () => {
    expect(marketParamsSchema.parse({ cat: 'van-hoc', book: 'sapiens', sort: 'price-asc', page: '3' })).toEqual({
      cat: 'van-hoc',
      book: 'sapiens',
      sort: 'price-asc',
      page: 3,
    })
    expect(marketParamsSchema.parse({ sort: ['price-desc', 'newest'] }).sort).toBe('price-desc')
  })
})

describe('marketQuery / withMarketParams', () => {
  it('bỏ giá trị mặc định (sort newest, page 1) → mỗi trạng thái một URL', () => {
    expect(marketQuery({ sort: 'newest', page: 1 })).toEqual({})
    expect(marketQuery({ cat: 'van-hoc', book: 'sapiens', sort: 'price-asc', page: 2 })).toEqual({
      cat: 'van-hoc',
      book: 'sapiens',
      sort: 'price-asc',
      page: '2',
    })
  })

  it('đổi bộ lọc / sắp xếp → về trang 1; đổi trang giữ bộ lọc', () => {
    const current = { cat: 'van-hoc', sort: 'price-asc' as const, page: 3 }
    expect(withMarketParams(current, { sort: 'price-desc' })).toEqual({ cat: 'van-hoc', sort: 'price-desc', page: 1 })
    expect(withMarketParams(current, { page: 4 })).toEqual({ cat: 'van-hoc', sort: 'price-asc', page: 4 })
    expect(marketHref(withMarketParams(current, { cat: undefined }))).toEqual({
      pathname: '/used-books',
      query: { sort: 'price-asc' },
    })
  })
})

describe('marketFilter (lọc như /sach, quyết định 10: ẩn danh mục ẩn tin)', () => {
  it('không chọn danh mục → chỉ tin của sách thuộc cây đang hiện; chip là danh mục cha đang hiện', () => {
    const { input, parents } = filter({})
    expect(input.categoryIds).toBeUndefined()
    expect(input.visibleCategoryIds).toEqual([1, 2, 3, 4])
    expect(parents.map((c) => c.slug)).toEqual(['van-hoc', 'thieu-nhi'])
    expect(input.sort).toBe('newest')
  })

  it('danh mục cha → id các con; danh mục không con / lá → chính nó', () => {
    expect(filter({ cat: 'van-hoc' }).input).toMatchObject({ categoryIds: [2, 3], visibleCategoryIds: undefined })
    expect(filter({ cat: 'thieu-nhi' }).input.categoryIds).toEqual([4])
    expect(filter({ cat: 'truyen-ngan' }).input.categoryIds).toEqual([3])
  })

  it('cat là danh mục con của gốc đang ẩn / không có → bỏ qua, vẫn lọc danh mục ẩn', () => {
    for (const cat of ['e2e-con', 'khong-co']) {
      const { input, params } = filter({ cat })
      expect(params.cat, cat).toBeUndefined()
      expect(input.categoryIds, cat).toBeUndefined()
      expect(input.visibleCategoryIds, cat).toEqual([1, 2, 3, 4])
    }
  })

  it('book, sort, page đi thẳng vào đầu vào của query', () => {
    expect(filter({ book: 'sapiens', sort: 'price-desc', page: '2' }).input).toMatchObject({
      bookSlug: 'sapiens',
      sort: 'price-desc',
      page: 2,
    })
  })
})
