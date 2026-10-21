import type { ChatEntry } from './chat-state'

/** Một mục hội thoại chưa có id (id gán lúc thêm vào danh sách, xem appendEntry) */
export type NewChatEntry = ChatEntry extends infer Entry ? (Entry extends ChatEntry ? Omit<Entry, 'id'> : never) : never

/**
 * Thêm một mục vào cuối hội thoại, id = id lớn nhất hiện có + 1, tính trên chính danh sách đang có (updater của
 * setEntries). Không dùng bộ đếm ref của ChatPanel: khung bị gỡ khi sang trang ẩn chat rồi mount lại thì bộ đếm khởi lại
 * theo `entries.length`, trong khi lượt trả lời đang chờ của bản cũ vẫn cấp id từ bộ đếm cũ → trùng id (trùng React key).
 */
export function appendEntry(entries: readonly ChatEntry[], entry: NewChatEntry): ChatEntry[] {
  const id = entries.reduce((max, current) => Math.max(max, current.id), -1) + 1
  return [...entries, { ...entry, id }]
}
