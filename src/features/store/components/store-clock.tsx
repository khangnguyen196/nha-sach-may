'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import type { Locale } from 'next-intl'
import { fillTemplate } from '@/lib/template'
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

// Một dòng ở cỡ chữ mặc định (e2e 320px canh). Mỗi cụm không ngắt, chỉ xuống dòng sau dấu " · " (khoảng trắng trước dấu
// chấm là  : dấu chấm dính với giờ, dòng 2 không bắt đầu bằng "·"): chữ phóng to thì xuống dòng thay vì làm cả trang
// cuộn ngang (chấp nhận giật một dòng trong trường hợp đó). min-h giữ chỗ rỗng cao đúng 1 dòng.
const lineClass = 'mt-3 min-h-[1lh] text-xs text-muted-foreground tabular-nums sm:text-sm'

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
          <time dateTime={vnDateTimeAttr(now, !reduced)} className="whitespace-nowrap">
            {fillTemplate(timeTemplate, { time: formatVnTime(now, locale, !reduced) })}
          </time>
          <span aria-hidden="true">{' · '}</span>
          <span className="whitespace-nowrap">{isStoreOpen(now) ? openLabel : closedLabel}</span>
        </p>
      ) : (
        <p aria-hidden="true" className={lineClass} data-testid="store-clock" />
      )}
    </div>
  )
}
