'use server'

import { refresh, updateTag } from 'next/cache'
import { toFailure, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { assertAdmin } from '../auth'
import { rowIdSchema } from '../schemas'

/**
 * Gỡ một đánh giá (policy reviews_delete_own_or_admin). Trigger tính lại điểm sách → làm mới trang sách + danh sách
 * đang chứa sách đó. Đã bị xóa ở nơi khác (0 dòng) → coi như xong.
 */
export async function deleteReviewAsAdmin(id: number): Promise<Result<null>> {
  const denied = await assertAdmin()
  if (denied) return denied
  const reviewId = rowIdSchema.safeParse(id)
  if (!reviewId.success) return { ok: false, code: 'UNKNOWN' }

  const supabase = await createClient()
  const { data, error } = await supabase.from('reviews').delete().eq('id', reviewId.data).select('book_id')
  if (error) return toFailure(error)
  for (const { book_id } of data) updateTag(`book:${book_id}`)
  refresh()
  return { ok: true, data: null }
}
