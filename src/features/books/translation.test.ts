import { describe, expect, it } from 'vitest'
import { showAutoTranslatedNote } from './translation'

const VI = 'Mô tả tiếng Việt'
const EN = 'English description'

describe('showAutoTranslatedNote', () => {
  // language × locale × cờ (mô tả hai phần đều có chữ)
  it.each([
    { language: 'vi', locale: 'en', flag: true, expected: true },
    { language: 'vi', locale: 'vi', flag: true, expected: false },
    { language: 'en', locale: 'vi', flag: true, expected: true },
    { language: 'en', locale: 'en', flag: true, expected: false },
    { language: 'vi', locale: 'en', flag: false, expected: false },
    { language: 'vi', locale: 'vi', flag: false, expected: false },
    { language: 'en', locale: 'vi', flag: false, expected: false },
    { language: 'en', locale: 'en', flag: false, expected: false },
  ] as const)('sách $language, trang $locale, cờ $flag → $expected', ({ language, locale, flag, expected }) => {
    const book = { language, description_auto_translated: flag, description: VI, description_en: EN }
    expect(showAutoTranslatedNote(book, locale)).toBe(expected)
  })

  it('sách vi, description_en trống / null → /en hiện mô tả tiếng Việt gốc, không có dòng', () => {
    for (const description_en of [null, '', '  \n ']) {
      const book = { language: 'vi', description_auto_translated: true, description: VI, description_en }
      expect(showAutoTranslatedNote(book, 'en')).toBe(false)
    }
  })

  it('sách en, description trống → không có dòng ở trang tiếng Việt', () => {
    for (const description of [null, '', ' ']) {
      const book = { language: 'en', description_auto_translated: true, description, description_en: EN }
      expect(showAutoTranslatedNote(book, 'vi')).toBe(false)
    }
  })

  it('ngôn ngữ sách khác vi / en → không có dòng', () => {
    const book = { language: 'fr', description_auto_translated: true, description: VI, description_en: EN }
    expect(showAutoTranslatedNote(book, 'vi')).toBe(false)
    expect(showAutoTranslatedNote(book, 'en')).toBe(false)
  })
})
