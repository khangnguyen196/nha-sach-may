import { ArrowRightIcon, TruckIcon } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { ShippingTerms } from '../queries'

/**
 * Thẻ "Miễn phí giao hàng": nền promo (chuyển màu promo-from → promo-to), số mốc lấy từ quote_items (getShippingTerms),
 * không hard-code. Vòng focus dùng promo-accent đặc: focus-ring tối là primary 50%, mờ trên nền promo (Vitest
 * src/app/globals.test.ts kiểm file nền promo không dùng focus-ring).
 */
export async function ShipCard({ id, terms }: { id: string; terms: ShippingTerms }) {
  const [t, format] = await Promise.all([getTranslations('home'), getFormatter()])
  return (
    <article
      aria-labelledby={id}
      className="flex w-full flex-col rounded-lg border border-promo-accent/25 bg-linear-150 from-promo-from to-promo-to p-5 text-promo-foreground"
    >
      <h3 id={id} className="text-lg font-semibold">
        {t('shipTitle')}
      </h3>
      <div className="my-auto flex flex-col gap-0.5 py-6">
        <span className="mb-4 grid size-12 place-items-center rounded-full bg-surface/75 text-promo-accent">
          <TruckIcon aria-hidden className="size-6" />
        </span>
        <p className="text-promo-muted">{t('shipLead')}</p>
        <p className="font-serif text-3xl leading-tight font-semibold text-promo-accent">
          {format.number(terms.freeShipFrom, 'price')}
        </p>
        {terms.fee !== null && (
          <p className="mt-3 max-w-[24ch] text-sm text-promo-muted">
            {t('shipFee', { fee: format.number(terms.fee, 'price') })}
          </p>
        )}
      </div>
      <Link
        href="/books"
        className="group inline-flex items-center gap-1.5 self-start rounded-sm text-sm font-medium text-promo-accent underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-promo-accent"
      >
        {t('shipCta')}
        <ArrowRightIcon aria-hidden className="size-4 transition-transform duration-200 ease-out motion-safe:group-hover:translate-x-0.5" />
      </Link>
    </article>
  )
}
