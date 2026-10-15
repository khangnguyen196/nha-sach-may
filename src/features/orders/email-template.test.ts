import { describe, expect, it } from 'vitest'
import { escapeHtml, renderOrderEmail, type OrderEmailContent } from './email-template'

const content: OrderEmailContent = {
  subject: 'Đã nhận đơn hàng NS26101600001',
  lead: 'Cảm ơn bạn đã đặt sách.',
  notes: ['Lý do: <đặt nhầm>'],
  itemsTitle: 'Sách trong đơn',
  items: [{ title: 'Tôi thấy hoa vàng trên cỏ xanh <script>', quantity: '× 2', total: '196.000 ₫' }],
  totals: [{ label: 'Tạm tính', value: '196.000 ₫' }],
  grandTotal: { label: 'Tổng cộng', value: '226.000 ₫' },
  paymentLine: 'Thanh toán: COD',
  transfer: { title: 'Thông tin chuyển khoản', hint: 'Quét mã ở trang đơn.', rows: [['Số tài khoản', '0000000000']] },
  cta: { label: 'Xem đơn hàng', href: 'https://example.com/tai-khoan/don-hang/NS26101600001?a=1&b=2' },
  footer: 'Email tự động.',
}

describe('renderOrderEmail', () => {
  it('HTML: escape dữ liệu từ DB (tên sách, lý do hủy), link CTA', () => {
    const { html } = renderOrderEmail(content)
    expect(html).not.toContain('<script>')
    expect(html).toContain('Tôi thấy hoa vàng trên cỏ xanh &#60;script&#62;')
    expect(html).toContain('Lý do: &#60;đặt nhầm&#62;')
    expect(html).toContain('href="https://example.com/tai-khoan/don-hang/NS26101600001?a=1&#38;b=2"')
    expect(html).toContain('0000000000')
  })

  it('bản text đủ thông tin cho trình đọc thư không hiện HTML', () => {
    const { text, subject } = renderOrderEmail(content)
    expect(subject).toBe(content.subject)
    for (const part of ['Cảm ơn bạn đã đặt sách.', '× 2: 196.000 ₫', 'Tổng cộng: 226.000 ₫', 'Số tài khoản: 0000000000']) {
      expect(text).toContain(part)
    }
    expect(text).toContain('Xem đơn hàng: https://example.com/tai-khoan/don-hang/NS26101600001?a=1&b=2')
  })

  it('không có chuyển khoản → không có khối chuyển khoản', () => {
    expect(renderOrderEmail({ ...content, transfer: null }).text).not.toContain('Thông tin chuyển khoản')
  })
})

describe('escapeHtml', () => {
  it('escape 5 ký tự đặc biệt', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&#60;a href=&#34;x&#34;&#62;&#39;&#38;&#39;&#60;/a&#62;')
  })
})
