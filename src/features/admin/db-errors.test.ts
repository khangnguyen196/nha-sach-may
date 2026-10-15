import { describe, expect, it } from 'vitest'
import { storageObjectPath, violatedUniqueConstraint } from './db-errors'

describe('violatedUniqueConstraint', () => {
  it('lấy tên constraint từ lỗi 23505', () => {
    expect(
      violatedUniqueConstraint({
        code: '23505',
        message: 'duplicate key value violates unique constraint "books_slug_key"',
      }),
    ).toBe('books_slug_key')
  })

  it('lỗi khác → null', () => {
    expect(violatedUniqueConstraint({ code: '23503', message: 'violates foreign key constraint "x"' })).toBeNull()
    expect(violatedUniqueConstraint({ message: 'fetch failed' })).toBeNull()
  })
})

describe('storageObjectPath', () => {
  const base = 'https://abc.supabase.co/storage/v1/object/public/book-covers/'

  it('URL trong bucket → đường dẫn object (bỏ query, giải mã)', () => {
    expect(storageObjectPath(`${base}9786041000001.webp`, base)).toBe('9786041000001.webp')
    expect(storageObjectPath(`${base}12-a1b2c3d4.webp?v=1`, base)).toBe('12-a1b2c3d4.webp')
    expect(storageObjectPath(`${base}b%C3%ACa.webp`, base)).toBe('bìa.webp')
  })

  it('không có bìa, URL ngoài bucket, đường dẫn lạ → null', () => {
    expect(storageObjectPath(null, base)).toBeNull()
    expect(storageObjectPath('https://books.google.com/x.jpg', base)).toBeNull()
    expect(storageObjectPath('https://abc.supabase.co/storage/v1/object/public/other/x.webp', base)).toBeNull()
    expect(storageObjectPath(base, base)).toBeNull()
    expect(storageObjectPath(`${base}../avatars/x.webp`, base)).toBeNull()
  })
})
