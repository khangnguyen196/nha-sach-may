import { describe, expect, it } from 'vitest'
import { fillTemplate, placeholder } from './template'

describe('fillTemplate', () => {
  it('điền giá trị, giữ nguyên chỗ trống không có giá trị', () => {
    expect(fillTemplate('Xóa “{title}” khỏi giỏ', { title: 'Dế Mèn' })).toBe('Xóa “Dế Mèn” khỏi giỏ')
    expect(fillTemplate('Giỏ hàng, {count} cuốn', { count: 3 })).toBe('Giỏ hàng, 3 cuốn')
    expect(fillTemplate('{a} và {b}', { a: 1 })).toBe('1 và {b}')
  })

  it('giá trị có ký tự đặc biệt không bị hiểu thành mẫu', () => {
    expect(fillTemplate('“{title}”', { title: '$& {count}' })).toBe('“$& {count}”')
  })

  it('placeholder khớp cú pháp của fillTemplate', () => {
    expect(fillTemplate(`x ${placeholder('n')}`, { n: 2 })).toBe('x 2')
  })
})
