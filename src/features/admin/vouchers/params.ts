import { z } from 'zod'
import type { AdminHref } from '@/components/admin/admin-link'
import { pageParam, searchParam, toSearch } from '../params'

export const voucherListParamsSchema = z.object({ q: searchParam, page: pageParam })

export type VoucherListParams = z.output<typeof voucherListParamsSchema>

export function voucherListHref(params: VoucherListParams, patch: Partial<VoucherListParams> = {}): AdminHref {
  const { q, page } = { ...params, ...patch }
  return `/admin/voucher${toSearch({ q, page })}`
}
