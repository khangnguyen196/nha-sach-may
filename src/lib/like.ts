import { slugify } from './slug'

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

/**
 * Giá trị trong bộ lọc logic của PostgREST (`.or(...)`): bọc nháy kép để dấu phẩy / ngoặc không phá cú pháp, escape
 * `\` và `"` (PostgREST bỏ một lớp `\` bên trong nháy, nên `\` của mẫu LIKE phải nhân đôi).
 */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/[\\"]/g, '\\$&')}"`
}

/**
 * Bảng không có `search_text` (VD tác giả): mỗi từ một bộ lọc `.or()` "tên chứa từ (có dấu, không phân biệt hoa
 * thường) HOẶC slug chứa từ đã slugify (gõ không dấu)". Gọi `.or()` cho từng phần tử → mọi từ đều phải khớp.
 */
export function nameOrSlugFilters(query: string, maxTerms = 8): string[] {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxTerms)
    .map((term) => {
      const conditions = [`name.ilike.${quoteFilterValue(`%${escapeLike(term)}%`)}`]
      const slug = slugify(term)
      if (slug) conditions.push(`slug.ilike.${quoteFilterValue(`%${escapeLike(slug)}%`)}`)
      return conditions.join(',')
    })
}
