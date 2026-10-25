import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import vi from '../../messages/vi.json'
import { ADMIN_VALIDATION_KEYS, ERROR_CODES, invalidInput, toFailure, VALIDATION_KEYS } from './errors'

describe('toFailure', () => {
  it('nhận mã lỗi và parse detail JSON', () => {
    expect(
      toFailure({ message: 'OUT_OF_STOCK', details: '{"book_id": 3, "title": "Dế Mèn", "stock": 2}' }),
    ).toEqual({ ok: false, code: 'OUT_OF_STOCK', details: { book_id: 3, title: 'Dế Mèn', stock: 2 } })
  })

  it('lỗi lạ → UNKNOWN, không lộ chi tiết', () => {
    expect(toFailure({ message: 'duplicate key value violates unique constraint', details: 'Key (id)=(1)' })).toEqual({
      ok: false,
      code: 'UNKNOWN',
    })
  })

  it('postgrest-js không gọi được server (code rỗng, message "TypeError: …") → NETWORK_ERROR', () => {
    expect(toFailure({ message: 'TypeError: fetch failed', details: 'TypeError: fetch failed at …', code: '' })).toEqual({
      ok: false,
      code: 'NETWORK_ERROR',
    })
    expect(toFailure({ message: 'TimeoutError: The operation was aborted due to timeout', code: '' }).code).toBe(
      'NETWORK_ERROR',
    )
    // Lỗi của Postgres / PostgREST luôn có code → không bị coi là lỗi mạng
    expect(toFailure({ message: 'TypeError: something', code: '22P02' }).code).toBe('UNKNOWN')
  })

  it('detail không phải JSON object → bỏ qua', () => {
    expect(toFailure({ message: 'CART_EMPTY', details: 'not json' })).toEqual({ ok: false, code: 'CART_EMPTY' })
    expect(toFailure({ message: 'CART_EMPTY', details: '[1, 2]' })).toEqual({ ok: false, code: 'CART_EMPTY' })
  })
})

describe('ERROR_CODES', () => {
  it('mỗi mã có bản dịch ở cả hai ngôn ngữ, không thừa không thiếu', () => {
    const codes = [...ERROR_CODES].sort()
    expect(Object.keys(vi.errors).sort()).toEqual(codes)
    expect(Object.keys(en.errors).sort()).toEqual(codes)
  })
})

// Mã lỗi DB raise (danh sách cuối schema.sql) mà app không đưa thẳng tới khách: lý do + chỗ đổi mã
const INTERNAL_DB_CODES: Record<string, string> = {
  CHAT_DISABLED: 'consume_chat_quota chưa đặt token = lỗi cấu hình; mapQuotaError (features/chat/quota.ts) đổi thành CHAT_UNAVAILABLE',
}

describe('mã lỗi raise trong supabase/schema.sql', () => {
  const schema = readFileSync(join(import.meta.dirname, '../../supabase/schema.sql'), 'utf8').replace(/--[^\n]*/g, '')
  const known: readonly string[] = ERROR_CODES
  const literal = [...schema.matchAll(/raise exception '([A-Z][A-Z_]+)'/g)].flatMap((m) => (m[1] ? [m[1]] : []))
  // raise exception '%', p_error: chỉ private.chat_quota_take; mã truyền vào là tham số thứ 4 ở mọi lời gọi
  const dynamic = [...schema.matchAll(/chat_quota_take\([^;]*?'([A-Z][A-Z_]+)',\s*'[a-z_]+'/g)].flatMap((m) => (m[1] ? [m[1]] : []))

  it('mọi mã có trong ERROR_CODES và có câu vi / en (trừ mã nội bộ đã liệt kê)', () => {
    const codes = [...new Set([...literal, ...dynamic])].filter((code) => !(code in INTERNAL_DB_CODES)).sort()
    expect(codes.length).toBeGreaterThan(20)
    expect(codes.filter((code) => !known.includes(code))).toEqual([])
    expect(codes.filter((code) => !(code in vi.errors) || !(code in en.errors))).toEqual([])
  })

  it('raise động (`%`) chỉ có ở chat_quota_take, mã của nó đọc được', () => {
    expect(schema.match(/raise exception '%'/g)).toHaveLength(1)
    expect([...new Set(dynamic)].sort()).toEqual(['CHAT_FREE_QUOTA', 'CHAT_QUOTA_EXCEEDED', 'WARNING_QUOTA_EXCEEDED'])
  })

  it('mã nội bộ vẫn còn được raise (xóa khỏi danh sách khi schema bỏ)', () => {
    for (const code of Object.keys(INTERNAL_DB_CODES)) expect(literal).toContain(code)
  })
})

describe('VALIDATION_KEYS', () => {
  it('mỗi khóa có bản dịch ở cả hai ngôn ngữ, không thừa không thiếu', () => {
    const keys = [...VALIDATION_KEYS].sort()
    expect(Object.keys(vi.validation).sort()).toEqual(keys)
    expect(Object.keys(en.validation).sort()).toEqual(keys)
  })
})

describe('ADMIN_VALIDATION_KEYS', () => {
  it('mỗi khóa có bản dịch ở admin.validation (chỉ tiếng Việt), không thừa không thiếu', () => {
    expect(Object.keys(vi.admin.validation).sort()).toEqual([...ADMIN_VALIDATION_KEYS].sort())
  })

  it('không trùng khóa validation dùng chung', () => {
    const shared: readonly string[] = VALIDATION_KEYS
    expect(ADMIN_VALIDATION_KEYS.filter((key) => shared.includes(key))).toEqual([])
  })
})

describe('invalidInput', () => {
  it('lấy lỗi đầu tiên của từng ô; message không phải khóa validation → invalid', () => {
    expect(
      invalidInput({
        issues: [
          { path: ['email'], message: 'required' },
          { path: ['email'], message: 'email' },
          { path: ['phone'], message: 'Invalid input: expected string' },
        ],
      }),
    ).toEqual({ ok: false, code: 'INVALID_INPUT', fieldErrors: { email: 'required', phone: 'invalid' } })
  })

  it('nhận khóa validation của admin', () => {
    expect(invalidInput({ issues: [{ path: ['price'], message: 'price' }] })).toEqual({
      ok: false,
      code: 'INVALID_INPUT',
      fieldErrors: { price: 'price' },
    })
  })
})

describe('câu lỗi hủy đơn / mã giảm giá (ux-messages)', () => {
  const locales = [vi.errors, en.errors]

  it('lý do cần cửa hàng xử lý (đã xác nhận / đang giao, đã giao, đã thanh toán, tài khoản khóa) có email liên hệ', () => {
    for (const errors of locales) {
      for (const code of ['ORDER_IN_PROGRESS', 'ORDER_DELIVERED', 'ORDER_PAID', 'ACCOUNT_LOCKED', 'UNKNOWN'] as const) {
        expect(errors[code], code).toContain('{email}')
      }
    }
  })

  it('ORDER_IN_PROGRESS phân biệt đã xác nhận / đang giao (detail status của cancel_order)', () => {
    for (const errors of locales) expect(errors.ORDER_IN_PROGRESS).toMatch(/\{status, select, shipping \{.+\} other \{.+\}\}/)
  })

  it('mã giảm giá chưa tới ngày / hết hạn nhắc thời điểm (detail starts_at / ends_at)', () => {
    for (const errors of locales) {
      expect(errors.VOUCHER_NOT_STARTED).toContain('{starts_at}')
      expect(errors.VOUCHER_EXPIRED).toContain('{ends_at}')
    }
  })
})

describe('toFailure: lỗi trước đây rơi vào UNKNOWN', () => {
  it('JWT bị PostgREST từ chối (phiên cũ) → SESSION_EXPIRED', () => {
    for (const code of ['PGRST301', 'PGRST302', 'PGRST303']) {
      expect(toFailure({ code, message: 'JWT expired' }), code).toEqual({ ok: false, code: 'SESSION_EXPIRED' })
    }
  })

  it('RLS / quyền cột chặn ghi (42501) → FORBIDDEN; mã do raise exception đặt vẫn ưu tiên', () => {
    expect(toFailure({ code: '42501', message: 'new row violates row-level security policy' })).toEqual({
      ok: false,
      code: 'FORBIDDEN',
    })
    expect(toFailure({ code: '42501', message: 'FORBIDDEN' })).toEqual({ ok: false, code: 'FORBIDDEN' })
  })

  it('lỗi phía máy chủ khác (timeout câu lệnh…) vẫn là UNKNOWN', () => {
    expect(toFailure({ code: '57014', message: 'canceling statement due to statement timeout' })).toEqual({
      ok: false,
      code: 'UNKNOWN',
    })
  })
})
