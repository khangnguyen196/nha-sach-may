import { describe, expect, it } from 'vitest'
import { bookFormSchema } from './schemas'
import { shouldClearAutoTranslated } from './translation-flag'

// Form sửa sách đã điền như khi admin mở trang (textarea gửi xuống dòng dạng CRLF)
const form = {
  title: 'Mắt biếc',
  subtitle: '',
  slug: 'mat-biec',
  description: 'Đoạn một.\r\nĐoạn hai.',
  description_en: 'Paragraph one.\r\nParagraph two.\r\n',
  isbn: '',
  price: '98000',
  original_price: '',
  stock: '12',
  category_id: '3',
  publisher_id: '',
  published_year: '',
  page_count: '',
  weight_grams: '',
  dimensions: '',
  format: 'paperback',
  language: 'vi',
  authors: [],
}

/** Dòng trong DB (xuống dòng LF) của cuốn sách đang sửa */
const viBook = {
  language: 'vi',
  description: 'Đoạn một.\nĐoạn hai.',
  description_en: 'Paragraph one.\nParagraph two.',
  description_auto_translated: true,
}

const enBook = {
  language: 'en',
  description: 'Đoạn một.\nĐoạn hai.',
  description_en: 'Paragraph one.\nParagraph two.',
  description_auto_translated: true,
}

const submit = (input: Partial<Record<keyof typeof form, string>>) => bookFormSchema.parse({ ...form, ...input })

describe('shouldClearAutoTranslated', () => {
  it('(a) lưu form không đổi gì (textarea CRLF, DB LF) → giữ dấu', () => {
    expect(shouldClearAutoTranslated(viBook, submit({}))).toBe(false)
    expect(shouldClearAutoTranslated(enBook, submit({ language: 'en' }))).toBe(false)
  })

  it('(a) DB còn khoảng trắng đầu / cuối hoặc CRLF, form gửi lại y nguyên → giữ dấu', () => {
    const before = { ...viBook, description_en: '  Paragraph one.\r\nParagraph two.\n' }
    expect(shouldClearAutoTranslated(before, submit({ description_en: before.description_en }))).toBe(false)
  })

  it('(b) sửa phần dịch → bỏ dấu', () => {
    // Sách vi: phần dịch là description_en
    expect(shouldClearAutoTranslated(viBook, submit({ description_en: 'Paragraph one, edited.' }))).toBe(true)
    expect(shouldClearAutoTranslated(viBook, submit({ description_en: '' }))).toBe(true)
    // Sách en: phần dịch là description
    expect(shouldClearAutoTranslated(enBook, submit({ language: 'en', description: 'Đoạn một đã sửa.' }))).toBe(true)
  })

  it('(c) sửa phần gốc → giữ dấu', () => {
    expect(shouldClearAutoTranslated(viBook, submit({ description: 'Đoạn một đã sửa.' }))).toBe(false)
    expect(
      shouldClearAutoTranslated(enBook, submit({ language: 'en', description_en: 'Paragraph one, edited.' })),
    ).toBe(false)
  })

  it('(d) đổi ngôn ngữ sách → bỏ dấu', () => {
    expect(shouldClearAutoTranslated(viBook, submit({ language: 'en' }))).toBe(true)
    expect(shouldClearAutoTranslated(enBook, submit({ language: 'vi' }))).toBe(true)
  })

  it('(e) cờ false → không đổi gì, kể cả khi sửa phần dịch hoặc đổi ngôn ngữ', () => {
    const before = { ...viBook, description_auto_translated: false }
    expect(shouldClearAutoTranslated(before, submit({}))).toBe(false)
    expect(shouldClearAutoTranslated(before, submit({ description_en: 'Edited.' }))).toBe(false)
    expect(shouldClearAutoTranslated(before, submit({ language: 'en' }))).toBe(false)
  })
})
