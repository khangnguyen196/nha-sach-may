import { describe, expect, it } from 'vitest'
import { validateReply } from './validate'

const slugs = new Set(['mat-biec', 'sapiens', 'nha-gia-kim', 'dac-nhan-tam'])

const reply = (patch: Record<string, unknown> = {}) =>
  JSON.stringify({
    intent: 'recommend',
    message: 'Mây hiểu cảm giác đó.',
    books: [{ slug: 'mat-biec', reason: 'Nhẹ nhàng, hoài niệm.' }],
    follow_up: 'Bạn thích truyện ngắn hay tiểu thuyết?',
    non_vietnamese: false,
    ...patch,
  })

describe('validateReply', () => {
  it('JSON hỏng hoặc thiếu field → null', () => {
    expect(validateReply('{"intent": "recommend"', slugs)).toBeNull()
    expect(validateReply('không phải JSON', slugs)).toBeNull()
    expect(validateReply(JSON.stringify({ intent: 'recommend', message: 'x' }), slugs)).toBeNull()
    expect(validateReply(reply({ intent: 'hack' }), slugs)).toBeNull()
  })

  it('bỏ slug ngoài ứng viên, slug trùng, giữ tối đa 3 theo thứ tự', () => {
    const result = validateReply(
      reply({
        books: [
          { slug: 'khong-ton-tai', reason: 'a' },
          { slug: 'sapiens', reason: 'b' },
          { slug: 'sapiens', reason: 'c' },
          { slug: 'mat-biec', reason: 'd' },
          { slug: 'nha-gia-kim', reason: 'e' },
          { slug: 'dac-nhan-tam', reason: 'f' },
        ],
      }),
      slugs,
    )
    expect(result?.books).toEqual([
      { slug: 'sapiens', reason: 'b' },
      { slug: 'mat-biec', reason: 'd' },
      { slug: 'nha-gia-kim', reason: 'e' },
    ])
  })

  it('cắt độ dài, bỏ link / thẻ HTML / ký tự điều khiển', () => {
    const result = validateReply(
      reply({
        message: `<b>Xem</b> https://lua-dao.example/x ngay ${'ơ'.repeat(700)}\u0007`,
        follow_up: 'ư'.repeat(300),
        books: [{ slug: 'mat-biec', reason: `${'ạ'.repeat(250)} www.example.com` }],
      }),
      slugs,
    )
    expect(result?.message.startsWith('Xem ngay ')).toBe(true)
    expect(result?.message).not.toMatch(/https?:|<b>|\u0007/)
    expect(result?.message.length).toBeLessThanOrEqual(600)
    expect(result?.followUp.length).toBeLessThanOrEqual(200)
    expect(result?.books[0]?.reason.length).toBeLessThanOrEqual(200)
    expect(result?.books[0]?.reason).not.toContain('www.')
  })

  it('crisis / off_topic → không có sách', () => {
    expect(validateReply(reply({ intent: 'crisis' }), slugs)?.books).toEqual([])
    expect(validateReply(reply({ intent: 'off_topic' }), slugs)?.books).toEqual([])
  })

  it('giữ cờ non_vietnamese', () => {
    expect(validateReply(reply({ non_vietnamese: true }), slugs)?.nonVietnamese).toBe(true)
  })
})
