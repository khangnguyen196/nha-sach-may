import { getTranslations } from 'next-intl/server'
import type { ComponentProps } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { NotFoundKind } from '@/lib/not-found-kind'

type Href = ComponentProps<typeof Link>['href']
type NotFoundLink = { href: Href; label: string }

type Props = {
  kind: NotFoundKind
  /** h1 khi là nội dung chính của trang (not-found.tsx, trang chưa có h1 ở shell); h2 khi nằm dưới tiêu đề có sẵn */
  heading?: 'h1' | 'h2'
  /** Link chính thay cho mặc định của loại trang (VD "Về trang đầu" của danh sách vượt quá số trang) */
  primary?: NotFoundLink
}

/**
 * Nội dung 404: nói rõ cái gì không có / vì sao, kèm đường đi tiếp. Đơn hàng: CÙNG một câu cho mã sai, đơn không có và
 * đơn của tài khoản khác (không để lộ mã đơn nào tồn tại).
 */
export async function NotFoundView({ kind, heading = 'h1', primary }: Props) {
  const t = await getTranslations('notFound')
  const Heading = heading
  const description = {
    page: t('description'),
    book: t('book'),
    category: t('category'),
    author: t('author'),
    order: t('order'),
    address: t('address'),
    'used-listing': t('usedListing'),
  }[kind]
  // Sách / danh mục / tác giả: tìm sách hoặc xem danh mục
  const catalogLinks: NotFoundLink[] = [
    { href: '/search', label: t('search') },
    // Lưới danh mục ở cuối trang chủ
    { href: { pathname: '/', hash: 'categories-title' }, label: t('browse') },
  ]
  const links: Record<NotFoundKind, NotFoundLink[]> = {
    page: [
      { href: '/search', label: t('search') },
      { href: '/', label: t('backHome') },
    ],
    book: catalogLinks,
    category: catalogLinks,
    author: catalogLinks,
    order: [
      { href: '/account/orders', label: t('myOrders') },
      { href: '/', label: t('backHome') },
    ],
    address: [
      { href: '/account/addresses', label: t('addressBook') },
      { href: '/account', label: t('account') },
    ],
    'used-listing': [
      { href: '/account/my-listings', label: t('myListings') },
      { href: '/account', label: t('account') },
    ],
  }
  const [first, second] = primary ? [primary, links[kind][0]] : links[kind]

  return (
    <div className="flex flex-col items-start" data-testid="not-found" data-kind={kind}>
      <Heading className="font-serif text-3xl font-medium">{t('title')}</Heading>
      <p className="mt-4 max-w-reading text-muted-foreground">{description}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        {first && (
          <Link href={first.href} className={buttonVariants({ size: 'lg', className: 'h-11 px-5 text-base' })}>
            {first.label}
          </Link>
        )}
        {second && (
          <Link href={second.href} className={buttonVariants({ variant: 'outline', size: 'lg', className: 'h-11 px-5 text-base' })}>
            {second.label}
          </Link>
        )}
      </div>
    </div>
  )
}
