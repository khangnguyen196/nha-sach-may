import 'server-only'

// AI giả cho e2e / CI (CHAT_AI_MOCK=1, chỉ có hiệu lực với Supabase local, ngoài Vercel: aiMockEnabled, env.ts). Thay
// `fetch` của callGemini nên cùng một đường code (vé, phân loại 429, validate) với Gemini thật. Không bao giờ gọi mạng.
// Cụm điều khiển trong câu của khách:
//   [mock:5-books]  trả 5 slug, gồm 1 slug lạ (kiểm lọc + tối đa 3 thẻ)
//   [mock:429]      429 theo phút (RetryInfo 55s);  [mock:429-day]  429 có cả PerDay + PerMinute
//   [mock:timeout]  lỗi timeout ngay, không chờ
//   [mock:crisis]   intent "crisis" (lớp 2)
//   [mock:english]  non_vietnamese = true

/** Response JSON giả (dùng chung với AI giả của gợi ý cảnh báo: warnings/mock.ts) */
export const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/** 429 giả đúng dạng của Google: luôn có PerMinute, perDay thêm PerDay; RetryInfo 55s */
export function quota429(perDay: boolean) {
  const violations = [
    { quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' },
    ...(perDay ? [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] : []),
  ]
  return jsonResponse(429, {
    error: {
      code: 429,
      status: 'RESOURCE_EXHAUSTED',
      details: [
        { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '55s' },
      ],
    },
  })
}

/** Đọc lại đúng những gì prompt.ts gửi: slug ứng viên (enum), tên sách đang xem, câu cuối của khách */
function readRequest(body: unknown) {
  const contents = isRecord(body) && Array.isArray(body.contents) ? body.contents : []
  const last: unknown = contents.at(-1)
  const parts = isRecord(last) && Array.isArray(last.parts) ? last.parts : []
  const text = parts.flatMap((part: unknown) => (isRecord(part) && typeof part.text === 'string' ? [part.text] : [])).join('\n')
  const config = isRecord(body) && isRecord(body.generationConfig) ? body.generationConfig : {}
  const schema = isRecord(config.responseJsonSchema) ? config.responseJsonSchema : {}
  const books = isRecord(schema.properties) && isRecord(schema.properties.books) ? schema.properties.books : {}
  const items = isRecord(books.items) && isRecord(books.items.properties) ? books.items.properties : {}
  const slug = isRecord(items.slug) && Array.isArray(items.slug.enum) ? items.slug.enum : []
  const slugs = slug.filter((value: unknown): value is string => typeof value === 'string')
  const current = /^SÁCH ĐANG XEM: (.*)$/m.exec(text)?.[1]
  let currentTitle: string | null = null
  if (current) {
    const parsed: unknown = JSON.parse(current)
    currentTitle = isRecord(parsed) && typeof parsed.t === 'string' ? parsed.t : null
  }
  const user = /<khach>([\s\S]*)<\/khach>\s*$/.exec(text)?.[1] ?? ''
  return { slugs, currentTitle, user }
}

export const mockFetch: typeof fetch = async (_input, init) => {
  const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null
  const { slugs, currentTitle, user } = readRequest(body)
  if (user.includes('[mock:429-day]')) return quota429(true)
  if (user.includes('[mock:429]')) return quota429(false)
  if (user.includes('[mock:timeout]')) throw new DOMException('mock timeout', 'TimeoutError')

  const crisis = user.includes('[mock:crisis]')
  const picked = user.includes('[mock:5-books]') ? [...slugs.slice(0, 4), 'sach-khong-ton-tai'] : slugs.slice(0, 3)
  const reply = {
    intent: crisis ? 'crisis' : currentTitle ? 'about_book' : 'recommend',
    message: currentTitle ? `Mây (giả lập) nói về cuốn ${currentTitle}.` : 'Mây (giả lập) gợi ý vài cuốn cho bạn.',
    books: crisis ? [] : picked.map((slug) => ({ slug, reason: `Lý do giả lập cho ${slug}.` })),
    follow_up: 'Bạn muốn đọc nhẹ nhàng hay sâu sắc hơn?',
    non_vietnamese: user.includes('[mock:english]'),
  }
  return jsonResponse(200, {
    candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(reply) }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0 },
  })
}
