import { describe, expect, it } from 'vitest'
import type { BlockableBook, BlockRule } from '@/features/prefs/blocks'
import { chatBlocks, withoutBlocked } from './blocked'

// Lọc sách bị chặn cho Mây (câu 10): dùng chung expandBlocks / isBlocked của features/prefs/blocks.ts

/** 1 → 10, 11 (danh mục cha → con); 2 không có con */
const CATEGORIES = [
  { id: 1, parent_id: null },
  { id: 10, parent_id: 1 },
  { id: 11, parent_id: 1 },
  { id: 2, parent_id: null },
]

const book = (slug: string, overrides: Partial<BlockableBook> = {}): BlockableBook & { slug: string } => ({
  slug,
  category_id: 2,
  publisher_id: 20,
  content_warnings: [],
  book_authors: [{ role: 'author', author_id: 30 }],
  ...overrides,
})

const slugs = (books: readonly { slug: string }[]) => books.map((item) => item.slug)

describe('chatBlocks', () => {
  it('khách / đọc lỗi (null) và chưa chặn gì → null (không lọc)', () => {
    expect(chatBlocks(null, CATEGORIES)).toBeNull()
    expect(chatBlocks([], CATEGORIES)).toBeNull()
  })

  it('danh mục cha mở ra mọi danh mục con (câu 8)', () => {
    expect(chatBlocks([{ kind: 'category', id: 1 }], CATEGORIES)?.categoryIds).toEqual([1, 10, 11])
  })
})

describe('withoutBlocked', () => {
  const BOOKS = [
    book('o-danh-muc-con', { category_id: 11 }),
    book('o-danh-muc-khac'),
    book('tac-gia', { book_authors: [{ role: 'author', author_id: 31 }] }),
    book('dich-gia', {
      book_authors: [
        { role: 'translator', author_id: 31 },
        { role: 'illustrator', author_id: 31 },
        { role: 'author', author_id: 32 },
      ],
    }),
    book('nxb', { publisher_id: 21 }),
    book('nhan', { content_warnings: ['loss', 'self_harm'] }),
    book('nhan-khac', { content_warnings: ['loss'] }),
    book('thieu-khoa', { category_id: null, publisher_id: null, book_authors: [] }),
  ]

  it('null → giữ nguyên (bản sao, không đổi mảng gốc)', () => {
    const kept = withoutBlocked(BOOKS, null)
    expect(kept).toEqual(BOOKS)
    expect(kept).not.toBe(BOOKS)
  })

  it('chặn danh mục cha → bỏ sách ở danh mục con, giữ sách danh mục khác', () => {
    expect(slugs(withoutBlocked(BOOKS, chatBlocks([{ kind: 'category', id: 1 }], CATEGORIES)))).not.toContain('o-danh-muc-con')
    expect(slugs(withoutBlocked(BOOKS, chatBlocks([{ kind: 'category', id: 1 }], CATEGORIES)))).toHaveLength(BOOKS.length - 1)
  })

  it('câu 9: chặn tác giả chỉ bỏ sách có người đó ở vai trò author, dịch giả / minh họa không tính', () => {
    const kept = slugs(withoutBlocked(BOOKS, chatBlocks([{ kind: 'author', id: 31 }], CATEGORIES)))
    expect(kept).not.toContain('tac-gia')
    expect(kept).toContain('dich-gia')
  })

  it('NXB và nhãn: bỏ đúng sách mang khóa đó; sách thiếu khóa không bị bỏ', () => {
    const rules: BlockRule[] = [
      { kind: 'publisher', id: 21 },
      { kind: 'warning', warning: 'self_harm' },
    ]
    const kept = slugs(withoutBlocked(BOOKS, chatBlocks(rules, CATEGORIES)))
    expect(kept).toEqual(['o-danh-muc-con', 'o-danh-muc-khac', 'tac-gia', 'dich-gia', 'nhan-khac', 'thieu-khoa'])
  })

  it('giữ nguyên kiểu và thứ tự của phần tử (dòng catalog / dòng thẻ)', () => {
    const rows = [{ ...book('a'), title: 'A' }, { ...book('b', { publisher_id: 21 }), title: 'B' }]
    const kept = withoutBlocked(rows, chatBlocks([{ kind: 'publisher', id: 21 }], CATEGORIES))
    expect(kept).toEqual([rows[0]])
    expect(kept[0]?.title).toBe('A')
  })
})
