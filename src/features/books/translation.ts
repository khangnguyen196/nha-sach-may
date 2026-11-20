import type { Locale } from 'next-intl'
import type { BookDetail } from './queries'

type TranslatedBook = Pick<BookDetail, 'language' | 'description_auto_translated' | 'description' | 'description_en'>

/**
 * Dòng "Bản dịch tự động" dưới mô tả: chỉ khi cờ bật VÀ phần đang hiện (theo `localize`) là phần dịch. Phần dịch theo
 * ngôn ngữ sách: sách 'vi' → description_en (hiện ở /en khi có chữ), sách 'en' → description (hiện ở trang tiếng Việt).
 * description_en trống thì /en hiện mô tả tiếng Việt gốc (fallback của `localize`) → không phải bản dịch.
 */
export function showAutoTranslatedNote(book: TranslatedBook, locale: Locale): boolean {
  if (!book.description_auto_translated) return false
  if (book.language === 'vi') return locale === 'en' && hasText(book.description_en)
  if (book.language === 'en') return locale === 'vi' && hasText(book.description)
  return false
}

function hasText(value: string | null) {
  return Boolean(value?.trim())
}
