import type { ChatEntry } from './chat-state'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** Một mục hội thoại chưa có id (id gán lúc thêm vào danh sách, xem appendEntry) */
export type NewChatEntry = DistributiveOmit<ChatEntry, 'id'>

/**
 * Thêm một mục vào cuối hội thoại, id = id lớn nhất hiện có + 1, tính trên chính danh sách đang có (updater của
 * setEntries). Không dùng bộ đếm ref của ChatPanel (khởi lại theo `entries.length` mỗi lần khung mount lại): id chỉ phụ
 * thuộc dữ liệu nên không trùng (trùng React key) dù lượt trả lời về lúc nào. Thực tế router của Next xếp điều hướng phía
 * client (Link, Back / Forward) sau Server Action đang chờ nên khung không bị gỡ giữa lúc chờ (run 39538755746, 39540610867;
 * docs/progress.md); giữ để không phụ thuộc cách xếp hàng đó.
 */
export function appendEntry(entries: readonly ChatEntry[], entry: NewChatEntry): ChatEntry[] {
  const id = entries.reduce((max, current) => Math.max(max, current.id), -1) + 1
  return [...entries, { ...entry, id }]
}
