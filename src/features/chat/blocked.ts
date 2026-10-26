// Mây không gợi ý sách bị chặn theo sở thích của người hỏi (docs/plans/so-thich-canh-bao.md, câu 10). Hàm thuần: so khớp
// dùng chung expandBlocks / isBlocked của features/prefs/blocks.ts (một nguồn với CSS che thẻ và dòng nhắc trang sách).
// Danh sách chặn chỉ dùng để lọc ở server, không bao giờ đi vào prompt.
import { expandBlocks, isBlocked, type BlockableBook, type BlockRule, type ExpandedBlocks } from '@/features/prefs/blocks'

/**
 * Mục chặn đã mở rộng (danh mục cha → mọi danh mục con, câu 8) hoặc null = không lọc: khách, chưa chặn gì, đọc mục
 * chặn lỗi (`rules` null).
 */
export function chatBlocks(
  rules: readonly BlockRule[] | null,
  categories: readonly { id: number; parent_id: number | null }[],
): ExpandedBlocks | null {
  if (!rules || rules.length === 0) return null
  return expandBlocks(rules, categories)
}

/** Bỏ sách bị chặn (tác giả chỉ tính vai trò author, câu 9); `blocks` null → giữ nguyên */
export function withoutBlocked<Book extends BlockableBook>(books: readonly Book[], blocks: ExpandedBlocks | null): Book[] {
  return blocks ? books.filter((book) => !isBlocked(book, blocks)) : [...books]
}
