import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { Link, type Href } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { paginationRange } from '../utils'

type Props = {
  page: number
  totalPages: number
  hrefFor: (page: number) => Href
}

const item = buttonVariants({ variant: 'ghost', size: 'icon-lg', className: 'text-muted-foreground' })

/** Link thật (chạy không cần JS, crawl được); trang hiện tại có aria-current */
export async function Pagination({ page, totalPages, hrefFor }: Props) {
  if (totalPages <= 1) return null
  const t = await getTranslations('catalog.pagination')

  return (
    <nav aria-label={t('label')} className="mt-12 flex justify-center">
      <ul className="flex items-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} rel="prev" className={item}>
              <ChevronLeftIcon aria-hidden />
              <span className="sr-only">{t('previous')}</span>
            </Link>
          ) : (
            <span aria-hidden className={cn(item, 'opacity-40')}>
              <ChevronLeftIcon />
            </span>
          )}
        </li>
        {paginationRange(page, totalPages).map((entry, index) =>
          entry === 'ellipsis' ? (
            <li key={`ellipsis-${index}`} aria-hidden className="px-1 text-subtle">
              …
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={hrefFor(entry)}
                aria-current={entry === page ? 'page' : undefined}
                aria-label={t('page', { page: entry })}
                className={cn(item, 'tabular-nums', entry === page && 'bg-surface-raised text-foreground')}
              >
                {entry}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} rel="next" className={item}>
              <ChevronRightIcon aria-hidden />
              <span className="sr-only">{t('next')}</span>
            </Link>
          ) : (
            <span aria-hidden className={cn(item, 'opacity-40')}>
              <ChevronRightIcon />
            </span>
          )}
        </li>
      </ul>
    </nav>
  )
}
