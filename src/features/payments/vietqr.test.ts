import { describe, expect, it } from 'vitest'
import { buildVietQrPayload, crc16 } from './vietqr'

/** Tách payload thành các trường ID / giá trị (một cấp) */
function parseFields(payload: string) {
  const fields = new Map<string, string>()
  let rest = payload
  while (rest.length > 0) {
    const id = rest.slice(0, 2)
    const length = Number(rest.slice(2, 4))
    fields.set(id, rest.slice(4, 4 + length))
    rest = rest.slice(4 + length)
  }
  return fields
}

const input = { bankBin: '970436', accountNo: '0011001234567', amount: 128_000, description: 'NS26101600001' }

describe('crc16', () => {
  it('giá trị kiểm tra chuẩn của CRC-16/CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1')
    expect(crc16('')).toBe('FFFF')
  })
})

describe('buildVietQrPayload', () => {
  it('đủ trường theo chuẩn NAPAS, độ dài khai báo khớp giá trị', () => {
    const fields = parseFields(buildVietQrPayload(input))
    expect([...fields.keys()]).toEqual(['00', '01', '38', '53', '54', '58', '62', '63'])
    expect(fields.get('00')).toBe('01')
    expect(fields.get('01')).toBe('12')
    expect(fields.get('53')).toBe('704')
    expect(fields.get('54')).toBe('128000')
    expect(fields.get('58')).toBe('VN')

    const merchant = parseFields(fields.get('38') ?? '')
    expect(merchant.get('00')).toBe('A000000727')
    expect(merchant.get('02')).toBe('QRIBFTTA')
    const beneficiary = parseFields(merchant.get('01') ?? '')
    expect(beneficiary.get('00')).toBe('970436')
    expect(beneficiary.get('01')).toBe('0011001234567')
    expect(parseFields(fields.get('62') ?? '').get('08')).toBe('NS26101600001')
  })

  it('CRC cuối tính trên toàn bộ chuỗi trước nó + "6304"', () => {
    const payload = buildVietQrPayload(input)
    expect(payload.slice(-8, -4)).toBe('6304')
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)))
  })

  it('từ chối đầu vào sai (không để lọt QR hỏng)', () => {
    expect(() => buildVietQrPayload({ ...input, bankBin: '97043' })).toThrow()
    expect(() => buildVietQrPayload({ ...input, accountNo: '001-100' })).toThrow()
    expect(() => buildVietQrPayload({ ...input, amount: 0 })).toThrow()
    expect(() => buildVietQrPayload({ ...input, amount: 1.5 })).toThrow()
    expect(() => buildVietQrPayload({ ...input, description: 'Đơn hàng' })).toThrow()
  })
})
