import { describe, expect, it } from 'vitest'
import { CONTENT_WARNINGS } from '@/features/warnings/labels'
import {
  blockCss,
  bookSlotAttributes,
  expandBlocks,
  isBlocked,
  parseBlockRow,
  parseBlockRows,
  type BlockableBook,
  type BlockRule,
  type ExpandedBlocks,
} from './blocks'

const NONE: ExpandedBlocks = { categoryIds: [], authorIds: [], publisherIds: [], warnings: [] }

/** Ký tự được phép trong CSS sinh ra: không `<`, `/`, `\`, `'`, `;`, khoảng trắng, chữ hoa (câu 3b) */
const CSS_CHARSET = /^[a-z0-9_\-[\]"=~:(),>{}]*$/

/** Toàn bộ khung CSS: đúng 2 quy tắc (link ẩn, ô mờ hiện), mỗi điều kiện là id số hoặc nhãn chữ thường */
const CONDITION = String.raw`\[data-(?:c|p)="[1-9]\d*"\]|\[data-a~="[1-9]\d*"\]|\[data-w~="[a-z_]+"\]`
const RULE = String.raw`\[data-book-slot\]:is\((?:${CONDITION})(?:,(?:${CONDITION}))*\):not\(\[data-revealed\]\)`
const CSS_SHAPE = new RegExp(
  String.raw`^${RULE}>\[data-book-link\]\{visibility:hidden\}${RULE}>\[data-book-veil\]\{display:flex\}$`,
)

const book = (overrides: Partial<BlockableBook> = {}): BlockableBook => ({
  category_id: 10,
  publisher_id: 20,
  content_warnings: [],
  book_authors: [{ role: 'author', author_id: 30 }],
  ...overrides,
})

describe('parseBlockRow: dòng user_blocks có kiểm (câu 3b)', () => {
  it('nhận dòng đúng của 4 kind', () => {
    expect(parseBlockRow({ kind: 'category', category_id: 12, author_id: null, publisher_id: null, warning: null })).toEqual({
      kind: 'category',
      id: 12,
    })
    expect(parseBlockRow({ kind: 'author', author_id: 5 })).toEqual({ kind: 'author', id: 5 })
    expect(parseBlockRow({ kind: 'publisher', publisher_id: 3 })).toEqual({ kind: 'publisher', id: 3 })
    expect(parseBlockRow({ kind: 'warning', warning: 'adult' })).toEqual({ kind: 'warning', warning: 'adult' })
  })

  it.each([
    ['chuỗi số', '12'],
    ['số âm', -1],
    ['0', 0],
    ['NaN', Number.NaN],
    ['số lẻ', 1.5],
    ['1e21', 1e21],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['chuỗi chèn selector', '1"]{}'],
    ['chuỗi đóng thẻ style', '</style>'],
    ['null', null],
  ])('bỏ id bẩn: %s', (_, id) => {
    for (const kind of ['category', 'author', 'publisher'] as const) {
      expect(parseBlockRow({ kind, [`${kind}_id`]: id }), kind).toBeNull()
    }
  })

  it('bỏ nhãn ngoài enum, kind lạ, dòng không phải object, id nằm sai cột', () => {
    for (const warning of ['evil', 'ADULT', 'adult"]{}', '</style>', '', null, 1]) {
      expect(parseBlockRow({ kind: 'warning', warning }), String(warning)).toBeNull()
    }
    expect(parseBlockRow({ kind: 'tag', category_id: 1 })).toBeNull()
    expect(parseBlockRow({ kind: 'category', author_id: 1, category_id: null })).toBeNull()
    for (const row of [null, undefined, 'category', 12, []]) expect(parseBlockRow(row)).toBeNull()
  })

  it('parseBlockRows giữ dòng đúng, bỏ dòng sai, không throw', () => {
    expect(
      parseBlockRows([
        { kind: 'author', author_id: 5 },
        { kind: 'author', author_id: '5' },
        null,
        { kind: 'warning', warning: 'loss' },
      ]),
    ).toEqual([
      { kind: 'author', id: 5 },
      { kind: 'warning', warning: 'loss' },
    ])
  })
})

describe('blockCss (câu 3b: chỉ id số nguyên + nhãn enum)', () => {
  it('không có mục → chuỗi rỗng', () => {
    expect(blockCss(NONE)).toBe('')
  })

  it('đầu vào bẩn bị loại: chỉ còn id hợp lệ và nhãn enum, ký tự trong danh sách cho phép', () => {
    const css = blockCss({
      categoryIds: [Number.NaN, -1, 0, 1.5, 1e21, Number.POSITIVE_INFINITY, 7],
      authorIds: [-5, 2 ** 53],
      publisherIds: [0.5],
      warnings: ['</style>', '1"]{}', 'ADULT', 'adult', 'x y'],
    })
    expect(css).toMatch(CSS_CHARSET)
    expect(css).toMatch(CSS_SHAPE)
    expect(css).toContain('[data-c="7"]')
    expect(css).toContain('[data-w~="adult"]')
    expect(css.match(/\[data-/g)).toHaveLength(2 * 4 + 2) // 2 quy tắc × (slot + c + w + revealed) + link / veil
    expect(css).not.toContain('</')
  })

  it('toàn đầu vào bẩn → chuỗi rỗng (không render <style>)', () => {
    expect(
      blockCss({ categoryIds: [Number.NaN, 0], authorIds: [-1], publisherIds: [1.5], warnings: ['</style>', 'evil'] }),
    ).toBe('')
  })

  it('selector đúng dạng cho đủ 4 kind', () => {
    const css = blockCss({ categoryIds: [12], authorIds: [5], publisherIds: [3], warnings: ['adult'] })
    expect(css).toBe(
      '[data-book-slot]:is([data-c="12"],[data-a~="5"],[data-p="3"],[data-w~="adult"]):not([data-revealed])>[data-book-link]{visibility:hidden}' +
        '[data-book-slot]:is([data-c="12"],[data-a~="5"],[data-p="3"],[data-w~="adult"]):not([data-revealed])>[data-book-veil]{display:flex}',
    )
    expect(css).toMatch(CSS_CHARSET)
    expect(css).toMatch(CSS_SHAPE)
  })
})

describe('expandBlocks (câu 8: chặn danh mục cha = chặn mọi danh mục con)', () => {
  // 1 → 2 → 4 → 6, 1 → 3; 5 riêng; 7 ↔ 8 (dữ liệu vòng)
  const categories = [
    { id: 1, parent_id: null },
    { id: 2, parent_id: 1 },
    { id: 3, parent_id: 1 },
    { id: 4, parent_id: 2 },
    { id: 5, parent_id: null },
    { id: 6, parent_id: 4 },
    { id: 7, parent_id: 8 },
    { id: 8, parent_id: 7 },
  ]

  it('cha → mọi lá con cháu (nhiều cấp), kể cả chính nó', () => {
    expect(expandBlocks([{ kind: 'category', id: 1 }], categories).categoryIds).toEqual([1, 2, 3, 4, 6])
    expect(expandBlocks([{ kind: 'category', id: 2 }], categories).categoryIds).toEqual([2, 4, 6])
    expect(expandBlocks([{ kind: 'category', id: 5 }], categories).categoryIds).toEqual([5])
  })

  it('dữ liệu vòng không lặp vô hạn; trùng bị gộp, xếp tăng dần', () => {
    const rules: BlockRule[] = [
      { kind: 'category', id: 7 },
      { kind: 'category', id: 4 },
      { kind: 'category', id: 2 },
      { kind: 'author', id: 9 },
      { kind: 'author', id: 3 },
      { kind: 'author', id: 9 },
      { kind: 'publisher', id: 4 },
      { kind: 'warning', warning: 'self_harm' },
      { kind: 'warning', warning: 'violence' },
    ]
    expect(expandBlocks(rules, categories)).toEqual({
      categoryIds: [2, 4, 6, 7, 8],
      authorIds: [3, 9],
      publisherIds: [4],
      warnings: ['violence', 'self_harm'],
    })
  })

  it('danh mục không còn trong cây vẫn giữ chính nó', () => {
    expect(expandBlocks([{ kind: 'category', id: 99 }], categories).categoryIds).toEqual([99])
  })
})

describe('isBlocked (dùng chung cho trang sách, chatbot Mây)', () => {
  it('đủ 4 kind', () => {
    expect(isBlocked(book(), NONE)).toBe(false)
    expect(isBlocked(book(), { ...NONE, categoryIds: [10] })).toBe(true)
    expect(isBlocked(book(), { ...NONE, publisherIds: [20] })).toBe(true)
    expect(isBlocked(book(), { ...NONE, authorIds: [30] })).toBe(true)
    expect(isBlocked(book({ content_warnings: ['loss', 'adult'] }), { ...NONE, warnings: ['adult'] })).toBe(true)
    expect(isBlocked(book({ content_warnings: ['loss'] }), { ...NONE, warnings: ['adult'] })).toBe(false)
  })

  it('câu 9: dịch giả / minh họa không tính, chỉ vai trò author', () => {
    const translated = book({
      book_authors: [
        { role: 'translator', author_id: 31 },
        { role: 'illustrator', author_id: 32 },
        { role: 'author', author_id: 30 },
      ],
    })
    expect(isBlocked(translated, { ...NONE, authorIds: [31] })).toBe(false)
    expect(isBlocked(translated, { ...NONE, authorIds: [32] })).toBe(false)
    expect(isBlocked(translated, { ...NONE, authorIds: [30] })).toBe(true)
    expect(bookSlotAttributes(translated)['data-a']).toBe('30')
  })

  it('sách thiếu danh mục / NXB / tác giả / nhãn: không thuộc tính, không bị chặn bởi kind đó', () => {
    const bare = book({ category_id: null, publisher_id: null, book_authors: [] })
    expect(bookSlotAttributes(bare)).toEqual({
      'data-book-slot': '',
      'data-c': undefined,
      'data-p': undefined,
      'data-a': undefined,
      'data-w': undefined,
    })
    expect(isBlocked(bare, { categoryIds: [10], authorIds: [30], publisherIds: [20], warnings: [...CONTENT_WARNINGS] })).toBe(
      false,
    )
  })
})

/** Khớp CSS sinh ra với data-* của một thẻ như trình duyệt (chỉ đúng dạng selector của blockCss: `=`, `~=`) */
function cssHidesSlot(css: string, attributes: Record<string, string | undefined>): boolean {
  const conditions = /:is\(([^)]*)\)/.exec(css)?.[1]
  if (!conditions) return false
  return conditions.split(',').some((condition) => {
    const match = /^\[(data-[a-z]+)(~?=)"([^"]+)"\]$/.exec(condition)
    if (!match) throw new Error(`điều kiện lạ: ${condition}`)
    const [, name = '', operator, value = ''] = match
    const actual = attributes[name]
    if (actual === undefined) return false
    return operator === '=' ? actual === value : actual.split(/\s+/).includes(value)
  })
}

describe('CSS và isBlocked cho cùng kết quả', () => {
  const categories = [
    { id: 1, parent_id: null },
    { id: 10, parent_id: 1 },
    { id: 11, parent_id: 1 },
    { id: 2, parent_id: null },
    { id: 12, parent_id: 2 },
  ]
  const books: BlockableBook[] = [
    book(),
    book({ category_id: 11, publisher_id: null, book_authors: [] }),
    book({ category_id: 12, publisher_id: 21, book_authors: [{ role: 'author', author_id: 300 }] }),
    book({ category_id: 12, publisher_id: 22, book_authors: [{ role: 'author', author_id: 3 }] }),
    book({ category_id: null, publisher_id: 2, content_warnings: ['self_harm'] }),
    book({ category_id: 12, publisher_id: 23, book_authors: [{ role: 'translator', author_id: 30 }] }),
    book({ category_id: 12, publisher_id: 24, content_warnings: ['adult', 'other_sensitive'] }),
  ]
  const ruleSets: BlockRule[][] = [
    [],
    [{ kind: 'category', id: 1 }],
    [{ kind: 'category', id: 11 }],
    [{ kind: 'author', id: 30 }],
    [{ kind: 'author', id: 3 }],
    [{ kind: 'publisher', id: 2 }],
    [{ kind: 'warning', warning: 'other_sensitive' }],
    [
      { kind: 'publisher', id: 21 },
      { kind: 'warning', warning: 'self_harm' },
    ],
  ]

  it.each(ruleSets.map((rules) => [JSON.stringify(rules), rules] as const))('%s', (_, rules) => {
    const expanded = expandBlocks(rules, categories)
    const css = blockCss(expanded)
    for (const sample of books) {
      expect(cssHidesSlot(css, bookSlotAttributes(sample)), JSON.stringify(sample)).toBe(isBlocked(sample, expanded))
    }
  })

  it('bộ mẫu có cả sách bị chặn lẫn không bị chặn', () => {
    const expanded = expandBlocks([{ kind: 'category', id: 1 }], categories)
    const hidden = books.filter((sample) => isBlocked(sample, expanded))
    expect(hidden.length).toBeGreaterThan(0)
    expect(hidden.length).toBeLessThan(books.length)
  })
})
