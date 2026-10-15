import { describe, expect, it } from 'vitest'
import {
  approvedEntries,
  isImportCoverPath,
  judgeOpenLibraryImage,
  openLibraryObjectPath,
  readCoversPreview,
  type PreviewEntry,
} from './covers'

describe('isImportCoverPath', () => {
  it('chỉ nhận tên file của import: <isbn>.webp', () => {
    expect(isImportCoverPath('9786041000001.webp', '9786041000001')).toBe(true)
    // bìa admin đã thay
    expect(isImportCoverPath('42-0a1b2c3d.webp', '9786041000001')).toBe(false)
    // bìa Open Library đã áp dụng (chạy lại không thay lần nữa)
    expect(isImportCoverPath('ol-9786041000001-0a1b2c3d.webp', '9786041000001')).toBe(false)
    expect(isImportCoverPath('9786041000001.webp', null)).toBe(false)
    expect(isImportCoverPath(null, '9786041000001')).toBe(false)
  })
})

describe('judgeOpenLibraryImage', () => {
  it('nhận ảnh bìa đủ lớn, gấp đôi bìa cũ, tỉ lệ bìa sách', () => {
    expect(judgeOpenLibraryImage({ format: 'jpeg', width: 400, height: 600 }, 128)).toEqual({ ok: true })
  })

  it('loại ảnh < 300px hoặc không gấp đôi bìa hiện tại', () => {
    expect(judgeOpenLibraryImage({ format: 'jpeg', width: 280, height: 420 }, 128).ok).toBe(false)
    expect(judgeOpenLibraryImage({ format: 'jpeg', width: 320, height: 480 }, 200).ok).toBe(false)
  })

  it('loại tỉ lệ không phải bìa (vuông, quá dài) và định dạng lạ', () => {
    expect(judgeOpenLibraryImage({ format: 'jpeg', width: 500, height: 500 }, 128).ok).toBe(false)
    expect(judgeOpenLibraryImage({ format: 'jpeg', width: 300, height: 600 }, 128).ok).toBe(false)
    expect(judgeOpenLibraryImage({ format: 'gif', width: 400, height: 600 }, 128).ok).toBe(false)
    expect(judgeOpenLibraryImage({}, 128).ok).toBe(false)
  })
})

describe('openLibraryObjectPath', () => {
  it('tên mới mỗi lần, khác tên của import', () => {
    expect(openLibraryObjectPath('9780141036144', 'deadbeef')).toBe('ol-9780141036144-deadbeef.webp')
    expect(openLibraryObjectPath('9780141036144')).toMatch(/^ol-9780141036144-[0-9a-f]{8}\.webp$/)
  })
})

const entry = (patch: Partial<PreviewEntry>): PreviewEntry => ({
  id: 1,
  title: '1984',
  isbn: '9780141036144',
  language: 'en',
  old_url: 'https://x.supabase.co/storage/v1/object/public/book-covers/9780141036144.webp',
  old_width: 128,
  status: 'accepted',
  reason: null,
  file: '9780141036144.jpg',
  width: 400,
  height: 600,
  approved: true,
  note: null,
  ...patch,
})

describe('approvedEntries / readCoversPreview', () => {
  it('chỉ ghi mục đã nhận + đã duyệt + có file', () => {
    const entries = [
      entry({ id: 1 }),
      entry({ id: 2, approved: false }),
      entry({ id: 3, status: 'rejected' }),
      entry({ id: 4, file: null }),
    ]
    expect(approvedEntries(entries).map((e) => e.id)).toEqual([1])
  })

  it('file sửa tay sai dạng hoặc trùng id → lỗi', () => {
    expect(() => readCoversPreview(JSON.stringify([entry({}), entry({})]))).toThrow(/trùng/)
    expect(() => readCoversPreview(JSON.stringify([{ ...entry({}), approved: 'yes' }]))).toThrow(/không hợp lệ/)
    expect(readCoversPreview(JSON.stringify([entry({})]))).toHaveLength(1)
  })
})
