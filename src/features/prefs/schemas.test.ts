import { describe, expect, it } from 'vitest'
import { blockItemSchema, unblockItemSchema } from './schemas'

describe('blockItemSchema', () => {
  it('nhận danh mục / tác giả / NXB theo id và warnings theo bookId', () => {
    for (const kind of ['category', 'author', 'publisher'] as const) {
      expect(blockItemSchema.safeParse({ kind, id: 12 }).success, kind).toBe(true)
    }
    expect(blockItemSchema.safeParse({ kind: 'warnings', bookId: 3 }).success).toBe(true)
  })

  it.each([
    ['id chuỗi', { kind: 'author', id: '12' }],
    ['id 0', { kind: 'author', id: 0 }],
    ['id âm', { kind: 'category', id: -1 }],
    ['id lẻ', { kind: 'publisher', id: 1.5 }],
    ['id quá lớn', { kind: 'author', id: 2 ** 53 }],
    ['thiếu id', { kind: 'author' }],
    ['kind lạ', { kind: 'tag', id: 1 }],
    ['kind warning (số ít) với nhãn', { kind: 'warning', warning: 'adult' }],
    ['warnings thiếu bookId', { kind: 'warnings' }],
    ['warnings kèm nhãn do client gửi', { kind: 'warnings', bookId: 3, labels: ['adult'] }],
    ['warnings kèm nhãn lạ', { kind: 'warnings', bookId: 3, labels: ['evil'] }],
    ['khóa thừa', { kind: 'author', id: 1, user_id: 'x' }],
    ['null', null],
    ['chuỗi', 'author:1'],
  ])('chặn: %s', (_, input) => {
    expect(blockItemSchema.safeParse(input).success).toBe(false)
  })
})

describe('unblockItemSchema', () => {
  it('nhận id dòng số nguyên dương, chặn id sai dạng / khóa thừa', () => {
    expect(unblockItemSchema.safeParse({ id: 7 }).success).toBe(true)
    for (const input of [{ id: '7' }, { id: 0 }, { id: 1.5 }, { id: 7, user_id: 'x' }, {}, null]) {
      expect(unblockItemSchema.safeParse(input).success, JSON.stringify(input)).toBe(false)
    }
  })
})
