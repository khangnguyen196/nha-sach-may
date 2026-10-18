import { z } from 'zod'
import { CHAT_INPUT } from './config'
import { cleanInput } from './sanitize'

// Chỉ server import (zod ≈ 30KB gzip). Client kiểm câu hỏi bằng checkMessage (input.ts).

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const chatSlugSchema = z.string().max(200).regex(SLUG)

/** Lịch sử do client gửi lên là dữ liệu không tin cậy: giới hạn từng trường, bỏ trường lạ, làm sạch như câu khách */
const historyTurnSchema = z.object({
  user: z.string().max(CHAT_INPUT.maxChars).transform(cleanInput),
  model: z.object({
    message: z.string().max(CHAT_INPUT.messageMax).transform(cleanInput),
    follow_up: z.string().max(CHAT_INPUT.followUpMax).transform(cleanInput),
    slugs: z.array(chatSlugSchema).max(CHAT_INPUT.maxBooks),
  }),
})

export type HistoryTurn = z.output<typeof historyTurnSchema>

export const askSchema = z.object({
  message: z.string().trim().min(1).max(CHAT_INPUT.maxChars),
  history: z.array(historyTurnSchema).max(CHAT_INPUT.historyTurns).default([]),
  slug: chatSlugSchema.nullish(),
  // Khách đã bấm "Tôi từ 18 tuổi trở lên…": chỉ là bằng chứng đã đồng ý, không phải xác minh tuổi
  ageConfirmed: z.literal(true),
})

export type AskInput = z.input<typeof askSchema>

/** JSON do AI trả (responseJsonSchema ở prompt.ts). Độ dài cắt sau ở validate.ts, không từ chối cả câu trả lời. */
export const aiReplySchema = z.object({
  intent: z.enum(['recommend', 'about_book', 'off_topic', 'crisis']),
  message: z.string(),
  books: z.array(z.object({ slug: z.string(), reason: z.string() })),
  follow_up: z.string(),
  non_vietnamese: z.boolean(),
})

export type AiReply = z.output<typeof aiReplySchema>
