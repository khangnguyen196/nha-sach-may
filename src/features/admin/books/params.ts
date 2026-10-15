import { z } from 'zod'
import type { AdminHref } from '@/components/admin/admin-link'
import { enumParam, idParam, pageParam, searchParam, toSearch } from '../params'

/** "Sắp hết": còn 1–5 cuốn (dùng chung trang tổng quan và bộ lọc danh sách sách) */
export const LOW_STOCK = 5

export const bookListParamsSchema = z.object({
  q: searchParam,
  category: idParam,
  status: enumParam(['active', 'hidden']),
  stock: enumParam(['low', 'out']),
  page: pageParam,
})

export type BookListParams = z.output<typeof bookListParamsSchema>

/** URL danh sách sách với bộ lọc hiện tại + thay đổi `patch` */
export function bookListHref(params: BookListParams, patch: Partial<BookListParams> = {}): AdminHref {
  const { q, category, status, stock, page } = { ...params, ...patch }
  return `/admin/sach${toSearch({ q, category, status, stock, page })}`
}
