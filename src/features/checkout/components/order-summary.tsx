import { BookIcon } from 'lucide-react'
import Image from 'next/image'
import { getFormatter, getTranslations } from 'next-intl/server'
import type { CartLine, CartQuote } from '@/features/cart/queries'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

/** Dòng không đặt được: ngừng bán (book null) hoặc vượt tồn kho (kể cả hết hàng) */
export function isProblemLine(line: CartLine) {
  return !line.book || line.quantity > line.book.stock
}

type Props = { lines: CartLine[]; quote: CartQuote & { discount: number }; voucherCode: string | null }

/** Tóm tắt ở cột phải: các dòng + tạm tính / phí ship / giảm giá / tổng từ quote_order (không tự tính tổng) */
export async function OrderSummary({ lines, quote, voucherCode }: Props) {
  const [t, tCart, format] = await Promise.all([getTranslations('checkout'), getTranslations('cart'), getFormatter()])
  const price = (value: number) => format.number(value, 'price')

  return (
    <section aria-labelledby="checkout-summary-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="checkout-summary-heading" className="text-lg font-semibold">
          {t('summary')}
        </h2>
        <Link href="/cart" className="rounded-sm text-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
          {t('editCart')}
        </Link>
      </div>

      <ul className="mt-4 divide-y border-y">
        {lines.map((line) => (
          <li key={line.book_id} className="flex gap-3 py-3" data-testid="checkout-line">
            {/* Tên sách hiển thị ngay bên cạnh → alt="" (ngoại lệ alt trong CLAUDE.md) */}
            <div className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-cover bg-surface-raised">
              {line.book?.cover_url ? (
                <Image src={line.book.cover_url} alt="" fill sizes="40px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-subtle">
                  <BookIcon aria-hidden className="size-4" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className={cn('line-clamp-2 font-medium', !line.book && 'text-muted-foreground')}>
                {line.book?.title ?? tCart('unavailableTitle')}
              </p>
              <p className="mt-0.5 text-muted-foreground">{t('quantity', { quantity: line.quantity })}</p>
              {!line.book ? (
                <p className="mt-1 text-sale">{tCart('unavailable')}</p>
              ) : line.book.stock === 0 ? (
                <p className="mt-1 text-sale">{tCart('soldOut')}</p>
              ) : (
                line.quantity > line.book.stock && (
                  <p className="mt-1 text-sale">{tCart('overStock', { stock: line.book.stock })}</p>
                )
              )}
            </div>
            {line.book && (
              <p className="shrink-0 text-sm tabular-nums">
                <span className="sr-only">{tCart('lineTotal')}: </span>
                {/* Chỉ để hiển thị; tổng tiền lấy từ quote */}
                {price(line.book.price * line.quantity)}
              </p>
            )}
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">{tCart('subtotal')}</dt>
          <dd className="tabular-nums" data-testid="checkout-subtotal">
            {price(quote.subtotal)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">{tCart('shipping')}</dt>
          <dd className="tabular-nums" data-testid="checkout-shipping">
            {quote.shipping_fee === 0 && quote.item_count > 0 ? tCart('freeShipping') : price(quote.shipping_fee)}
          </dd>
        </div>
        {quote.discount > 0 && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">
              {t('discount')}
              {voucherCode && <span className="ml-1 font-mono text-xs">({voucherCode})</span>}
            </dt>
            <dd className="text-success tabular-nums" data-testid="checkout-discount">
              −{price(quote.discount)}
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4 border-t pt-3 text-base">
          <dt className="font-semibold">{tCart('total')}</dt>
          <dd className="font-semibold text-primary tabular-nums" data-testid="checkout-total">
            {price(quote.total)}
          </dd>
        </div>
      </dl>
    </section>
  )
}

/** Giỏ có dòng không đặt được → chặn sớm, chỉ đường về giỏ (place_order vẫn là chốt chặn cuối) */
export async function CartProblems() {
  const t = await getTranslations('checkout')
  return (
    <div className="mt-4 rounded-md border border-sale/40 bg-sale/10 px-3 py-2.5 text-sm" data-testid="checkout-problems">
      <p className="text-sale">{t('problemsTitle')}</p>
      <Link href="/cart" className="mt-1.5 block w-fit font-medium underline underline-offset-4">
        {t('fixInCart')}
      </Link>
    </div>
  )
}
