/**
 * Dựng email đơn hàng (HTML + text) từ chuỗi đã dịch, đã định dạng. Hàm thuần (Vitest); dịch + lấy dữ liệu ở
 * `emails.ts`. Trình đọc thư không hiểu CSS variables / class → style inline, bảng màu riêng ở đây (ngoại lệ "không
 * hard-code màu" trong CLAUDE.md: một chỗ duy nhất, theo bảng light của design system).
 */
const EMAIL_COLORS = {
  background: '#f7f5f0',
  surface: '#ffffff',
  text: '#1c1917',
  muted: '#57534e',
  primary: '#9a5b14',
  primaryForeground: '#ffffff',
  border: '#e7e2d8',
} as const

export type OrderEmailContent = {
  subject: string
  lead: string
  /** Lý do hủy, ghi chú hoàn tiền… */
  notes: string[]
  itemsTitle: string
  items: { title: string; quantity: string; total: string }[]
  totals: { label: string; value: string }[]
  /** Dòng cuối của bảng tiền (in đậm, màu nhấn) */
  grandTotal: { label: string; value: string }
  paymentLine: string
  transfer: { title: string; hint: string; rows: [string, string][] } | null
  cta: { label: string; href: string }
  footer: string
}

export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

const row = (label: string, value: string, style = '') =>
  `<tr><td style="padding:4px 0;color:${EMAIL_COLORS.muted};${style}">${escapeHtml(label)}</td>` +
  `<td style="padding:4px 0;text-align:right;${style}">${escapeHtml(value)}</td></tr>`

export function renderOrderEmail(content: OrderEmailContent): { subject: string; html: string; text: string } {
  const { subject, lead, notes, itemsTitle, items, totals, grandTotal, paymentLine, transfer, cta, footer } = content
  const c = EMAIL_COLORS
  const p = (text: string, style = '') => `<p style="margin:0 0 12px;${style}">${escapeHtml(text)}</p>`

  const itemRows = items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid ${c.border}">${escapeHtml(item.title)} ` +
        `<span style="color:${c.muted}">${escapeHtml(item.quantity)}</span></td>` +
        `<td style="padding:8px 0;border-bottom:1px solid ${c.border};text-align:right;white-space:nowrap">${escapeHtml(item.total)}</td></tr>`,
    )
    .join('')
  const totalRows =
    totals.map((t) => row(t.label, t.value)).join('') +
    row(grandTotal.label, grandTotal.value, `font-weight:600;color:${c.primary};border-top:1px solid ${c.border};padding-top:8px`)
  const transferBlock = transfer
    ? `<div style="margin:20px 0;padding:16px;border:1px solid ${c.border};border-radius:10px">` +
      `<p style="margin:0 0 8px;font-weight:600">${escapeHtml(transfer.title)}</p>` +
      `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">${transfer.rows.map(([l, v]) => row(l, v)).join('')}</table>` +
      `<p style="margin:8px 0 0;font-size:13px;color:${c.muted}">${escapeHtml(transfer.hint)}</p></div>`
    : ''

  const html =
    `<!doctype html><html><body style="margin:0;padding:24px;background:${c.background};color:${c.text};font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6">` +
    `<div style="max-width:560px;margin:0 auto;padding:24px;background:${c.surface};border:1px solid ${c.border};border-radius:10px">` +
    `<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:22px;font-weight:600">${escapeHtml(subject)}</h1>` +
    p(lead) +
    notes.map((note) => p(note, `color:${c.muted}`)).join('') +
    `<p style="margin:20px 0 4px;font-weight:600">${escapeHtml(itemsTitle)}</p>` +
    `<table role="presentation" width="100%" style="border-collapse:collapse">${itemRows}</table>` +
    `<table role="presentation" width="100%" style="border-collapse:collapse;margin-top:12px">${totalRows}</table>` +
    p(paymentLine, 'margin-top:12px') +
    transferBlock +
    `<p style="margin:24px 0"><a href="${escapeHtml(cta.href)}" style="display:inline-block;padding:10px 18px;background:${c.primary};color:${c.primaryForeground};border-radius:10px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>` +
    `<p style="margin:0;font-size:12px;color:${c.muted}">${escapeHtml(footer)}</p>` +
    `</div></body></html>`

  const text = [
    subject,
    '',
    lead,
    ...notes,
    '',
    `${itemsTitle}:`,
    ...items.map((item) => `- ${item.title} ${item.quantity}: ${item.total}`),
    '',
    ...totals.map((t) => `${t.label}: ${t.value}`),
    `${grandTotal.label}: ${grandTotal.value}`,
    paymentLine,
    ...(transfer ? ['', `${transfer.title}:`, ...transfer.rows.map(([l, v]) => `${l}: ${v}`), transfer.hint] : []),
    '',
    `${cta.label}: ${cta.href}`,
    '',
    footer,
  ].join('\n')

  return { subject, html, text }
}
