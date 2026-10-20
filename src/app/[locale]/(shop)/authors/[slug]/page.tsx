import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { InlineNotFound } from '@/components/layout/inline-not-found'
import { resolveSort } from '@/features/books/catalog-params'
import { CatalogSkeleton, PageHeaderSkeleton } from '@/features/books/components/book-grid-skeleton'
import { Breadcrumb } from '@/features/books/components/breadcrumb'
import { CatalogView } from '@/features/books/components/catalog-view'
import { getAllAuthorSlugs, getAuthorBySlug, getCategories, listBooks } from '@/features/books/queries'
import { catalogParamsSchema } from '@/features/books/schemas'
import { splitParagraphs, truncateText, visibleCategoryIds } from '@/features/books/utils'
import { localeAlternates } from '@/i18n/alternates'
import { localize } from '@/lib/i18n-db'

type Props = PageProps<'/[locale]/authors/[slug]'>

// Slug tạo sau lần build (admin thêm / đổi slug, import giữa hai lần deploy) không có trong generateStaticParams: Next
// dựng App Shell cho tham số chưa biết. Page chỉ đọc `params` bên trong <Suspense> (và LocaleSwitcher đọc useParams
// trong Suspense riêng) → shell dựng được, slug mới stream theo request; slug đã prerender vẫn có sẵn trong HTML tĩnh,
// nhưng nằm trong boundary ẩn `<div hidden id="S:…">` chờ script `$RC` (không hiện khi tắt JS: docs/plans/no-js.md ★9).

export async function generateStaticParams() {
  const slugs = await getAllAuthorSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [author, locale, t] = await Promise.all([getAuthorBySlug(slug), getLocale(), getTranslations('author')])
  if (!author) return {}
  const bio = localize(author, 'bio', locale)
  return {
    title: author.name,
    description: bio ? truncateText(bio, 160) : t('metaDescription', { name: author.name }),
    alternates: localeAlternates({ pathname: '/authors/[slug]', params: { slug } }, locale),
  }
}

// Ảnh tác giả (photo_url) chưa hiện: dữ liệu hiện toàn null và remotePatterns chỉ cho bucket book-covers.
export default function AuthorPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <Suspense fallback={<PageHeaderSkeleton />}>
        <AuthorContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function AuthorContent({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  const { slug } = await params
  const [author, locale, t] = await Promise.all([getAuthorBySlug(slug), getLocale(), getTranslations('author')])
  // Proxy đã trả 404 thật; tới được đây là proxy không hỏi được DB → UI 404 trong boundary (không throw sau stream)
  if (!author) return <InlineNotFound kind="author" heading="h1" />
  const bio = splitParagraphs(localize(author, 'bio', locale))

  return (
    <>
      <Breadcrumb items={[{ label: author.name }]} />
      <header className="mt-6 mb-8 md:mb-10">
        <h1 className="font-serif text-3xl font-medium md:text-4xl">{author.name}</h1>
        {bio.length > 0 && (
          <div className="mt-3 max-w-reading space-y-3 text-muted-foreground">
            {bio.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        )}
      </header>

      <section aria-labelledby="author-books">
        <h2 id="author-books" className="mb-6 text-xl font-semibold">
          {t('books')}
        </h2>
        <Suspense fallback={<CatalogSkeleton />}>
          <AuthorResults slug={author.slug} bookIds={author.bookIds} searchParams={searchParams} />
        </Suspense>
      </section>
    </>
  )
}

type ResultsProps = { slug: string; bookIds: number[]; searchParams: Props['searchParams'] }

async function AuthorResults({ slug, bookIds, searchParams }: ResultsProps) {
  const [raw, t, categories] = await Promise.all([searchParams, getTranslations('catalog'), getCategories()])
  // Trang tác giả không có bộ lọc: chỉ giữ sort và trang
  const { sort, page } = catalogParamsSchema.parse(raw)
  const params = { sort, page }

  const result =
    bookIds.length > 0
      ? await listBooks({
          bookIds,
          // Sách thuộc danh mục ẩn không lên danh sách (docs/plans/sau-ux.md mục 6)
          visibleCategoryIds: visibleCategoryIds(categories),
          sort: resolveSort(params, 'browse'),
          page,
        })
      : { books: [], total: 0 }
  // Trang vượt quá → UI 404 (soft 404)
  if (page > 1 && result.books.length === 0) return <InlineNotFound kind="page" />

  return (
    <CatalogView
      params={params}
      context="browse"
      base={{ pathname: '/authors/[slug]', params: { slug } }}
      result={result}
      filters={false}
      empty={{ title: t('empty.title'), description: t('empty.description') }}
    />
  )
}
