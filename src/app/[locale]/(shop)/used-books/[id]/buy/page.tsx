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

// instant = false chỉ tắt kiểm tra "instant navigation" của Next (dev) và kiểm static shell không rỗng; KHÔNG đổi cách
// render: tin đọc theo phiên trong Suspense (không cache), không có generateStaticParams (tin tạo / gỡ liên tục).
// Giữ tạm, xem docs/progress.md [Mức thấp] instant = false.
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
export default async function BuyUsedListingPage({ params, searchParams }: Props) {
  const [t, locale] = await Promise.all([getTranslations('used.buy'), getLocale()])
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <h1 className="font-serif text-3xl font-medium md:text-4xl">{t('title')}</h1>
      <Suspense fallback={<CheckoutSkeleton />}>
        <BuyContent locale={locale} params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

type ContentProps = { locale: Locale; params: Props['params']; searchParams: Props['searchParams'] }

async function BuyContent({ locale, params, searchParams }: ContentProps) {
  const [{ id: rawId }, query] = await Promise.all([params, searchParams])
  const user = await requireUser(locale, { pathname: '/used-books/[id]/buy', params: { id: rawId } })
  const id = listingIdSchema.safeParse(rawId)
  // Proxy đã trả 404 thật cho id sai / tin không công khai; tới được đây là proxy không hỏi được DB → UI 404 trong
  // boundary (notFound() sau khi stream làm React bỏ SSR: lỗi #419)
  if (!id.success) return <InlineNotFound kind="used-market" />
  // Dựng lại từ id đã parse (không từ chuỗi trên URL): trang thêm địa chỉ chỉ nhận đúng URL này làm ?next=
  const href: Href = { pathname: '/used-books/[id]/buy', params: { id: String(id.data) } }

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

  // Cùng thứ tự kiểm với place_used_order: tin không còn đang bán (kể cả đã bán) → tin của chính mình → sách ngừng
  // bán. quote.available = tin đang bán và sách còn bán: false sau hai bước đầu là sách ngừng bán (hoặc tin vừa đổi
  // trạng thái giữa hai lần đọc) → câu theo sách nếu đọc được dòng sách, không thì câu chung
  const book = listing.book
  if (listing.sold) return <Unavailable listing={listing} reason="LISTING_UNAVAILABLE" />
  if (listing.sellerId === user.id) return <Unavailable listing={listing} reason="LISTING_OWN" />
  if (!book?.active || !quote?.available) {
    return <Unavailable listing={listing} reason={book && !book.active ? 'BOOK_UNAVAILABLE' : 'LISTING_UNAVAILABLE'} />
  }
  // ?address= từ trang thêm địa chỉ; không thuộc sổ địa chỉ thì về địa chỉ mặc định (getAddresses xếp đầu), như /thanh-toan
  const wanted = Number(query.address)
  const selectedId = addresses.find((address) => address.id === wanted)?.id ?? addresses[0]?.id

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
          selectedId={selectedId}
          locale={locale}
          // Lưu xong quay lại đúng trang mua với địa chỉ mới chọn sẵn (parseAddressNext); ghi chú đã gõ thì mất
          addHref={{ pathname: '/account/addresses/new', query: { next: getPathname({ href, locale }) } }}
        />
      }
      payment={<PaymentMethod />}
      summary={<UsedOrderSummary listing={{ ...listing, book }} quote={quote} />}
      placeIcon={<ShoppingBagIcon aria-hidden />}
    />
  )
}

type UnavailableProps = {
  listing: PurchaseListing
  /** Mã lỗi place_used_order sẽ trả cho tin này (cùng câu trong messages errors) */
  reason: 'LISTING_UNAVAILABLE' | 'LISTING_OWN' | 'BOOK_UNAVAILABLE'
}

/** Không mua được (đã bán, tin của chính mình, ngừng bán): không có form, link về tin / về chợ */
async function Unavailable({ listing, reason }: UnavailableProps) {
  const [t, tMarket, tErrors] = await Promise.all([
    getTranslations('used.buy'),
    getTranslations('used.market'),
    getTranslations('errors'),
  ])
  const own = reason === 'LISTING_OWN'
  // Sách ngừng bán: người mua không đọc được dòng sách (RLS) → trang gọi với LISTING_UNAVAILABLE (câu chung "không còn
  // bán"); người đọc được dòng sách (admin) → câu kèm tên
  const description =
    reason === 'BOOK_UNAVAILABLE' && listing.book
      ? tErrors('BOOK_UNAVAILABLE', { title: listing.book.title })
      : tErrors(reason === 'BOOK_UNAVAILABLE' ? 'LISTING_UNAVAILABLE' : reason)
  const listingHref: Href = { pathname: '/used-books/[id]', params: { id: String(listing.id) } }
  const linkClass = buttonVariants({ variant: 'outline', size: 'lg', className: 'h-10 px-4' })

  return (
    <div className="mt-8" data-testid="used-order-unavailable">
      <EmptyState
        icon={PackageXIcon}
        title={own ? t('ownTitle') : t('unavailableTitle')}
        description={description}
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
            {listing.book?.active && (
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
