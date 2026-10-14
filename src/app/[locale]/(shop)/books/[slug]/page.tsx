import { BookIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Fragment, Suspense } from 'react'
import { Breadcrumb, type Crumb } from '@/features/books/components/breadcrumb'
import { Shelf, ShelfSkeleton } from '@/features/books/components/shelf'
import {
  getAllBookSlugs,
  getBookBySlug,
  getCategories,
  getRelatedBooks,
  type BookDetail,
  type Category,
} from '@/features/books/queries'
import { discountPercent, splitParagraphs, truncateText } from '@/features/books/utils'
import { localeAlternates } from '@/i18n/alternates'
import { Link } from '@/i18n/navigation'
import { localize } from '@/lib/i18n-db'

type Props = PageProps<'/[locale]/books/[slug]'>

const META_DESCRIPTION_LENGTH = 160
// Dưới mức này coi là sắp hết; chỉ để hiện "Chỉ còn N cuốn"
const LOW_STOCK = 5

export async function generateStaticParams() {
  const slugs = await getAllBookSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [book, locale, t] = await Promise.all([getBookBySlug(slug), getLocale(), getTranslations('book')])
  if (!book) return {}
  const description = localize(book, 'description', locale)
  return {
    title: book.title,
    description: description
      ? truncateText(description, META_DESCRIPTION_LENGTH)
      : t('metaDescription', { title: book.title }),
    alternates: localeAlternates({ pathname: '/books/[slug]', params: { slug } }, locale),
  }
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params
  const [book, categories, locale, t] = await Promise.all([
    getBookBySlug(slug),
    getCategories(),
    getLocale(),
    getTranslations('book'),
  ])
  if (!book) notFound()

  const leaf = categories.find((c) => c.id === book.category_id)
  const parent = leaf && categories.find((c) => c.id === leaf.parent_id)
  const crumbs: Crumb[] = [parent, leaf].flatMap((category) =>
    category
      ? [
          {
            label: localize(category, 'name', locale),
            href: { pathname: '/categories/[slug]', params: { slug: category.slug } },
          },
        ]
      : [],
  )
  crumbs.push({ label: book.title })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <Breadcrumb items={crumbs} />

      <div className="mt-6 grid gap-8 md:mt-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 lg:gap-16">
        <div className="md:sticky md:top-24 md:self-start">
          <div className="relative mx-auto aspect-[2/3] w-full max-w-xs overflow-hidden rounded-cover bg-surface-raised md:max-w-none">
            {book.cover_url ? (
              // Ảnh đứng một mình → alt là tên sách. Là LCP của trang → preload.
              <Image
                src={book.cover_url}
                alt={book.title}
                fill
                preload
                sizes="(min-width: 1152px) 420px, (min-width: 768px) 38vw, 320px"
                className="object-cover"
              />
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-2 text-subtle">
                <BookIcon aria-hidden className="size-10" />
                <span className="text-sm">{t('noCover')}</span>
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <h1 className="font-serif text-3xl font-medium md:text-4xl">{book.title}</h1>
          {book.subtitle && <p className="mt-2 text-lg text-muted-foreground">{book.subtitle}</p>}
          <People book={book} />
          <PriceBlock book={book} />
          <Description book={book} />
          <Details book={book} />
        </div>
      </div>

      {leaf && (
        <div className="mt-16 md:mt-24">
          <Suspense fallback={<ShelfSkeleton id="related-books" title={t('related')} />}>
            <RelatedShelf bookId={book.id} category={leaf} title={t('related')} />
          </Suspense>
        </div>
      )}
    </div>
  )
}

async function People({ book }: { book: BookDetail }) {
  const t = await getTranslations('book')
  const byRole = (role: string) => book.book_authors.flatMap((ba) => (ba.role === role && ba.authors ? [ba.authors] : []))
  const groups = [
    { label: t('authors'), people: byRole('author') },
    { label: t('translators'), people: byRole('translator') },
    { label: t('illustrators'), people: byRole('illustrator') },
  ].filter((group) => group.people.length > 0)
  if (groups.length === 0) return null

  return (
    <dl className="mt-4 space-y-1 text-sm">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{group.label}:</dt>
          <dd>
            {group.people.map((person, index) => (
              <Fragment key={person.slug}>
                {index > 0 && ', '}
                <Link
                  href={{ pathname: '/authors/[slug]', params: { slug: person.slug } }}
                  className="rounded-sm font-medium transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {person.name}
                </Link>
              </Fragment>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  )
}

async function PriceBlock({ book }: { book: BookDetail }) {
  const [t, format] = await Promise.all([getTranslations('book'), getFormatter()])
  const discount = discountPercent(book.price, book.original_price)
  const stockLabel =
    book.stock <= 0 ? t('outOfStock') : book.stock <= LOW_STOCK ? t('lowStock', { count: book.stock }) : t('inStock')

  return (
    <div className="mt-6 border-t pt-6">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="sr-only">{t('price')}</span>
        <span className="text-3xl font-semibold text-primary">{format.number(book.price, 'price')}</span>
        {discount !== null && book.original_price !== null && (
          <>
            <span className="sr-only">{t('originalPrice')}</span>
            <s className="text-subtle">{format.number(book.original_price, 'price')}</s>
            <span className="rounded-sm bg-sale/10 px-1.5 py-0.5 text-sm font-medium text-sale">
              {t('discount', { percent: discount })}
            </span>
          </>
        )}
      </p>
      <p className={book.stock > 0 ? 'mt-2 text-sm text-success' : 'mt-2 text-sm text-muted-foreground'}>
        {stockLabel}
      </p>
      {/* Chỗ của nút "Thêm vào giỏ" (Phase 5): giữ sẵn chiều cao để thêm nút sau không đẩy nội dung bên dưới */}
      <div aria-hidden className="mt-6 h-11" />
    </div>
  )
}

/** Đoạn đầu hiện thẳng; phần còn lại trong <details> (0 JS, không cần client component) */
async function Description({ book }: { book: BookDetail }) {
  const [t, locale] = await Promise.all([getTranslations('book'), getLocale()])
  const [lead, ...rest] = splitParagraphs(localize(book, 'description', locale))

  return (
    <section aria-labelledby="book-description" className="mt-10">
      <h2 id="book-description" className="text-lg font-semibold">
        {t('description')}
      </h2>
      <div className="mt-3 max-w-reading">
        {lead ? (
          <p className="whitespace-pre-line">{lead}</p>
        ) : (
          <p className="text-muted-foreground">{t('noDescription')}</p>
        )}
        {rest.length > 0 && (
          <details className="group mt-4">
            <summary className="inline-flex cursor-pointer list-none rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">{t('readMore')}</span>
              <span className="hidden group-open:inline">{t('readLess')}</span>
            </summary>
            <div className="mt-4 space-y-4">
              {rest.map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  )
}

async function Details({ book }: { book: BookDetail }) {
  const [t, format] = await Promise.all([getTranslations('book'), getFormatter()])
  const language = book.language === 'vi' || book.language === 'en' ? t(`languages.${book.language}`) : book.language
  // Dữ liệu từ Google Books hay thiếu field → dòng nào null thì ẩn
  const rows: [string, string | null][] = [
    [t('isbn'), book.isbn],
    [t('publisher'), book.publishers?.name ?? null],
    [t('publishedYear'), book.published_year === null ? null : String(book.published_year)],
    [t('pageCount'), book.page_count === null ? null : format.number(book.page_count)],
    [t('format'), t(`formats.${book.format}`)],
    [t('language'), language],
    [t('dimensions'), book.dimensions],
    [t('weight'), book.weight_grams === null ? null : t('weightValue', { grams: book.weight_grams })],
  ]

  return (
    <section aria-labelledby="book-details" className="mt-10">
      <h2 id="book-details" className="text-lg font-semibold">
        {t('details')}
      </h2>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(([label, value]) =>
          value === null ? null : (
            <Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words">{value}</dd>
            </Fragment>
          ),
        )}
      </dl>
    </section>
  )
}

async function RelatedShelf({ bookId, category, title }: { bookId: number; category: Category; title: string }) {
  const books = await getRelatedBooks(bookId, category.id)
  return (
    <Shelf
      id="related-books"
      title={title}
      href={{ pathname: '/categories/[slug]', params: { slug: category.slug } }}
      books={books}
    />
  )
}
