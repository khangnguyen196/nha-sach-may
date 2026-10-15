import { describe, expect, it } from 'vitest'
import { containsPatterns, escapeLike, normalizeSearch } from './like'

describe('escapeLike', () => {
  it('escape \\ trước rồi tới % và _', () => {
    expect(escapeLike('50%')).toBe('50\\%')
    expect(escapeLike('a_b')).toBe('a\\_b')
    expect(escapeLike('c:\\temp')).toBe('c:\\\\temp')
    // \% gõ vào → \\ (dấu \ thật) + \% (dấu % thật), không thành một ký tự escape
    expect(escapeLike('\\%')).toBe('\\\\\\%')
  })

  it('* (PostgREST coi là %) → _', () => {
    expect(escapeLike('a*b')).toBe('a_b')
  })

  it('chuỗi thường giữ nguyên', () => {
    expect(escapeLike('dac nhan tam')).toBe('dac nhan tam')
  })
})

describe('normalizeSearch', () => {
  it('bỏ dấu, đ → d, chữ thường như normalize_vi', () => {
    expect(normalizeSearch('Đắc Nhân Tâm')).toBe('dac nhan tam')
    expect(normalizeSearch('NGUYỄN Nhật Ánh')).toBe('nguyen nhat anh')
  })
})

describe('containsPatterns', () => {
  it('mỗi từ một mẫu %từ%, đã bỏ dấu và escape', () => {
    expect(containsPatterns('  Tâm  Đắc ')).toEqual(['%tam%', '%dac%'])
    expect(containsPatterns('100%')).toEqual(['%100\\%%'])
    expect(containsPatterns('_')).toEqual(['%\\_%'])
  })

  it('không có từ nào → rỗng', () => {
    expect(containsPatterns('   ')).toEqual([])
  })

  it('giới hạn số từ', () => {
    expect(containsPatterns('a b c d', 2)).toEqual(['%a%', '%b%'])
  })
})
