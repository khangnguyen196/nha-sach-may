import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { maskEmail } = await import('./email')

describe('maskEmail', () => {
  it('giữ ký tự đầu và tên miền', () => {
    expect(maskEmail('nguyen.van.an@example.com')).toBe('n***@example.com')
    expect(maskEmail('a@b.vn')).toBe('a***@b.vn')
  })

  it('không phải email → ***', () => {
    expect(maskEmail('khong-phai-email')).toBe('***')
    expect(maskEmail('@example.com')).toBe('***')
  })
})
