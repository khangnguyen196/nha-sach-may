import type { Database } from '@/types/database'

type Enums = Database['public']['Enums']

/**
 * Trạng thái một tin đã bán ở "Sách tôi bán" (tiền là mô phỏng):
 * - shipping: đơn chưa giao (chờ xác nhận / đã xác nhận / đang giao);
 * - awaitingPayment: đã giao nhưng người mua chưa thanh toán (chuyển khoản chưa đối soát);
 * - payoutPending: đã giao + đã thanh toán, cửa hàng chưa trả người bán ("Chờ trả");
 * - payoutPaid: admin đã đánh dấu đã trả ("Đã trả").
 */
export type SaleStatus = 'shipping' | 'awaitingPayment' | 'payoutPending' | 'payoutPaid'

type SaleState = {
  orderStatus: Enums['order_status']
  paymentStatus: Enums['payment_status']
  /** seller_payouts.status; null khi đơn chưa đạt đã giao + đã thanh toán (my_used_sales: left join) */
  payoutStatus: string | null
}

export function saleStatus({ orderStatus, paymentStatus, payoutStatus }: SaleState): SaleStatus {
  if (orderStatus !== 'delivered') return 'shipping'
  if (payoutStatus === 'paid') return 'payoutPaid'
  if (payoutStatus === 'pending') return 'payoutPending'
  // Khoản trả do trigger ghi cùng lúc đơn đạt đã giao + đã thanh toán: không có khoản mà đã thanh toán thì vẫn là tiền
  // cửa hàng còn nợ người bán
  return paymentStatus === 'paid' ? 'payoutPending' : 'awaitingPayment'
}

/** Tổng "Chờ trả" / "Đã trả" (đơn đang giao, chờ người mua thanh toán chưa tính) */
export function saleTotals(sales: readonly { status: SaleStatus; amount: number }[]) {
  let pending = 0
  let paid = 0
  for (const sale of sales) {
    if (sale.status === 'payoutPending') pending += sale.amount
    else if (sale.status === 'payoutPaid') paid += sale.amount
  }
  return { pending, paid }
}
