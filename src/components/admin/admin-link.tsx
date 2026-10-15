import NextLink from 'next/link'
import type { ComponentProps } from 'react'

/** Đường dẫn trong khu admin (thư mục `app/admin`, URL tiếng Việt viết thẳng) */
export type AdminHref = '/admin' | `/admin/${string}` | `/admin?${string}`

/**
 * Link của khu admin. Admin không có `[locale]` và không có provider của next-intl nên Link của `i18n/navigation`
 * không dùng được; kiểu `AdminHref` chặn lỡ tay trỏ ra trang cửa hàng (trang cửa hàng phải qua locale).
 */
export function AdminLink({ href, ...props }: Omit<ComponentProps<typeof NextLink>, 'href'> & { href: AdminHref }) {
  return <NextLink href={href} {...props} />
}
