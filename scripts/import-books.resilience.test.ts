import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchLargeCovers,
  mapVolume,
  searchAll,
  writePreview,
  type BookInput,
  type Candidate,
  type CategoryStats,
} from './import-books'

const volume = (isbn: string) => ({
  id: `vol-${isbn}`,
  volumeInfo: {
    title: `Sách ${isbn}`,
    authors: ['Tác giả'],
    language: 'vi',
    industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }],
    imageLinks: { thumbnail: `https://books.google.com/books/content?id=${isbn}&zoom=1` },
  },
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const quotaExceeded = () =>
  new Response('{"error":{"message":"Quota exceeded for quota metric Queries per day"}}', { status: 429 })

function candidate(isbn: string): Candidate {
  const book = mapVolume(volume(isbn), 'tho')
  if (!book) throw new Error('fixture')
  return { book, volumeId: `vol-${isbn}`, previewable: true }
}

/** Các pha có sleep() giữa request → chạy với fake timers cho nhanh */
async function withTimers<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync()
  return promise
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('pha 2: fetchLargeCovers', () => {
  it('gặp 429 → dừng ngay, sách còn lại giữ cover_large = null', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ volumeInfo: { imageLinks: { large: 'http://books.google.com/books/publisher/content?id=a&zoom=4' } } }))
      .mockResolvedValueOnce(quotaExceeded())
    vi.stubGlobal('fetch', fetchMock)

    const [a, b, c] = [candidate('9780000000101'), candidate('9780000000102'), candidate('9780000000103')]
    await withTimers(fetchLargeCovers([a, b, c], 1e9, new Map<string, CategoryStats>()))

    expect(a.book.cover_large).toBe('https://books.google.com/books/publisher/content?id=a&zoom=4')
    expect(b.book.cover_large).toBeNull()
    expect(c.book.cover_large).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2) // không gọi thêm cho sách thứ 3
  })

  it('lỗi lẻ (404) của một cuốn → cuốn đó dùng ảnh nhỏ, các cuốn sau vẫn lấy tiếp', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ error: 'not found' }, 404))
        .mockResolvedValueOnce(json({ volumeInfo: { imageLinks: { medium: 'https://books.google.com/books/content?id=b&zoom=3' } } })),
    )
    const [a, b] = [candidate('9780000000201'), candidate('9780000000202')]
    await withTimers(fetchLargeCovers([a, b], 1e9, new Map<string, CategoryStats>()))

    expect(a.book.cover_large).toBeNull()
    expect(b.book.cover_large).toBe('https://books.google.com/books/content?id=b&zoom=3')
  })
})

describe('pha 1: searchAll', () => {
  it('gặp 429 → dừng search, giữ sách đã có, báo các danh mục chưa search xong', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json({ totalItems: 1, items: [volume('9780000000301')] }))
        .mockResolvedValueOnce(quotaExceeded()),
    )
    const { candidates, incomplete } = await withTimers(
      searchAll({ tho: ['q1'], 'tieu-thuyet': ['q2'], 'lich-su-dia-ly': ['q3'] }, new Map<string, CategoryStats>()),
    )

    expect(candidates.map((c) => c.book.isbn)).toEqual(['9780000000301'])
    expect(incomplete).toEqual(['tieu-thuyet', 'lich-su-dia-ly'])
  })
})

describe('writePreview', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'preview-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('0 sách → báo lỗi, giữ nguyên file cũ, không để lại .tmp', () => {
    const path = join(dir, 'preview.json')
    writeFileSync(path, '["OLD"]')

    expect(() => writePreview(path, [])).toThrow(/giữ nguyên/)
    expect(readFileSync(path, 'utf8')).toBe('["OLD"]')
    expect(existsSync(`${path}.tmp`)).toBe(false)
  })

  it('có sách → ghi qua .tmp rồi rename, đè file cũ', () => {
    const path = join(dir, 'preview.json')
    writeFileSync(path, '["OLD"]')
    const books: BookInput[] = [candidate('9780000000401').book]

    writePreview(path, books)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toHaveLength(1)
    expect(existsSync(`${path}.tmp`)).toBe(false)
  })
})
