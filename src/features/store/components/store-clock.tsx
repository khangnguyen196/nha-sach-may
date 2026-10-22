'use client'

import { useSyncExternalStore } from 'react'
import { fillTemplate } from '@/lib/template'
import { formatVnTime, isStoreOpen, msUntilNextMinute, vnDateTimeAttr } from '../hours'

const MINUTE_MS = 60_000

// Báo React đúng đầu mỗi phút (không chạy mỗi giây). Timer của tab nền bị trình duyệt giãn ra → khi tab hiện lại
// thì báo ngay và hẹn lại từ đầu.
function subscribeMinute(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = () => {
    timer = setTimeout(() => {
      onChange()
      schedule()
    }, msUntilNextMinute(new Date()))
  }
  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return
    clearTimeout(timer)
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

// Số phút kể từ epoch: giữ nguyên trong cả phút nên React chỉ render lại khi sang phút mới
const getMinute = () => Math.floor(Date.now() / MINUTE_MS)
// Server, prerender và lần hydrate: chưa biết giờ của khách → chỗ giữ rỗng (không đóng băng giờ vào HTML)
const getServerMinute = () => null

const lineClass = 'h-[1lh] text-xs whitespace-nowrap text-muted-foreground tabular-nums sm:text-sm'

/** Giờ Việt Nam + trạng thái cửa hàng. Không aria-live: không đọc lại mỗi phút. */
export function StoreClock({
  timeTemplate,
  openLabel,
  closedLabel,
  locale,
  className = '',
}: {
  /** Câu đã dịch, giữ chỗ trống `{time}` */
  timeTemplate: string
  openLabel: string
  closedLabel: string
  locale: string
  className?: string
}) {
  const minute = useSyncExternalStore(subscribeMinute, getMinute, getServerMinute)

  if (minute === null) return <p aria-hidden="true" className={`${lineClass} ${className}`} data-testid="store-clock" />

  const now = new Date(minute * MINUTE_MS)
  return (
    <p className={`${lineClass} ${className}`} data-testid="store-clock">
      <time dateTime={vnDateTimeAttr(now)}>{fillTemplate(timeTemplate, { time: formatVnTime(now, locale) })}</time>
      <span aria-hidden="true"> · </span>
      <span>{isStoreOpen(now) ? openLabel : closedLabel}</span>
    </p>
  )
}
