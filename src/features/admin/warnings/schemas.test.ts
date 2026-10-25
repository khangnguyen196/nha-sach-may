import { describe, expect, it } from 'vitest'
import { invalidInput } from '@/lib/errors'
import { reviewRpcArgs, reviewSuggestionInput, reviewSuggestionSchema } from './schemas'

function form(entries: [string, string][]) {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

const parse = (entries: [string, string][]) => reviewSuggestionSchema.safeParse(reviewSuggestionInput(form(entries)))

describe('form duyệt gợi ý', () => {
  it('nhãn lặp lại → bỏ trùng, xếp theo thứ tự enum; sách chưa xét (không có ô ẩn) → null', () => {
    const parsed = parse([
      ['labels', 'self_harm'],
      ['labels', 'violence'],
      ['labels', 'self_harm'],
      ['decision', 'approve'],
    ])
    expect(parsed.success && parsed.data).toEqual({
      labels: ['violence', 'self_harm'],
      decision: 'approve',
      expectedReviewedAt: null,
    })
  })

  it('ô ẩn rỗng = chưa xét; chuỗi PostgREST có micro giây giữ nguyên', () => {
    expect(parse([['decision', 'dismiss'], ['expected_reviewed_at', '']]).data?.expectedReviewedAt).toBeNull()
    const raw = '2026-10-25T09:42:01.123456+00:00'
    expect(parse([['decision', 'dismiss'], ['expected_reviewed_at', raw]]).data?.expectedReviewedAt).toBe(raw)
  })

  it('nhãn lạ, quá 5 phần tử, nút lạ, thời điểm sai dạng → INVALID_INPUT', () => {
    const fieldOf = (entries: [string, string][]) => {
      const parsed = parse(entries)
      return parsed.success ? null : Object.keys(invalidInput(parsed.error).fieldErrors ?? {})
    }
    expect(fieldOf([['labels', 'spoilers'], ['decision', 'approve']])).toEqual(['labels'])
    expect(fieldOf([...Array.from({ length: 6 }, (): [string, string] => ['labels', 'loss']), ['decision', 'approve']])).toEqual([
      'labels',
    ])
    expect(fieldOf([['decision', 'publish']])).toEqual(['decision'])
    expect(fieldOf([['decision', 'approve'], ['expected_reviewed_at', 'hôm qua']])).toEqual(['expectedReviewedAt'])
  })
})

describe('reviewRpcArgs', () => {
  it('sách chưa xét → BỎ HẲN khóa p_expected_reviewed_at (không gửi null)', () => {
    const args = reviewRpcArgs(7, { labels: ['loss'], decision: 'approve', expectedReviewedAt: null })
    expect(args).toEqual({ p_id: 7, p_labels: ['loss'], p_approve: true })
    expect(Object.hasOwn(args, 'p_expected_reviewed_at')).toBe(false)
  })

  it('sách đã xét → gửi nguyên chuỗi đã đọc; bỏ qua → p_approve false', () => {
    const raw = '2026-10-25T09:42:01.123456+00:00'
    expect(reviewRpcArgs(8, { labels: [], decision: 'dismiss', expectedReviewedAt: raw })).toEqual({
      p_id: 8,
      p_labels: [],
      p_approve: false,
      p_expected_reviewed_at: raw,
    })
  })
})
