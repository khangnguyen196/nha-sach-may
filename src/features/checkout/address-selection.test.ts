import { describe, expect, it } from 'vitest'
import { pickAddressId } from './address-selection'

// getAddresses xếp địa chỉ mặc định lên đầu
const addresses = [{ id: 7 }, { id: 12 }, { id: 30 }]

describe('pickAddressId (?address= ở /thanh-toan và trang mua sách cũ)', () => {
  it('id có trong sổ địa chỉ → chọn đúng id đó (không phải mặc định)', () => {
    expect(pickAddressId(addresses, '12')).toBe(12)
    expect(pickAddressId(addresses, '30')).toBe(30)
  })

  it('?address= dạng mảng một phần tử (["12"]) → Number đọc như "12" → chọn id 12', () => {
    expect(pickAddressId(addresses, ['12'])).toBe(12)
  })

  it('id không thuộc sổ địa chỉ (của người khác, đã xóa) → địa chỉ đầu danh sách', () => {
    expect(pickAddressId(addresses, '999')).toBe(7)
  })

  const fallbacks: [string, string | string[] | undefined][] = [
    ['thiếu', undefined],
    ['chữ', 'abc'],
    ['rỗng', ''],
    ['lặp khóa', ['12', '30']],
  ]
  it.each(fallbacks)('?address= %s → địa chỉ đầu danh sách', (_label, raw) => {
    expect(pickAddressId(addresses, raw)).toBe(7)
  })

  it('sổ địa chỉ trống → undefined', () => {
    expect(pickAddressId([], '12')).toBeUndefined()
    expect(pickAddressId([], undefined)).toBeUndefined()
  })
})
