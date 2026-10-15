import 'server-only'
import { updateTag } from 'next/cache'
import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Tồn kho / sold_count của các sách trong đơn vừa đổi (đặt / hủy) → làm mới trang sách và các danh sách đang chứa
 * chúng (tag `book:{id}` gắn theo từng sách). Chỉ gọi trong Server Action (updateTag).
 */
export async function expireOrderBooks(supabase: Supabase, orderId: number) {
  const { data, error } = await supabase.from('order_items').select('book_id').eq('order_id', orderId)
  if (error) {
    // Đơn đã đổi xong: không báo lỗi cho người dùng, cache tự hết hạn sau `hours`
    console.error('expireOrderBooks:', error.message)
    return
  }
  for (const { book_id } of data) if (book_id !== null) updateTag(`book:${book_id}`)
}
