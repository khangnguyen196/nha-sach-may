import { z } from 'zod'
import type { AdminHref } from '@/components/admin/admin-link'
import { pageParam, searchParam, toSearch } from '../params'

export const authorListParamsSchema = z.object({ q: searchParam, page: pageParam })

export type AuthorListParams = z.output<typeof authorListParamsSchema>

export function authorListHref(params: AuthorListParams, patch: Partial<AuthorListParams> = {}): AdminHref {
  const { q, page } = { ...params, ...patch }
  return `/admin/tac-gia${toSearch({ q, page })}`
}
