type DescriptionFields = { language: string; description: string | null; description_en: string | null }

/** Phần dịch của mô tả theo ngôn ngữ sách: sách 'en' dịch sang tiếng Việt ở description, sách khác dịch ở description_en */
export const translatedKey = (language: string) => (language === 'en' ? 'description' : 'description_en')

/** Cùng cách chuẩn hóa với optionalMultilineText (lib/text-schema.ts): CRLF / CR → LF, trim, rỗng → null */
function normalize(value: string | null) {
  return (value ?? '').replace(/\r\n?/g, '\n').trim() || null
}

/**
 * Admin lưu form sách: bỏ dấu "bản dịch tự động" khi cờ đang bật VÀ (phần dịch đổi nội dung HOẶC ngôn ngữ sách đổi:
 * phần dịch chuyển sang cột khác). So sau khi chuẩn hóa như schema của form: lưu lại form không sửa gì (textarea gửi
 * CRLF, DB lưu LF) không bỏ dấu. Admin không bao giờ bật lại cờ.
 */
export function shouldClearAutoTranslated(
  before: DescriptionFields & { description_auto_translated: boolean },
  after: DescriptionFields,
): boolean {
  if (!before.description_auto_translated) return false
  if (before.language !== after.language) return true
  const key = translatedKey(before.language)
  return normalize(before[key]) !== normalize(after[key])
}
