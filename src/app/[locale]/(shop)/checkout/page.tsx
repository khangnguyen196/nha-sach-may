import { ShoppingBagIcon } from 'lucide-react'
import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { getAddresses } from '@/features/account/queries'
import { EmptyState } from '@/features/books/components/empty-state'
import { getCart } from '@/features/cart/queries'
import { placeOrder } from '@/features/checkout/actions'
import { AddressOptions } from '@/features/checkout/components/address-options'
import { CheckoutForm } from '@/features/checkout/components/checkout-form'
import { CheckoutSkeleton } from '@/features/checkout/components/checkout-skeleton'
import { CartProblems, isProblemLine, OrderSummary } from '@/features/checkout/components/order-summary'
import { PaymentMethod } from '@/features/checkout/components/payment-method'
import { VOUCHER_FORM_ID, VoucherField } from '@/features/checkout/components/voucher-field'
import { getCheckoutQuote, getCheckoutVouchers } from '@/features/checkout/queries'
import { NOTE_MAX } from '@/features/checkout/schemas'
import { parseVoucherInput } from '@/features/checkout/voucher'
import { rankVouchers } from '@/features/checkout/voucher-suggestions'
import { localeAlternates } from '@/i18n/alternates'
import { getPathname, Link } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth'
import { getFormMessages } from '@/lib/form-messages'
import { placeholder } from '@/lib/template'

type Props = PageProps<'/[locale]/checkout'>

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('checkout'), getLocale()])
  return {
    title: t('title'),
    description: t('metaDescription'),
    robots: { index: false, follow: false },
    alternates: localeAlternates('/checkout', locale),
  }
}

/** Cần đăng nhập (proxy chặn một lớp, requireUser kiểm tra lại). Static shell = tiêu đề; còn lại trong Suspense. */
export default async function CheckoutPage({ searchParams }: Props) {
  const [t, locale] = await Promise.all([getTranslations('checkout'), getLocale()])
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <h1 className="font-serif text-3xl font-medium md:text-4xl">{t('title')}</h1>
      <Suspense fallback={<CheckoutSkeleton />}>
        <CheckoutContent locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function CheckoutContent({ locale, searchParams }: { locale: Locale; searchParams: Props['searchParams'] }) {
  await requireUser(locale, '/checkout')
  const query = await searchParams
  // ?voucher= : mã nằm trên URL (form GET "Áp dụng"); sai dạng → báo dưới ô như mã không tồn tại
  const [lines, { quote, voucher }, suggestions, addresses, t, tCart, messages] = await Promise.all([
    getCart(),
    getCheckoutQuote(locale, parseVoucherInput(query.voucher)),
    getCheckoutVouchers(),
    getAddresses(),
    getTranslations('checkout'),
    getTranslations('cart'),
    getFormMessages(['AUTH_REQUIRED', 'CART_EMPTY', 'CART_CHANGED']),
  ])

  if (lines.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          icon={ShoppingBagIcon}
          title={tCart('emptyTitle')}
          description={tCart('emptyDescription')}
          action={
            <Link href="/" className={buttonVariants({ size: 'lg', className: 'h-10 px-4' })}>
              {tCart('browse')}
            </Link>
          }
        />
      </div>
    )
  }

  // ?address= từ trang thêm địa chỉ; không thuộc sổ địa chỉ thì về địa chỉ mặc định (getAddresses xếp đầu)
  const wanted = Number(query.address)
  const selectedId = addresses.find((address) => address.id === wanted)?.id ?? addresses[0]?.id
  const hasProblems = lines.some(isProblemLine)
  const voucherCode = voucher && !voucher.failure ? voucher.code : null

  return (
    <>
      <CheckoutForm
        action={placeOrder.bind(null, locale)}
        messages={messages}
        labels={{
          noteLabel: t('noteLabel'),
          noteHint: t('noteHint'),
          noteCount: t('noteCount', { count: placeholder('count'), max: NOTE_MAX }),
          placeOrder: t('placeOrder'),
          placing: t('placing'),
          syncingCart: t('syncingCart'),
          fixQuantity: t('fixQuantity'),
          fixRemove: t('fixRemove'),
          chooseAddress: t('chooseAddress'),
        }}
        // Sinh ở phần động (sau khi đọc phiên), không ở static shell: giá trị ngẫu nhiên lúc prerender sẽ bị
        // đóng băng vào HTML dùng chung. Mỗi lần render một key → đặt xong quay lại checkout là đơn mới.
        idempotencyKey={crypto.randomUUID()}
        expectedTotal={quote.total}
        voucherCode={voucherCode}
        noteMax={NOTE_MAX}
        blocked={addresses.length === 0 || hasProblems || quote.item_count === 0}
        address={<AddressOptions addresses={addresses} selectedId={selectedId} locale={locale} />}
        payment={<PaymentMethod />}
        summary={<OrderSummary lines={lines} quote={quote} voucherCode={voucherCode} />}
        voucher={<VoucherField voucher={voucher} addressId={selectedId} suggestions={rankVouchers(suggestions)} />}
        problems={hasProblems ? <CartProblems /> : undefined}
      />
      {/* Form GET của ô mã giảm giá (ô + nút nằm trong form đặt hàng, gắn bằng form="…"); giữ địa chỉ đang chọn */}
      <form id={VOUCHER_FORM_ID} method="get" action={getPathname({ href: '/checkout', locale })} hidden>
        {selectedId !== undefined && <input type="hidden" name="address" value={selectedId} />}
      </form>
    </>
  )
}
