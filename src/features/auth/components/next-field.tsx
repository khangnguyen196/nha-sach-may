'use client'

import { useSyncExternalStore } from 'react'

const noSubscribe = () => () => {}

/**
 * Input ẩn `next` của form đăng nhập, đọc `?next=` trên URL ở client sau khi hydrate. Không đọc searchParams ở server:
 * phần đó phải nằm trong Suspense, và fallback (một form khác) bị thay khi phần đọc URL stream tới → mất chữ khách đã
 * gõ. Form vì vậy nằm trong khung tĩnh, chỉ có một form ngay từ đầu. Server action lọc lại bằng safeNextPath.
 */
export function NextField() {
  const next = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get('next') ?? '',
    () => '',
  )
  return <input type="hidden" name="next" value={next} />
}
