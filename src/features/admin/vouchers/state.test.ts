import { describe, expect, it } from 'vitest'
import { voucherState } from './state'

const now = new Date('2026-10-15T12:00:00Z')
const base = { is_active: true, starts_at: null, ends_at: null, usage_limit: null, used_count: 0 }

describe('voucherState', () => {
  it('đang chạy khi bật, trong thời gian, còn lượt', () => {
    expect(voucherState(base, now)).toBe('active')
    expect(
      voucherState(
        { ...base, starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-11-01T00:00:00Z', usage_limit: 5, used_count: 4 },
        now,
      ),
    ).toBe('active')
  })

  it('tắt / chưa tới giờ / hết hạn / hết lượt', () => {
    expect(voucherState({ ...base, is_active: false }, now)).toBe('inactive')
    expect(voucherState({ ...base, starts_at: '2026-10-16T00:00:00Z' }, now)).toBe('scheduled')
    expect(voucherState({ ...base, ends_at: '2026-10-15T11:59:59Z' }, now)).toBe('expired')
    expect(voucherState({ ...base, usage_limit: 3, used_count: 3 }, now)).toBe('exhausted')
  })

  it('đã tắt được ưu tiên hơn mọi trạng thái khác (cùng thứ tự với voucher_discount)', () => {
    expect(voucherState({ ...base, is_active: false, ends_at: '2026-01-01T00:00:00Z' }, now)).toBe('inactive')
  })
})
