import { SearchIcon } from 'lucide-react'
import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { resolveSort } from '@/features/books/catalog-params'
import { CatalogSkeleton } from '@/features/books/components/book-grid-skeleton'
import { CatalogView } from '@/features/books/components/catalog-view'
import { EmptyState } from '@/features/books/components/empty-state'
import { getCategories, listBooks } from '@/features/books/queries'
import { catalogParamsSchema } from '@/features/books/schemas'
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
      {/* Ô tìm kiếm cần giá trị q từ URL nên nằm trong Suspense; fallback là cùng form nhưng còn trống */}
      <Suspense
        fallback={
          <>
            <SearchForm locale={locale} />
            <CatalogSkeleton />
          </>
        }
      >
        <SearchResults locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function SearchForm({ locale, defaultValue }: { locale: Locale; defaultValue?: string }) {
  const t = await getTranslations('searchPage')
  return (
    // GET form: chạy không cần JS, gửi lại từ khóa mới thì bỏ filter cũ (tìm mới từ đầu)
    <form role="search" method="get" action={getPathname({ href: '/search', locale })} className="mt-6 mb-10 flex max-w-xl gap-2">
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
          className="h-11 w-full rounded-lg border border-input bg-surface pr-3 pl-9 text-base outline-none placeholder:text-subtle focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
  // Hiện lại đúng chữ người dùng gõ (q đã parse bị chuẩn hóa chữ thường)
  const typed = (Array.isArray(raw.q) ? raw.q[0] : raw.q)?.trim() ?? ''
  const form = <SearchForm locale={locale} defaultValue={typed} />

  if (!parsed.q) {
    return (
      <>
        {form}
        <EmptyState icon={SearchIcon} title={t('hintTitle')} description={t('hint')} />
      </>
    )
  }

  // Lọc danh mục: chip là danh mục cha; `cat` trong URL nhận cả slug danh mục lá
  const parents = categories.filter((c) => c.parent_id === null)
  const selected = categories.find((c) => c.slug === parsed.cat)
  const params = selected ? parsed : { ...parsed, cat: undefined }
  const children = selected ? categories.filter((c) => c.parent_id === selected.id) : []
  const categoryIds = selected ? (children.length > 0 ? children.map((c) => c.id) : [selected.id]) : undefined

  const result = await listBooks({
    q: parsed.q,
    categoryIds,
    price: params.price,
    lang: params.lang,
    inStock: Boolean(params.stock),
    sort: resolveSort(params, 'search'),
    page: params.page,
  })
  if (params.page > 1 && result.books.length === 0) notFound()

  return (
    <>
      {form}
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
