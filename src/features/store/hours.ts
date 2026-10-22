// "store" ở đây là cửa hàng (giờ mở cửa), không phải state store như features/cart/store.ts.
// Chỉ để hiển thị: giờ mở cửa không ảnh hưởng giỏ hàng hay đặt hàng.
//
// Dùng Intl.DateTimeFormat có sẵn thay vì formatter của next-intl: client không có formatter / provider của next-intl
// (messages precompile, NextIntlClientProvider chỉ truyền namespace 'search'), Intl của trình duyệt tốn 0KB JS.
// Mọi formatter đặt timeZone tường minh: kết quả không phụ thuộc múi giờ của máy khách (không dùng getHours()).

import type { Locale } from 'next-intl'

export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh'
/** Mở cửa khi STORE_OPEN_HOUR ≤ giờ VN < STORE_CLOSE_HOUR */
export const STORE_OPEN_HOUR = 6
export const STORE_CLOSE_HOUR = 22

// hourCycle 'h23': giờ 0–23 (hour12: false có bản ICU trả "24" lúc nửa đêm)
const vnPartsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: VN_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function vnParts(date: Date) {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of vnPartsFormat.formatToParts(date)) parts[part.type] = part.value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

export function vnHourMinute(date: Date) {
  const { hour, minute } = vnParts(date)
  return { hour, minute }
}

export function isStoreOpen(date: Date) {
  const { hour } = vnHourMinute(date)
  return hour >= STORE_OPEN_HOUR && hour < STORE_CLOSE_HOUR
}

const timeFormats = new Map<string, Intl.DateTimeFormat>()

/**
 * Có giây (timeStyle 'medium'): vi "23:31:05", en "11:31:05 PM". Không giây ('short'): vi "14:35" / "00:00",
 * en "2:35 PM" / "12:00 AM" (ICU có thể chèn U+202F trước AM / PM).
 * timeStyle theo mẫu giờ của locale (vi "HH:mm"): hour 'numeric' cho vi ra "0:00", "5:59".
 */
export function formatVnTime(date: Date, locale: Locale, withSeconds: boolean) {
  const timeStyle = withSeconds ? 'medium' : 'short'
  const key = `${locale}:${timeStyle}`
  let format = timeFormats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { timeZone: VN_TIME_ZONE, timeStyle })
    timeFormats.set(key, format)
  }
  return format.format(date)
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

/**
 * Giá trị cho <time dateTime>: "2026-10-22T14:35:05+07:00" (có giây) hoặc "2026-10-22T14:35+07:00", ngày cũng theo
 * giờ VN. VN không có giờ mùa hè nên offset cố định.
 */
export function vnDateTimeAttr(date: Date, withSeconds: boolean) {
  const { year, month, day, hour, minute, second } = vnParts(date)
  const time = withSeconds ? `${pad(hour)}:${pad(minute)}:${pad(second)}` : `${pad(hour)}:${pad(minute)}`
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${time}+07:00`
}

/**
 * Góc (độ, theo chiều kim đồng hồ từ số 12, trong [0, 360)) của 3 kim theo giờ VN. Viết dạng chia để thuộc tính SVG
 * in số gọn (77.5 thay vì 77.50000000000001).
 */
export function clockAngles(date: Date) {
  const { hour: h, minute: m, second: s } = vnParts(date)
  return {
    // 30° mỗi giờ + 0,5° mỗi phút
    hour: (60 * (h % 12) + m) / 2,
    // 6° mỗi phút + 0,1° mỗi giây
    minute: (60 * m + s) / 10,
    second: 6 * s,
  }
}

/**
 * Số ms tới đầu đơn vị kế tiếp (giây: 1000, phút: 60_000). Tính trên mốc UTC được vì giờ VN lệch UTC tròn giờ
 * (+07:00): ranh giới giây / phút của giờ VN trùng ranh giới của UTC.
 */
export function msUntilNext(date: Date, unitMs: number) {
  return unitMs - (date.getTime() % unitMs)
}
