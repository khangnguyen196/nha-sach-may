import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { USED_PHOTO_BUCKET } from './signed-urls'

type Client = SupabaseClient<Database>

/** Ảnh tải lên chưa gắn tin cũ hơn mức này mới bị dọn: ảnh mới có thể đang nằm trong form ở tab khác */
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000
/** Thư mục một người bán có tối đa ~30 ảnh (trần của policy, tải song song có thể vượt chút ít) */
const FOLDER_LIST_LIMIT = 200

/**
 * Xóa các ảnh (trong thư mục của chính người bán) không còn nằm trong tin nào chưa rút của người đó: ảnh bỏ khỏi tin khi
 * sửa, ảnh của tin vừa rút, ảnh mồ côi. Tin đã rút là trạng thái cuối, ảnh của nó không còn dùng. Lỗi chỉ ghi log: dữ
 * liệu tin đã lưu xong, ảnh sót chỉ chiếm chỗ trong trần 30 ảnh. Storage không báo lỗi khi policy chặn xóa (ảnh gắn tin
 * chờ duyệt / đã duyệt / đã bán), chỉ trả mảng rỗng: không coi là lỗi.
 */
export async function removeUnusedPhotos(supabase: Client, userId: string, paths: readonly string[]) {
  const candidates = [...new Set(paths)].filter((path) => path.startsWith(`${userId}/`))
  if (candidates.length === 0) return
  try {
    const { data, error } = await supabase
      .from('used_listings')
      .select('photos')
      .eq('seller_id', userId)
      .neq('status', 'withdrawn')
      .overlaps('photos', candidates)
    if (error) {
      console.error('removeUnusedPhotos (listings):', error.message)
      return
    }
    const inUse = new Set(data.flatMap((listing) => listing.photos))
    const unused = candidates.filter((path) => !inUse.has(path))
    if (unused.length === 0) return
    const { error: removeError } = await supabase.storage.from(USED_PHOTO_BUCKET).remove(unused)
    if (removeError) console.error('removeUnusedPhotos (remove):', removeError.message)
  } catch (error) {
    console.error('removeUnusedPhotos:', error)
  }
}

/**
 * Dọn ảnh mồ côi của chính người bán (tải lên rồi bỏ form giữa chừng) cũ hơn 24 giờ, để không chạm trần 30 ảnh. Trang
 * đăng tin gọi trong after() (không chặn trang), với client theo phiên tạo TRƯỚC after() (Server Component không đọc
 * cookies trong after()); lỗi bỏ qua.
 */
export async function removeMyOrphanPhotos(supabase: Client, userId: string) {
  try {
    const { data, error } = await supabase.storage
      .from(USED_PHOTO_BUCKET)
      .list(userId, { limit: FOLDER_LIST_LIMIT, sortBy: { column: 'created_at', order: 'asc' } })
    if (error) {
      console.error('removeMyOrphanPhotos (list):', error.message)
      return
    }
    const now = Date.now()
    const old = data
      .filter((file) => file.created_at && now - Date.parse(file.created_at) > ORPHAN_AGE_MS)
      .map((file) => `${userId}/${file.name}`)
    await removeUnusedPhotos(supabase, userId, old)
  } catch (error) {
    console.error('removeMyOrphanPhotos:', error)
  }
}
