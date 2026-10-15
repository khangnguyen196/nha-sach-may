import { describe, expect, it } from 'vitest'
import { authorFormSchema } from './schemas'

describe('authorFormSchema', () => {
  it('slug từ tên khi để trống, tiểu sử rỗng → null', () => {
    expect(authorFormSchema.parse({ name: ' Nguyễn Nhật Ánh ', slug: '', bio: '  ', bio_en: 'Writer' })).toEqual({
      name: 'Nguyễn Nhật Ánh',
      slug: 'nguyen-nhat-anh',
      bio: null,
      bio_en: 'Writer',
    })
  })

  it('tên bắt buộc', () => {
    expect(authorFormSchema.safeParse({ name: '', slug: 'abc' }).success).toBe(false)
  })
})
