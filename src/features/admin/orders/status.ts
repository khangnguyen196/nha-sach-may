import type { OrderStatus } from '@/features/orders/params'

/**
 * Trạng thái đơn được phép chuyển tới, trùng bảng `private.order_status_transition_allowed` (trigger chặn ở DB với
 * mọi role; Vitest đối chiếu với schema.sql). UI chỉ hiện nút cho các trạng thái này.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipping', 'cancelled'],
  shipping: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
}

export function nextStatuses(status: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[status]
}

type ForwardStatus = 'confirmed' | 'shipping' | 'delivered'

const FORWARD: Record<OrderStatus, ForwardStatus | null> = {
  pending: 'confirmed',
  confirmed: 'shipping',
  shipping: 'delivered',
  delivered: null,
  cancelled: null,
}

/** Bước tiếp theo của luồng giao (không tính hủy), luôn nằm trong nextStatuses (Vitest) */
export function forwardStatus(status: OrderStatus): ForwardStatus | null {
  return FORWARD[status]
}

export function canAdminCancel(status: OrderStatus) {
  return nextStatuses(status).includes('cancelled')
}
