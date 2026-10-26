import { describe, expect, it } from 'vitest'
import en from '../../../messages/en.json'
import vi from '../../../messages/vi.json'
import { expandBlocks, type ExpandedBlocks } from '@/features/prefs/blocks'
import { searchQuerySchema, searchResponseSchema, type SearchHit } from './schemas'
import { normalizeSearchQuery, paletteRow, parseSearchResponse } from './search-input'

const zodQuery = (input: string) => {
  const parsed = searchQuerySchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

const zodResponse = (input: unknown) => {
  const parsed = searchResponseSchema.safeParse(input)
  return parsed.success ? parsed.data.data : null
}

const QUERIES: [string, string][] = [
  ['rỗng', ''],
  ['1 ký tự', 'a'],
  ['2 ký tự', 'ab'],
  ['1 ký tự + khoảng trắng hai đầu', '  a  '],
  ['100 ký tự', 'a'.repeat(100)],
  ['101 ký tự', 'a'.repeat(101)],
  ['100 ký tự + khoảng trắng hai đầu', `  ${'a'.repeat(100)}  `],
  ['101 ký tự có khoảng trắng giữa, gộp lại còn dưới 100', `${'a'.repeat(50)}${' '.repeat(3)}${'b'.repeat(48)}`],
  ['2 ký tự có khoảng trắng giữa', 'a b'],
  ['có dấu, viết hoa', 'Nguyễn Nhật Ánh'],
  ['không dấu', 'nguyen nhat anh'],
  ['NFD (dấu tổ hợp)', 'Nguyễn'],
  ['nhiều khoảng trắng giữa', 'sapiens    lược   sử'],
  ['tab + xuống dòng', '\tsapiens\nlược\r\nsử\t'],
  ['NBSP', ' sapiens lược sử '],
  ['khoảng trắng toàn góc (U+3000)', '　sách　hay　'],
  ['BOM (U+FEFF) hai đầu', '﻿sapiens﻿'],
  ['em space / thin space', ' a b '],
  ['line separator (U+2028)', ' ab '],
  ['zero-width space (không phải khoảng trắng)', '​ab​'],
  ['chỉ khoảng trắng Unicode', ' 　 '],
  ['emoji (2 code unit, 1 code point)', '📚'],
  ['2 emoji', '📚📚'],
  ['100 code point = 200 code unit', '𝒜'.repeat(100)],
  ['101 code point', '𝒜'.repeat(101)],
  ['100 chữ + 1 emoji = 101 code point', `${'a'.repeat(100)}📚`],
  ['99 chữ + 1 emoji = 100 code point', `${'a'.repeat(99)}📚`],
  ['surrogate lẻ', '\ud83d'],
  ['surrogate lẻ + chữ', '\ud83da'],
  ['e + dấu tổ hợp (2 code point)', 'é'],
  ['ký tự lạ', '<script>%_\'"'],
  ['chữ hoa đặc biệt', 'İSTANBUL ẞ'],
]

describe('normalizeSearchQuery khớp searchQuerySchema', () => {
  it.each(QUERIES)('%s', (_, input) => {
    expect(normalizeSearchQuery(input)).toBe(zodQuery(input))
  })

  it('giá trị mong đợi của vài ca chính', () => {
    expect(normalizeSearchQuery(' Sapiens   Lược Sử ')).toBe('sapiens lược sử')
    expect(normalizeSearchQuery('a')).toBeNull()
    expect(normalizeSearchQuery('a'.repeat(101))).toBeNull()
    expect(normalizeSearchQuery('a'.repeat(100))).toBe('a'.repeat(100))
  })
})

const hit = { id: 1, slug: 'sapiens', title: 'Sapiens', coverUrl: 'https://x/y.webp', authors: ['Yuval Noah Harari'] }
/** Khóa chặn như searchBookHits trả (bookBlockKeys) */
const blockKeys = { categoryId: 12, publisherId: 3, authorIds: [5, 9], warnings: ['adult'] }
const keyed = { ...hit, blockKeys }
const withKeys = (keys: unknown) => ({ ok: true, data: [{ ...hit, blockKeys: keys }] })

const RESPONSES: [string, unknown][] = [
  ['hợp lệ', { ok: true, data: [hit] }],
  ['danh sách rỗng', { ok: true, data: [] }],
  ['coverUrl null', { ok: true, data: [{ ...hit, coverUrl: null }] }],
  ['authors rỗng', { ok: true, data: [{ ...hit, authors: [] }] }],
  ['key thừa ở hit và ở ngoài', { ok: true, extra: 1, data: [{ ...hit, price: 98000 }] }],
  ['nhiều hit', { ok: true, data: [hit, { ...hit, id: 2, slug: 'b' }] }],
  ['ok = false', { ok: false, code: 'UNKNOWN' }],
  ['ok = "true"', { ok: 'true', data: [hit] }],
  ['thiếu ok', { data: [hit] }],
  ['thiếu data', { ok: true }],
  ['data không phải mảng', { ok: true, data: hit }],
  ['data null', { ok: true, data: null }],
  ['null', null],
  ['undefined', undefined],
  ['chuỗi', 'ok'],
  ['mảng', [hit]],
  ['hit null', { ok: true, data: [null] }],
  ['hit là mảng', { ok: true, data: [[1, 'a']] }],
  ['id là chuỗi', { ok: true, data: [{ ...hit, id: '1' }] }],
  ['id NaN', { ok: true, data: [{ ...hit, id: Number.NaN }] }],
  ['id Infinity', { ok: true, data: [{ ...hit, id: Number.POSITIVE_INFINITY }] }],
  ['id số lẻ', { ok: true, data: [{ ...hit, id: 1.5 }] }],
  ['thiếu slug', { ok: true, data: [{ id: 1, title: 'a', coverUrl: null, authors: [] }] }],
  ['title là số', { ok: true, data: [{ ...hit, title: 1 }] }],
  ['thiếu coverUrl', { ok: true, data: [{ id: 1, slug: 'a', title: 'a', authors: [] }] }],
  ['coverUrl undefined', { ok: true, data: [{ ...hit, coverUrl: undefined }] }],
  ['coverUrl là số', { ok: true, data: [{ ...hit, coverUrl: 0 }] }],
  ['authors không phải mảng', { ok: true, data: [{ ...hit, authors: 'Harari' }] }],
  ['authors có phần tử không phải chuỗi', { ok: true, data: [{ ...hit, authors: ['a', null] }] }],
  ['một hit sai trong nhiều hit', { ok: true, data: [hit, { ...hit, slug: 2 }] }],
  // blockKeys (P-C, quyết định (12)): không bắt buộc (phản hồi cũ trong CDN), có thì phải đúng kiểu
  ['phản hồi mới có blockKeys', { ok: true, data: [keyed] }],
  ['phản hồi cũ thiếu blockKeys lẫn với hit mới', { ok: true, data: [hit, { ...keyed, id: 2 }] }],
  ['blockKeys undefined', withKeys(undefined)],
  ['blockKeys rỗng (sách thiếu danh mục / NXB / tác giả / nhãn)', withKeys({ categoryId: null, publisherId: null, authorIds: [], warnings: [] })],
  ['key thừa trong blockKeys', withKeys({ ...blockKeys, title: 'x' })],
  ['blockKeys null', withKeys(null)],
  ['blockKeys là mảng', withKeys([12])],
  ['blockKeys là chuỗi', withKeys('12')],
  ['categoryId là chuỗi', withKeys({ ...blockKeys, categoryId: '12' })],
  ['categoryId thiếu', withKeys({ publisherId: 3, authorIds: [], warnings: [] })],
  ['categoryId NaN', withKeys({ ...blockKeys, categoryId: Number.NaN })],
  ['publisherId undefined', withKeys({ ...blockKeys, publisherId: undefined })],
  ['publisherId Infinity', withKeys({ ...blockKeys, publisherId: Number.POSITIVE_INFINITY })],
  ['authorIds không phải mảng', withKeys({ ...blockKeys, authorIds: 5 })],
  ['authorIds có chuỗi', withKeys({ ...blockKeys, authorIds: [5, '9'] })],
  ['authorIds có null', withKeys({ ...blockKeys, authorIds: [null] })],
  ['warnings thiếu', withKeys({ categoryId: 1, publisherId: 1, authorIds: [] })],
  ['warnings có số', withKeys({ ...blockKeys, warnings: ['adult', 1] })],
  ['warnings là chuỗi', withKeys({ ...blockKeys, warnings: 'adult' })],
  ['blockKeys sai ở một hit trong nhiều hit', { ok: true, data: [keyed, { ...keyed, id: 2, blockKeys: { ...blockKeys, authorIds: null } }] }],
]

describe('parseSearchResponse khớp searchResponseSchema', () => {
  it.each(RESPONSES)('%s', (_, input) => {
    expect(parseSearchResponse(input)).toEqual(zodResponse(input))
  })

  it('bỏ key thừa như zod', () => {
    expect(parseSearchResponse({ ok: true, data: [{ ...hit, price: 98000 }] })).toEqual([hit])
    expect(parseSearchResponse(withKeys({ ...blockKeys, extra: 1 }))).toEqual([keyed])
  })

  it('phản hồi cũ thiếu blockKeys vẫn hợp lệ (không che); blockKeys sai kiểu → cả phản hồi null', () => {
    expect(parseSearchResponse({ ok: true, data: [hit] })).toEqual([hit])
    expect(parseSearchResponse({ ok: true, data: [hit] })?.[0]).not.toHaveProperty('blockKeys')
    expect(parseSearchResponse({ ok: true, data: [keyed] })).toEqual([keyed])
    expect(parseSearchResponse(withKeys(null))).toBeNull()
    expect(parseSearchResponse({ ok: true, data: [hit, { ...keyed, blockKeys: { ...blockKeys, warnings: [1] } }] })).toBeNull()
  })

  it('JSON thật từ /api/search', () => {
    const raw = JSON.parse(JSON.stringify({ ok: true, data: [hit, { ...hit, id: 9, coverUrl: null }] }))
    expect(parseSearchResponse(raw)).toEqual(zodResponse(raw))
    expect(parseSearchResponse(raw)).toHaveLength(2)
  })
})

const BLOCKS: ExpandedBlocks = expandBlocks([{ kind: 'author', id: 9 }], [])
const NO_BLOCKS: ExpandedBlocks = { categoryIds: [], authorIds: [], publisherIds: [], warnings: [] }
const NONE_REVEALED: ReadonlySet<number> = new Set()

describe('paletteRow (dòng sách của palette bị che theo sở thích)', () => {
  const plain: SearchHit = { ...hit, id: 2, blockKeys: { ...blockKeys, authorIds: [4] } }
  const blocked: SearchHit = keyed

  it('khóa trúng mục chặn, chưa Xem → che; khóa không trúng → hiện', () => {
    expect(paletteRow(blocked, BLOCKS, NONE_REVEALED)).toBe('veiled')
    expect(paletteRow(plain, BLOCKS, NONE_REVEALED)).toBe('visible')
  })

  it('đã Xem (id trong tập đã Xem) → hiện; Xem cuốn khác không ảnh hưởng', () => {
    expect(paletteRow(blocked, BLOCKS, new Set([blocked.id]))).toBe('visible')
    expect(paletteRow(blocked, BLOCKS, new Set([plain.id]))).toBe('veiled')
  })

  it('chưa có mục chặn (khách, chưa chặn, BlockStyles chưa stream xong) hoặc mục chặn rỗng → hiện', () => {
    expect(paletteRow(blocked, null, NONE_REVEALED)).toBe('visible')
    expect(paletteRow(blocked, NO_BLOCKS, NONE_REVEALED)).toBe('visible')
  })

  it('phản hồi cũ thiếu blockKeys → hiện (không đoán)', () => {
    expect(paletteRow(hit, BLOCKS, NONE_REVEALED)).toBe('visible')
  })

  it('đủ 4 kind (cùng so khớp với thẻ sách: keysBlocked)', () => {
    const only = (rules: Parameters<typeof expandBlocks>[0]) => paletteRow(blocked, expandBlocks(rules, []), NONE_REVEALED)
    expect(only([{ kind: 'category', id: 12 }])).toBe('veiled')
    expect(only([{ kind: 'publisher', id: 3 }])).toBe('veiled')
    expect(only([{ kind: 'author', id: 5 }])).toBe('veiled')
    expect(only([{ kind: 'warning', warning: 'adult' }])).toBe('veiled')
    expect(only([{ kind: 'warning', warning: 'loss' }])).toBe('visible')
  })
})

describe('chuỗi dòng bị che của palette', () => {
  it('cùng chữ với ô mờ ở danh sách (prefs.hidden / prefs.reveal), cả vi / en', () => {
    for (const messages of [vi, en]) {
      expect(messages.search.hidden).toBe(messages.prefs.hidden)
      expect(messages.search.reveal).toBe(messages.prefs.reveal)
    }
    expect(vi.search.hidden).toBe('Đã ẩn theo sở thích của bạn')
    expect(vi.search.reveal).toBe('Xem')
  })
})
