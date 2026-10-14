import { describe, expect, it } from 'vitest'
import { discountPercent, paginationRange, splitParagraphs, truncateText } from './utils'

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
