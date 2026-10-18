import { CircleCheckIcon } from 'lucide-react'
import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { InlineNotFound } from '@/components/layout/inline-not-found'
import { buttonVariants } from '@/components/ui/button'
import { OrderDetails, OrderDetailsSkeleton } from '@/features/orders/components/order-details'
import { getOrderByCode } from '@/features/orders/queries'
import { awaitingTransfer } from '@/features/orders/utils'
import { VietQrCard } from '@/features/payments/components/vietqr-card'
import { Link } from '@/i18n/navigation'
import { requireUser } from '@/lib/auth'

type Props = PageProps<'/[locale]/checkout/success/[code]'>

// Mã đơn không biết trước lúc build (không có generateStaticParams) nên header (LocaleSwitcher đọc useParams) không
// prerender được shell cho route này. Trang riêng tư, render theo request là đủ → cho phép route chặn.
export const instant = false

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('order')
  // Trang riêng tư (noindex) → không cần hreflang theo từng mã đơn
  return { title: t('successTitle'), robots: { index: false, follow: false } }
}

// Tiêu đề "Đặt hàng thành công" nằm trong boundary, chỉ hiện khi có đơn: proxy không hỏi được DB mà đơn không có thì
// trang chỉ hiện UI 404 (trước đây khối 404 nằm ngay dưới tiêu đề "Đặt hàng thành công" đã prerender)
export default async function OrderSuccessPage({ params }: Props) {
  const locale = await getLocale()
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 md:py-16">
      <Suspense fallback={<SuccessSkeleton />}>
        <OrderSuccess locale={locale} params={params} />
      </Suspense>
    </div>
  )
}

async function OrderSuccess({ locale, params }: { locale: Locale; params: Props['params'] }) {
  const { code } = await params
  const user = await requireUser(locale, { pathname: '/checkout/success/[code]', params: { code } })
  const [order, t, format] = await Promise.all([getOrderByCode(code, user.id), getTranslations('order'), getFormatter()])
  // Không có hoặc của người khác (lọc theo user_id) → 404 như nhau. Proxy đã trả 404; còn tới đây (proxy không hỏi
  // được) thì hiện UI 404 trong boundary
  if (!order) return <InlineNotFound kind="order" heading="h1" />

  return (
    <>
      <div className="flex flex-col items-center text-center">
        <CircleCheckIcon aria-hidden className="size-12 text-success" />
        <h1 className="mt-4 font-serif text-3xl font-medium md:text-4xl">{t('successTitle')}</h1>
        <p className="mt-2 text-muted-foreground">{t('successLead')}</p>
      </div>
      <div className="mt-10" data-testid="order-success">
        <OrderDetails
          order={order}
          locale={locale}
          highlight={
            order.payment_method === 'bank_transfer' ? (
              <>
                <p className="-mt-2 text-center font-medium text-primary" data-testid="order-bank-amount">
                  {t('bankAmount', { total: format.number(order.total, 'price') })}
                </p>
                {awaitingTransfer(order) && <VietQrCard orderCode={order.order_code} amount={order.total} />}
              </>
            ) : (
              <p className="-mt-2 text-center font-medium text-primary" data-testid="order-cod">
                {t('codAmount', { total: format.number(order.total, 'price') })}
              </p>
            )
          }
        />
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href={{ pathname: '/account/orders/[code]', params: { code: order.order_code } }}
          className={buttonVariants({ variant: 'outline', size: 'lg', className: 'h-11 px-6 text-base' })}
        >
          {t('viewOrder')}
        </Link>
        <Link href="/" className={buttonVariants({ size: 'lg', className: 'h-11 px-6 text-base' })}>
          {t('continueShopping')}
        </Link>
      </div>
    </>
  )
}

function SuccessSkeleton() {
  // Cùng kích thước khối tiêu đề (icon 48px + h1 + câu dẫn) để không xô trang khi nội dung tới
  return (
    <>
      <div aria-hidden className="flex animate-pulse flex-col items-center motion-reduce:animate-none">
        <div className="size-12 rounded-full bg-surface-raised" />
        <div className="mt-4 h-9 w-64 rounded-sm bg-surface-raised md:h-10" />
        <div className="mt-2 h-6 w-72 max-w-full rounded-sm bg-surface-raised" />
      </div>
      <div className="mt-10">
        <OrderDetailsSkeleton />
      </div>
      <div aria-hidden className="mt-10 h-11" />
    </>
  )
}
