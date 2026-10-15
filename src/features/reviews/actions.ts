'use server'

import { refresh, updateTag } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { invalidInput, toFailure, type Failure, type Result } from '@/lib/errors'
import { createClient } from '@/lib/supabase/server'
import { bookIdSchema, reviewSchema } from './schemas'

// id sách do page bind sẵn (tham số bind đi qua client nên parse lại); lỗi trả mã, chuỗi đã dịch có sẵn ở form. Quyền viết do RLS quyết định
// (reviews_insert_if_purchased: có đơn delivered chứa sách; update / delete: đánh giá của chính mình). Client chỉ ghi
// được rating, content (column grant); user_id = auth.uid() mặc định, display_name do trigger điền.

const UNKNOWN: Failure = { ok: false, code: 'UNKNOWN' }
/** RLS chặn insert (chưa nhận sách) */
const RLS_VIOLATION = '42501'

/** Trang sách + mọi danh sách đang chứa sách (điểm trung bình đổi theo trigger) */
function expireBook(bookId: number) {
  updateTag(`book:${bookId}`)
  refresh()
}

export async function saveReview(bookId: number, _prev: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const id = bookIdSchema.safeParse(bookId)
  if (!id.success) return UNKNOWN
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return invalidInput(parsed.error)
  const user = await getCurrentUser()
  if (!user) return { ok: false, code: 'AUTH_REQUIRED' }

  const supabase = await createClient()
  // Mỗi người một đánh giá / sách (unique): có rồi thì sửa
  const { data: updated, error: updateError } = await supabase
    .from('reviews')
    .update(parsed.data)
    .eq('book_id', id.data)
    .eq('user_id', user.id)
    .select('id')
  if (updateError) return toFailure(updateError)

  if (updated.length === 0) {
    const { error } = await supabase.from('reviews').insert({ book_id: id.data, ...parsed.data })
    if (error?.code === RLS_VIOLATION) return { ok: false, code: 'REVIEW_NOT_ALLOWED' }
    if (error) return toFailure(error)
  }
  expireBook(id.data)
  return { ok: true, data: null }
}

export async function deleteReview(bookId: number): Promise<Result<null>> {
  const id = bookIdSchema.safeParse(bookId)
  if (!id.success) return UNKNOWN
  const user = await getCurrentUser()
  if (!user) return { ok: false, code: 'AUTH_REQUIRED' }

  const supabase = await createClient()
  const { error } = await supabase.from('reviews').delete().eq('book_id', id.data).eq('user_id', user.id)
  if (error) return toFailure(error)
  expireBook(id.data)
  return { ok: true, data: null }
}
