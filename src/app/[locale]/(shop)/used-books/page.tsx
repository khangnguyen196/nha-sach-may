import { TagIcon } from 'lucide-react'
import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { InlineNotFound } from '@/components/layout/inline-not-found'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/features/books/components/empty-state'
import { Pagination } from '@/features/books/components/pagination'
import { getBookBySlug, getCategories } from '@/features/books/queries'
import { UsedDemoNote } from '@/features/used/components/demo-note'
import { MarketFilters } from '@/features/used/components/market-filters'
import { MarketGrid, MarketGridSkeleton } from '@/features/used/components/market-grid'
import { MARKET_PAGE_SIZE, marketFilter, marketHref, withMarketParams } from '@/features/used/market-params'
import { listMarketListings } from '@/features/used/public-queries'
import { marketParamsSchema } from '@/features/used/schemas'
import { localeAlternates } from '@/i18n/alternates'
import { Link } from '@/i18n/navigation'
import { localize } from '@/lib/i18n-db'

type Props = PageProps<'/[locale]/used-books'>

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('used.market'), getLocale()])
  return { title: t('title'), description: t('metaDescription'), alternates: localeAlternates('/used-books', locale) }
}

/**
 * Chợ sách cũ: tin đã duyệt, lọc danh mục / một cuốn (`?book=`), sắp xếp, phân trang qua URL (docs/plans/cho-sach-cu.md,
 * P-B vòng 9). Tiêu đề + ghi chú demo prerender sẵn; phần đọc searchParams stream sau.
 */
export default async function UsedMarketPage({ searchParams }: Props) {
  const [t, locale] = await Promise.all([getTranslations('used.market'), getLocale()])
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <h1 className="font-serif text-3xl font-medium md:text-4xl">{t('title')}</h1>
      <p className="mt-3 max-w-reading text-muted-foreground">{t('lead')}</p>
      <div className="mt-6 max-w-reading">
        <UsedDemoNote />
      </div>
      <div className="mt-8">
        <Suspense fallback={<MarketSkeleton />}>
          <MarketResults locale={locale} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}

function MarketSkeleton() {
  return (
    <div aria-hidden>
      <div className="mb-8 grid gap-4">
        {Array.from({ length: 2 }, (_, row) => (
          <div key={row} className="flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-surface-raised motion-reduce:animate-none" />
            ))}
          </div>
        ))}
      </div>
      <div className="mb-6 h-5 w-24 animate-pulse rounded-sm bg-surface-raised motion-reduce:animate-none" />
      <MarketGridSkeleton />
    </div>
  )
}

async function MarketResults({ locale, searchParams }: { locale: Locale; searchParams: Props['searchParams'] }) {
  const [raw, t, categories] = await Promise.all([searchParams, getTranslations('used.market'), getCategories()])
  const { params, parents, input } = marketFilter(marketParamsSchema.parse(raw), categories)
  const [result, book] = await Promise.all([
    listMarketListings(input),
    params.book ? getBookBySlug(params.book) : Promise.resolve(null),
  ])
  // Trang vượt quá → UI 404 (soft 404 như /sach)
  if (params.page > 1 && result.listings.length === 0) return <InlineNotFound kind="page" />

  const filtered = Boolean(params.cat || params.book)
  const clearHref = marketHref(withMarketParams(params, { cat: undefined, book: undefined }))

  return (
    <>
      <MarketFilters
        params={params}
        categories={parents.map((category) => ({ slug: category.slug, label: localize(category, 'name', locale) }))}
        book={book && { title: book.title }}
      />
      <p role="status" className="mt-8 mb-6 text-sm text-muted-foreground" data-testid="market-count">
        {t('resultCount', { count: result.total })}
      </p>
      {result.listings.length > 0 ? (
        <MarketGrid listings={result.listings} />
      ) : filtered ? (
        <EmptyState
          icon={TagIcon}
          title={t('emptyFiltered.title')}
          description={t('emptyFiltered.description')}
          action={
            <Link href={clearHref} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              {t('clearBook')}
            </Link>
          }
        />
      ) : (
        <EmptyState
          icon={TagIcon}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            // Không prefetch: khách chưa đăng nhập bị proxy chuyển sang trang đăng nhập
            <Link href="/account/my-listings" prefetch={false} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              {t('sell')}
            </Link>
          }
        />
      )}
      <Pagination
        page={params.page}
        totalPages={Math.ceil(result.total / MARKET_PAGE_SIZE)}
        hrefFor={(page) => marketHref(withMarketParams(params, { page }))}
      />
    </>
  )
}
