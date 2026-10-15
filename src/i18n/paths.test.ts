import { describe, expect, it } from 'vitest'
import { localizedPath } from './paths'

describe('localizedPath', () => {
  it('vi không prefix, en có /en, pathname đã dịch', () => {
    expect(localizedPath('/login', 'vi')).toBe('/dang-nhap')
    expect(localizedPath('/login', 'en')).toBe('/en/login')
    expect(localizedPath('/account/addresses', 'vi')).toBe('/tai-khoan/dia-chi')
    expect(localizedPath('/', 'vi')).toBe('/')
    expect(localizedPath('/', 'en')).toBe('/en')
  })

  it('mã hóa query', () => {
    expect(localizedPath('/login', 'vi', { next: '/tai-khoan?x=1' })).toBe('/dang-nhap?next=%2Ftai-khoan%3Fx%3D1')
  })
})
