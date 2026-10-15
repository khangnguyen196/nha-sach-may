import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Constants } from '@/types/database'
import { canAdminCancel, canMarkPaid, forwardStatus, nextStatuses } from './status'

const STATUSES = Constants.public.Enums.order_status

/** Bảng chuyển trạng thái trong `private.order_status_transition_allowed` của schema.sql (nguồn sự thật ở DB) */
function transitionsInSchema() {
  const sql = readFileSync(join(import.meta.dirname, '../../../../supabase/schema.sql'), 'utf8')
  const body = /function private\.order_status_transition_allowed[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(sql)?.[1]
  if (!body) throw new Error('Không tìm thấy order_status_transition_allowed trong schema.sql')
  const table = new Map<string, string[]>()
  for (const [, from, targets] of body.matchAll(/when '(\w+)'\s+then p_to in \(([^)]*)\)/g)) {
    table.set(from ?? '', [...(targets ?? '').matchAll(/'(\w+)'/g)].map((match) => match[1] ?? ''))
  }
  return table
}

describe('nextStatuses', () => {
  it('trùng bảng chuyển trạng thái của trigger trong schema.sql', () => {
    const schema = transitionsInSchema()
    expect(schema.size).toBeGreaterThan(0)
    for (const status of STATUSES) {
      expect([...nextStatuses(status)].sort(), status).toEqual([...(schema.get(status) ?? [])].sort())
    }
  })

  it('delivered và cancelled là trạng thái cuối', () => {
    expect(nextStatuses('delivered')).toEqual([])
    expect(nextStatuses('cancelled')).toEqual([])
  })
})

describe('forwardStatus', () => {
  it('đi theo luồng giao, không tính hủy', () => {
    expect(forwardStatus('pending')).toBe('confirmed')
    expect(forwardStatus('confirmed')).toBe('shipping')
    expect(forwardStatus('shipping')).toBe('delivered')
    expect(forwardStatus('delivered')).toBeNull()
    expect(forwardStatus('cancelled')).toBeNull()
  })

  it('luôn là một trạng thái được phép chuyển tới', () => {
    for (const status of STATUSES) {
      const next = forwardStatus(status)
      if (next) expect(nextStatuses(status)).toContain(next)
    }
  })
})

describe('canAdminCancel', () => {
  it('hủy được từ 3 trạng thái đầu', () => {
    expect(STATUSES.filter(canAdminCancel)).toEqual(['pending', 'confirmed', 'shipping'])
  })
})

describe('canMarkPaid', () => {
  const order = { status: 'pending', payment_method: 'bank_transfer', payment_status: 'unpaid' } as const

  it('đơn chuyển khoản chưa thanh toán, chưa hủy', () => {
    expect(canMarkPaid(order)).toBe(true)
    expect(canMarkPaid({ ...order, status: 'delivered' })).toBe(true)
  })

  it('COD, đã thanh toán / hoàn tiền, đã hủy → không', () => {
    expect(canMarkPaid({ ...order, payment_method: 'cod' })).toBe(false)
    expect(canMarkPaid({ ...order, payment_status: 'paid' })).toBe(false)
    expect(canMarkPaid({ ...order, payment_status: 'refunded' })).toBe(false)
    expect(canMarkPaid({ ...order, status: 'cancelled' })).toBe(false)
  })
})
