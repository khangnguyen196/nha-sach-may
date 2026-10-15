/**
 * Slug dùng chung cho URL (sách, danh mục, tác giả): bỏ dấu tiếng Việt, chữ thường, nối bằng gạch ngang, tối đa 80
 * ký tự. Dùng ở `scripts/import-books.ts` và form admin (để trống slug → tạo từ tên).
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
}
