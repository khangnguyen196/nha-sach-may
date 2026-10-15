import { describe, expect, it } from 'vitest'
import { invalidInput } from '@/lib/errors'
import { addressSchema } from './schemas'

const valid = {
  recipient_name: ' Nguyễn Văn An ',
  phone: '0912345678',
  province: '01',
  ward: '00004',
  street: ' 12 Phố Huế ',
}

function fieldErrors(input: Record<string, unknown>) {
  const result = addressSchema.safeParse(input)
  return result.success ? {} : invalidInput(result.error).fieldErrors
}

describe('addressSchema', () => {
  it('mã tỉnh/phường → tên đầy đủ tiếng Việt, cắt khoảng trắng', () => {
    expect(addressSchema.parse(valid)).toEqual({
      recipient_name: 'Nguyễn Văn An',
      phone: '0912345678',
      province: 'Thành phố Hà Nội',
      ward: 'Phường Ba Đình',
      street: '12 Phố Huế',
    })
  })

  it.each([
    ['+84912345678', '0912345678'],
    ['0912 345 678', '0912345678'],
    ['091.234.5678', '0912345678'],
    ['+84 38-123-4567', '0381234567'],
  ])('điện thoại hợp lệ %s → %s', (input, expected) => {
    expect(addressSchema.parse({ ...valid, phone: input }).phone).toBe(expected)
  })

  it.each([['0212345678'], ['091234567'], ['09123456789'], ['84912345678'], ['+85912345678'], ['abc'], ['']])(
    'điện thoại không hợp lệ %j',
    (phone) => {
      expect(fieldErrors({ ...valid, phone })).toEqual({ phone: 'phone' })
    },
  )

  it('phường không thuộc tỉnh → lỗi ở ô phường', () => {
    expect(fieldErrors({ ...valid, province: '79' })).toEqual({ ward: 'ward' })
  })

  it('tỉnh không có trong danh sách → lỗi ở ô tỉnh', () => {
    expect(fieldErrors({ ...valid, province: '99' })).toEqual({ province: 'province' })
  })

  it('thiếu ô → lỗi từng ô', () => {
    expect(fieldErrors({})).toEqual({
      recipient_name: 'required',
      phone: 'required',
      province: 'province',
      ward: 'ward',
      street: 'required',
    })
    expect(fieldErrors({ ...valid, recipient_name: '  ', street: 'x'.repeat(201) })).toEqual({
      recipient_name: 'recipientName',
      street: 'street',
    })
  })
})
