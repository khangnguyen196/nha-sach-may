import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { InlineNotFound } from '@/components/layout/inline-not-found'
import { CatalogSkeleton } from '@/features/books/components/book-grid-skeleton'
import { CatalogView } from '@/features/books/components/catalog-view'
import { withCategoryFilter } from '@/features/books/listing'
import { getCategories, listBooks } from '@/features/books/queries'
import { catalogParamsSchema } from '@/features/books/schemas'
import { localeAlternates } from '@/i18n/alternates'
import { localize } from '@/lib/i18n-db'

type Props = PageProps<'/[locale]/books'>

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('allBooks'), getLocale()])
  return { title: t('title'), description: t('metaDescription'), alternates: localeAlternates('/books', locale) }
}

/** Tất cả sách: đích của CTA trang chủ và "Xem tất cả" của các kệ. Lọc / sắp xếp / phân trang qua URL như danh mục. */
export default async function AllBooksPage({ searchParams }: Props) {
  const [t, locale] = await Promise.all([getTranslations('allBooks'), getLocale()])
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <h1 className="mb-8 font-serif text-3xl font-medium md:mb-10 md:text-4xl">{t('title')}</h1>
      {/* Tiêu đề prerender sẵn; phần đọc searchParams stream sau */}
      <Suspense fallback={<CatalogSkeleton />}>
        <AllBooksResults locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function AllBooksResults({ locale, searchParams }: { locale: Locale; searchParams: Props['searchParams'] }) {
  const [raw, t, categories] = await Promise.all([searchParams, getTranslations('catalog'), getCategories()])
  const { params, parents, input } = withCategoryFilter(catalogParamsSchema.parse(raw), categories, 'browse')
  const result = await listBooks(input)
  // Proxy đã trả 404 cho trang vượt quá; còn tới đây (proxy không hỏi được) thì hiện UI 404 trong boundary
  if (params.page > 1 && result.books.length === 0) return <InlineNotFound />

  return (
    <CatalogView
      params={params}
      context="browse"
      base={{ pathname: '/books' }}
      result={result}
      filters={{ cats: parents.map((c) => ({ slug: c.slug, label: localize(c, 'name', locale) })) }}
      empty={{ title: t('empty.title'), description: t('empty.description') }}
    />
  )
}
