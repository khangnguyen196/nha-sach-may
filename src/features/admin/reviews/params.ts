import { z } from 'zod'
import type { AdminHref } from '@/components/admin/admin-link'
import { enumParam, pageParam, toSearch } from '../params'

export const RATINGS = ['1', '2', '3', '4', '5'] as const

/** `?sao=1..5`: lọc theo số sao (đánh giá thấp thường là chỗ cần kiểm duyệt) */
export const reviewListParamsSchema = z.object({ sao: enumParam(RATINGS), page: pageParam })

export type ReviewListParams = z.output<typeof reviewListParamsSchema>

export function reviewListHref(params: ReviewListParams, patch: Partial<ReviewListParams> = {}): AdminHref {
  const { sao, page } = { ...params, ...patch }
  return `/admin/danh-gia${toSearch({ sao, page })}`
}
