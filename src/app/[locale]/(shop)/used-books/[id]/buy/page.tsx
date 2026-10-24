import { PackageXIcon, ShoppingBagIcon } from 'lucide-react'
import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { InlineNotFound } from '@/components/layout/inline-not-found'
import { buttonVariants } from '@/components/ui/button'
import { getAddresses } from '@/features/account/queries'
import { EmptyState } from '@/features/books/components/empty-state'
import { AddressOptions } from '@/features/checkout/components/address-options'
import { CheckoutSkeleton } from '@/features/checkout/components/checkout-skeleton'
import { PaymentMethod } from '@/features/checkout/components/payment-method'
import { NOTE_MAX } from '@/features/checkout/schemas'
import { placeUsedOrder } from '@/features/used/actions'
import { UsedOrderForm } from '@/features/used/components/used-order-form'
import { UsedOrderSummary } from '@/features/used/components/used-order-summary'
import { getListingForPurchase, getUsedOrderQuote, type PurchaseListing } from '@/features/used/queries'
import { listingIdSchema } from '@/features/used/schemas'
import { localeAlternates } from '@/i18n/alternates'
import { getPathname, Link, type Href } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth'
import { getFormMessages } from '@/lib/form-messages'
import { placeholder } from '@/lib/template'

type Props = PageProps<'/[locale]/used-books/[id]/buy'>

// id không biết trước lúc build (không có generateStaticParams) nên header (LocaleSwitcher đọc useParams) không
// prerender được shell cho route này. Trang riêng tư (cần đăng nhập), render theo request là đủ (như trang sửa tin).
export const instant = false

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ id }, t, locale] = await Promise.all([params, getTranslations('used.buy'), getLocale()])
  return {
    title: t('title'),
    description: t('metaDescription'),
    robots: { index: false, follow: false },
    alternates: localeAlternates({ pathname: '/used-books/[id]/buy', params: { id } }, locale),
  }
}

/**
 * Mua một tin trên Chợ sách cũ (đơn riêng, không qua giỏ, không voucher). Cần đăng nhập (proxy chặn một lớp,
 * requireUser kiểm tra lại); proxy trả 404 thật cho tin không có / không công khai. Static shell = tiêu đề.
 */
export default async function BuyUsedListingPage({ params }: Props) {
  const [t, locale] = await Promise.all([getTranslations('used.buy'), getLocale()])
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <h1 className="font-serif text-3xl font-medium md:text-4xl">{t('title')}</h1>
      <Suspense fallback={<CheckoutSkeleton />}>
        <BuyContent locale={locale} params={params} />
      </Suspense>
    </div>
  )
}

async function BuyContent({ locale, params }: { locale: Locale; params: Props['params'] }) {
  const { id: rawId } = await params
  const href = { pathname: '/used-books/[id]/buy', params: { id: rawId } } as const
  const user = await requireUser(locale, href)
  const id = listingIdSchema.safeParse(rawId)
  // Proxy đã trả 404 thật cho id sai / tin không công khai; tới được đây là proxy không hỏi được DB → UI 404 trong
  // boundary (notFound() sau khi stream làm React bỏ SSR: lỗi #419)
  if (!id.success) return <InlineNotFound kind="used-market" />

  const [listing, quote, addresses, t, tCheckout, messages] = await Promise.all([
    getListingForPurchase(id.data),
    getUsedOrderQuote(id.data),
    getAddresses(),
    getTranslations('used.buy'),
    getTranslations('checkout'),
    getFormMessages(['AUTH_REQUIRED', 'LISTING_UNAVAILABLE', 'LISTING_OWN', 'LISTING_CHANGED', 'INVALID_ADDRESS'], {
      signInNext: getPathname({ href, locale }),
    }),
  ])
  if (!listing) return <InlineNotFound kind="used-market" />

  // Cùng thứ tự kiểm với place_used_order: tin / sách không còn bán, rồi tin của chính mình
  const book = listing.book
  if (listing.sold || !quote?.available || !book?.active) return <Unavailable listing={listing} />
  if (listing.sellerId === user.id) return <Unavailable listing={listing} own />

  return (
    <UsedOrderForm
      action={placeUsedOrder.bind(null, locale, listing.id)}
      messages={messages}
      labels={{
        noteLabel: tCheckout('noteLabel'),
        noteHint: tCheckout('noteHint'),
        noteCount: tCheckout('noteCount', { count: placeholder('count'), max: NOTE_MAX }),
        placeOrder: t('placeOrder'),
        placing: tCheckout('placing'),
        chooseAddress: tCheckout('chooseAddress'),
      }}
      // Sinh ở phần động (sau khi đọc phiên), không ở static shell: giá trị ngẫu nhiên lúc prerender sẽ bị đóng băng
      // vào HTML dùng chung. Mỗi lần render một key: action làm mới trang (tin vừa đổi…) → key mới cho bản đang hiện
      idempotencyKey={crypto.randomUUID()}
      expectedTotal={quote.total}
      // Cùng lần đọc với nội dung tin đang hiện (getListingForPurchase), nguyên chuỗi PostgREST
      expectedUpdatedAt={listing.updatedAt}
      noteMax={NOTE_MAX}
      blocked={addresses.length === 0}
      address={
        <AddressOptions
          addresses={addresses}
          selectedId={addresses[0]?.id}
          locale={locale}
          addHref="/account/addresses/new"
        />
      }
      payment={<PaymentMethod />}
      summary={<UsedOrderSummary listing={{ ...listing, book }} quote={quote} />}
      placeIcon={<ShoppingBagIcon aria-hidden />}
    />
  )
}

/** Không mua được (đã bán, ngừng bán, tin của chính mình): không có form, link về tin / về chợ */
async function Unavailable({ listing, own = false }: { listing: PurchaseListing; own?: boolean }) {
  const [t, tMarket, tErrors] = await Promise.all([
    getTranslations('used.buy'),
    getTranslations('used.market'),
    getTranslations('errors'),
  ])
  // Sách ngừng bán: người mua không đọc được dòng sách (RLS) → câu chung "không còn bán"; admin đọc được → câu kèm tên
  const reason = own
    ? tErrors('LISTING_OWN')
    : listing.book && !listing.book.active
      ? tErrors('BOOK_UNAVAILABLE', { title: listing.book.title })
      : tErrors('LISTING_UNAVAILABLE')
  const listingHref: Href = { pathname: '/used-books/[id]', params: { id: String(listing.id) } }
  const linkClass = buttonVariants({ variant: 'outline', size: 'lg', className: 'h-10 px-4' })

  return (
    <div className="mt-8" data-testid="used-order-unavailable">
      <EmptyState
        icon={PackageXIcon}
        title={own ? t('ownTitle') : t('unavailableTitle')}
        description={reason}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            {own ? (
              <Link href="/account/my-listings" className={linkClass}>
                {t('myListings')}
              </Link>
            ) : (
              <Link href="/used-books" className={linkClass}>
                {tMarket('backToMarket')}
              </Link>
            )}
            {/* Tin đã bán vẫn có trang (nhãn "Đã bán"); sách ngừng bán thì trang tin là 404 → không dẫn tới */}
            {(own || listing.book?.active) && (
              <Link href={listingHref} prefetch={false} className={linkClass}>
                {t('backToListing')}
              </Link>
            )}
          </div>
        }
      />
    </div>
  )
}
