import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { parseBlockRows, type BlockRule } from './blocks'

/**
 * Mục chặn của người đang đăng nhập (lọc `user_id` tường minh + RLS `user_blocks_select_own`). Client theo phiên, không
 * 'use cache' (dữ liệu theo user) → chỉ gọi trong <Suspense>, sau getCurrentUser. `React.cache`: layout, trang sách,
 * Mây trong cùng request dùng chung một lần đọc. Dòng sai bị bỏ (parseBlockRows).
 */
export const getMyBlocks = cache(async (userId: string): Promise<BlockRule[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_blocks')
    .select('kind, category_id, author_id, publisher_id, warning')
    .eq('user_id', userId)
  if (error) throw new Error(`getMyBlocks: ${error.code ?? 'unknown'}`)
  return parseBlockRows(data)
})
