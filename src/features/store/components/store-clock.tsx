'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import type { Locale } from 'next-intl'
import { placeholder } from '@/lib/template'
import { clockAngles, formatVnTime, isStoreOpen, msUntilNext, vnDateTimeAttr } from '../hours'

const SECOND_MS = 1000
const MINUTE_MS = 60_000

// Báo React đúng đầu mỗi giây / phút. Tab ẩn thì dừng hẹn giờ (không đánh thức máy mỗi giây cho một đồng hồ không ai
// nhìn); tab hiện lại thì báo ngay (giờ mới) rồi hẹn lại từ đầu.
function subscribeEvery(unitMs: number) {
  return (onChange: () => void) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if (document.visibilityState !== 'visible') return
      timer = setTimeout(() => {
        onChange()
        schedule()
      }, msUntilNext(new Date(), unitMs))
    }
    const onVisibilityChange = () => {
      clearTimeout(timer)
      if (document.visibilityState !== 'visible') return
      onChange()
      schedule()
    }
    schedule()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
}

// Tạo một lần ở mức module: hàm subscribe đổi giữa các lần render thì React hủy rồi đăng ký lại
const subscribeSecond = subscribeEvery(SECOND_MS)
const subscribeMinute = subscribeEvery(MINUTE_MS)
// Mốc đầu giây / phút (ms): giữ nguyên trong cả đơn vị nên React chỉ render lại khi sang giây / phút mới
const getSecondTick = () => Math.floor(Date.now() / SECOND_MS) * SECOND_MS
const getMinuteTick = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS
// Server, prerender và lần hydrate: chưa biết giờ của khách → mặt không kim + dòng rỗng (không đóng băng giờ vào HTML)
const getServerTick = () => null

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
function subscribeReducedMotion(onChange: () => void) {
  const query = matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const getReducedMotion = () => matchMedia(REDUCED_MOTION).matches
const getServerReducedMotion = () => false

// Một dòng ở cỡ chữ mặc định (e2e 320px canh). Chỉ ngắt được ở hai chỗ: sau dấu " · " (khoảng trắng trước dấu chấm là
// \u00a0: dấu chấm dính với "giờ Việt Nam", dòng 2 không bắt đầu bằng "·"), và nếu cụm giờ + dấu chấm vẫn không vừa
// thì thêm dấu cách ngay sau ô giờ (đo 2026-10-23, 1.5rem ở màn 320px: en "10:44:44 AM in Vietnam ·" 292 > 288px, vi
// 283px vừa). Chữ phóng to thì xuống dòng thay vì làm cả trang cuộn ngang (chấp nhận giật một dòng trong trường hợp đó).
// min-h giữ chỗ rỗng cao đúng 1 dòng.
// Không dùng tabular-nums: Be Vietnam Pro tự host không có tnum (GSUB chỉ ccmp, dnom, frac, liga, locl, numr; đo
// 2026-10-23) nên class không đổi gì. Dấu chấm và trạng thái giữ đứng yên bằng ô giờ rộng cố định (TimeCell).
const lineClass = 'mt-3 min-h-[1lh] text-xs text-muted-foreground sm:text-sm'

// Mốc (UTC, ms) có chuỗi giờ rộng nhất trong ngày: vi có giây 04:44:44, không giây 04:44; en 10:44:44 AM / 10:44 AM
// (AM rộng hơn PM). Đo bằng script ngoài repo 2026-10-23, Be Vietnam Pro 400 (3 subset), cùng chuỗi ở 12 / 14 / 24px.
// Đổi font hoặc định dạng giờ thì đo lại; e2e "ô giờ rộng ≥ mọi chuỗi giờ trong ngày" canh.
const WIDEST_TIME_UTC: Record<Locale, { seconds: number; minutes: number }> = {
  vi: { seconds: 1767217484000, minutes: 1767217440000 },
  en: { seconds: 1767239084000, minutes: 1767239040000 },
}

// Ô giờ rộng bằng giờ rộng nhất: mẫu ẩn và giờ thật xếp chồng trong một ô grid, chữ số trong ô được nhích nhưng mọi thứ
// sau ô đứng yên. Mẫu là phần tử rỗng, chữ ở ::after: không vào cây trợ năng, không bị chép, textContent của <time> chỉ
// còn giờ thật. Trước khi font tải xong (display: swap) ô đo theo font dự phòng nên có thể nhích một lần khi font tải.
function TimeCell({ now, locale, withSeconds }: { now: Date; locale: Locale; withSeconds: boolean }) {
  const widest = WIDEST_TIME_UTC[locale][withSeconds ? 'seconds' : 'minutes']
  return (
    <span className="inline-grid whitespace-nowrap">
      <span
        aria-hidden="true"
        data-clock-sample={formatVnTime(new Date(widest), locale, withSeconds)}
        className="invisible col-start-1 row-start-1 after:content-[attr(data-clock-sample)]"
      />
      <span className="col-start-1 row-start-1">{formatVnTime(now, locale, withSeconds)}</span>
    </span>
  )
}

// Kim xoay bằng thuộc tính transform của SVG, không transition / animation: kim nhảy đúng lúc sang giây / phút mới
// (không trượt, không quay ngược một vòng lúc 59 → 0).
function ClockHands({ date, showSeconds }: { date: Date; showSeconds: boolean }) {
  const angles = clockAngles(date)
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 size-full">
      <line
        data-hand="hour"
        x1="50"
        y1="50"
        x2="50"
        y2="28"
        transform={`rotate(${angles.hour} 50 50)`}
        className="stroke-foreground"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        data-hand="minute"
        x1="50"
        y1="50"
        x2="50"
        y2="16"
        transform={`rotate(${angles.minute} 50 50)`}
        className="stroke-foreground"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {showSeconds ? (
        <line
          data-hand="second"
          x1="50"
          y1="58"
          x2="50"
          y2="12"
          transform={`rotate(${angles.second} 50 50)`}
          className="stroke-primary"
          strokeWidth="1"
          strokeLinecap="round"
        />
      ) : null}
      <circle cx="50" cy="50" r="2.5" className="fill-primary" />
    </svg>
  )
}

/**
 * Đồng hồ kim giờ Việt Nam + dòng giờ số và trạng thái cửa hàng. Mặt đồng hồ (children, Server Component) là hình
 * trang trí; thông tin đọc được nằm ở <time>. Không aria-live: không đọc lại mỗi giây.
 * Giảm chuyển động: không kim giây, dòng số giờ:phút, cập nhật mỗi phút.
 */
export function StoreClock({
  timeTemplate,
  openLabel,
  closedLabel,
  locale,
  className = '',
  children,
}: {
  /** Câu đã dịch, giữ chỗ trống `{time}` */
  timeTemplate: string
  openLabel: string
  closedLabel: string
  locale: Locale
  className?: string
  /** Mặt đồng hồ (ClockFace) */
  children: ReactNode
}) {
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getServerReducedMotion)
  const tick = useSyncExternalStore(
    reduced ? subscribeMinute : subscribeSecond,
    reduced ? getMinuteTick : getSecondTick,
    getServerTick,
  )
  const now = tick === null ? null : new Date(tick)
  // Tách câu quanh chỗ trống thay vì fillTemplate: fillTemplate chỉ trả chuỗi, không chèn được ô giờ. Dấu cách đầu phần
  // sau là chỗ ngắt duy nhất trong <time>; phần chữ còn lại không ngắt.
  const [before, after = ''] = timeTemplate.split(placeholder('time'))
  const afterWords = after.trimStart()
  const afterSpace = after.slice(0, after.length - afterWords.length)

  return (
    <div className={className}>
      <div
        data-testid="store-clock-face"
        className="relative size-28 rounded-full border border-border bg-surface sm:size-36"
        aria-hidden="true"
      >
        {children}
        {now ? <ClockHands date={now} showSeconds={!reduced} /> : null}
      </div>
      {now ? (
        <p className={lineClass} data-testid="store-clock">
          <time dateTime={vnDateTimeAttr(now, !reduced)}>
            {before}
            <TimeCell now={now} locale={locale} withSeconds={!reduced} />
            {afterSpace}
            <span className="whitespace-nowrap">{afterWords}</span>
          </time>
          <span aria-hidden="true">{'\u00a0· '}</span>
          <span className="whitespace-nowrap">{isStoreOpen(now) ? openLabel : closedLabel}</span>
        </p>
      ) : (
        <p aria-hidden="true" className={lineClass} data-testid="store-clock" />
      )}
    </div>
  )
}
