import { z } from 'zod'
import type { AdminHref } from '@/components/admin/admin-link'
import { enumParam, pageParam, toSearch } from '../params'

// URL tiếng Việt của trang admin: ?trang-thai=cho-tra | da-tra (không có = tất cả), ?page=

const STATUS_BY_SLUG = { 'cho-tra': 'pending', 'da-tra': 'paid' } as const
const SLUG_BY_STATUS = { pending: 'cho-tra', paid: 'da-tra' } as const

export type PayoutStatus = keyof typeof SLUG_BY_STATUS

export const payoutListParamsSchema = z
  .object({ 'trang-thai': enumParam(['cho-tra', 'da-tra']), page: pageParam })
  .transform(({ 'trang-thai': slug, page }) => ({
    status: slug === undefined ? undefined : STATUS_BY_SLUG[slug],
    page,
  }))

export type PayoutListParams = z.output<typeof payoutListParamsSchema>

export function payoutListHref(params: PayoutListParams, patch: Partial<PayoutListParams> = {}): AdminHref {
  const { status, page } = { ...params, ...patch }
  return `/admin/tra-nguoi-ban${toSearch({ 'trang-thai': status && SLUG_BY_STATUS[status], page })}`
}
