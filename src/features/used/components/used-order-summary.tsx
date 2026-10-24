import { BookIcon } from 'lucide-react'
import Image from 'next/image'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { PurchaseListing, UsedOrderQuote } from '../queries'
import { UsedDemoNote } from './demo-note'

type Props = {
  listing: PurchaseListing & { book: NonNullable<PurchaseListing['book']> }
  /** Tiền do quote_used_order tính (giá tin + ship cố định); client không tự tính */
  quote: UsedOrderQuote
}

/**
 * Tóm tắt đơn sách cũ ở trang mua: bìa catalog của sách (ảnh thật của tin xem ở trang tin), tên, "Sách cũ · tình
 * trạng", người bán, ghi chú của người bán (cùng bản với updated_at gửi đi), giá / ship / tổng, ghi chú demo.
 */
export async function UsedOrderSummary({ listing, quote }: Props) {
  const [t, tMarket, tCondition, tCart, format] = await Promise.all([
    getTranslations('used.buy'),
    getTranslations('used.market'),
    getTranslations('used.condition'),
    getTranslations('cart'),
    getFormatter(),
  ])
  const price = (value: number) => format.number(value, 'price')

  return (
    <section aria-labelledby="used-order-summary-title">
      <h2 id="used-order-summary-title" className="text-lg font-semibold">
        {t('summary')}
      </h2>
      <div className="mt-4 flex gap-3">
        <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-cover bg-surface-raised">
          {listing.book.coverUrl ? (
            // Tên sách hiện ngay bên cạnh → alt="" (ngoại lệ alt trong CLAUDE.md)
            <Image src={listing.book.coverUrl} alt="" fill sizes="56px" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-subtle">
              <BookIcon aria-hidden className="size-4" />
            </span>
          )}
        </div>
        <div className="min-w-0 text-sm">
          <p className="line-clamp-2 font-medium" data-testid="used-order-title">
            {listing.book.title}
          </p>
          <p className="mt-0.5 text-muted-foreground" data-testid="used-order-condition">
            {t('usedLabel', { condition: tCondition(listing.condition) })}
          </p>
          <p className="mt-0.5 text-muted-foreground" data-testid="used-order-seller">
            {tMarket('seller', { name: listing.sellerName ?? tMarket('member') })}
          </p>
          <Link
            href={{ pathname: '/used-books/[id]', params: { id: String(listing.id) } }}
            prefetch={false}
            className="mt-1 inline-block rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t('viewListing')}
          </Link>
        </div>
      </div>

      {listing.description && (
        <div className="mt-4 border-t pt-4 text-sm">
          <h3 className="text-muted-foreground">{t('sellerNote')}</h3>
          <p className="mt-1 whitespace-pre-line" data-testid="used-order-description">
            {listing.description}
          </p>
        </div>
      )}

      <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">{t('price')}</dt>
          <dd className="tabular-nums" data-testid="used-order-price">
            {price(quote.price)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">{tCart('shipping')}</dt>
          <dd className="tabular-nums" data-testid="used-order-shipping">
            {quote.shipping_fee === 0 ? tCart('freeShipping') : price(quote.shipping_fee)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t pt-3 text-base">
          <dt className="font-semibold">{tCart('total')}</dt>
          <dd className="font-semibold text-primary tabular-nums" data-testid="used-order-total">
            {price(quote.total)}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <UsedDemoNote />
      </div>
    </section>
  )
}
