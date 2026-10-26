import { describe, expect, it, vi } from 'vitest'
import type { BookCard } from '@/features/books/queries'
import { blockCss, bookSlotAttributes, expandBlocks, isBlocked, type BlockRule } from '@/features/prefs/blocks'
import { cssHidesSlot } from '@/features/prefs/css-match.test-helper'

// Thẻ tin ở Chợ sách cũ mang khóa chặn của sách catalog của tin (docs/plans/so-thich-canh-bao.md P-C, quyết định (4)
// vòng 12): chợ sách cũ không có e2e che (không tạo tin trên sách thật). listMarketListings chạy thật trên một client
// Supabase giả: client giả chỉ trả các cột của `books!inner(…)` có trong chuỗi select (bỏ khóa khỏi select → thẻ
// thiếu thuộc tính → test đỏ).

/** Một tin đã duyệt như DB trả (đủ cột); `books` bị cắt theo select của query */
const DB_BOOK = {
  id: 9,
  slug: 'mat-biec',
  title: 'Mắt biếc',
  category_id: 12,
  publisher_id: 3,
  content_warnings: ['adult', 'loss'],
  book_authors: [
    { role: 'author', author_id: 7, authors: { name: 'Nguyễn Nhật Ánh' } },
    { role: 'translator', author_id: 6, authors: { name: 'Dịch giả' } },
    { role: 'author', author_id: 5, authors: { name: 'Đồng tác giả' } },
  ],
}
const DB_LISTING = {
  id: 41,
  condition: 'good',
  price: 30_000,
  photos: ['seller/a.webp'],
  seller_name: 'Người bán',
  approved_at: '2026-10-20T00:00:00Z',
  books: DB_BOOK,
}

/** Tách danh sách cột cấp cao nhất của PostgREST select (`a, b(c, d), e`) */
function splitColumns(list: string): string[] {
  const columns: string[] = []
  let depth = 0
  let current = ''
  for (const char of list) {
    if (char === ',' && depth === 0) {
      columns.push(current.trim())
      current = ''
      continue
    }
    if (char === '(') depth++
    if (char === ')') depth--
    current += char
  }
  if (current.trim()) columns.push(current.trim())
  return columns
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** Chỉ giữ các cột có trong select (cột lồng `x(…)` cắt tiếp theo danh sách bên trong) */
function project(row: unknown, select: string): unknown {
  if (Array.isArray(row)) return row.map((item) => project(item, select))
  if (!isRecord(row)) return row
  const result: Record<string, unknown> = {}
  for (const column of splitColumns(select)) {
    const nested = /^([a-z_]+)(?:!inner)?\((.*)\)$/s.exec(column)
    const name = nested?.[1] ?? column
    result[name] = nested?.[2] === undefined ? row[name] : project(row[name], nested[2])
  }
  return result
}

const calls = vi.hoisted(() => ({ select: '' }))

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ cacheTag: () => {}, cacheLife: () => {} }))
vi.mock('./signed-urls', () => ({ signUsedPhotoUrls: async (_client: unknown, paths: string[]) => paths.map(() => null) }))
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => {
    const builder = {
      select: (columns: string) => {
        calls.select = columns
        return builder
      },
      eq: () => builder,
      in: () => builder,
      or: () => builder,
      order: () => builder,
      range: async () => ({ data: [project(DB_LISTING, calls.select)], count: 1, error: null }),
    }
    return { from: () => builder }
  },
}))

const { listMarketListings } = await import('./public-queries')

async function marketListing() {
  const { listings } = await listMarketListings({ sort: 'newest', page: 1 })
  const [listing] = listings
  if (!listing) throw new Error('listMarketListings không trả tin nào')
  return listing
}

/** Cùng cuốn ở dạng dữ liệu của BookCard (BOOK_CARD_COLUMNS: đủ cột thẻ sách) */
const BOOK_CARD: BookCard = {
  id: DB_BOOK.id,
  slug: DB_BOOK.slug,
  title: DB_BOOK.title,
  cover_url: null,
  price: 90_000,
  original_price: null,
  stock: 3,
  category_id: DB_BOOK.category_id,
  publisher_id: DB_BOOK.publisher_id,
  content_warnings: ['adult', 'loss'],
  book_authors: DB_BOOK.book_authors,
}

describe('listMarketListings: data-* chặn theo sở thích của thẻ tin', () => {
  it('select lấy khóa từ sách catalog của tin: danh mục, NXB, nhãn, tác giả (vai trò + id)', async () => {
    await marketListing()
    const books = /books!inner\((.*)\)/s.exec(calls.select)?.[1] ?? ''
    expect(splitColumns(books)).toEqual(expect.arrayContaining(['category_id', 'publisher_id', 'content_warnings']))
    expect(splitColumns(books).find((column) => column.startsWith('book_authors('))).toMatch(/^book_authors\(role, author_id/)
  })

  it('đủ c / a (chỉ vai trò author, tăng dần) / p / w (thứ tự enum)', async () => {
    const listing = await marketListing()
    expect(bookSlotAttributes(listing.book)).toEqual({
      'data-book-slot': '',
      'data-c': '12',
      'data-p': '3',
      'data-a': '5 7',
      'data-w': 'loss adult',
    })
  })

  it('khớp bookSlotAttributes của BookCard cho cùng cuốn', async () => {
    const listing = await marketListing()
    expect(bookSlotAttributes(listing.book)).toEqual(bookSlotAttributes(BOOK_CARD))
  })

  const CATEGORIES = [
    { id: 1, parent_id: null },
    { id: 12, parent_id: 1 },
    { id: 2, parent_id: null },
  ]
  const RULE_SETS: [string, BlockRule[], boolean][] = [
    ['danh mục cha', [{ kind: 'category', id: 1 }], true],
    ['danh mục khác', [{ kind: 'category', id: 2 }], false],
    ['tác giả vai trò author', [{ kind: 'author', id: 5 }], true],
    ['dịch giả không tính', [{ kind: 'author', id: 6 }], false],
    ['NXB', [{ kind: 'publisher', id: 3 }], true],
    ['nhãn', [{ kind: 'warning', warning: 'adult' }], true],
    ['nhãn khác', [{ kind: 'warning', warning: 'violence' }], false],
  ]

  it.each(RULE_SETS)('blockCss che thẻ tin như thẻ sách: %s', async (_, rules, hidden) => {
    const listing = await marketListing()
    const expanded = expandBlocks(rules, CATEGORIES)
    const css = blockCss(expanded)
    expect(cssHidesSlot(css, bookSlotAttributes(listing.book))).toBe(hidden)
    expect(cssHidesSlot(css, bookSlotAttributes(BOOK_CARD))).toBe(hidden)
    expect(isBlocked(listing.book, expanded)).toBe(hidden)
  })
})
