import { ExternalLinkIcon } from 'lucide-react'
import { routing } from '@/i18n/routing'

type ShopPathname = '/books/[slug]' | '/categories/[slug]' | '/authors/[slug]'

/** Trang chủ cửa hàng (tiếng Việt, không prefix) */
export const SHOP_HOME_PATH = routing.pathnames['/']

/** URL tiếng Việt của trang cửa hàng (/sach/<slug>…). Admin không có provider của next-intl nên tính thẳng từ routing. */
export function shopPath(pathname: ShopPathname, slug: string) {
  return routing.pathnames[pathname].vi.replace('[slug]', encodeURIComponent(slug))
}

/**
 * Mở trang cửa hàng tương ứng ở tab mới (xem kết quả sau khi sửa). Sách / danh mục đang ẩn thì trang cửa hàng 404 →
 * `hiddenLabel`: chữ mờ, không phải link, kèm lý do.
 */
export function ShopLink({
  pathname,
  slug,
  label,
  newTabLabel,
  hiddenLabel,
}: {
  pathname: ShopPathname
  slug: string
  label: string
  newTabLabel: string
  /** Có giá trị = đang ẩn ("Đang ẩn, khách không thấy") */
  hiddenLabel?: string
}) {
  if (hiddenLabel) {
    return (
      <span aria-disabled="true" className="inline-flex items-center gap-1.5 text-sm text-subtle" data-testid="shop-link-hidden">
        <span className="opacity-60">{label}</span>
        <ExternalLinkIcon aria-hidden className="size-3.5 opacity-60" />
        <span>· {hiddenLabel}</span>
      </span>
    )
  }
  return (
    <a
      // Admin không có Link của next-intl; cửa hàng là root layout khác nên tải lại cả trang là đúng
      // eslint-disable-next-line no-restricted-syntax
      href={shopPath(pathname, slug)}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-1.5 rounded-sm text-sm text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus-ring"
    >
      {label}
      <ExternalLinkIcon aria-hidden className="size-3.5" />
      <span className="sr-only">{newTabLabel}</span>
    </a>
  )
}
