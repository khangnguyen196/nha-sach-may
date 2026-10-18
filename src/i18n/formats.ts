import type { Formats } from 'next-intl'

// Giá luôn là VND ở cả hai ngôn ngữ: vi → "98.000 ₫", en → "₫98,000".
// Dùng trong code: format.number(value, 'price'); trong message: {value, number, price}
export const formats = {
  number: {
    price: { style: 'currency', currency: 'VND', maximumFractionDigits: 0 },
  },
  dateTime: {
    short: { day: 'numeric', month: 'short', year: 'numeric' },
    withTime: { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  },
} satisfies Formats
