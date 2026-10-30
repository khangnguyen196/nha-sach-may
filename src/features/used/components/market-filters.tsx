import { XIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { Link, type Href } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { DEFAULT_MARKET_SORT, MARKET_SORTS, marketHref, withMarketParams, type MarketParams } from '../market-params'

type CategoryOption = { slug: string; label: string }

type Props = {
  params: MarketParams
  categories: CategoryOption[]
  /** Đang lọc theo một cuốn (`?book=`): tên sách, null khi slug không còn là sách đang bán */
  book: { title: string } | null
}

/**
 * Bộ lọc danh mục + sắp xếp của Chợ sách cũ: link thật (không thêm JS client, chạy cả khi tắt JS, chia sẻ được), trạng
 * thái hiện tại có aria-current. Đổi bộ lọc / sắp xếp → về trang 1.
 */
export async function MarketFilters({ params, categories, book }: Props) {
  const t = await getTranslations('used.market')
  const href = (patch: Partial<MarketParams>) => marketHref(withMarketParams(params, patch))
  const sort = params.sort ?? DEFAULT_MARKET_SORT

  return (
    <div className="grid gap-4">
      {params.book && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm" data-testid="market-book-filter">
          <span className="font-medium">{book ? t('bookFilter', { title: book.title }) : t('bookFilterUnknown')}</span>
          <Link
            href={href({ book: undefined })}
            className="inline-flex items-center gap-1 rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus-ring"
          >
            <XIcon aria-hidden className="size-4" />
            {t('clearBook')}
          </Link>
        </p>
      )}
      {categories.length > 0 && (
        <ChipGroup label={t('categoryFilter')}>
          <Chip href={href({ cat: undefined })} active={!params.cat}>
            {t('allCategories')}
          </Chip>
          {categories.map((category) => (
            <Chip key={category.slug} href={href({ cat: category.slug })} active={params.cat === category.slug}>
              {category.label}
            </Chip>
          ))}
        </ChipGroup>
      )}
      <ChipGroup label={t('sortLabel')}>
        {MARKET_SORTS.map((value) => (
          <Chip key={value} href={href({ sort: value })} active={sort === value}>
            {t(`sort.${value}`)}
          </Chip>
        ))}
      </ChipGroup>
    </div>
  )
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
      <span aria-hidden className="text-xs font-medium text-subtle md:w-20 md:shrink-0">
        {label}
      </span>
      {/* Hàng chip cuộn ngang trên mobile (danh mục có thể nhiều) */}
      <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0">
        <ul className="flex w-max gap-2 md:w-auto md:flex-wrap">{children}</ul>
      </div>
    </div>
  )
}

function Chip({ href, active, children }: { href: Href; active: boolean; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'inline-flex h-8 items-center rounded-full border px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-focus-ring',
          active
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-input text-muted-foreground hover:bg-surface-raised hover:text-foreground',
        )}
      >
        {children}
      </Link>
    </li>
  )
}
