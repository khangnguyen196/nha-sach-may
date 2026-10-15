import { describe, expect, it } from 'vitest'
import { invalidInput } from '@/lib/errors'
import { categoryFormSchema } from './schemas'

const valid = {
  name: ' Tiểu thuyết ',
  name_en: 'Novels',
  slug: '',
  description: '',
  description_en: '',
  parent_id: '1',
  sort_order: '3',
  is_active: 'on',
}

function fieldErrors(input: Record<string, unknown>) {
  const result = categoryFormSchema.safeParse({ ...valid, ...input })
  return result.success ? {} : invalidInput(result.error).fieldErrors
}

describe('categoryFormSchema', () => {
  it('chuẩn hóa: trim, rỗng → null, slug từ tên, ô chọn → boolean', () => {
    expect(categoryFormSchema.parse(valid)).toEqual({
      name: 'Tiểu thuyết',
      name_en: 'Novels',
      slug: 'tieu-thuyet',
      description: null,
      description_en: null,
      parent_id: 1,
      sort_order: 3,
      is_active: true,
    })
  })

  it('không có cha → null; bỏ chọn hiển thị → false', () => {
    expect(categoryFormSchema.parse({ ...valid, parent_id: '', is_active: undefined })).toMatchObject({
      parent_id: null,
      is_active: false,
    })
  })

  it('thứ tự trong -1000..1000, bắt buộc', () => {
    expect(fieldErrors({ sort_order: '1001' })).toEqual({ sort_order: 'sortOrder' })
    expect(fieldErrors({ sort_order: '' })).toEqual({ sort_order: 'sortOrder' })
    expect(categoryFormSchema.parse({ ...valid, sort_order: '-5' }).sort_order).toBe(-5)
  })

  it('tên bắt buộc, slug phải còn ký tự sau chuẩn hóa', () => {
    expect(fieldErrors({ name: '  ' })).toEqual({ name: 'name' })
    expect(fieldErrors({ name: '???', slug: '' })).toEqual({ slug: 'slug' })
  })
})
