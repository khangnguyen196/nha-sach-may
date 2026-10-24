import { z } from 'zod'
import type { AdminHref } from '@/components/admin/admin-link'
import { LISTING_STATUSES, type ListingStatus } from '@/features/used/status'
import { enumParam, pageParam, toSearch } from '../params'

/** Mặc định: tin chờ duyệt (việc admin cần làm) */
export const DEFAULT_LISTING_STATUS: ListingStatus = 'pending'

/** `?status=…` (trạng thái tin, mặc định pending), `?page=` */
export const usedListingListParamsSchema = z.object({
  status: enumParam(LISTING_STATUSES).transform((status) => status ?? DEFAULT_LISTING_STATUS),
  page: pageParam,
})

export type UsedListingListParams = z.output<typeof usedListingListParamsSchema>

export function usedListingListHref(
  params: UsedListingListParams,
  patch: Partial<UsedListingListParams> = {},
): AdminHref {
  const { status, page } = { ...params, ...patch }
  return `/admin/sach-cu${toSearch({ status: status === DEFAULT_LISTING_STATUS ? undefined : status, page })}`
}
