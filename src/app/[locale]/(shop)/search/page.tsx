import { SearchIcon } from 'lucide-react'
import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { InlineNotFound } from '@/components/layout/inline-not-found'
import { Button } from '@/components/ui/button'
import { CatalogSkeleton } from '@/features/books/components/book-grid-skeleton'
import { CatalogView } from '@/features/books/components/catalog-view'
import { EmptyState } from '@/features/books/components/empty-state'
import { withCategoryFilter } from '@/features/books/listing'
import { getCategories, listBooks } from '@/features/books/queries'
import { catalogParamsSchema } from '@/features/books/schemas'
import { visibleCategoryIds } from '@/features/books/utils'
import { SearchTabs, SearchTabsSkeleton } from '@/features/used/components/search-tabs'
import { SearchUsedResults } from '@/features/used/components/search-used-results'
import { DEFAULT_MARKET_SORT, parseSearchTab, type SearchTab } from '@/features/used/market-params'
import { countUsedListings, listMarketListings, matchingUsedSearchBookIds } from '@/features/used/public-queries'
import { localeAlternates } from '@/i18n/alternates'
import { getPathname } from '@/i18n/navigation'
import { localize } from '@/lib/i18n-db'

type Props = PageProps<'/[locale]/search'>

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('searchPage'), getLocale()])
  return {
    title: t('title'),
    description: t('metaDescription'),
    // Trang kết quả tìm kiếm không nên vào chỉ mục (nội dung trùng lặp, vô số URL)
    robots: { index: false, follow: true },
    alternates: localeAlternates('/search', locale),
  }
}

export default async function SearchPage({ searchParams }: Props) {
  const [t, locale] = await Promise.all([getTranslations('searchPage'), getLocale()])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <h1 className="font-serif text-3xl font-medium md:text-4xl">{t('title')}</h1>
      {/* Ô tìm kiếm cần giá trị q từ URL nên nằm trong Suspense; fallback là cùng form nhưng còn trống. Fallback luôn
          giữ chỗ dải tab (chưa biết q): trang có từ khóa (thường gặp) không nhảy; trang chưa có từ khóa (không có tab)
          co lại 44px một lần, chấp nhận */}
      <Suspense
        fallback={
          <>
            <SearchForm locale={locale} />
            <SearchTabsSkeleton />
            <CatalogSkeleton />
          </>
        }
      >
        <SearchResults locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function SearchForm({ locale, defaultValue, tab }: { locale: Locale; defaultValue?: string; tab?: SearchTab }) {
  const t = await getTranslations('searchPage')
  return (
    // GET form: chạy không cần JS, gửi lại từ khóa mới thì bỏ filter cũ (tìm mới từ đầu); đang ở tab Sách cũ thì ở lại
    <form role="search" method="get" action={getPathname({ href: '/search', locale })} className="mt-6 mb-10 flex max-w-xl gap-2">
      {tab === 'used' && <input type="hidden" name="type" value="used" />}
      <label htmlFor="search-q" className="sr-only">
        {t('label')}
      </label>
      <div className="relative flex-1">
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <input
          id="search-q"
          type="search"
          name="q"
          defaultValue={defaultValue}
          maxLength={100}
          autoComplete="off"
          className="h-11 w-full rounded-lg border border-input bg-surface pr-3 pl-9 text-base outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus-ring"
        />
      </div>
      <Button type="submit" size="lg" className="h-11 px-5">
        {t('submit')}
      </Button>
    </form>
  )
}

async function SearchResults({ locale, searchParams }: { locale: Locale; searchParams: Props['searchParams'] }) {
  const [raw, t, categories] = await Promise.all([searchParams, getTranslations('searchPage'), getCategories()])
  const parsed = catalogParamsSchema.parse(raw)
  const tab = parseSearchTab(raw)
  // Hiện lại đúng chữ người dùng gõ (q đã parse bị chuẩn hóa chữ thường)
  const typed = (Array.isArray(raw.q) ? raw.q[0] : raw.q)?.trim() ?? ''
  const form = <SearchForm locale={locale} defaultValue={typed} tab={tab} />

  if (!parsed.q) {
    return (
      <>
        {form}
        <EmptyState icon={SearchIcon} title={t('hintTitle')} description={t('hint')} />
      </>
    )
  }

  // Tab Sách cũ: 2 bước (id sách khớp → tin của các sách đó), không đổi DB. Sách bị chặn theo sở thích: tin vẫn được đếm
  // và lên lưới (ô mờ của MarketGrid che), như mọi bộ đếm khác (chặn chỉ ở CSS, không phá cache)
  const visibleIds = visibleCategoryIds(categories)
  if (tab === 'used') {
    const bookIds = await matchingUsedSearchBookIds(parsed.q, visibleIds)
    const result =
      bookIds.length > 0
        ? await listMarketListings({ bookIds, sort: DEFAULT_MARKET_SORT, page: parsed.page })
        : { listings: [], total: 0 }
    if (parsed.page > 1 && result.listings.length === 0) return <InlineNotFound kind="page" />
    return (
      <>
        {form}
        <SearchTabs raw={raw} active="used" usedCount={result.total} />
        <SearchUsedResults raw={raw} typed={typed} page={parsed.page} result={result} />
      </>
    )
  }

  const { params, parents, input } = withCategoryFilter(parsed, categories, 'search')
  const [result, usedCount] = await Promise.all([
    listBooks(input),
    matchingUsedSearchBookIds(parsed.q, visibleIds).then((ids) => (ids.length > 0 ? countUsedListings(ids) : 0)),
  ])
  // Trang vượt quá → UI 404 (soft 404)
  if (params.page > 1 && result.books.length === 0) return <InlineNotFound kind="page" />

  return (
    <>
      {form}
      <SearchTabs raw={raw} active="new" usedCount={usedCount} />
      <h2 className="sr-only">{t('resultsFor', { q: typed })}</h2>
      <CatalogView
        params={params}
        context="search"
        base={{ pathname: '/search' }}
        result={result}
        filters={{ cats: parents.map((c) => ({ slug: c.slug, label: localize(c, 'name', locale) })) }}
        empty={{ title: t('emptyTitle', { q: typed }), description: t('emptyDescription') }}
      />
    </>
  )
}
