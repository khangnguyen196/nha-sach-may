'use client'

import { useSyncExternalStore, type ReactNode } from 'react'

const subscribe = () => () => {}

function hashHasError() {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  return hash.has('error_code') || hash.has('error')
}

/**
 * Template email mặc định của Supabase báo link lỗi (hết hạn / đã dùng) sau dấu `#` (`#error=…&error_code=otp_expired`):
 * server không đọc được phần này nên render `invalid` ("Liên kết không hợp lệ"); sau hydrate, có lỗi trong hash thì
 * đổi sang `expired` (có nút "Yêu cầu liên kết mới"). Cả hai khối do server dịch và render sẵn.
 */
export function LinkErrorNotice({ invalid, expired }: { invalid: ReactNode; expired: ReactNode }) {
  // Server snapshot false: HTML server và lần hydrate đầu giống nhau, sau đó React đọc hash thật
  const hasHashError = useSyncExternalStore(subscribe, hashHasError, () => false)
  return hasHashError ? expired : invalid
}
