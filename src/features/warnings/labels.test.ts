import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '../../../messages/en.json'
import vi from '../../../messages/vi.json'
import { CONTENT_WARNINGS } from './labels'

describe('CONTENT_WARNINGS', () => {
  it('khớp enum public.content_warning trong supabase/schema.sql, đúng thứ tự', () => {
    const schema = readFileSync(join(import.meta.dirname, '../../../supabase/schema.sql'), 'utf8')
    const body = /create type public\.content_warning as enum \(([^)]*)\)/.exec(schema)?.[1]
    if (!body) throw new Error('schema.sql không có enum content_warning')
    const values = [...body.matchAll(/'([a-z_]+)'/g)].map((match) => match[1])
    expect(values).toHaveLength(5)
    expect([...CONTENT_WARNINGS]).toEqual(values)
  })

  it('mỗi nhãn có tên ở cả vi / en, không thừa không thiếu', () => {
    for (const messages of [vi, en]) {
      expect(Object.keys(messages.contentWarnings.labels)).toEqual([...CONTENT_WARNINGS])
    }
  })

  it('câu nhẹ nhàng cho nhãn tự hại: không số điện thoại, không dùng lại chat.crisis', () => {
    for (const messages of [vi, en]) expect(messages.contentWarnings.selfHarmNote).not.toMatch(/\d/)
    expect(vi.contentWarnings.selfHarmNote).toBe(
      'Nếu bạn đang gặp khó khăn, hãy chia sẻ với người bạn tin tưởng hoặc tìm hỗ trợ chuyên môn.',
    )
    expect(vi.contentWarnings.selfHarmNote).not.toBe(vi.chat.crisis)
  })
})
