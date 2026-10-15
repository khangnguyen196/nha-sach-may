import { describe, expect, it } from 'vitest'
import { initialOf } from './utils'

describe('initialOf', () => {
  it('lấy chữ đầu của tên (từ cuối)', () => {
    expect(initialOf('Nguyễn Văn An')).toBe('A')
    expect(initialOf('  trần thị ánh  ')).toBe('Á')
    expect(initialOf('Đức')).toBe('Đ')
  })

  it('email → ký tự đầu; rỗng → ?', () => {
    expect(initialOf('mai.le@example.com')).toBe('M')
    expect(initialOf('   ')).toBe('?')
  })
})
