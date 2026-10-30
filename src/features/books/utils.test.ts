import { describe, expect, it } from 'vitest'
import {
  discountPercent,
  fillShelf,
  homeShelves,
  inVisibleCategories,
  paginationRange,
  showRelatedShelf,
  splitParagraphs,
  truncateText,
  visibleBooksFilter,
  visibleCategoryIds,
} from './utils'

describe('discountPercent', () => {
  it('làm tròn % giảm', () => {
    expect(discountPercent(80_000, 100_000)).toBe(20)
    expect(discountPercent(98_000, 125_000)).toBe(22)
  })

  it('không có giá gốc hoặc không giảm → null', () => {
    expect(discountPercent(80_000, null)).toBeNull()
    expect(discountPercent(80_000, 80_000)).toBeNull()
    expect(discountPercent(80_000, 0)).toBeNull()
    expect(discountPercent(99_800, 100_000)).toBeNull()
  })
})

describe('paginationRange', () => {
  it('ít trang → hiện hết', () => {
    expect(paginationRange(1, 1)).toEqual([1])
    expect(paginationRange(2, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('nhiều trang → rút gọn hai phía', () => {
    expect(paginationRange(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10])
    expect(paginationRange(1, 10)).toEqual([1, 2, 'ellipsis', 10])
    expect(paginationRange(10, 10)).toEqual([1, 'ellipsis', 9, 10])
  })

  it('hở đúng một trang → hiện số thay vì "…"', () => {
    expect(paginationRange(4, 10)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 10])
  })

  it('không có trang nào → rỗng', () => {
    expect(paginationRange(1, 0)).toEqual([])
  })
})

describe('splitParagraphs', () => {
  it('tách theo dòng trống, bỏ đoạn rỗng', () => {
    expect(splitParagraphs('Một\n\nHai\ndòng\n \n\nBa ')).toEqual(['Một', 'Hai\ndòng', 'Ba'])
  })

  it('null hoặc rỗng → []', () => {
    expect(splitParagraphs(null)).toEqual([])
    expect(splitParagraphs('  ')).toEqual([])
  })
})

describe('truncateText', () => {
  it('ngắn hơn giới hạn → giữ nguyên, chỉ gộp khoảng trắng', () => {
    expect(truncateText('  Một\n\nhai  ba ', 160)).toBe('Một hai ba')
  })

  it('dài → cắt ở ranh giới từ, bỏ dấu câu cuối, thêm "…"', () => {
    const result = truncateText('Một cuốn sách hay, kể về tuổi thơ ở miền quê.', 30)
    expect(result).toBe('Một cuốn sách hay, kể về tuổi…')
    expect(result.length).toBeLessThanOrEqual(30)
  })
})

describe('fillShelf', () => {
  const books = (...ids: number[]) => ids.map((id) => ({ id }))

  it('bìa nét trước, lấp đủ bằng danh sách thường, không trùng id', () => {
    expect(fillShelf(books(5, 2), books(1, 2, 3, 4, 5), 4).map((b) => b.id)).toEqual([5, 2, 1, 3])
  })

  it('đủ sách bìa nét thì không lấy thêm', () => {
    expect(fillShelf(books(1, 2, 3), books(4, 5), 3).map((b) => b.id)).toEqual([1, 2, 3])
  })

  it('không có bìa nét (chưa đo / trước migration) → giữ thứ tự thường', () => {
    expect(fillShelf([], books(3, 1, 2), 12).map((b) => b.id)).toEqual([3, 1, 2])
  })

  it('bỏ id trong exclude (đã hiện ở kệ trên), vẫn lấp đủ bằng sách sau', () => {
    expect(fillShelf(books(5, 2), books(1, 2, 3, 4, 5), 3, new Set([5, 1])).map((b) => b.id)).toEqual([2, 3, 4])
  })
})

describe('homeShelves', () => {
  const books = (...ids: number[]) => ids.map((id) => ({ id }))
  const ids = (list: { id: number }[]) => list.map((b) => b.id)
  const source = (sharp: number[], all: number[]) => ({ sharp: books(...sharp), all: books(...all) })
  const empty = source([], [])
  const MIN = { featured: 2, bestselling: 3 }

  // 1–9: sách tiếng Việt, 21–29: sách tiếng Anh. Nổi bật trùng Ngoại văn ở 21, 22 (lỗi của đánh giá 2026-10-30)
  const sources = {
    featuredVi: source([2], [1, 2]),
    featured: source([21, 2], [22, 21, 1, 2]),
    bestselling: books(22, 3, 1, 4, 5),
    newArrivals: source([1, 6], [3, 1, 7, 6, 8]),
    foreign: source([21, 23], [22, 21, 24, 23]),
  }

  it('Nổi bật: sách tiếng Việt trước (bìa nét trước trong nhóm), rồi sách khác cùng quy tắc', () => {
    expect(ids(homeShelves(sources, 4, MIN).featured)).toEqual([2, 1, 21, 22])
  })

  it('không id nào lên hai kệ; kệ sau loại sách của kệ trên theo thứ tự Nổi bật → Bán chạy → Mới về → Ngoại văn', () => {
    const shelves = homeShelves(sources, 4, MIN)
    expect(ids(shelves.bestselling)).toEqual([3, 4, 5])
    expect(ids(shelves.newArrivals)).toEqual([6, 7, 8])
    expect(ids(shelves.foreign)).toEqual([23, 24])
    const all = Object.values(shelves).flatMap(ids)
    expect(new Set(all).size).toBe(all.length)
  })

  it('Bán chạy giữ thứ tự số bán (không xếp bìa nét lên trước)', () => {
    const shelves = homeShelves({ ...sources, featuredVi: empty, featured: empty, bestselling: books(9, 3, 7, 1) }, 4, MIN)
    expect(ids(shelves.bestselling)).toEqual([9, 3, 7, 1])
  })

  it('kệ dưới ngưỡng sau khi loại trùng thì ẩn, sách của nó không tính là đã hiện', () => {
    // Bán chạy còn 2 cuốn (3, 4) sau khi bỏ 1, 2 của Nổi bật → ẩn; Mới về vẫn nhận 3, 4
    const shelves = homeShelves(
      { ...sources, featured: empty, bestselling: books(1, 2, 3, 4), newArrivals: source([], [3, 4, 6]) },
      4,
      MIN,
    )
    expect(ids(shelves.featured)).toEqual([2, 1])
    expect(shelves.bestselling).toEqual([])
    expect(ids(shelves.newArrivals)).toEqual([3, 4, 6])
  })

  it('Nổi bật dưới ngưỡng thì ẩn; Mới về / Ngoại văn không có ngưỡng (rỗng thì trang tự ẩn)', () => {
    const shelves = homeShelves(
      { ...sources, featuredVi: source([], [1]), featured: source([], [1]), newArrivals: empty, foreign: source([], [21]) },
      4,
      MIN,
    )
    expect(shelves.featured).toEqual([])
    expect(ids(shelves.newArrivals)).toEqual([])
    expect(ids(shelves.foreign)).toEqual([21])
  })
})

describe('visibleCategoryIds', () => {
  it('giữ gốc đang hiện và con có cha đang hiện; bỏ con của gốc đang ẩn (gốc ẩn không có trong danh sách công khai)', () => {
    const categories = [
      { id: 1, parent_id: null },
      { id: 2, parent_id: 1 },
      { id: 3, parent_id: 1 },
      // Con đang hiện của gốc 9 đang ẩn (như danh mục test e2e)
      { id: 10, parent_id: 9 },
    ]
    expect(visibleCategoryIds(categories)).toEqual([1, 2, 3])
  })
})

describe('visibleBooksFilter', () => {
  it('sách thuộc danh mục đang hiện hoặc không có danh mục (★6c giữ nguyên)', () => {
    expect(visibleBooksFilter([1, 2, 3])).toBe('category_id.is.null,category_id.in.(1,2,3)')
  })

  it('không danh mục nào hiện → chỉ sách không có danh mục (không sinh `in.()` rỗng)', () => {
    expect(visibleBooksFilter([])).toBe('category_id.is.null')
  })
})

describe('inVisibleCategories', () => {
  it('bỏ sách thuộc danh mục ẩn / con của gốc ẩn, giữ sách không có danh mục', () => {
    const categories = [
      { id: 1, parent_id: null },
      { id: 2, parent_id: 1 },
      { id: 10, parent_id: 9 },
    ]
    const books = [
      { slug: 'hien', category_id: 2 },
      { slug: 'con-goc-an', category_id: 10 },
      { slug: 'danh-muc-an', category_id: 7 },
      { slug: 'khong-danh-muc', category_id: null },
    ]
    expect(inVisibleCategories(books, categories).map((book) => book.slug)).toEqual(['hien', 'khong-danh-muc'])
  })
})

describe('showRelatedShelf', () => {
  const categories = [
    { id: 1, parent_id: null },
    { id: 2, parent_id: 1 },
    { id: 10, parent_id: 9 },
  ]
  it('danh mục lá đang hiện → có kệ; con của gốc ẩn / không có danh mục → không', () => {
    expect(showRelatedShelf(2, categories)).toBe(true)
    expect(showRelatedShelf(10, categories)).toBe(false)
    expect(showRelatedShelf(undefined, categories)).toBe(false)
  })
})
