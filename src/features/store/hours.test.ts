import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Hours = typeof import('./hours')

// Tùy bản ICU / V8, giữa giờ và AM / PM có thể là U+202F, U+00A0 hoặc dấu cách thường
const normalizeSpaces = (text: string) => text.replace(/[\u202f\u00a0]/g, ' ')

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
    expect(formatVnTime(at(iso), 'vi', false)).toBe(vnTime)
    expect(isStoreOpen(at(iso))).toBe(open)
  })

  it('vnHourMinute theo giờ VN', () => {
    expect(load().vnHourMinute(at('2026-10-22T07:35:00Z'))).toEqual({ hour: 14, minute: 35 })
    expect(load().vnHourMinute(at('2026-10-22T17:00:00Z'))).toEqual({ hour: 0, minute: 0 })
  })

  it('định dạng giờ theo locale', () => {
    const { formatVnTime } = load()
    expect(formatVnTime(at('2026-10-22T07:35:00Z'), 'vi', false)).toBe('14:35')
    expect(formatVnTime(at('2026-10-22T17:00:00Z'), 'vi', false)).toBe('00:00')
    expect(normalizeSpaces(formatVnTime(at('2026-10-22T07:35:00Z'), 'en', false))).toBe('2:35 PM')
    expect(normalizeSpaces(formatVnTime(at('2026-10-22T17:00:00Z'), 'en', false))).toBe('12:00 AM')
  })

  it('định dạng giờ có giây theo locale', () => {
    const { formatVnTime } = load()
    expect(formatVnTime(at('2026-10-22T16:31:05Z'), 'vi', true)).toBe('23:31:05')
    expect(formatVnTime(at('2026-10-22T17:00:00Z'), 'vi', true)).toBe('00:00:00')
    expect(formatVnTime(at('2026-10-21T22:59:59Z'), 'vi', true)).toBe('05:59:59')
    expect(normalizeSpaces(formatVnTime(at('2026-10-22T16:31:05Z'), 'en', true))).toBe('11:31:05 PM')
    expect(normalizeSpaces(formatVnTime(at('2026-10-22T17:00:00Z'), 'en', true))).toBe('12:00:00 AM')
    // Formatter cache theo cả kiểu: gọi xen kẽ không lẫn có / không giây
    expect(formatVnTime(at('2026-10-22T16:31:05Z'), 'vi', false)).toBe('23:31')
  })

  it('vnDateTimeAttr lấy cả ngày theo giờ VN', () => {
    const { vnDateTimeAttr } = load()
    expect(vnDateTimeAttr(at('2026-10-22T07:35:00Z'), false)).toBe('2026-10-22T14:35+07:00')
    // 00:00 ngày 23/10 giờ VN = 17:00Z ngày 22/10
    expect(vnDateTimeAttr(at('2026-10-22T17:00:00Z'), false)).toBe('2026-10-23T00:00+07:00')
    expect(vnDateTimeAttr(at('2026-12-31T17:05:00Z'), false)).toBe('2027-01-01T00:05+07:00')
  })

  it('vnDateTimeAttr có giây', () => {
    const { vnDateTimeAttr } = load()
    expect(vnDateTimeAttr(at('2026-10-22T16:31:05Z'), true)).toBe('2026-10-22T23:31:05+07:00')
    expect(vnDateTimeAttr(at('2026-10-22T16:59:59Z'), true)).toBe('2026-10-22T23:59:59+07:00')
    expect(vnDateTimeAttr(at('2026-12-31T17:00:00Z'), true)).toBe('2027-01-01T00:00:00+07:00')
  })

  it.each([
    // [UTC, giờ VN, kim giờ, kim phút, kim giây]
    ['2026-10-22T17:00:00Z', '00:00:00', 0, 0, 0],
    ['2026-10-22T05:00:00Z', '12:00:00', 0, 0, 0],
    ['2026-10-21T20:15:30Z', '03:15:30', 97.5, 93, 180],
    ['2026-10-22T07:35:05Z', '14:35:05', 77.5, 210.5, 30],
    ['2026-10-22T14:59:59Z', '21:59:59', 299.5, 359.9, 354],
  ])('góc 3 kim lúc %s (%s giờ VN)', (iso, _vnTime, hour, minute, second) => {
    const angles = load().clockAngles(at(iso))
    expect(angles.hour).toBeCloseTo(hour, 6)
    expect(angles.minute).toBeCloseTo(minute, 6)
    expect(angles.second).toBeCloseTo(second, 6)
  })

  it.each([
    ['vi', true, 10],
    ['vi', false, 10],
    ['en', true, 20],
    ['en', false, 20],
  ] as const)('mẫu ô giờ %s (có giây: %s): đủ %i mẫu, đủ 10 chữ số', (locale, withSeconds, count) => {
    const samples = load().clockCellSamples(locale, withSeconds)
    expect(samples).toHaveLength(count)
    expect(new Set(samples).size).toBe(count)
    // en: mỗi chữ số có ở cả mẫu AM lẫn PM
    const groups = locale === 'en' ? [/AM$/, /PM$/] : [/^/]
    for (const group of groups) {
      const digits = new Set(samples.filter((sample) => group.test(sample)).flatMap((sample) => sample.match(/\d/g) ?? []))
      expect([...digits].sort().join(''), String(group)).toBe('0123456789')
    }
  })

  it.each([
    ['vi', true],
    ['vi', false],
    ['en', true],
    ['en', false],
  ] as const)('mọi giờ trong ngày (%s, có giây: %s) khớp vị trí một mẫu ô giờ', (locale, withSeconds) => {
    const { clockCellSamples, formatVnTime } = load()
    const samples = clockCellSamples(locale, withSeconds)
    const isDigit = (char: string | undefined) => char !== undefined && char >= '0' && char <= '9'
    // Vị trí (căn lề phải) mà các mẫu cùng độ dài không cùng một ký tự: chữ số đổi theo mẫu. Vị trí cố định (en "1"
    // đầu) thì giờ thật cũng phải đúng ký tự đó.
    const varying = new Map(
      samples.map((sample) => {
        const sameLength = samples.filter((other) => other.length === sample.length)
        return [sample, [...sample].map((_, index) => new Set(sameLength.map((other) => other[index])).size > 1)]
      }),
    )
    const varies = (sample: string, index: number) => varying.get(sample)?.[index] === true
    const fits = (text: string, sample: string) => {
      if (text.length > sample.length) return false
      const offset = sample.length - text.length
      return [...text].every((char, index) => {
        const sampleChar = sample[offset + index]
        if (!isDigit(char)) return char === sampleChar
        return isDigit(sampleChar) && (char === sampleChar || varies(sample, offset + index))
      })
    }
    const step = withSeconds ? 1000 : 60_000
    const start = Date.UTC(2026, 0, 1, 17)
    const misfits: string[] = []
    for (let at = start; at < start + 86_400_000; at += step) {
      const text = formatVnTime(new Date(at), locale, withSeconds)
      if (!samples.some((sample) => fits(text, sample))) misfits.push(text)
    }
    expect(misfits.slice(0, 5)).toEqual([])
  })

  it('msUntilNext theo giây và theo phút', () => {
    const { msUntilNext } = load()
    expect(msUntilNext(at('2026-10-22T07:35:00.000Z'), 60_000)).toBe(60_000)
    expect(msUntilNext(at('2026-10-22T07:35:30.500Z'), 60_000)).toBe(29_500)
    expect(msUntilNext(at('2026-10-22T07:35:59.999Z'), 60_000)).toBe(1)
    expect(msUntilNext(at('2026-10-22T07:35:00.000Z'), 1000)).toBe(1000)
    expect(msUntilNext(at('2026-10-22T07:35:30.250Z'), 1000)).toBe(750)
    expect(msUntilNext(at('2026-10-22T07:35:30.999Z'), 1000)).toBe(1)
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
