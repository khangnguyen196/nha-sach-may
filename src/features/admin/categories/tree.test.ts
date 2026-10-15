import { describe, expect, it } from 'vitest'
import { categoryTree, isLeaf, leafCategoryGroups } from './tree'

const categories = [
  { id: 1, parent_id: null, name: 'Văn học', is_active: true },
  { id: 2, parent_id: 1, name: 'Tiểu thuyết', is_active: true },
  { id: 3, parent_id: null, name: 'Thiếu nhi', is_active: true },
  { id: 4, parent_id: 1, name: 'Thơ', is_active: false },
  { id: 5, parent_id: 99, name: 'Mồ côi', is_active: true },
]

describe('categoryTree', () => {
  it('gốc theo thứ tự đầu vào, kèm con; cha không có trong danh sách → coi là gốc', () => {
    expect(
      categoryTree(categories).map(({ root, children }) => [root.id, children.map((child) => child.id)]),
    ).toEqual([
      [1, [2, 4]],
      [3, []],
      [5, []],
    ])
  })
})

describe('isLeaf', () => {
  it('không có con → lá', () => {
    expect(isLeaf(categories, 1)).toBe(false)
    expect(isLeaf(categories, 2)).toBe(true)
    expect(isLeaf(categories, 3)).toBe(true)
  })
})

describe('leafCategoryGroups', () => {
  it('danh mục gốc có con → nhóm theo tên gốc; gốc không con → lựa chọn đứng riêng', () => {
    expect(leafCategoryGroups(categories)).toEqual([
      {
        label: 'Văn học',
        options: [
          { id: 2, name: 'Tiểu thuyết', hidden: false },
          { id: 4, name: 'Thơ', hidden: true },
        ],
      },
      { label: null, options: [{ id: 3, name: 'Thiếu nhi', hidden: false }] },
      { label: null, options: [{ id: 5, name: 'Mồ côi', hidden: false }] },
    ])
  })
})
