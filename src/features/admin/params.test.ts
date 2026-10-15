import { describe, expect, it } from 'vitest'
import { authorListHref, authorListParamsSchema } from './authors/params'
import { bookListHref, bookListParamsSchema } from './books/params'

describe('bookListParamsSchema', () => {
  it('đọc bộ lọc hợp lệ', () => {
    expect(
      bookListParamsSchema.parse({ q: ' mắt biếc ', category: '12', status: 'hidden', stock: 'low', page: '3' }),
    ).toEqual({ q: 'mắt biếc', category: 12, status: 'hidden', stock: 'low', page: 3 })
  })

  it('giá trị lạ hoặc rỗng → bỏ qua, khóa lặp → lấy giá trị đầu', () => {
    expect(
      bookListParamsSchema.parse({ q: '  ', category: 'abc', status: 'deleted', stock: '', page: '-1' }),
    ).toEqual({ q: undefined, category: undefined, status: undefined, stock: undefined, page: undefined })
    expect(bookListParamsSchema.parse({ q: ['a', 'b'], page: ['2', '9'] })).toMatchObject({ q: 'a', page: 2 })
  })

  it('từ khóa quá 100 ký tự → bỏ qua', () => {
    expect(bookListParamsSchema.parse({ q: 'x'.repeat(101) }).q).toBeUndefined()
  })
})

describe('bookListHref', () => {
  const params = bookListParamsSchema.parse({ q: 'tâm', category: '5', page: '2' })

  it('giữ bộ lọc, mã hóa từ khóa', () => {
    expect(bookListHref(params)).toBe('/admin/sach?q=t%C3%A2m&category=5&page=2')
  })

  it('đổi bộ lọc về trang 1, trang 1 không ghi vào URL', () => {
    expect(bookListHref(params, { status: 'hidden', page: undefined })).toBe(
      '/admin/sach?q=t%C3%A2m&category=5&status=hidden',
    )
    expect(bookListHref(params, { page: 1 })).toBe('/admin/sach?q=t%C3%A2m&category=5')
  })

  it('không có bộ lọc → /admin/sach', () => {
    expect(bookListHref(bookListParamsSchema.parse({}))).toBe('/admin/sach')
  })
})

describe('authorListHref', () => {
  it('chỉ có từ khóa và trang', () => {
    const params = authorListParamsSchema.parse({ q: 'Nam Cao', page: '4', category: '1' })
    expect(authorListHref(params)).toBe('/admin/tac-gia?q=Nam+Cao&page=4')
  })
})
