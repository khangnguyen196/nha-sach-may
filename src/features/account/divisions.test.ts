import { describe, expect, it } from 'vitest'
import divisions from './data/divisions.json'
import {
  findDivisionCodes,
  getProvinceOptions,
  getWardOptions,
  localizeDivisionNames,
  resolveDivisionCodes,
} from './divisions'

describe('dữ liệu hành chính', () => {
  it('đúng 34 tỉnh/thành và 3.321 phường/xã', () => {
    expect(divisions).toHaveLength(34)
    expect(divisions.reduce((sum, province) => sum + province.wards.length, 0)).toBe(3321)
  })

  it('danh sách tỉnh theo locale, sắp theo tên ngắn', () => {
    const vi = getProvinceOptions('vi')
    expect(vi).toHaveLength(34)
    expect(vi[0]).toEqual({ code: '91', label: 'Tỉnh An Giang' })
    expect(getProvinceOptions('en').find((option) => option.code === '79')?.label).toBe('Ho Chi Minh City')
  })

  it('phường theo tỉnh; mã tỉnh lạ → null', () => {
    expect(getWardOptions('01', 'vi')?.some((option) => option.label === 'Phường Ba Đình')).toBe(true)
    expect(getWardOptions('99', 'vi')).toBeNull()
  })
})

describe('resolveDivisionCodes', () => {
  it('mã hợp lệ → tên đầy đủ tiếng Việt', () => {
    expect(resolveDivisionCodes('01', '00004')).toEqual({ province: 'Thành phố Hà Nội', ward: 'Phường Ba Đình' })
  })

  it('phường không thuộc tỉnh → null', () => {
    expect(resolveDivisionCodes('79', '00004')).toBeNull()
    expect(resolveDivisionCodes('99', '00004')).toBeNull()
  })
})

describe('tra tên đã lưu', () => {
  it('tên vi → mã (form sửa)', () => {
    expect(findDivisionCodes('Thành phố Hà Nội', 'Phường Ba Đình')).toEqual({ provinceCode: '01', wardCode: '00004' })
    expect(findDivisionCodes('Thành phố Hà Nội', 'Phường Không Có')).toEqual({ provinceCode: '01', wardCode: null })
  })

  it('tên vi → en; không tìm thấy thì giữ nguyên', () => {
    const names = { province: 'Thành phố Hà Nội', ward: 'Phường Ba Đình' }
    expect(localizeDivisionNames(names, 'en')).toEqual({ province: 'Hanoi City', ward: 'Ba Dinh Ward' })
    expect(localizeDivisionNames(names, 'vi')).toBe(names)
    expect(localizeDivisionNames({ province: 'Tỉnh Cũ', ward: 'Xã Cũ' }, 'en')).toEqual({
      province: 'Tỉnh Cũ',
      ward: 'Xã Cũ',
    })
  })
})
