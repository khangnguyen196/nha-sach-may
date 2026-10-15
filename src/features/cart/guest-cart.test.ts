import { describe, expect, it } from 'vitest'
import {
  addItem,
  cartLimit,
  countItems,
  parseGuestCart,
  parseItemsParam,
  removeItem,
  serializeItemsParam,
  setItemQuantity,
} from './guest-cart'
import { MAX_LINES } from './schemas'

const lines = (count: number) => Array.from({ length: count }, (_, i) => ({ book_id: i + 1, quantity: 1 }))

describe('parseGuestCart', () => {
  it('đọc giỏ hợp lệ', () => {
    expect(parseGuestCart('[{"book_id":3,"quantity":2},{"book_id":5,"quantity":1}]')).toEqual([
      { book_id: 3, quantity: 2 },
      { book_id: 5, quantity: 1 },
    ])
  })

  it.each([
    ['rỗng', null],
    ['JSON hỏng', '[{"book_id":3'],
    ['không phải mảng', '{"book_id":3,"quantity":1}'],
    ['book_id không phải số nguyên dương', '[{"book_id":"3","quantity":1}]'],
    ['quantity = 0', '[{"book_id":3,"quantity":0}]'],
    ['quantity > 99', '[{"book_id":3,"quantity":100}]'],
    ['quantity lẻ', '[{"book_id":3,"quantity":1.5}]'],
  ])('%s → giỏ rỗng', (_, raw) => {
    expect(parseGuestCart(raw)).toEqual([])
  })

  it('quá 100 dòng → giỏ rỗng', () => {
    expect(parseGuestCart(JSON.stringify(lines(MAX_LINES)))).toHaveLength(MAX_LINES)
    expect(parseGuestCart(JSON.stringify(lines(MAX_LINES + 1)))).toEqual([])
  })

  it('gộp book_id trùng, chặn ở 99, giữ thứ tự', () => {
    expect(
      parseGuestCart(
        '[{"book_id":7,"quantity":60},{"book_id":2,"quantity":1},{"book_id":7,"quantity":60}]',
      ),
    ).toEqual([
      { book_id: 7, quantity: 99 },
      { book_id: 2, quantity: 1 },
    ])
  })
})

describe('cartLimit', () => {
  it('min(stock, 99), không âm', () => {
    expect(cartLimit(5)).toBe(5)
    expect(cartLimit(500)).toBe(99)
    expect(cartLimit(0)).toBe(0)
    expect(cartLimit(-2)).toBe(0)
  })
})

describe('addItem', () => {
  it('thêm dòng mới ở cuối, cộng dồn dòng đã có', () => {
    const first = addItem([], 3, 10)
    expect(first).toEqual({ items: [{ book_id: 3, quantity: 1 }], status: 'added' })
    const second = addItem([...first.items, { book_id: 4, quantity: 1 }], 3, 10)
    expect(second.items).toEqual([
      { book_id: 3, quantity: 2 },
      { book_id: 4, quantity: 1 },
    ])
  })

  it('đủ tồn kho / 99 → limit, không đổi giỏ', () => {
    expect(addItem([{ book_id: 3, quantity: 2 }], 3, cartLimit(2))).toEqual({
      items: [{ book_id: 3, quantity: 2 }],
      status: 'limit',
    })
    expect(addItem([{ book_id: 3, quantity: 99 }], 3, cartLimit(500)).status).toBe('limit')
    expect(addItem([], 3, cartLimit(0)).status).toBe('limit')
  })

  it('đủ 100 đầu sách → full, sách đã có vẫn cộng được', () => {
    const full = lines(MAX_LINES)
    expect(addItem(full, 1000, 10).status).toBe('full')
    expect(addItem(full, 1, 10).status).toBe('added')
  })
})

describe('setItemQuantity / removeItem / countItems', () => {
  const items = [
    { book_id: 1, quantity: 2 },
    { book_id: 2, quantity: 3 },
  ]

  it('chặn số lượng trong 1–99', () => {
    expect(setItemQuantity(items, 1, 0)[0]).toEqual({ book_id: 1, quantity: 1 })
    expect(setItemQuantity(items, 1, 150)[0]).toEqual({ book_id: 1, quantity: 99 })
    expect(setItemQuantity(items, 1, 4.7)[0]).toEqual({ book_id: 1, quantity: 4 })
    expect(setItemQuantity(items, 9, 5)).toEqual(items)
  })

  it('xóa và đếm tổng số cuốn', () => {
    expect(removeItem(items, 1)).toEqual([{ book_id: 2, quantity: 3 }])
    expect(countItems(items)).toBe(5)
    expect(countItems([])).toBe(0)
  })
})

describe('items param của /api/cart/guest', () => {
  it('serialize sắp theo book_id, parse ngược lại', () => {
    const param = serializeItemsParam([
      { book_id: 15, quantity: 1 },
      { book_id: 12, quantity: 2 },
    ])
    expect(param).toBe('12x2,15x1')
    expect(parseItemsParam(param)).toEqual([
      { book_id: 12, quantity: 2 },
      { book_id: 15, quantity: 1 },
    ])
  })

  it('rỗng → giỏ rỗng', () => {
    expect(parseItemsParam(null)).toEqual([])
    expect(parseItemsParam('')).toEqual([])
  })

  it('gộp trùng', () => {
    expect(parseItemsParam('3x50,3x60')).toEqual([{ book_id: 3, quantity: 99 }])
  })

  it.each(['abc', '12x', 'x2', '12x0', '0x1', '12x100', '12x2,', '12x2;15x1', '-1x2', '1.5x2', '12x02', '99999999999999999x1'])(
    '%s → null',
    (value) => {
      expect(parseItemsParam(value)).toBeNull()
    },
  )

  it('quá 100 dòng → null', () => {
    expect(parseItemsParam(serializeItemsParam(lines(MAX_LINES)))).toHaveLength(MAX_LINES)
    expect(parseItemsParam(serializeItemsParam(lines(MAX_LINES + 1)))).toBeNull()
  })
})
