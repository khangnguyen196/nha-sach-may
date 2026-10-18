// Kiểm câu trả lời của AI trước khi dùng: JSON đúng schema, slug chỉ trong danh sách ứng viên, chữ thuần đã cắt.
// Tên, tác giả, giá trên thẻ lấy từ DB (actions.ts), không bao giờ lấy chữ do AI viết.
import { CHAT_INPUT } from './config'
import { aiReplySchema, type AiReply } from './schemas'
import { cleanOutput } from './sanitize'

export type ValidReply = {
  intent: AiReply['intent']
  message: string
  books: { slug: string; reason: string }[]
  followUp: string
  nonVietnamese: boolean
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** null = JSON hỏng / sai schema → CHAT_UNAVAILABLE */
export function validateReply(text: string, candidateSlugs: ReadonlySet<string>): ValidReply | null {
  const parsed = aiReplySchema.safeParse(parseJson(text))
  if (!parsed.success) return null
  const { intent, message, books, follow_up, non_vietnamese } = parsed.data

  const seen = new Set<string>()
  const kept =
    intent === 'crisis' || intent === 'off_topic'
      ? []
      : books
          .filter((book) => {
            if (!candidateSlugs.has(book.slug) || seen.has(book.slug)) return false
            seen.add(book.slug)
            return true
          })
          .slice(0, CHAT_INPUT.maxBooks)
          .map((book) => ({ slug: book.slug, reason: cleanOutput(book.reason, CHAT_INPUT.reasonMax) }))

  return {
    intent,
    message: cleanOutput(message, CHAT_INPUT.messageMax),
    books: kept,
    followUp: cleanOutput(follow_up, CHAT_INPUT.followUpMax),
    nonVietnamese: non_vietnamese,
  }
}
