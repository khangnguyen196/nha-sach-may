// Client leaf không format ICU (không kéo intl-messageformat, xem CLAUDE.md → i18n). Chuỗi có giá trị chỉ biết ở
// client (tên sách của giỏ khách, số trên badge) được server dịch sẵn với chỗ trống giữ nguyên:
//   t('removeLabel', { title: '{title}' })  →  'Xóa “{title}” khỏi giỏ'
// rồi client điền bằng fillTemplate. Chỉ dùng cho tham số đơn giản, không dùng cho plural/select.

export function placeholder(name: string) {
  return `{${name}}`
}

export function fillTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  )
}
