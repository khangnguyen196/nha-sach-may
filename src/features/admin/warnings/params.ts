import { z } from 'zod'
import type { AdminHref } from '@/components/admin/admin-link'
import { idParam, pageParam, toSearch } from '../params'

/** `?sach=<id>`: chỉ gợi ý của một sách (link "Xem gợi ý" từ trang sửa sách) */
export const suggestionListParamsSchema = z.object({ sach: idParam, page: pageParam })

export type SuggestionListParams = z.output<typeof suggestionListParamsSchema>

export function suggestionListHref(params: SuggestionListParams, patch: Partial<SuggestionListParams> = {}): AdminHref {
  const { sach, page } = { ...params, ...patch }
  return `/admin/canh-bao${toSearch({ sach, page })}`
}
