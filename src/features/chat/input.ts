// Kiểm câu hỏi ở client (không import zod, xem CLAUDE.md → Hiệu năng). Kết quả phải khớp askSchema ở server
// (schemas.test.ts).
import { CHAT_INPUT } from './config'

export type MessageCheck = { ok: true; message: string } | { ok: false; reason: 'empty' | 'tooLong' }

export function checkMessage(raw: string): MessageCheck {
  const message = raw.trim()
  if (!message) return { ok: false, reason: 'empty' }
  if (message.length > CHAT_INPUT.maxChars) return { ok: false, reason: 'tooLong' }
  return { ok: true, message }
}
