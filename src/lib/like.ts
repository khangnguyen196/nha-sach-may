/**
 * Mẫu `ilike` cho ô tìm kiếm của admin (PostgREST `.ilike(cột, mẫu)`), cùng cách với RPC `search_books`:
 * từ khóa bỏ dấu như `public.normalize_vi` (khớp cột `search_text`), tách theo khoảng trắng, mỗi từ một mẫu
 * `%từ%` → gọi `.ilike` cho từng mẫu để mọi từ đều phải khớp, không cần đúng thứ tự.
 */

/** Gần với `public.normalize_vi` (unaccent + lower) cho chữ tiếng Việt / Latin */
export function normalizeSearch(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
}

/**
 * Escape ký tự đại diện của LIKE (`\` trước, rồi `%`, `_`) để gõ `%` / `_` không khớp mọi dòng.
 * `*`: PostgREST coi `*` trong mẫu like là `%` và không có cách escape → đổi thành `_` (khớp đúng một ký tự bất kỳ).
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&').replace(/\*/g, '_')
}

/** Từ khóa → danh sách mẫu `%từ%` (rỗng nếu không có từ nào), tối đa `maxTerms` từ */
export function containsPatterns(query: string, maxTerms = 8): string[] {
  return normalizeSearch(query)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxTerms)
    .map((term) => `%${escapeLike(term)}%`)
}
