import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { countUsedListings, matchingUsedSearchBookIds } from './public-queries'

/**
 * Số N của nhãn "Sách cũ (N)" ở tab Sách mới. N chỉ là số phụ: lỗi ở bất kỳ bước nào → null (nhãn không số), không
 * kéo cả trang kết quả sách mới lên error boundary. Tách khỏi page.tsx để thử được bằng Vitest.
 */
export async function searchUsedCount(q: string, visibleIds: number[]): Promise<number | null> {
  let step = 'ids'
  try {
    const ids = await matchingUsedSearchBookIds(q, visibleIds)
    if (ids.length === 0) return 0
    step = 'count'
    return await countUsedListings(ids)
  } catch (error) {
    // Đứng đầu catch: lỗi nội bộ của Next (redirect, dừng prerender ở dữ liệu động…) phải ném tiếp, không thành null
    unstable_rethrow(error)
    // Không ghi q hay message (có thể kèm từ khóa người dùng gõ): chỉ bước lỗi + tên lỗi
    console.error(`searchUsedCount (${step}):`, error instanceof Error ? error.name : typeof error)
    return null
  }
}
