'use client'

import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'

/** Đường dẫn trong khu admin (thư mục `app/admin`, URL tiếng Việt viết thẳng) */
export type AdminHref = '/admin' | `/admin/${string}` | `/admin?${string}`

type Props = Omit<ComponentProps<typeof NextLink>, 'href'> & { href: AdminHref }

/**
 * Link của khu admin. Admin không có `[locale]` và không có provider của next-intl nên Link của `i18n/navigation`
 * không dùng được; kiểu `AdminHref` chặn lỡ tay trỏ ra trang cửa hàng (trang cửa hàng phải qua locale).
 *
 * Không prefetch khi link hiện trên màn hình: trang admin động (theo phiên), mỗi prefetch là một lượt render + kiểm
 * quyền admin ở proxy và layout (đo: ~19 lần rpc is_admin mỗi lần mở danh sách đơn). Chỉ prefetch khi rê chuột /
 * focus / chạm vào link (`prefetch={false}` của Next tắt cả prefetch lúc hover nên tự gọi router.prefetch).
 * Truyền `prefetch` rõ ràng (VD link "Quản trị" từ cửa hàng: `false`) thì giữ đúng giá trị đó, không prefetch khi hover.
 */
export function AdminLink({ href, prefetch, onMouseEnter, onFocus, onTouchStart, ...props }: Props) {
  const router = useRouter()
  const prefetchOnIntent = () => {
    if (prefetch === undefined) router.prefetch(href)
  }
  return (
    <NextLink
      href={href}
      prefetch={prefetch ?? false}
      onMouseEnter={(event) => {
        onMouseEnter?.(event)
        prefetchOnIntent()
      }}
      onFocus={(event) => {
        onFocus?.(event)
        prefetchOnIntent()
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event)
        prefetchOnIntent()
      }}
      {...props}
    />
  )
}
