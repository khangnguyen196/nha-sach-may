import { ChevronRightIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link, type Href } from '@/i18n/navigation'

export type Crumb = { label: string; href?: Href }

/** Trang chủ luôn đứng đầu; mục cuối (không có href) là trang hiện tại */
export async function Breadcrumb({ items }: { items: Crumb[] }) {
  const t = await getTranslations('catalog')
  const crumbs: Crumb[] = [{ label: t('home'), href: '/' }, ...items]

  return (
    <nav aria-label={t('breadcrumb')}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => (
          <li key={index} className="flex min-w-0 items-center gap-1.5">
            {index > 0 && <ChevronRightIcon aria-hidden className="size-3.5 shrink-0 text-subtle" />}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="rounded-sm transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-focus-ring"
              >
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="line-clamp-1 text-foreground">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
