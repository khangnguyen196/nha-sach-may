import 'server-only'
import { jsonResponse, quota429 } from '@/features/chat/mock'
import { CONTENT_WARNINGS } from './labels'
import { WARNING_BOOKS_PREFIX } from './prompt'

// AI giả của gợi ý cảnh báo (e2e / CI), chỉ dùng khi resolveWarningMode() = mock (cùng chốt chặn với Mây). Thay `fetch`
// của callGemini nên đi đúng đường code thật (vé, phân loại 429, parse). Không bao giờ gọi mạng. Đọc lô từ khối JSON
// của request (WARNING_BOOKS_PREFIX). Cụm điều khiển trong tên sách:
//   (không cụm)              labels [] + lý do giả
//   [mock:warn-violence]     ["violence"]                 [mock:warn-self-harm]  ["self_harm"]
//   [mock:warn-all]          đủ 5 nhãn, lộn thứ tự, có trùng (parse → 5 nhãn theo thứ tự enum)
//   [mock:warn-bad-label]    ["violence", "gore"] (parse bỏ "gore")
//   [mock:warn-bad-id]       id ngoài lô (sách rơi vào missing)
//   [mock:warn-long-reason]  lý do 300 ký tự, emoji vắt qua mốc 200 (parse cắt, không vỡ cặp surrogate)
// Cụm của cả lô (một sách có là đủ): [mock:warn-bad-json] JSON hỏng, [mock:warn-blocked] promptFeedback SAFETY,
// [mock:warn-429] 429 theo phút, [mock:warn-429-day] 429 có PerDay, [mock:warn-timeout] timeout ngay.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

type MockBook = { id: string; title: string }

function readBooks(body: unknown): MockBook[] {
  const contents = isRecord(body) && Array.isArray(body.contents) ? body.contents : []
  const last: unknown = contents.at(-1)
  const parts = isRecord(last) && Array.isArray(last.parts) ? last.parts : []
  const text = parts.flatMap((part: unknown) => (isRecord(part) && typeof part.text === 'string' ? [part.text] : [])).join('')
  if (!text.startsWith(WARNING_BOOKS_PREFIX)) return []
  const data: unknown = JSON.parse(text.slice(WARNING_BOOKS_PREFIX.length))
  if (!Array.isArray(data)) return []
  return data.flatMap((book: unknown) =>
    isRecord(book) && typeof book.id === 'string' && typeof book.t === 'string' ? [{ id: book.id, title: book.t }] : [],
  )
}

// 199 chữ "a" + emoji (2 đơn vị UTF-16) vắt qua mốc 200, rồi thêm cho đủ dài
const LONG_REASON = `${'a'.repeat(199)}😀${'b'.repeat(99)}`

function labelsFor(title: string): string[] {
  if (title.includes('[mock:warn-all]')) return ['other_sensitive', ...CONTENT_WARNINGS, 'violence']
  if (title.includes('[mock:warn-bad-label]')) return ['violence', 'gore']
  if (title.includes('[mock:warn-violence]')) return ['violence']
  if (title.includes('[mock:warn-self-harm]')) return ['self_harm']
  return []
}

const answer = (text: string) =>
  jsonResponse(200, {
    candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0 },
  })

export const mockWarningFetch: typeof fetch = async (_input, init) => {
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null
  const books = readBooks(body)
  const has = (token: string) => books.some((book) => book.title.includes(token))
  if (has('[mock:warn-429-day]')) return quota429(true)
  if (has('[mock:warn-429]')) return quota429(false)
  if (has('[mock:warn-timeout]')) throw new DOMException('mock timeout', 'TimeoutError')
  if (has('[mock:warn-blocked]')) return jsonResponse(200, { promptFeedback: { blockReason: 'SAFETY' } })
  if (has('[mock:warn-bad-json]')) return answer('{"books": [')

  const reply = {
    books: books.map((book) => ({
      id: book.title.includes('[mock:warn-bad-id]') ? '999999999' : book.id,
      labels: labelsFor(book.title),
      reason: book.title.includes('[mock:warn-long-reason]') ? LONG_REASON : `Lý do giả lập cho sách ${book.id}.`,
    })),
  }
  return answer(JSON.stringify(reply))
}
