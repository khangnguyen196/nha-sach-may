import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONTENT_WARNINGS } from '@/features/warnings/labels'
import {
  blockCss,
  bookSlotAttributes,
  expandBlocks,
  isBlocked,
  parseBlockRow,
  parseBlockRows,
  BLOCK_LIMIT,
  matchingBlocks,
  missingWarnings,
  unblockedTargets,
  type BlockableBook,
  type BlockRule,
  type ExpandedBlocks,
  type StoredBlock,
} from './blocks'
import { cssHidesSlot } from './css-match.test-helper'

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
  it('nhận dòng đúng của 4 kind, kèm id dòng', () => {
    expect(
      parseBlockRow({ id: 1, kind: 'category', category_id: 12, author_id: null, publisher_id: null, warning: null }),
    ).toEqual({ kind: 'category', id: 12, rowId: 1 })
    expect(parseBlockRow({ id: 2, kind: 'author', author_id: 5 })).toEqual({ kind: 'author', id: 5, rowId: 2 })
    expect(parseBlockRow({ id: 3, kind: 'publisher', publisher_id: 3 })).toEqual({ kind: 'publisher', id: 3, rowId: 3 })
    expect(parseBlockRow({ id: 4, kind: 'warning', warning: 'adult' })).toEqual({ kind: 'warning', warning: 'adult', rowId: 4 })
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
      expect(parseBlockRow({ id: 1, kind, [`${kind}_id`]: id }), kind).toBeNull()
      // id dòng bẩn (đích đúng): cũng bỏ
      expect(parseBlockRow({ id, kind, [`${kind}_id`]: 7 }), `${kind} rowId`).toBeNull()
    }
    expect(parseBlockRow({ id, kind: 'warning', warning: 'adult' }), 'warning rowId').toBeNull()
  })

  it('bỏ nhãn ngoài enum, kind lạ, dòng không phải object, id nằm sai cột, thiếu id dòng', () => {
    for (const warning of ['evil', 'ADULT', 'adult"]{}', '</style>', '', null, 1]) {
      expect(parseBlockRow({ id: 1, kind: 'warning', warning }), String(warning)).toBeNull()
    }
    expect(parseBlockRow({ id: 1, kind: 'tag', category_id: 1 })).toBeNull()
    expect(parseBlockRow({ id: 1, kind: 'category', author_id: 1, category_id: null })).toBeNull()
    expect(parseBlockRow({ kind: 'author', author_id: 5 })).toBeNull()
    for (const row of [null, undefined, 'category', 12, []]) expect(parseBlockRow(row)).toBeNull()
  })

  it('parseBlockRows giữ dòng đúng, bỏ dòng sai, không throw', () => {
    expect(
      parseBlockRows([
        { id: 1, kind: 'author', author_id: 5 },
        { id: 2, kind: 'author', author_id: '5' },
        null,
        { id: 3, kind: 'warning', warning: 'loss' },
      ]),
    ).toEqual([
      { kind: 'author', id: 5, rowId: 1 },
      { kind: 'warning', warning: 'loss', rowId: 3 },
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

/** Bộ mẫu dùng chung cho CSS / isBlocked / matchingBlocks: 1 → 10, 11; 2 → 12 */
const SAMPLE_CATEGORIES = [
  { id: 1, parent_id: null },
  { id: 10, parent_id: 1 },
  { id: 11, parent_id: 1 },
  { id: 2, parent_id: null },
  { id: 12, parent_id: 2 },
]
const SAMPLE_BOOKS: BlockableBook[] = [
  book(),
  book({ category_id: 11, publisher_id: null, book_authors: [] }),
  book({ category_id: 12, publisher_id: 21, book_authors: [{ role: 'author', author_id: 300 }] }),
  book({ category_id: 12, publisher_id: 22, book_authors: [{ role: 'author', author_id: 3 }] }),
  book({ category_id: null, publisher_id: 2, content_warnings: ['self_harm'] }),
  book({ category_id: 12, publisher_id: 23, book_authors: [{ role: 'translator', author_id: 30 }] }),
  book({ category_id: 12, publisher_id: 24, content_warnings: ['adult', 'other_sensitive'] }),
]
const RULE_SETS: BlockRule[][] = [
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

describe('CSS và isBlocked cho cùng kết quả', () => {
  it.each(RULE_SETS.map((rules) => [JSON.stringify(rules), rules] as const))('%s', (_, rules) => {
    const expanded = expandBlocks(rules, SAMPLE_CATEGORIES)
    const css = blockCss(expanded)
    for (const sample of SAMPLE_BOOKS) {
      expect(cssHidesSlot(css, bookSlotAttributes(sample)), JSON.stringify(sample)).toBe(isBlocked(sample, expanded))
    }
  })

  it('bộ mẫu có cả sách bị chặn lẫn không bị chặn', () => {
    const expanded = expandBlocks([{ kind: 'category', id: 1 }], SAMPLE_CATEGORIES)
    const hidden = SAMPLE_BOOKS.filter((sample) => isBlocked(sample, expanded))
    expect(hidden.length).toBeGreaterThan(0)
    expect(hidden.length).toBeLessThan(SAMPLE_BOOKS.length)
  })
})

describe('matchingBlocks (dòng nhắc "Bạn đã chặn …" ở trang sách)', () => {
  it('danh mục cha trúng sách ở danh mục con; trả đúng mục (còn rowId), giữ thứ tự', () => {
    const rules: StoredBlock[] = [
      { kind: 'warning', warning: 'loss', rowId: 4 },
      { kind: 'category', id: 1, rowId: 7 },
      { kind: 'author', id: 30, rowId: 8 },
      { kind: 'publisher', id: 99, rowId: 9 },
    ]
    expect(matchingBlocks(book(), rules, SAMPLE_CATEGORIES)).toEqual([
      { kind: 'category', id: 1, rowId: 7 },
      { kind: 'author', id: 30, rowId: 8 },
    ])
    expect(matchingBlocks(book({ content_warnings: ['loss'] }), rules, SAMPLE_CATEGORIES).map((r) => r.rowId)).toEqual([
      4, 7, 8,
    ])
    // Danh mục con khác cha: không trúng
    expect(matchingBlocks(book({ category_id: 12 }), [{ kind: 'category', id: 1 }], SAMPLE_CATEGORIES)).toEqual([])
    expect(matchingBlocks(book({ category_id: 12 }), [{ kind: 'category', id: 2 }], SAMPLE_CATEGORIES)).toHaveLength(1)
  })

  it('câu 9: dịch giả / minh họa không tính', () => {
    const translated = book({
      book_authors: [
        { role: 'translator', author_id: 31 },
        { role: 'illustrator', author_id: 32 },
      ],
    })
    const rules: BlockRule[] = [
      { kind: 'author', id: 31 },
      { kind: 'author', id: 32 },
    ]
    expect(matchingBlocks(translated, rules, SAMPLE_CATEGORIES)).toEqual([])
  })

  it('bất biến: khác rỗng ⇔ isBlocked, trên bộ sách mẫu × mọi bộ mục chặn', () => {
    let matched = 0
    for (const rules of RULE_SETS) {
      const expanded = expandBlocks(rules, SAMPLE_CATEGORIES)
      for (const sample of SAMPLE_BOOKS) {
        const matches = matchingBlocks(sample, rules, SAMPLE_CATEGORIES)
        expect(matches.length > 0, `${JSON.stringify(rules)} ${JSON.stringify(sample)}`).toBe(isBlocked(sample, expanded))
        if (matches.length > 0) matched += 1
      }
    }
    expect(matched).toBeGreaterThan(0)
  })
})

describe('unblockedTargets (nút "Không muốn thấy …" ở trang sách)', () => {
  it('chưa chặn gì → đủ đích; tác giả chỉ vai trò author', () => {
    const sample = book({
      book_authors: [
        { role: 'author', author_id: 30 },
        { role: 'author', author_id: 33 },
        { role: 'translator', author_id: 31 },
      ],
    })
    expect(unblockedTargets(sample, NONE)).toEqual({ categoryId: 10, publisherId: 20, authorIds: [30, 33] })
  })

  it('danh mục đã bị chặn qua danh mục cha → không còn nút thể loại; mục đã chặn bị bỏ', () => {
    const expanded = expandBlocks(
      [
        { kind: 'category', id: 1 },
        { kind: 'author', id: 30 },
      ],
      SAMPLE_CATEGORIES,
    )
    expect(unblockedTargets(book(), expanded)).toEqual({ categoryId: null, publisherId: 20, authorIds: [] })
    expect(unblockedTargets(book(), { ...NONE, publisherIds: [20] }).publisherId).toBeNull()
  })

  it('sách thiếu danh mục / NXB → null', () => {
    expect(unblockedTargets(book({ category_id: null, publisher_id: null, book_authors: [] }), NONE)).toEqual({
      categoryId: null,
      publisherId: null,
      authorIds: [],
    })
  })
})

describe('missingWarnings ("Ẩn các sách có cảnh báo này" chỉ thêm nhãn còn thiếu)', () => {
  it('theo thứ tự enum, bỏ nhãn đã chặn và nhãn ngoài enum', () => {
    expect(missingWarnings(['self_harm', 'violence', 'evil'], [])).toEqual(['violence', 'self_harm'])
    expect(missingWarnings(['self_harm', 'violence'], ['violence'])).toEqual(['self_harm'])
    expect(missingWarnings(['adult'], ['adult', 'loss'])).toEqual([])
    expect(missingWarnings([], [])).toEqual([])
  })
})

describe('BLOCK_LIMIT', () => {
  it('khớp private.user_blocks_limit() trong schema.sql', () => {
    const schema = readFileSync(new URL('../../../supabase/schema.sql', import.meta.url), 'utf8')
    const limit = /function private\.user_blocks_limit\(\)[\s\S]*?\$\$ select (\d+) \$\$/.exec(schema)?.[1]
    expect(Number(limit)).toBe(BLOCK_LIMIT)
  })
})
