import { describe, expect, it } from 'vitest'
import { searchQuerySchema, searchResponseSchema } from './schemas'
import { normalizeSearchQuery, parseSearchResponse } from './search-input'

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
]

describe('parseSearchResponse khớp searchResponseSchema', () => {
  it.each(RESPONSES)('%s', (_, input) => {
    expect(parseSearchResponse(input)).toEqual(zodResponse(input))
  })

  it('bỏ key thừa như zod', () => {
    expect(parseSearchResponse({ ok: true, data: [{ ...hit, price: 98000 }] })).toEqual([hit])
  })

  it('JSON thật từ /api/search', () => {
    const raw = JSON.parse(JSON.stringify({ ok: true, data: [hit, { ...hit, id: 9, coverUrl: null }] }))
    expect(parseSearchResponse(raw)).toEqual(zodResponse(raw))
    expect(parseSearchResponse(raw)).toHaveLength(2)
  })
})
