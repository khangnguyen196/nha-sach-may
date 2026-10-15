import { z } from 'zod'
import type { AdminHref } from '@/components/admin/admin-link'
import { Constants } from '@/types/database'
import { enumParam, pageParam, searchParam, toSearch } from '../params'

export const orderListParamsSchema = z.object({
  q: searchParam,
  status: enumParam(Constants.public.Enums.order_status),
  page: pageParam,
})

export type OrderListParams = z.output<typeof orderListParamsSchema>

export function orderListHref(params: OrderListParams, patch: Partial<OrderListParams> = {}): AdminHref {
  const { q, status, page } = { ...params, ...patch }
  return `/admin/don-hang${toSearch({ q, status, page })}`
}
