type CategoryNode = { id: number; parent_id: number | null }

/**
 * Danh mục 2 cấp theo thứ tự đầu vào (đã sort_order): mỗi danh mục gốc kèm danh mục con. Danh mục có parent_id trỏ
 * tới dòng không có trong danh sách (dữ liệu lệch) được coi là gốc để không bị mất khỏi admin.
 */
export function categoryTree<T extends CategoryNode>(categories: readonly T[]): { root: T; children: T[] }[] {
  const ids = new Set(categories.map((category) => category.id))
  return categories
    .filter((category) => category.parent_id === null || !ids.has(category.parent_id))
    .map((root) => ({ root, children: categories.filter((category) => category.parent_id === root.id) }))
}

/** Danh mục lá theo nhóm danh mục gốc; `label` null = danh mục gốc không có con (chính nó là lá) */
export type CategoryGroup = { label: string | null; options: { id: number; name: string; hidden: boolean }[] }

/** Lựa chọn danh mục cho sách (chỉ danh mục lá), nhóm theo danh mục gốc cho `<optgroup>` */
export function leafCategoryGroups(
  categories: readonly (CategoryNode & { name: string; is_active: boolean })[],
): CategoryGroup[] {
  const option = (category: { id: number; name: string; is_active: boolean }) => ({
    id: category.id,
    name: category.name,
    hidden: !category.is_active,
  })
  return categoryTree(categories).map(({ root, children }) =>
    children.length > 0 ? { label: root.name, options: children.map(option) } : { label: null, options: [option(root)] },
  )
}
