import type { Locale } from 'next-intl'

/**
 * Lấy nội dung theo ngôn ngữ từ một dòng DB: tiếng Anh ở cột `<key>_en`, tiếng Việt ở cột gốc.
 * `*_en` null hoặc rỗng → fallback về cột gốc. Tên sách không dịch nên không dùng hàm này cho `title`.
 *
 *   localize(category, 'name', locale)
 */
export function localize<
  K extends string,
  R extends Record<K, string | null> & Partial<Record<`${K}_en`, string | null>>,
>(row: R, key: K, locale: Locale): R[K] | string {
  if (locale !== 'en') return row[key]
  // TS không thu hẹp được kiểu khi index bằng template `${K}_en` generic → đọc qua kiểu rộng hơn
  const columns: Partial<Record<string, string | null>> = row
  const translated = columns[`${key}_en`]
  return translated?.trim() ? translated : row[key]
}
