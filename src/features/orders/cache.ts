import 'server-only'
import { updateTag } from 'next/cache'
import { usedListingTags } from '@/features/used/tags'
import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Các sách trong đơn vừa đổi (đặt / hủy / admin hủy) → làm mới trang sách và các danh sách đang chứa chúng.
 * Dòng sách mới: tồn kho / sold_count đổi → tag `book:{id}` (gắn theo từng sách). Dòng sách cũ (`used_listing_id`):
 * tồn kho không đổi nhưng tin đổi trạng thái công khai (đặt → đã bán, hủy → đang bán lại) → tag chợ, trang tin, "Có N
 * bản cũ" của sách (`usedListingTags`). Chỉ gọi trong Server Action (updateTag).
 */
export async function expireOrderBooks(supabase: Supabase, orderId: number) {
  const { data, error } = await supabase.from('order_items').select('book_id, used_listing_id').eq('order_id', orderId)
  if (error) {
    // Đơn đã đổi xong: không báo lỗi cho người dùng, cache tự hết hạn sau `hours`
    console.error('expireOrderBooks:', error.message)
    return
  }
  const tags = new Set<string>()
  for (const { book_id, used_listing_id } of data) {
    if (book_id === null) continue
    if (used_listing_id === null) tags.add(`book:${book_id}`)
    else for (const tag of usedListingTags(used_listing_id, book_id)) tags.add(tag)
  }
  for (const tag of tags) updateTag(tag)
}
