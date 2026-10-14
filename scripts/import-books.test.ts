import { describe, expect, it } from 'vitest'
import {
  capPerCategory,
  dedupeEditions,
  dedupeSlugs,
  isLikelyPlaceholder,
  mapVolume,
  normalizeText,
  type BookInput,
  type Candidate,
} from './import-books'

const volume = (info: Record<string, unknown>) => ({
  id: 'v1',
  volumeInfo: {
    title: 'Mắt biếc',
    authors: ['Nguyễn Nhật Ánh'],
    language: 'vi',
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9786041000001' }],
    imageLinks: { thumbnail: 'http://books.google.com/books/content?id=x&zoom=1&edge=curl' },
    ...info,
  },
})

describe('mapVolume', () => {
  it('giữ sách tiếng Việt, ảnh nhỏ chuyển https và bỏ edge=curl', () => {
    const book = mapVolume(volume({}), 'tieu-thuyet')
    expect(book?.slug).toBe('mat-biec')
    expect(book?.cover_small).toBe('https://books.google.com/books/content?id=x&zoom=1')
    expect(book?.cover_large).toBeNull()
  })

  it('bỏ sách không phải tiếng Việt hoặc thiếu ngôn ngữ', () => {
    expect(mapVolume(volume({ language: 'en' }), 'tieu-thuyet')).toBeNull()
    expect(mapVolume(volume({ language: undefined }), 'tieu-thuyet')).toBeNull()
  })

  it('tên không slugify được → slug là ISBN viết thường', () => {
    const book = mapVolume(
      volume({ title: '!!!', industryIdentifiers: [{ type: 'ISBN_10', identifier: '604100000X' }] }),
      'tho',
    )
    expect(book?.slug).toBe('604100000x')
  })
})

describe('dedupeSlugs', () => {
  it('slug trùng với sách khác → thêm 4 số cuối ISBN (viết thường)', () => {
    const a = mapVolume(volume({}), 'tho')
    const b = mapVolume(volume({ industryIdentifiers: [{ type: 'ISBN_10', identifier: '604100002X' }] }), 'tho')
    if (!a || !b) throw new Error('fixture')
    const books: BookInput[] = dedupeSlugs([a, b])
    expect(books.map((x) => x.slug)).toEqual(['mat-biec', 'mat-biec-002x'])
  })
})

describe('isLikelyPlaceholder', () => {
  it('PNG nhẹ là trang lót; JPEG hoặc PNG nặng thì không', () => {
    expect(isLikelyPlaceholder({ type: 'image/png', bytes: Buffer.alloc(20_000) })).toBe(true)
    expect(isLikelyPlaceholder({ type: 'image/png', bytes: Buffer.alloc(120_000) })).toBe(false)
    expect(isLikelyPlaceholder({ type: 'image/jpeg', bytes: Buffer.alloc(9_000) })).toBe(false)
  })
})

describe('dedupeEditions', () => {
  const cand = (isbn: string, title: string, author: string, year: number | null, previewable: boolean): Candidate => {
    const book = mapVolume(
      volume({ title, authors: [author], industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }] }),
      'tieu-thuyet',
    )
    if (!book) throw new Error('fixture')
    return { book: { ...book, published_year: year }, volumeId: isbn, previewable }
  }

  it('cùng tên + tác giả đầu → giữ bản có xem trước, rồi bản mới nhất', () => {
    const old = cand('9780000000001', 'Mắt biếc', 'Nguyễn Nhật Ánh', 2015, false)
    const other = cand('9780000000002', 'Cho tôi xin một vé đi tuổi thơ', 'Nguyễn Nhật Ánh', 2008, false)
    const newer = cand('9780000000003', 'Mắt Biếc', 'Nguyễn Nhật Ánh', 2019, false)
    const preview = cand('9780000000004', 'Mắt biếc', 'Nguyễn Nhật Ánh', 2010, true)
    expect(dedupeEditions([old, other, newer]).map((c) => c.book.isbn)).toEqual(['9780000000002', '9780000000003'])
    expect(dedupeEditions([old, newer, preview]).map((c) => c.book.isbn)).toEqual(['9780000000004'])
  })

  it('cùng tên nhưng khác tác giả → giữ cả hai', () => {
    const a = cand('9780000000005', 'Tuyển tập', 'Thạch Lam', null, false)
    const b = cand('9780000000006', 'Tuyển tập', 'Nam Cao', null, false)
    expect(dedupeEditions([a, b])).toHaveLength(2)
  })
})

describe('capPerCategory', () => {
  it('lấy xoay vòng theo tác giả, tối đa max cuốn', () => {
    const make = (n: number, author: string): Candidate => {
      const book = mapVolume(
        volume({
          title: `Sách ${author} ${n}`,
          authors: [author],
          industryIdentifiers: [{ type: 'ISBN_13', identifier: `97800000${author.length}${String(n).padStart(4, '0')}` }],
        }),
        'tho',
      )
      if (!book) throw new Error('fixture')
      return { book, volumeId: book.isbn, previewable: false }
    }
    const input = [make(1, 'A'), make(2, 'A'), make(3, 'A'), make(1, 'BB'), make(1, 'CCC')]
    const kept = capPerCategory(input, 3).map((c) => c.book.title)
    expect(kept).toEqual(['Sách A 1', 'Sách BB 1', 'Sách CCC 1'])
  })
})

describe('normalizeText', () => {
  it('dấu thanh đứng trước dấu mũ/trăng → sửa thứ tự rồi ghép (NFC thôi không đủ)', () => {
    expect('Nguyẽ̂n'.normalize('NFC')).not.toBe('Nguyễn')
    expect(normalizeText('Nguyẽ̂n')).toBe('Nguyễn')
    expect(normalizeText('á̆')).toBe('ắ')
    expect(normalizeText('Nhật')).toBe('Nhật')
  })

  it('chuỗi đã đúng giữ nguyên (kể cả dạng NFD đúng thứ tự)', () => {
    for (const s of ['Nguyễn Nhật Ánh', 'Đắc Nhân Tâm', 'Tiếng Việt', 'Harry Potter']) {
      expect(normalizeText(s)).toBe(s)
      expect(normalizeText(s.normalize('NFD'))).toBe(s)
    }
  })

  it('mapVolume áp chuẩn hóa cho tên, tác giả; loại tên lỗi mã hóa', () => {
    const book = mapVolume(volume({ title: ' Mắt biếc ', authors: ['Nguyẽ̂n Nhật Ánh'] }), 'tho')
    expect(book?.authors).toEqual(['Nguyễn Nhật Ánh'])
    expect(mapVolume(volume({ title: 'L¿ch S¿ Vi¿t Nam' }), 'tho')).toBeNull()
    expect(mapVolume(volume({ title: 'Truy�n ngắn' }), 'tho')).toBeNull()
  })
})
