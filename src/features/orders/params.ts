import type { Database } from '@/types/database'

// Thuần, không zod: tham số URL của trang "Đơn hàng của tôi". Giá trị sai → bỏ qua về mặc định (như catalog-params),
// URL người dùng sửa tay không làm vỡ trang.

export type OrderStatus = Database['public']['Enums']['order_status']

export const ORDERS_PAGE_SIZE = 10
const MAX_PAGE = 10_000

/** Bộ lọc trên URL (`?status=`): "Đang xử lý" gộp `confirmed` + `shipping` */
export const ORDER_FILTERS = ['pending', 'processing', 'delivered', 'cancelled'] as const
export type OrderFilter = (typeof ORDER_FILTERS)[number]

export const FILTER_STATUSES: Record<OrderFilter, OrderStatus[]> = {
  pending: ['pending'],
  processing: ['confirmed', 'shipping'],
  delivered: ['delivered'],
  cancelled: ['cancelled'],
}

export type OrderListParams = { status?: OrderFilter; page: number }

type SearchParams = Record<string, string | string[] | undefined>

/** searchParams có thể lặp key (`?a=1&a=2`) → chỉ lấy giá trị đầu */
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const isFilter = (value: string | undefined): value is OrderFilter => ORDER_FILTERS.some((filter) => filter === value)

export function parseOrderListParams(searchParams: SearchParams): OrderListParams {
  const status = first(searchParams.status)
  const rawPage = first(searchParams.page)
  const page = rawPage !== undefined && /^\d+$/.test(rawPage) ? Number(rawPage) : 1
  return {
    status: isFilter(status) ? status : undefined,
    page: page >= 1 && page <= MAX_PAGE ? page : 1,
  }
}

/** Tham số → query của Link; bỏ giá trị mặc định để mỗi trạng thái chỉ có một URL */
export function orderListQuery({ status, page }: OrderListParams): Record<string, string> {
  const query: Record<string, string> = {}
  if (status) query.status = status
  if (page > 1) query.page = String(page)
  return query
}
