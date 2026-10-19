import { describe, expect, it } from 'vitest'
import { withCategoryFilter } from './listing'
import type { Category } from './queries'
import { catalogParamsSchema } from './schemas'

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

// Danh sách công khai (RLS chỉ trả danh mục is_active): gốc 1 (con 2, 3); con 10 của gốc 9 đang ẩn (như dữ liệu e2e)
const CATEGORIES = [category(1, 'van-hoc'), category(2, 'tieu-thuyet', 1), category(3, 'truyen-ngan', 1), category(10, 'e2e-con', 9)]

const filter = (search: Record<string, string>, context: 'browse' | 'search' = 'browse') =>
  withCategoryFilter(catalogParamsSchema.parse(search), CATEGORIES, context)

describe('withCategoryFilter (docs/plans/sau-ux.md mục 6)', () => {
  it('không chọn danh mục → chỉ sách thuộc cây đang hiện', () => {
    const { input, parents } = filter({})
    expect(input.categoryIds).toBeUndefined()
    expect(input.visibleCategoryIds).toEqual([1, 2, 3])
    expect(parents.map((c) => c.slug)).toEqual(['van-hoc'])
  })

  it('chọn danh mục cha đang hiện → id các con, không cần lọc thêm', () => {
    const { input, params } = filter({ cat: 'van-hoc' })
    expect(params.cat).toBe('van-hoc')
    expect(input.categoryIds).toEqual([2, 3])
    expect(input.visibleCategoryIds).toBeUndefined()
  })

  it('cat là danh mục con của gốc đang ẩn → bỏ qua như không có, vẫn lọc danh mục ẩn', () => {
    const { input, params } = filter({ cat: 'e2e-con' })
    expect(params.cat).toBeUndefined()
    expect(input.categoryIds).toBeUndefined()
    expect(input.visibleCategoryIds).toEqual([1, 2, 3])
  })

  it('tìm kiếm giữ từ khóa và cùng bộ lọc', () => {
    const { input } = filter({ q: 'nguyen' }, 'search')
    expect(input.q).toBe('nguyen')
    expect(input.visibleCategoryIds).toEqual([1, 2, 3])
  })
})
