import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '../params'

// Đang đi (chờ / đã xác nhận / đang giao) dùng màu nhấn nhạt, đã giao màu thành công, đã hủy lùi về nền phụ
const TONE: Record<OrderStatus, string> = {
  pending: 'bg-primary/15 text-primary',
  confirmed: 'bg-primary/15 text-primary',
  shipping: 'bg-primary/15 text-primary',
  delivered: 'bg-success/15 text-success',
  cancelled: 'bg-surface-raised text-muted-foreground',
}

export async function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = await getTranslations('order.status')
  return (
    <span
      className={cn('inline-flex shrink-0 rounded-sm px-2 py-0.5 text-xs font-medium', TONE[status])}
      data-testid="order-status"
    >
      {t(status)}
    </span>
  )
}
