import { describe, expect, it } from 'vitest'
import {
  createListingSchema,
  expectedUpdatedAtSchema,
  LISTING_DESCRIPTION_MAX,
  listingFormValues,
  listingIdSchema,
  photoFolder,
  updateListingSchema,
} from './schemas'

const SELLER = '0b0e8f8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const photo = (n: number) => `${SELLER}/00000000-0000-4000-8000-00000000000${n}.webp`

const valid = {
  book_id: '12',
  condition: 'good',
  price: '25000',
  description: 'Sách còn mới',
  photos: [photo(1)],
}

const fieldOf = (input: unknown, schema = createListingSchema) => {
  const result = schema.safeParse(input)
  return result.success ? null : Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]))
}

describe('createListingSchema / updateListingSchema', () => {
  it('dữ liệu đúng → số, mô tả đã cắt', () => {
    expect(createListingSchema.parse(valid)).toEqual({
      book_id: 12,
      condition: 'good',
      price: 25_000,
      description: 'Sách còn mới',
      photos: [photo(1)],
    })
    // Sửa tin không có book_id
    expect(updateListingSchema.parse({ ...valid, book_id: undefined })).not.toHaveProperty('book_id')
  })

  it('mô tả: cắt xuống dòng / tab / dấu cách hai đầu, rỗng → null, CRLF đếm như LF', () => {
    expect(createListingSchema.parse({ ...valid, description: '\n\t  Gáy hơi sờn \t\r\n' }).description).toBe('Gáy hơi sờn')
    expect(createListingSchema.parse({ ...valid, description: '\n\t \r\n ' }).description).toBeNull()
    expect(createListingSchema.parse({ ...valid, description: undefined }).description).toBeNull()
    const lines = `${'a'.repeat(249)}\r\n${'b'.repeat(250)}`
    expect(createListingSchema.parse({ ...valid, description: lines }).description).toHaveLength(LISTING_DESCRIPTION_MAX)
  })

  it('mô tả 500 ký tự được, 501 → listingDescription (đếm sau khi cắt)', () => {
    expect(createListingSchema.parse({ ...valid, description: 'a'.repeat(500) }).description).toHaveLength(500)
    expect(createListingSchema.parse({ ...valid, description: ` ${'a'.repeat(500)}\n` }).description).toHaveLength(500)
    expect(fieldOf({ ...valid, description: 'a'.repeat(501) })).toEqual({ description: 'listingDescription' })
  })

  it('ảnh: 0 / 4 ảnh, trùng, sai mẫu tên → listingPhotos', () => {
    expect(fieldOf({ ...valid, photos: [] })).toEqual({ photos: 'listingPhotos' })
    expect(fieldOf({ ...valid, photos: [photo(1), photo(2), photo(3), photo(4)] })).toEqual({ photos: 'listingPhotos' })
    expect(createListingSchema.parse({ ...valid, photos: [photo(1), photo(2), photo(3)] }).photos).toHaveLength(3)
    expect(fieldOf({ ...valid, photos: [photo(1), photo(1)] })).toEqual({ photos: 'listingPhotos' })
    for (const bad of [
      `${SELLER}/anh.webp`,
      `${SELLER}/00000000-0000-4000-8000-000000000001.jpg`,
      `../${SELLER}/00000000-0000-4000-8000-000000000001.webp`,
      `${SELLER.toUpperCase()}/00000000-0000-4000-8000-000000000001.webp`,
      `x/${photo(1)}`,
    ]) {
      expect(fieldOf({ ...valid, photos: [bad] }), bad).toEqual({ photos: 'listingPhotos' })
    }
    expect(photoFolder(photo(1))).toBe(SELLER)
  })

  it('giá: 0, âm, số thực, có dấu chấm, chữ, quá int4 → listingPrice', () => {
    for (const price of ['0', '-1000', '25000.5', '25.000', '1e5', 'abc', '', '2147483648', undefined]) {
      expect(fieldOf({ ...valid, price }), String(price)).toEqual({ price: 'listingPrice' })
    }
    expect(createListingSchema.parse({ ...valid, price: ' 2147483647 ' }).price).toBe(2_147_483_647)
  })

  it('sách, tình trạng sai → listingBook / listingCondition', () => {
    for (const bookId of ['0', '-3', '1.5', 'abc', undefined]) {
      expect(fieldOf({ ...valid, book_id: bookId }), String(bookId)).toEqual({ book_id: 'listingBook' })
    }
    expect(fieldOf({ ...valid, condition: 'mint' })).toEqual({ condition: 'listingCondition' })
    expect(fieldOf({ ...valid, condition: undefined })).toEqual({ condition: 'listingCondition' })
  })
})

describe('listingFormValues', () => {
  it('đọc nhiều ô ảnh cùng tên, bỏ File', () => {
    const formData = new FormData()
    formData.set('book_id', '7')
    formData.set('condition', 'fair')
    formData.set('price', '30000')
    formData.append('photos', photo(1))
    formData.append('photos', new Blob(['x']))
    formData.append('photos', photo(2))
    expect(listingFormValues(formData)).toEqual({
      book_id: '7',
      condition: 'fair',
      price: '30000',
      description: undefined,
      photos: [photo(1), photo(2)],
    })
  })
})

describe('listingIdSchema', () => {
  it('id dương', () => {
    expect(listingIdSchema.parse('42')).toBe(42)
    expect(listingIdSchema.safeParse('0').success).toBe(false)
    expect(listingIdSchema.safeParse('abc').success).toBe(false)
  })
})

describe('expectedUpdatedAtSchema (updated_at của bản tin đang hiển thị, dùng chung admin + trang mua)', () => {
  it('chuỗi PostgREST: có micro giây, hoặc không phần lẻ (Postgres bỏ phần lẻ = 0) → giữ nguyên chuỗi', () => {
    for (const value of ['2026-10-24T05:05:00.123456+00:00', '2026-10-24T05:05:00+00:00']) {
      expect(expectedUpdatedAtSchema.safeParse(value).data, value).toBe(value)
    }
  })

  it('không phải thời điểm, thiếu múi giờ, trống / thiếu → lỗi', () => {
    for (const value of ['abc', '2026-10-24T05:05:00.123456', '2026-10-24T05:05:00', '', null, undefined]) {
      expect(expectedUpdatedAtSchema.safeParse(value).success, String(value)).toBe(false)
    }
  })
})
