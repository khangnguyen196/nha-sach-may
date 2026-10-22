import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Hours = typeof import('./hours')

// ICU mới chèn U+202F (narrow no-break space) hoặc U+00A0 trước AM / PM
const normalizeSpaces = (text: string) => text.replace(/[  ]/g, ' ')

const at = (iso: string) => new Date(iso)

function defineCases(load: () => Hours) {
  it.each([
    ['2026-10-21T22:59:00Z', '05:59', false],
    ['2026-10-21T23:00:00Z', '06:00', true],
    ['2026-10-22T14:59:00Z', '21:59', true],
    ['2026-10-22T15:00:00Z', '22:00', false],
    ['2026-10-22T17:00:00Z', '00:00', false],
  ])('%s = %s giờ VN → mở cửa: %s', (iso, vnTime, open) => {
    const { isStoreOpen, formatVnTime } = load()
    expect(formatVnTime(at(iso), 'vi')).toBe(vnTime)
    expect(isStoreOpen(at(iso))).toBe(open)
  })

  it('vnHourMinute theo giờ VN', () => {
    expect(load().vnHourMinute(at('2026-10-22T07:35:00Z'))).toEqual({ hour: 14, minute: 35 })
    expect(load().vnHourMinute(at('2026-10-22T17:00:00Z'))).toEqual({ hour: 0, minute: 0 })
  })

  it('định dạng giờ theo locale', () => {
    const { formatVnTime } = load()
    expect(formatVnTime(at('2026-10-22T07:35:00Z'), 'vi')).toBe('14:35')
    expect(formatVnTime(at('2026-10-22T17:00:00Z'), 'vi')).toBe('00:00')
    expect(normalizeSpaces(formatVnTime(at('2026-10-22T07:35:00Z'), 'en'))).toBe('2:35 PM')
    expect(normalizeSpaces(formatVnTime(at('2026-10-22T17:00:00Z'), 'en'))).toBe('12:00 AM')
  })

  it('vnDateTimeAttr lấy cả ngày theo giờ VN', () => {
    const { vnDateTimeAttr } = load()
    expect(vnDateTimeAttr(at('2026-10-22T07:35:00Z'))).toBe('2026-10-22T14:35+07:00')
    // 00:00 ngày 23/10 giờ VN = 17:00Z ngày 22/10
    expect(vnDateTimeAttr(at('2026-10-22T17:00:00Z'))).toBe('2026-10-23T00:00+07:00')
    expect(vnDateTimeAttr(at('2026-12-31T17:05:00Z'))).toBe('2027-01-01T00:05+07:00')
  })

  it('msUntilNextMinute', () => {
    const { msUntilNextMinute } = load()
    expect(msUntilNextMinute(at('2026-10-22T07:35:00.000Z'))).toBe(60_000)
    expect(msUntilNextMinute(at('2026-10-22T07:35:30.500Z'))).toBe(29_500)
    expect(msUntilNextMinute(at('2026-10-22T07:35:59.999Z'))).toBe(1)
  })
}

describe('giờ cửa hàng (múi giờ của máy chạy test)', () => {
  let hours: Hours
  beforeEach(async () => {
    hours = await import('./hours')
  })
  defineCases(() => hours)
})

// Một ngày mùa đông (không giờ mùa hè ở Los Angeles): offset phút theo getTimezoneOffset()
const WINTER = at('2026-01-15T00:00:00Z')
const MACHINE_ZONES = [
  ['America/Los_Angeles', 480],
  ['Asia/Tokyo', -540],
] as const

describe.each(MACHINE_ZONES)('giờ cửa hàng khi máy ở múi %s', (timeZone, offset) => {
  let hours: Hours
  beforeEach(async () => {
    vi.stubEnv('TZ', timeZone)
    // Nạp lại module sau khi đổi TZ: formatter ở mức module được tạo dưới múi giờ mới
    vi.resetModules()
    hours = await import('./hours')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('TZ thật sự đã đổi', () => {
    expect(WINTER.getTimezoneOffset()).toBe(offset)
  })

  defineCases(() => hours)
})

it('hai múi giờ thử có offset khác nhau', () => {
  const offsets = MACHINE_ZONES.map(([timeZone]) => {
    vi.stubEnv('TZ', timeZone)
    const value = WINTER.getTimezoneOffset()
    vi.unstubAllEnvs()
    return value
  })
  expect(new Set(offsets).size).toBe(MACHINE_ZONES.length)
})
