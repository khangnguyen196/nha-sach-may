import { describe, expect, it } from 'vitest'
import { localize } from './i18n-db'

const category = { name: 'Tiểu thuyết', name_en: 'Novels', description: 'Mô tả', description_en: null }

describe('localize', () => {
  it('vi → cột gốc', () => {
    expect(localize(category, 'name', 'vi')).toBe('Tiểu thuyết')
  })

  it('en → cột *_en', () => {
    expect(localize(category, 'name', 'en')).toBe('Novels')
  })

  it('en nhưng *_en null hoặc rỗng → fallback cột gốc', () => {
    expect(localize(category, 'description', 'en')).toBe('Mô tả')
    expect(localize({ name: 'Thơ', name_en: '  ' }, 'name', 'en')).toBe('Thơ')
  })

  it('cột gốc null → trả về null', () => {
    expect(localize({ bio: null, bio_en: null }, 'bio', 'en')).toBeNull()
  })
})
