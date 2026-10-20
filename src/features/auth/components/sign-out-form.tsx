'use client'

import type { ReactNode } from 'react'
import { clearNoteDrafts } from '@/features/checkout/note-draft'

/**
 * Form đăng xuất (Server Action kết thúc bằng redirect(): gửi được trước hydrate, nút không khóa; no-js.md ★8). Có JS thì
 * xóa nháp ghi chú thanh toán của tab trước khi gửi:
 * server không xóa được sessionStorage, người đăng nhập sau trong cùng tab không được thấy nháp đó.
 */
export function SignOutForm({ action, className, children }: { action: () => Promise<void>; className?: string; children: ReactNode }) {
  return (
    <form action={action} onSubmit={() => clearNoteDrafts()} className={className}>
      {children}
    </form>
  )
}
