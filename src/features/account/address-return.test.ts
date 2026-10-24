import { describe, expect, it } from 'vitest'
import { parseAddressNext } from './address-return'
import { addressReturnToSchema } from './schemas'

describe('parseAddressNext (?next= của trang thêm địa chỉ)', () => {
  it('trang thanh toán đúng locale → checkout', () => {
    expect(parseAddressNext('/thanh-toan', 'vi')).toBe('checkout')
    expect(parseAddressNext('/en/checkout', 'en')).toBe('checkout')
  })

  it('trang mua tin sách cũ cùng locale → id tin', () => {
    expect(parseAddressNext('/cho-sach-cu/12/mua', 'vi')).toEqual({ usedListingId: 12 })
    expect(parseAddressNext('/en/used-books/12/buy', 'en')).toEqual({ usedListingId: 12 })
    expect(parseAddressNext(`/cho-sach-cu/${Number.MAX_SAFE_INTEGER}/mua`, 'vi')).toEqual({
      usedListingId: Number.MAX_SAFE_INTEGER,
    })
  })

  it.each([
    ['/en/checkout', 'vi'],
    ['/thanh-toan', 'en'],
    ['/en/used-books/12/buy', 'vi'],
    ['/cho-sach-cu/12/mua', 'en'],
  ] as const)('locale khác: %s ở trang %s → null', (next, locale) => {
    expect(parseAddressNext(next, locale)).toBeNull()
  })

  it.each([
    '/cho-sach-cu/abc/mua',
    '/cho-sach-cu/12a/mua',
    '/cho-sach-cu/0/mua',
    '/cho-sach-cu/012/mua',
    '/cho-sach-cu/-1/mua',
    '/cho-sach-cu/1.5/mua',
    '/cho-sach-cu/1e3/mua',
    `/cho-sach-cu/${Number.MAX_SAFE_INTEGER + 1}/mua`,
    '/cho-sach-cu/99999999999999999999/mua',
  ])('id sai dạng / số 0 / quá lớn: %s → null', (next) => {
    expect(parseAddressNext(next, 'vi')).toBeNull()
  })

  it.each([
    '/cho-sach-cu/1%2F2/mua',
    '/cho-sach-cu/12%2Fmua',
    '%2Fcho-sach-cu%2F12%2Fmua',
    '/cho-sach-cu/%/mua',
    '/cho-sach-cu/12',
    '/cho-sach-cu/12/mua/',
    '/cho-sach-cu/12/mua?x=1',
    '/cho-sach-cu//mua',
    '/cho-sach-cu/1/2/mua',
    '/thanh-toan/',
    '/thanh-toan?voucher=X',
    '//evil.example/thanh-toan',
    'https://evil.example/cho-sach-cu/12/mua',
    '/tai-khoan/dia-chi',
    '',
  ])('đường dẫn lạ / mã hóa: %j → null', (next) => {
    expect(parseAddressNext(next, 'vi')).toBeNull()
  })

  it('không phải chuỗi (thiếu, lặp khóa ?next=a&next=b) → null', () => {
    expect(parseAddressNext(undefined, 'vi')).toBeNull()
    expect(parseAddressNext(['/thanh-toan', '/thanh-toan'], 'vi')).toBeNull()
  })
})

describe('addressReturnToSchema (tham số bind của createAddress)', () => {
  it('nhận checkout, id tin nguyên dương an toàn, null', () => {
    expect(addressReturnToSchema.parse('checkout')).toBe('checkout')
    expect(addressReturnToSchema.parse({ usedListingId: 7 })).toEqual({ usedListingId: 7 })
    expect(addressReturnToSchema.parse({ usedListingId: Number.MAX_SAFE_INTEGER })).toEqual({
      usedListingId: Number.MAX_SAFE_INTEGER,
    })
    expect(addressReturnToSchema.parse(null)).toBeNull()
  })

  it.each([
    ['chuỗi lạ', 'cart'],
    ['URL thô', '/cho-sach-cu/7/mua'],
    ['id 0', { usedListingId: 0 }],
    ['id âm', { usedListingId: -3 }],
    ['id lẻ', { usedListingId: 1.5 }],
    ['id quá lớn', { usedListingId: Number.MAX_SAFE_INTEGER + 1 }],
    ['id chuỗi', { usedListingId: '7' }],
    ['thừa khóa', { usedListingId: 7, next: '//evil.example' }],
    ['thiếu id', {}],
    ['undefined', undefined],
  ])('%s → null', (_label, value) => {
    expect(addressReturnToSchema.parse(value)).toBeNull()
  })
})
