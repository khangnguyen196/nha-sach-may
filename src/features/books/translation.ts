import type { Locale } from 'next-intl'
// Giữ `import type`: file này chạy cả ở client (form sửa sách của admin), còn queries.ts có 'server-only'.
import type { BookDetail } from './queries'

type TranslatedBook = Pick<BookDetail, 'language' | 'description_auto_translated' | 'description' | 'description_en'>

/**
 * Phần dịch của mô tả theo ngôn ngữ sách: sách 'vi' dịch sang tiếng Anh ở description_en, sách 'en' dịch sang tiếng
 * Việt ở description. Ngôn ngữ khác: không có phần dịch.
 */
export function translatedKey(language: string): 'description' | 'description_en' | null {
  if (language === 'vi') return 'description_en'
  if (language === 'en') return 'description'
  return null
}

/**
 * Dòng "Bản dịch tự động" dưới mô tả: chỉ khi cờ bật VÀ ô đang hiện là phần dịch. Ô đang hiện tính y như `localize`:
 * /en có description_en (có chữ) thì description_en, còn lại description. VD sách 'en' chưa có description_en thì /en
 * cũng hiện description (bản dịch tiếng Việt) → có dòng.
 */
export function showAutoTranslatedNote(book: TranslatedBook, locale: Locale): boolean {
  if (!book.description_auto_translated) return false
  const key = translatedKey(book.language)
  if (!key) return false
  const shown = locale === 'en' && hasText(book.description_en) ? 'description_en' : 'description'
  return shown === key && hasText(book[shown])
}

function hasText(value: string | null) {
  return Boolean(value?.trim())
}
