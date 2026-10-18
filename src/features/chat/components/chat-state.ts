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

/**
 * Gợi ý nào được hiện (chỉ giao diện; lịch sử gửi server vẫn giữ follow_up của mọi lượt):
 * - chưa hỏi gì → chip ban đầu;
 * - đang chờ trả lời → không gợi ý nào;
 * - lượt mới nhất là câu trả lời của Mây (khách chưa trả lời) → follow_up của đúng lượt đó;
 * - còn lại (lượt cuối là lỗi / câu của khách) → không gợi ý nào.
 */
export type Suggestion = { kind: 'chips' } | { kind: 'followUp'; entryId: number } | { kind: 'none' }

export function visibleSuggestion(entries: readonly ChatEntry[], pending: boolean): Suggestion {
  if (pending) return { kind: 'none' }
  const last = entries.at(-1)
  if (!last) return { kind: 'chips' }
  return last.role === 'assistant' && last.reply.followUp ? { kind: 'followUp', entryId: last.id } : { kind: 'none' }
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
