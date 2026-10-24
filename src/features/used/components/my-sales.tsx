import { getFormatter, getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'
import { getMySales, type MySale } from '../queries'
import { saleTotals, type SaleStatus } from '../sales'
import { UsedDemoNote } from './demo-note'

// Đang giao / chờ người mua thanh toán: nền phụ (chưa tới lượt cửa hàng trả); chờ trả: màu nhấn; đã trả: thành công
const TONE: Record<SaleStatus, string> = {
  shipping: 'bg-surface-raised text-muted-foreground',
  awaitingPayment: 'bg-surface-raised text-muted-foreground',
  payoutPending: 'bg-primary/15 text-primary',
  payoutPaid: 'bg-success/15 text-success',
}

/**
 * Khối "Đã bán" ở Sách tôi bán: tin đã có người mua (đơn chưa hủy) + tiền sẽ nhận (giá − phí sàn, số do DB tính) +
 * tổng chờ trả / đã trả. Tiền là mô phỏng (ghi chú demo). Không hiện gì của người mua / mã đơn. Đọc phiên → trong
 * <Suspense> (MySalesSkeleton).
 */
export async function MySales({ userId }: { userId: string }) {
  const [sales, t] = await Promise.all([getMySales(userId), getTranslations('used.sales')])

  if (sales.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground" data-testid="my-sales-empty">
        {t('empty')}
      </p>
    )
  }

  const format = await getFormatter()
  const totals = saleTotals(sales)
  return (
    <>
      <dl
        aria-label={t('totalsLabel')}
        className="mt-4 grid grid-cols-2 gap-3 rounded-lg border bg-surface p-4 text-sm sm:p-5"
        data-testid="my-sales-totals"
      >
        <div>
          <dt className="text-muted-foreground">{t('totalPending')}</dt>
          <dd className="mt-1 text-lg font-semibold text-primary tabular-nums" data-testid="my-sales-total-pending">
            {format.number(totals.pending, 'price')}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('totalPaid')}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums" data-testid="my-sales-total-paid">
            {format.number(totals.paid, 'price')}
          </dd>
        </div>
      </dl>
      <ul aria-label={t('listLabel')} className="mt-3 grid gap-3" data-testid="my-sales">
        {sales.map((sale) => (
          <SaleRow key={sale.listingId} sale={sale} />
        ))}
      </ul>
      <div className="mt-4">
        <UsedDemoNote />
      </div>
    </>
  )
}

async function SaleRow({ sale }: { sale: MySale }) {
  const [t, format] = await Promise.all([getTranslations('used.sales'), getFormatter()])
  const price = (value: number) => format.number(value, 'price')
  const date = (value: string) => format.dateTime(new Date(value), 'short')

  return (
    <li className="rounded-lg border bg-surface p-4 sm:p-5" data-testid="sale-row" data-listing-id={sale.listingId}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="line-clamp-2 font-medium">{sale.title}</p>
        <span
          className={cn('inline-flex shrink-0 rounded-sm px-2 py-0.5 text-xs font-medium', TONE[sale.status])}
          data-testid="sale-status"
          data-status={sale.status}
        >
          {t(`status.${sale.status}`)}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('soldAt', { date: date(sale.soldAt) })}
        {sale.paidAt && (
          <>
            {' · '}
            <span data-testid="sale-paid-at">{t('paidAt', { date: date(sale.paidAt) })}</span>
          </>
        )}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{t('price')}</dt>
          <dd className="mt-0.5 tabular-nums" data-testid="sale-price">
            {price(sale.price)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('fee')}</dt>
          <dd className="mt-0.5 tabular-nums" data-testid="sale-fee">
            {price(sale.fee)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('amount')}</dt>
          <dd className="mt-0.5 font-semibold text-primary tabular-nums" data-testid="sale-amount">
            {price(sale.amount)}
          </dd>
        </div>
      </dl>
    </li>
  )
}

/** Cao gần bằng khối thật khi có hai tin đã bán (tổng tiền + hai dòng), tránh nhảy trang khi dữ liệu về */
export function MySalesSkeleton() {
  return (
    <div aria-hidden className="animate-pulse motion-reduce:animate-none">
      <div className="mt-4 h-[89px] rounded-lg bg-surface-raised sm:h-[97px]" />
      <div className="mt-3 grid gap-3">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="h-[145px] rounded-lg bg-surface-raised sm:h-[153px]" />
        ))}
      </div>
    </div>
  )
}
