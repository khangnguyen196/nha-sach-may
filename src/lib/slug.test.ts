import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it('bỏ dấu tiếng Việt, đ → d, chữ thường, nối bằng gạch ngang', () => {
    expect(slugify('Đắc Nhân Tâm')).toBe('dac-nhan-tam')
    expect(slugify('  Tôi thấy hoa vàng trên cỏ xanh!  ')).toBe('toi-thay-hoa-vang-tren-co-xanh')
  })

  it('gộp ký tự đặc biệt liên tiếp, bỏ gạch ngang ở hai đầu', () => {
    expect(slugify('--Harry Potter & Hòn đá Phù thủy (Tập 1)--')).toBe('harry-potter-hon-da-phu-thuy-tap-1')
  })

  it('đã là slug thì giữ nguyên', () => {
    expect(slugify('mat-biec-2')).toBe('mat-biec-2')
  })

  it('tối đa 80 ký tự, không kết thúc bằng gạch ngang', () => {
    const slug = slugify(`${'a'.repeat(79)} b`)
    expect(slug).toBe('a'.repeat(79))
    expect(slugify('x'.repeat(200))).toHaveLength(80)
  })

  it('toàn ký tự đặc biệt → rỗng', () => {
    expect(slugify('!!! ???')).toBe('')
  })
})
