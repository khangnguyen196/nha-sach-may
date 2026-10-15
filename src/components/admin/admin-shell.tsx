import {
  BookOpenIcon,
  FolderTreeIcon,
  LayoutDashboardIcon,
  PackageIcon,
  PenLineIcon,
  StoreIcon,
  MessageSquareTextIcon,
  TicketPercentIcon,
} from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { AdminLink } from './admin-link'
import { AdminNav, type AdminNavItem } from './admin-nav'
import { SHOP_HOME_PATH } from './shop-link'

const focusRing = 'rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

/** Khung admin: thanh điều hướng trên (mobile) / trái (desktop). Trang tự dựng `<main id="main">`. */
export async function AdminShell({ children }: { children: ReactNode }) {
  const [t, tLayout, tCommon] = await Promise.all([
    getTranslations('admin'),
    getTranslations('layout'),
    getTranslations('common'),
  ])
  const items: AdminNavItem[] = [
    { href: '/admin', label: t('nav.dashboard'), icon: <LayoutDashboardIcon aria-hidden /> },
    { href: '/admin/sach', label: t('nav.books'), icon: <BookOpenIcon aria-hidden /> },
    { href: '/admin/danh-muc', label: t('nav.categories'), icon: <FolderTreeIcon aria-hidden /> },
    { href: '/admin/tac-gia', label: t('nav.authors'), icon: <PenLineIcon aria-hidden /> },
    { href: '/admin/don-hang', label: t('nav.orders'), icon: <PackageIcon aria-hidden /> },
    { href: '/admin/voucher', label: t('nav.vouchers'), icon: <TicketPercentIcon aria-hidden /> },
    { href: '/admin/danh-gia', label: t('nav.reviews'), icon: <MessageSquareTextIcon aria-hidden /> },
  ]
  const themeToggle = <ThemeToggle labels={{ toLight: tLayout('toLightTheme'), toDark: tLayout('toDarkTheme') }} />

  return (
    <div className="md:grid md:min-h-dvh md:grid-cols-[15rem_minmax(0,1fr)]">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur md:flex md:h-dvh md:flex-col md:border-r md:border-b-0">
        <div className="flex h-14 items-center gap-2 px-4 md:h-16 md:px-6">
          <AdminLink href="/admin" className={`font-serif text-base font-semibold ${focusRing}`}>
            {tCommon('siteName')}{' '}
            <span className="font-sans text-sm font-normal text-muted-foreground">· {t('title')}</span>
          </AdminLink>
          <div className="ml-auto md:hidden">{themeToggle}</div>
        </div>
        <AdminNav label={t('nav.label')} items={items} />
        <div className="mt-auto hidden items-center justify-between gap-2 border-t px-6 py-3 md:flex">
          <a
            // Cửa hàng là root layout khác: link thường, tải lại cả trang
            // eslint-disable-next-line no-restricted-syntax
            href={SHOP_HOME_PATH}
            className={`flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground ${focusRing}`}
          >
            <StoreIcon aria-hidden className="size-4" />
            {t('nav.backToShop')}
          </a>
          {themeToggle}
        </div>
      </header>
      {children}
    </div>
  )
}
