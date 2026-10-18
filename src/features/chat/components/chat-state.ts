// Trạng thái hội thoại phía client: chỉ trong bộ nhớ (không DB, không localStorage). Bong bóng giữ state để chuyển
// trang trong (shop) và đóng / mở khung không mất lịch sử; tải lại trang thì mất.
import type { ErrorDetails } from '@/lib/errors'
import type { ChatReply, ChatTurn } from '../actions'
import { CHAT_INPUT } from '../config'

export type ChatEntry =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; reply: ChatReply }
  | { id: number; role: 'error'; code: string; details?: ErrorDetails }

/** Tối đa 4 lượt gần nhất gửi kèm câu hỏi (server validate lại như dữ liệu không tin cậy) */
export function recentTurns(entries: readonly ChatEntry[]): ChatTurn[] {
  return entries
    .flatMap((entry) => (entry.role === 'assistant' ? [entry.reply.turn] : []))
    .slice(-CHAT_INPUT.historyTurns)
}

export const AGE_KEY = 'may-age-ok'

/** sessionStorage có thể bị chặn (chế độ riêng tư, cookie bị tắt) → lỗi thì chỉ nhớ trong tab này */
export function readAgeConfirmed(): boolean {
  try {
    return window.sessionStorage.getItem(AGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeAgeConfirmed() {
  try {
    window.sessionStorage.setItem(AGE_KEY, '1')
  } catch {
    // nhớ trong bộ nhớ (state của bong bóng) là đủ
  }
}
