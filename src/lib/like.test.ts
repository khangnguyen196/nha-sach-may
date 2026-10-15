import { describe, expect, it } from 'vitest'
import { containsPatterns, escapeLike, nameOrSlugFilters, normalizeSearch, quoteFilterValue } from './like'

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

describe('quoteFilterValue', () => {
  it('bọc nháy kép, escape \\ và "', () => {
    expect(quoteFilterValue('a,b(c)')).toBe('"a,b(c)"')
    expect(quoteFilterValue('say "hi"')).toBe('"say \\"hi\\""')
    expect(quoteFilterValue('%50\\%%')).toBe('"%50\\\\%%"')
  })
})

describe('nameOrSlugFilters', () => {
  it('mỗi từ: tên chứa từ gốc HOẶC slug chứa từ đã slugify', () => {
    expect(nameOrSlugFilters('Nguyễn  Nhật')).toEqual([
      'name.ilike."%Nguyễn%",slug.ilike."%nguyen%"',
      'name.ilike."%Nhật%",slug.ilike."%nhat%"',
    ])
    expect(nameOrSlugFilters("O'Brien")).toEqual([`name.ilike."%O'Brien%",slug.ilike."%o-brien%"`])
  })

  it('ký tự đại diện / ký tự của cú pháp lọc được escape trong nháy', () => {
    expect(nameOrSlugFilters('%')).toEqual(['name.ilike."%\\\\%%"'])
    expect(nameOrSlugFilters('a,b')).toEqual(['name.ilike."%a,b%",slug.ilike."%a-b%"'])
  })
})
