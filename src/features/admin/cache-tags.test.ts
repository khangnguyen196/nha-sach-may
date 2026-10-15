import { describe, expect, it } from 'vitest'
import { catalogTagsFor, type BookSnapshot } from './cache-tags'

const book: BookSnapshot = {
  id: 7,
  slug: 'mat-biec',
  title: 'Mắt biếc',
  subtitle: null,
  isbn: '9786041000001',
  language: 'vi',
  category_id: 3,
  price: 120_000,
  stock: 10,
  is_active: true,
  is_featured: false,
  authors: ['1:author'],
}

const bookTags = (patch: Partial<BookSnapshot>, before: Partial<BookSnapshot> = {}) =>
  catalogTagsFor({ kind: 'book', before: { ...book, ...before }, after: { ...book, ...before, ...patch } })

describe('catalogTagsFor: sách', () => {
  it('sửa tại chỗ (mô tả, giá cùng khoảng lọc, tồn kho vẫn còn) → chỉ book:{id}', () => {
    expect(bookTags({})).toEqual(['book:7'])
    expect(bookTags({ price: 150_000 })).toEqual(['book:7'])
    expect(bookTags({ stock: 1 })).toEqual(['book:7'])
  })

  it('ẩn sách → chỉ book:{id} (các danh sách đang chứa sách có tag của nó)', () => {
    expect(bookTags({ is_active: false })).toEqual(['book:7'])
  })

  it('hiện lại → thêm books (danh sách chưa chứa sách không có tag của nó)', () => {
    expect(bookTags({ is_active: true }, { is_active: false })).toEqual(['book:7', 'books'])
  })

  it('đang ẩn, sửa gì cũng chỉ book:{id}', () => {
    expect(bookTags({ slug: 'mat-biec-2', category_id: 9 }, { is_active: false })).toEqual(['book:7'])
  })

  it.each<[string, Partial<BookSnapshot>]>([
    ['đổi danh mục', { category_id: 4 }],
    ['đổi slug', { slug: 'mat-biec-moi' }],
    ['đổi nổi bật', { is_featured: true }],
    ['đổi tên (kết quả tìm kiếm)', { title: 'Mắt biếc (tái bản)' }],
    ['đổi ISBN', { isbn: '9786041000002' }],
    ['đổi ngôn ngữ (bộ lọc ngôn ngữ)', { language: 'en' }],
    ['đổi tác giả', { authors: ['1:author', '2:translator'] }],
    ['giá sang khoảng lọc khác', { price: 99_000 }],
    ['hết hàng (bộ lọc còn hàng)', { stock: 0 }],
  ])('%s → book:{id} + books', (_name, patch) => {
    expect(bookTags(patch)).toEqual(['book:7', 'books'])
  })

  it('tác giả cùng tập, khác thứ tự → không đổi', () => {
    expect(
      bookTags({ authors: ['2:translator', '1:author'] }, { authors: ['1:author', '2:translator'] }),
    ).toEqual(['book:7'])
  })

  it('có hàng trở lại → books', () => {
    expect(bookTags({ stock: 5 }, { stock: 0 })).toEqual(['book:7', 'books'])
  })
})

describe('catalogTagsFor: danh mục', () => {
  const category = { parent_id: 1, is_active: true }

  it('tạo mới hoặc sửa tên / mô tả / thứ tự → categories', () => {
    expect(catalogTagsFor({ kind: 'category', before: null, after: category })).toEqual(['categories'])
    expect(catalogTagsFor({ kind: 'category', before: category, after: category })).toEqual(['categories'])
  })

  it('ẩn / hiện hoặc đổi cha → categories + books', () => {
    expect(catalogTagsFor({ kind: 'category', before: category, after: { ...category, is_active: false } })).toEqual([
      'categories',
      'books',
    ])
    expect(catalogTagsFor({ kind: 'category', before: category, after: { ...category, parent_id: 2 } })).toEqual([
      'categories',
      'books',
    ])
  })
})

describe('catalogTagsFor: tác giả', () => {
  it('authors + book:{id} các sách của tác giả', () => {
    expect(catalogTagsFor({ kind: 'author', bookIds: [3, 5] })).toEqual(['authors', 'book:3', 'book:5'])
    expect(catalogTagsFor({ kind: 'author', bookIds: [] })).toEqual(['authors'])
  })
})
