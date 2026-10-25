import { describe, expect, it } from 'vitest'
import { invalidInput } from '@/lib/errors'
import { bookFormInput, bookFormSchema } from './schemas'

const valid = {
  title: '  Mắt biếc ',
  subtitle: '',
  slug: '',
  description: 'Dòng 1\r\nDòng 2',
  description_en: '',
  isbn: '978-604-1-00000-1',
  price: '98.000',
  original_price: '120000',
  stock: '12',
  category_id: '3',
  publisher_id: '',
  published_year: '2019',
  page_count: '',
  weight_grams: '',
  dimensions: '',
  format: 'paperback',
  language: 'vi',
  authors: [
    { author_id: '5', role: 'author' },
    { author_id: '', role: 'translator' },
    { author_id: '5', role: 'author' },
  ],
}

function fieldErrors(input: Record<string, unknown>) {
  const result = bookFormSchema.safeParse({ ...valid, ...input })
  return result.success ? {} : invalidInput(result.error).fieldErrors
}

describe('bookFormSchema', () => {
  it('chuẩn hóa: trim, rỗng → null, số có dấu nhóm, ISBN liền, slug từ tên, gộp dòng tác giả trùng', () => {
    expect(bookFormSchema.parse(valid)).toEqual({
      title: 'Mắt biếc',
      subtitle: null,
      slug: 'mat-biec',
      description: 'Dòng 1\nDòng 2',
      description_en: null,
      isbn: '9786041000001',
      price: 98_000,
      original_price: 120_000,
      stock: 12,
      category_id: 3,
      publisher_id: null,
      published_year: 2019,
      page_count: null,
      weight_grams: null,
      dimensions: null,
      format: 'paperback',
      language: 'vi',
      is_featured: false,
      authors: [{ author_id: 5, role: 'author' }],
    })
  })

  it('slug người nhập được chuẩn hóa; chỉ có ký tự đặc biệt → lỗi', () => {
    expect(bookFormSchema.parse({ ...valid, slug: ' Mắt Biếc (Tái bản) ' }).slug).toBe('mat-biec-tai-ban')
    expect(fieldErrors({ slug: '!!!', title: '???' })).toEqual({ slug: 'slug' })
  })

  it('nổi bật: có ô chọn trong form → true', () => {
    expect(bookFormSchema.parse({ ...valid, is_featured: 'on' }).is_featured).toBe(true)
  })

  it('giá ≥ 0, số nguyên', () => {
    expect(fieldErrors({ price: '-1' })).toEqual({ price: 'price' })
    expect(fieldErrors({ price: '12.5' })).toEqual({ price: 'price' })
    expect(fieldErrors({ price: '' })).toEqual({ price: 'price' })
    expect(bookFormSchema.parse({ ...valid, price: '0', original_price: '' }).price).toBe(0)
  })

  it('giá gốc < giá bán → lỗi tại ô giá gốc; bằng giá bán thì được', () => {
    expect(fieldErrors({ price: '100000', original_price: '99000' })).toEqual({ original_price: 'originalPrice' })
    expect(bookFormSchema.parse({ ...valid, price: '100000', original_price: '100000' }).original_price).toBe(100_000)
  })

  it('tồn kho ≥ 0', () => {
    expect(fieldErrors({ stock: '-3' })).toEqual({ stock: 'stock' })
    expect(bookFormSchema.parse({ ...valid, stock: '0' }).stock).toBe(0)
  })

  it('năm xuất bản 1800–2100', () => {
    expect(fieldErrors({ published_year: '1799' })).toEqual({ published_year: 'year' })
    expect(fieldErrors({ published_year: '2101' })).toEqual({ published_year: 'year' })
    expect(bookFormSchema.parse({ ...valid, published_year: '1800' }).published_year).toBe(1800)
  })

  it('ISBN 10 (đuôi X) hoặc 13 số', () => {
    expect(bookFormSchema.parse({ ...valid, isbn: '604-100000-x' }).isbn).toBe('604100000X')
    expect(fieldErrors({ isbn: '12345' })).toEqual({ isbn: 'isbn' })
  })

  it('bắt buộc tên và danh mục', () => {
    expect(fieldErrors({ title: '   ', slug: 'x' })).toEqual({ title: 'title' })
    expect(fieldErrors({ category_id: '' })).toEqual({ category_id: 'category' })
  })

  it('hình thức / ngôn ngữ / tác giả sửa tay sai giá trị → invalid', () => {
    expect(fieldErrors({ format: 'ebook' })).toEqual({ format: 'invalid' })
    expect(fieldErrors({ language: 'fr' })).toEqual({ language: 'invalid' })
    expect(fieldErrors({ authors: [{ author_id: '5', role: 'editor' }] })).toEqual({ authors: 'invalid' })
    expect(fieldErrors({ authors: [{ author_id: 'abc', role: 'author' }] })).toEqual({ authors: 'invalid' })
  })

  it('nhãn cảnh báo: chỉ ghi khi admin đổi so với lúc mở form (bỏ trùng, theo thứ tự enum); không có reviewed_at', () => {
    const labels = (input: Record<string, unknown>) => {
      const data = bookFormSchema.parse({ ...valid, ...input })
      return 'content_warnings' in data ? data.content_warnings : 'không ghi'
    }
    expect(labels({ content_warnings: ['self_harm', 'violence', 'self_harm'] })).toEqual(['violence', 'self_harm'])
    expect(labels({ content_warnings: ['loss', 'adult'], content_warnings_before: ['adult', 'loss'] })).toBe('không ghi')
    expect(labels({ content_warnings: [], content_warnings_before: ['loss'] })).toEqual([])
    expect(labels({})).toBe('không ghi')
    expect(Object.keys(bookFormSchema.parse({ ...valid, content_warnings: ['loss'] }))).not.toContain(
      'content_warnings_reviewed_at',
    )
  })

  it('nhãn lạ / quá 5 → lỗi tại ô nhãn', () => {
    expect(fieldErrors({ content_warnings: ['spoilers'] })).toEqual({ content_warnings: 'invalid' })
    expect(fieldErrors({ content_warnings: Array.from({ length: 6 }, () => 'loss') })).toEqual({ content_warnings: 'invalid' })
  })
})

describe('bookFormInput', () => {
  it('ghép author_id[] + author_role[] theo thứ tự', () => {
    const formData = new FormData()
    formData.set('title', 'Sách')
    formData.append('author_id', '1')
    formData.append('author_role', 'author')
    formData.append('author_id', '')
    formData.append('author_role', 'translator')
    expect(bookFormInput(formData)).toMatchObject({
      title: 'Sách',
      authors: [
        { author_id: '1', role: 'author' },
        { author_id: '', role: 'translator' },
      ],
    })
  })

  it('ô nhãn lặp lại → mảng (cả bản lúc mở form)', () => {
    const formData = new FormData()
    formData.append('content_warnings', 'violence')
    formData.append('content_warnings', 'loss')
    formData.append('content_warnings_before', 'loss')
    expect(bookFormInput(formData)).toMatchObject({
      content_warnings: ['violence', 'loss'],
      content_warnings_before: ['loss'],
    })
  })
})
