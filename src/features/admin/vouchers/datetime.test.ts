import { describe, expect, it } from 'vitest'
import { isoToVnInput, vnInputToIso } from './datetime'

describe('vnInputToIso', () => {
  it('giờ VN (UTC+7) → UTC', () => {
    expect(vnInputToIso('2026-10-20T08:30')).toBe('2026-10-20T01:30:00.000Z')
    expect(vnInputToIso('2026-01-01T03:00:15')).toBe('2025-12-31T20:00:15.000Z')
  })

  it('sai định dạng hoặc ngày giờ không có thật → null', () => {
    for (const value of ['', '2026-10-20', '20/10/2026 08:30', '2026-02-31T10:00', '2026-10-20T24:00', '2026-13-01T00:00']) {
      expect(vnInputToIso(value), value).toBeNull()
    }
  })
})

describe('isoToVnInput', () => {
  it('UTC → giá trị ô datetime-local theo giờ VN, khứ hồi khớp', () => {
    expect(isoToVnInput('2026-10-20T01:30:00+00:00')).toBe('2026-10-20T08:30')
    expect(isoToVnInput('2025-12-31T20:00:00Z')).toBe('2026-01-01T03:00')
    expect(vnInputToIso(isoToVnInput('2026-10-20T01:30:00Z'))).toBe('2026-10-20T01:30:00.000Z')
  })

  it('null / sai → rỗng', () => {
    expect(isoToVnInput(null)).toBe('')
    expect(isoToVnInput('không phải ngày')).toBe('')
  })
})
