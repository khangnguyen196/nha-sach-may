import type { Database } from '@/types/database'

type Order = Pick<Database['public']['Tables']['orders']['Row'], 'status' | 'payment_status'>
type PaymentOrder = Order & Pick<Database['public']['Tables']['orders']['Row'], 'payment_method'>

/**
 * Khách tự hủy được khi cửa hàng chưa xác nhận và đơn chưa thanh toán. Đơn đã thanh toán (VietQR, Phase 9) phải qua
 * cửa hàng vì chưa có quy trình hoàn tiền; cancel_order sẽ kiểm tra cùng điều kiện ở DB (migration Phase 9).
 */
export function canCancel(order: Order) {
  return order.status === 'pending' && order.payment_status !== 'paid'
}

/** Đơn chuyển khoản còn chờ tiền: hiện thẻ VietQR (trang đặt hàng thành công, chi tiết đơn) */
export function awaitingTransfer(order: PaymentOrder) {
  return order.payment_method === 'bank_transfer' && order.payment_status === 'unpaid' && order.status !== 'cancelled'
}
