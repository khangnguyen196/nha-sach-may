import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * FILE DUY NHẤT ký link ảnh sách cũ (bucket `used-listing-photos` không công khai; quyết định 7 trong
 * docs/plans/cho-sach-cu.md). Vitest `cache-life.test.ts` kiểm: chỉ file này gọi createSignedUrl(s), và mọi hàm
 * 'use cache' trong file dùng link ký giữ cache ngắn hơn hạn link (cacheLife 'hours' | 'minutes' | 'seconds').
 */

export const USED_PHOTO_BUCKET = 'used-listing-photos'

/** Hạn link ký ảnh: 7 ngày. Cache chứa link phải hết hạn trước (cacheLife('hours'): expire 1 ngày) */
export const USED_PHOTO_URL_TTL = 604_800

/**
 * Link ký cho từng ảnh, cùng thứ tự với `paths`. `client`: anon cho trang công khai (policy chỉ cho ký ảnh của tin đã
 * duyệt / đã bán), theo phiên cho người bán / admin (ký theo từng request, không cache). Ảnh không còn / không được đọc
 * (lỗi từng ảnh) hay cả lần gọi lỗi → null: UI hiện ảnh thay thế, không throw.
 */
export async function signUsedPhotoUrls(
  client: SupabaseClient<Database>,
  paths: readonly string[],
): Promise<(string | null)[]> {
  if (paths.length === 0) return []
  try {
    const { data, error } = await client.storage.from(USED_PHOTO_BUCKET).createSignedUrls([...paths], USED_PHOTO_URL_TTL)
    if (error) {
      console.error('signUsedPhotoUrls:', error.message)
      return paths.map(() => null)
    }
    const urls = new Map(data.map((item) => [item.path, item.error ? null : item.signedUrl]))
    return paths.map((path) => urls.get(path) ?? null)
  } catch (error) {
    console.error('signUsedPhotoUrls:', error)
    return paths.map(() => null)
  }
}
