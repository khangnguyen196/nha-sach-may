import type { ReactNode } from 'react'

/**
 * Khối thông báo thay chỗ form (đã gửi email, đổi mật khẩu xong, link hết hạn). Không hook → dùng được ở cả
 * Server Component lẫn form client. role="status" để trình đọc màn hình đọc khi nó thay form sau khi gửi.
 */
export function Notice({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div role="status" className="rounded-lg border bg-surface p-6">
      <h2 className="font-serif text-xl font-medium">{title}</h2>
      <div className="mt-3 text-sm text-muted-foreground">{children}</div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
