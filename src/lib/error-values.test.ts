import { describe, expect, it } from 'vitest'
import { errorMessageValues } from './error-values'
import { SUPPORT_EMAIL } from './support'

const formatDate = (date: Date) => `ngày ${date.toISOString()}`

describe('errorMessageValues', () => {
  it('luôn có email liên hệ, giữ nguyên detail khác', () => {
    expect(errorMessageValues(undefined, formatDate)).toEqual({ email: SUPPORT_EMAIL })
    expect(errorMessageValues({ title: 'Sapiens', stock: 2 }, formatDate)).toEqual({
      email: SUPPORT_EMAIL,
      title: 'Sapiens',
      stock: 2,
    })
  })

  it('starts_at / ends_at (ISO từ DB) → ngày giờ đã format', () => {
    expect(errorMessageValues({ starts_at: '2099-01-01T20:04:05+00:00' }, formatDate)).toEqual({
      email: SUPPORT_EMAIL,
      starts_at: 'ngày 2099-01-01T20:04:05.000Z',
    })
    expect(errorMessageValues({ ends_at: '2020-01-01T20:04:05+00:00' }, formatDate).ends_at).toBe(
      'ngày 2020-01-01T20:04:05.000Z',
    )
  })

  it('chuỗi không phải ngày → giữ nguyên, không ném lỗi', () => {
    expect(errorMessageValues({ ends_at: 'không phải ngày' }, formatDate).ends_at).toBe('không phải ngày')
  })
})
