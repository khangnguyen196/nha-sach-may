import { BookIcon, ShoppingBagIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import type { Locale } from 'next-intl'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { Fragment, Suspense } from 'react'
import { InlineNotFound } from '@/components/layout/inline-not-found'
import { Button } from '@/components/ui/button'
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
import { discountPercent, showRelatedShelf, splitParagraphs, truncateText, visibleCategoryIds } from '@/features/books/utils'
import { addToCart, addToCartFromForm } from '@/features/cart/actions'
import { AddToCartButton } from '@/features/cart/components/add-to-cart-button'
import { cartLimit, MAX_LINES } from '@/features/cart/guest-cart'
import {
  BookPrefs,
  BookPrefsPlaceholder,
  HideWarnings,
  HideWarningsPlaceholder,
} from '@/features/prefs/components/book-prefs'
import { MyReview } from '@/features/reviews/components/my-review'
import { RatingStars } from '@/features/reviews/components/rating-stars'
import { ReviewList, ReviewListSkeleton } from '@/features/reviews/components/review-list'
import { UsedCopies, UsedCopiesSkeleton } from '@/features/used/components/used-copies'
import { WarningNotice } from '@/features/warnings/components/warning-notice'
import { localeAlternates } from '@/i18n/alternates'
import { Link } from '@/i18n/navigation'
import { localizedSlugPath } from '@/i18n/paths'
import { localize } from '@/lib/i18n-db'
import { bookJsonLd, serializeJsonLd } from '@/lib/json-ld'
import { siteUrl } from '@/lib/site-url'
import { SUPPORT_EMAIL } from '@/lib/support'

type Props = PageProps<'/[locale]/books/[slug]'>

const META_DESCRIPTION_LENGTH = 160
// Dưới mức này coi là sắp hết; chỉ để hiện "Chỉ còn N cuốn"
const LOW_STOCK = 5

// Slug tạo sau lần build (admin thêm / đổi slug, import giữa hai lần deploy) không có trong generateStaticParams: Next
// dựng App Shell cho tham số chưa biết. Page chỉ đọc `params` bên trong <Suspense> (và LocaleSwitcher đọc useParams
// trong Suspense riêng) → shell dựng được, slug mới stream theo request; slug đã prerender vẫn có sẵn trong HTML tĩnh,
// nhưng nằm trong boundary ẩn `<div hidden id="S:…">` chờ script `$RC` (không hiện khi tắt JS: docs/plans/no-js.md ★9).

export async function generateStaticParams() {
  const slugs = await getAllBookSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const [book, locale, t, tCommon] = await Promise.all([
    getBookBySlug(slug),
    getLocale(),
    getTranslations('book'),
    getTranslations('common'),
  ])
  if (!book) return {}
  const localized = localize(book, 'description', locale)
  const description = localized
    ? truncateText(localized, META_DESCRIPTION_LENGTH)
    : t('metaDescription', { title: book.title })
  return {
    title: book.title,
    description,
    alternates: localeAlternates({ pathname: '/books/[slug]', params: { slug } }, locale),
    // Ghi đè cả openGraph của layout (Next không gộp sâu): ảnh chia sẻ là bìa sách (WebP 600px trong Storage)
    openGraph: {
      type: 'book',
      siteName: tCommon('siteName'),
      locale: locale === 'en' ? 'en_US' : 'vi_VN',
      title: book.title,
      description,
      ...(book.isbn && { isbn: book.isbn }),
      ...(book.cover_url && { images: [{ url: book.cover_url, alt: book.title }] }),
    },
  }
}

export default function BookPage({ params }: Props) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <Suspense fallback={<BookPageSkeleton />}>
        <BookContent params={params} />
      </Suspense>
    </div>
  )
}

function BookPageSkeleton() {
  return (
    <div aria-hidden className="animate-pulse motion-reduce:animate-none">
      <div className="h-5 w-48 rounded-sm bg-surface-raised" />
      <div className="mt-6 grid gap-8 md:mt-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 lg:gap-16">
        <div className="mx-auto aspect-[2/3] w-full max-w-xs rounded-cover bg-surface-raised md:max-w-none" />
        <div className="space-y-4">
          <div className="h-10 w-3/4 rounded-sm bg-surface-raised" />
          <div className="h-5 w-1/2 rounded-sm bg-surface-raised" />
          <div className="mt-8 h-24 rounded-md bg-surface-raised" />
        </div>
      </div>
    </div>
  )
}

async function BookContent({ params }: { params: Props['params'] }) {
  const { slug } = await params
  const [book, categories, locale, t] = await Promise.all([
    getBookBySlug(slug),
    getCategories(),
    getLocale(),
    getTranslations('book'),
  ])
  // Proxy đã trả 404 thật; tới được đây là proxy không hỏi được DB → UI 404 trong boundary (không throw sau stream)
  if (!book) return <InlineNotFound kind="book" heading="h1" />

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

  const base = siteUrl()
  const url = `${base}${localizedSlugPath('/books/[slug]', book.slug, locale)}`
  const jsonLd = bookJsonLd({
    url,
    name: book.title,
    image: book.cover_url,
    description: localize(book, 'description', locale),
    isbn: book.isbn,
    authors: book.book_authors.flatMap((ba) => (ba.role === 'author' && ba.authors ? [ba.authors.name] : [])),
    publisher: book.publishers?.name ?? null,
    pageCount: book.page_count,
    language: book.language,
    format: book.format,
    price: book.price,
    inStock: book.stock > 0,
    rating: book.review_count > 0 ? { value: book.avg_rating, count: book.review_count } : null,
    breadcrumb: [
      ...[parent, leaf].flatMap((category) =>
        category
          ? [
              {
                name: localize(category, 'name', locale),
                url: `${base}${localizedSlugPath('/categories/[slug]', category.slug, locale)}`,
              },
            ]
          : [],
      ),
      { name: book.title, url },
    ],
  })

  return (
    <>
      {/* Dữ liệu có cấu trúc (Book, Offer, BreadcrumbList): JSON đã thoát `<`, không phải JS chạy */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <Breadcrumb items={crumbs} />

      <div className="mt-6 grid gap-8 md:mt-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 lg:gap-16">
        <div className="md:sticky md:top-24 md:self-start">
          <div className="relative mx-auto aspect-[2/3] w-full max-w-xs overflow-hidden rounded-cover bg-surface-raised md:max-w-none">
            {book.cover_url ? (
              // Ảnh đứng một mình → alt là tên sách. Là LCP của trang → preload + ưu tiên cao.
              <Image
                src={book.cover_url}
                alt={book.title}
                fill
                preload
                fetchPriority="high"
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
          <RatingSummary book={book} />
          <People book={book} />
          <PriceBlock book={book} />
          {/* Chợ sách cũ: tin của sách thuộc danh mục ẩn không lên chợ (quyết định 10) → không hiện dòng này */}
          {(book.category_id === null || visibleCategoryIds(categories).includes(book.category_id)) && (
            <Suspense fallback={<UsedCopiesSkeleton />}>
              <UsedCopies bookId={book.id} slug={book.slug} />
            </Suspense>
          )}
          {/* Nhãn cảnh báo đã duyệt: cùng dữ liệu cache với mô tả (book:{id}), cùng boundary → không Suspense riêng, không CLS.
              Nút "Ẩn các sách có cảnh báo này" theo phiên: Suspense riêng, chỗ nút giữ sẵn chiều cao cho mọi người */}
          <WarningNotice
            labels={book.content_warnings}
            action={
              <Suspense fallback={<HideWarningsPlaceholder />}>
                <HideWarnings bookId={book.id} labels={book.content_warnings} slug={book.slug} locale={locale} />
              </Suspense>
            }
          />
          <Description book={book} />
          <Details book={book} />
          {/* Chặn theo sở thích (theo phiên, Suspense riêng như MyReview): khách / fallback giữ chỗ bằng summary thu gọn */}
          <Suspense fallback={<BookPrefsPlaceholder />}>
            <BookPrefs bookId={book.id} slug={book.slug} locale={locale} />
          </Suspense>
        </div>
      </div>

      <Reviews book={book} locale={locale} />

      {/* Sách thuộc danh mục ẩn (mở qua link trực tiếp): kệ sẽ toàn sách ẩn → không hiện (docs/plans/sau-ux.md mục 6) */}
      {leaf && showRelatedShelf(leaf.id, categories) && (
        <div className="mt-16 md:mt-24">
          <Suspense fallback={<ShelfSkeleton id="related-books" title={t('related')} />}>
            <RelatedShelf bookId={book.id} category={leaf} title={t('related')} />
          </Suspense>
        </div>
      )}
    </>
  )
}

/** Điểm trung bình (cột do trigger tính, có sẵn trong cache book:{id}) → nhảy tới khối đánh giá */
async function RatingSummary({ book }: { book: BookDetail }) {
  if (book.review_count === 0) return null
  const [t, format] = await Promise.all([getTranslations('review'), getFormatter()])
  const rating = format.number(book.avg_rating, { maximumFractionDigits: 1 })
  return (
    <a
      href="#reviews"
      className="mt-3 inline-flex items-center gap-2 rounded-sm text-sm outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
      data-testid="rating-summary"
    >
      <RatingStars rating={book.avg_rating} />
      <span className="sr-only">{t('average', { rating })}</span>
      <span aria-hidden className="font-medium">
        {rating}
      </span>
      <span className="text-muted-foreground">({t('count', { count: book.review_count })})</span>
    </a>
  )
}

async function Reviews({ book, locale }: { book: BookDetail; locale: Locale }) {
  const t = await getTranslations('review')
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="mt-16 scroll-mt-24 md:mt-24">
      <h2 id="reviews-title" className="text-xl font-semibold">
        {t('title')}
      </h2>
      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-12">
        <Suspense fallback={<ReviewListSkeleton />}>
          <ReviewList bookId={book.id} />
        </Suspense>
        {/* Theo phiên: stream riêng, không chặn danh sách đánh giá (cache chung) */}
        <Suspense fallback={<div className="h-24" />}>
          <MyReview bookId={book.id} slug={book.slug} locale={locale} />
        </Suspense>
      </div>
    </section>
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
      {/* data-chat-avoid: bong bóng chat ẩn khi nút này đi vào dải đáy màn hình (không che CTA) */}
      <div className="mt-6" data-chat-avoid>
        <AddToCart book={book} />
      </div>
    </div>
  )
}

/** CTA primary duy nhất của trang. Hết hàng → nút disabled, không cần JS. */
async function AddToCart({ book }: { book: BookDetail }) {
  const [t, tCart, tErrors, locale] = await Promise.all([
    getTranslations('book'),
    getTranslations('cart'),
    getTranslations('errors'),
    getLocale(),
  ])
  const limit = cartLimit(book.stock)
  if (limit === 0) {
    return (
      <Button size="lg" className="h-11 w-full px-6 text-base sm:w-auto" disabled>
        {t('outOfStock')}
      </Button>
    )
  }

  return (
    <AddToCartButton
      bookId={book.id}
      limit={limit}
      add={addToCart.bind(null, locale, book.id)}
      formAction={addToCartFromForm.bind(null, locale, book.id, book.slug)}
      icon={<ShoppingBagIcon aria-hidden />}
      labels={{
        add: tCart('add'),
        adding: tCart('adding'),
        added: tCart('added'),
        viewCart: tCart('viewCart'),
        limitReached: tCart('limitReached', { max: limit }),
        cartFull: tCart('cartFull', { max: MAX_LINES }),
        storageError: tCart('storageError'),
        error: tErrors('UNKNOWN', { email: SUPPORT_EMAIL }),
        networkError: tCart('networkError'),
      }}
    />
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
