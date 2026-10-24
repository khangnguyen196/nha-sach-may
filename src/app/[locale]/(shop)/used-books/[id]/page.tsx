import { ImageOffIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { InlineNotFound } from '@/components/layout/inline-not-found'
import { Breadcrumb } from '@/features/books/components/breadcrumb'
import { UsedDemoNote } from '@/features/used/components/demo-note'
import { getMarketListing, type MarketListingDetail } from '@/features/used/public-queries'
import { listingIdSchema } from '@/features/used/schemas'
import { localeAlternates } from '@/i18n/alternates'
import { Link } from '@/i18n/navigation'

type Props = PageProps<'/[locale]/used-books/[id]'>

// id không biết trước lúc build (không có generateStaticParams: tin tạo / gỡ liên tục, link ảnh có hạn) nên header
// (LocaleSwitcher đọc useParams) không prerender được shell cho route này → render theo request như trang sửa tin; dữ
// liệu của tin vẫn lấy từ cache ('use cache', cacheLife('hours')). Proxy đã trả 404 thật cho tin không công khai.
export const instant = false

// Tin tạm thời (bán / rút / gỡ bất cứ lúc nào) và link ảnh có hạn → không cho index, không vào sitemap
const ROBOTS = { index: false, follow: true } as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ id: rawId }, locale, t, tCondition, format] = await Promise.all([
    params,
    getLocale(),
    getTranslations('used.market'),
    getTranslations('used.condition'),
    getFormatter(),
  ])
  const id = listingIdSchema.safeParse(rawId)
  const listing = id.success ? await getMarketListing(id.data) : null
  if (!listing) return { robots: ROBOTS }
  return {
    title: t('detailTitle', { title: listing.book.title }),
    description: t('detailDescription', {
      title: listing.book.title,
      condition: tCondition(listing.condition),
      price: format.number(listing.price, 'price'),
    }),
    robots: ROBOTS,
    alternates: localeAlternates({ pathname: '/used-books/[id]', params: { id: String(listing.id) } }, locale),
  }
}

export default function UsedListingPage({ params }: Props) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <Suspense fallback={<UsedListingSkeleton />}>
        <UsedListing params={params} />
      </Suspense>
    </div>
  )
}

function UsedListingSkeleton() {
  return (
    <div aria-hidden className="animate-pulse motion-reduce:animate-none">
      <div className="h-5 w-48 rounded-sm bg-surface-raised" />
      <div className="mt-6 grid gap-8 md:mt-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 lg:gap-16">
        <div className="mx-auto aspect-[3/4] w-full max-w-xs rounded-cover bg-surface-raised md:max-w-none" />
        <div className="space-y-4">
          <div className="h-10 w-3/4 rounded-sm bg-surface-raised" />
          <div className="h-8 w-1/3 rounded-sm bg-surface-raised" />
          <div className="mt-8 h-24 rounded-md bg-surface-raised" />
        </div>
      </div>
    </div>
  )
}

async function UsedListing({ params }: { params: Props['params'] }) {
  const { id: rawId } = await params
  const id = listingIdSchema.safeParse(rawId)
  // Proxy đã trả 404 thật cho id sai / tin không công khai; tới được đây là proxy không hỏi được DB (hoặc sách của tin
  // vừa ngừng bán) → UI 404 trong boundary (notFound() sau khi stream làm React bỏ SSR: lỗi #419)
  if (!id.success) return <InlineNotFound kind="used-market" heading="h1" />
  const [listing, t, tCondition, format] = await Promise.all([
    getMarketListing(id.data),
    getTranslations('used.market'),
    getTranslations('used.condition'),
    getFormatter(),
  ])
  if (!listing) return <InlineNotFound kind="used-market" heading="h1" />

  return (
    <>
      <Breadcrumb items={[{ label: t('title'), href: '/used-books' }, { label: listing.book.title }]} />
      <div className="mt-6 grid gap-8 md:mt-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 lg:gap-16">
        <Photos listing={listing} />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl font-medium md:text-4xl" data-testid="market-listing-title">
              {listing.book.title}
            </h1>
            {listing.sold && (
              <span
                className="inline-flex shrink-0 rounded-sm bg-surface-raised px-2 py-0.5 text-sm font-medium text-muted-foreground"
                data-testid="market-listing-sold"
              >
                {t('sold')}
              </span>
            )}
          </div>
          <p className="mt-6 border-t pt-6">
            <span className="sr-only">{t('price')}</span>
            <span className="text-3xl font-semibold text-primary tabular-nums" data-testid="market-listing-price">
              {format.number(listing.price, 'price')}
            </span>
          </p>
          {listing.sold && <p className="mt-2 text-sm text-muted-foreground">{t('soldNote')}</p>}

          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('conditionLabel')}</dt>
            <dd>{tCondition(listing.condition)}</dd>
            <dt className="text-muted-foreground">{t('sellerLabel')}</dt>
            <dd data-testid="market-listing-seller">{listing.sellerName ?? t('member')}</dd>
            {listing.approvedAt && (
              <>
                <dt className="text-muted-foreground">{t('approvedAt')}</dt>
                <dd className="tabular-nums">{format.dateTime(new Date(listing.approvedAt), { dateStyle: 'medium' })}</dd>
              </>
            )}
          </dl>

          <section aria-labelledby="market-listing-description" className="mt-10">
            <h2 id="market-listing-description" className="text-lg font-semibold">
              {t('description')}
            </h2>
            <p className="mt-3 max-w-reading whitespace-pre-line">
              {listing.description ?? <span className="text-muted-foreground">{t('noDescription')}</span>}
            </p>
          </section>

          <div className="mt-8 max-w-reading">
            <UsedDemoNote />
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <Link
              href={{ pathname: '/books/[slug]', params: { slug: listing.book.slug } }}
              className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t('bookLink')}
            </Link>
            <Link
              href="/used-books"
              className="rounded-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t('backToMarket')}
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

const FIRST_PHOTO_SIZES = '(min-width: 1152px) 420px, (min-width: 768px) 38vw, 320px'
const OTHER_PHOTO_SIZES = '(min-width: 1152px) 210px, (min-width: 768px) 19vw, 50vw'

/** Ảnh thật của tin: ảnh đầu lớn (LCP, tải sớm), các ảnh sau nhỏ hơn. Link ký → `unoptimized` (quyết định 7b) */
async function Photos({ listing }: { listing: MarketListingDetail }) {
  const t = await getTranslations('used.market')
  return (
    <section aria-label={t('photos')} className="md:sticky md:top-24 md:self-start">
      <ul className="grid grid-cols-2 gap-3" data-testid="market-listing-photos">
        {listing.photos.map((photo, index) => (
          <li
            key={photo.path}
            className={
              index === 0
                ? 'relative col-span-2 mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-cover border bg-surface-raised md:max-w-none'
                : 'relative aspect-[3/4] overflow-hidden rounded-cover border bg-surface-raised'
            }
          >
            {photo.url ? (
              // Ảnh đứng một mình → alt có tên sách + số thứ tự
              <Image
                src={photo.url}
                alt={t('photoAlt', { number: index + 1, title: listing.book.title })}
                fill
                unoptimized
                sizes={index === 0 ? FIRST_PHOTO_SIZES : OTHER_PHOTO_SIZES}
                {...(index === 0 ? { preload: true, fetchPriority: 'high' } : { loading: 'lazy' })}
                className="object-cover"
              />
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-sm text-muted-foreground">
                <ImageOffIcon aria-hidden className="size-5" />
                {t('photoMissing')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
