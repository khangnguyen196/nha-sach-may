import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { InlineNotFound } from '@/components/layout/inline-not-found'
import { CatalogSkeleton, PageHeaderSkeleton } from '@/features/books/components/book-grid-skeleton'
import { Breadcrumb } from '@/features/books/components/breadcrumb'
import { CatalogView } from '@/features/books/components/catalog-view'
import { authorListing } from '@/features/books/listing'
import { getAllAuthorSlugs, getAuthorBySlug, listBooks } from '@/features/books/queries'
import { catalogParamsSchema } from '@/features/books/schemas'
import { splitParagraphs, truncateText } from '@/features/books/utils'
import { localeAlternates } from '@/i18n/alternates'
import { localize } from '@/lib/i18n-db'

type Props = PageProps<'/[locale]/authors/[slug]'>

// Slug tạo sau lần build (admin thêm / đổi slug, import giữa hai lần deploy) không có trong generateStaticParams: Next
// dựng App Shell cho tham số chưa biết. Page chỉ đọc `params` bên trong <Suspense> (và LocaleSwitcher đọc useParams
// trong Suspense riêng) → shell dựng được, slug mới stream theo request; slug đã prerender vẫn là HTML tĩnh đầy đủ.

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
  if (!author) notFound()
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
  const [raw, t] = await Promise.all([searchParams, getTranslations('catalog')])
  const { params, input } = authorListing(catalogParamsSchema.parse(raw), bookIds)
  const result = input ? await listBooks(input) : { books: [], total: 0 }
  // Proxy đã trả 404 cho trang vượt quá; còn tới đây (proxy không hỏi được) thì hiện UI 404 trong boundary
  if (params.page > 1 && result.books.length === 0) return <InlineNotFound />

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
