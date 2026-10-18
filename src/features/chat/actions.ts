'use server'

import { randomBytes } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { getFormatter, getTranslations } from 'next-intl/server'
import { getBookBySlug, getCategories } from '@/features/books/queries'
import { truncateText } from '@/features/books/utils'
import { getCurrentUser } from '@/lib/auth'
import type { Failure, Result } from '@/lib/errors'
import { selectCandidates, type Candidate } from './candidates'
import { CHAT_INPUT, DEFAULT_MODEL, VISITOR_COOKIE } from './config'
import { isCrisisMessage } from './crisis'
import { resolveChatMode } from './env'
import { activeCooldown, callGemini, GLOBAL_COOLDOWN } from './gemini'
import { mockFetch } from './mock'
import { buildRequestBody, fitPromptBudget, type CurrentBook } from './prompt'
import { getChatBookCards, getChatCatalog, type ChatBookCardRow } from './queries'
import { clientIp, consumeQuota, hashId, quotaLimits } from './quota'
import { isBlockedCountry } from './region'
import { askSchema } from './schemas'
import { validateReply, type ValidReply } from './validate'

// Chatbot chỉ có ở trang tiếng Việt → chuỗi / định dạng giá luôn theo 'vi' (Server Action không đọc được root params).
// Thứ tự (docs/plans/phase-11.md → Luồng): input → bật? → tự hại (trước khu vực) → khu vực → dữ liệu + định danh →
// cooldown → trừ lượt (vé) → Gemini một lần → validate → thẻ sách từ DB. Không throw ra UI, không log nội dung chat.
const LOCALE = 'vi'

export type ChatBookCard = {
  slug: string
  title: string
  authors: string
  coverUrl: string | null
  priceLabel: string
  reason: string
}

/** Lượt vừa xong, client giữ trong bộ nhớ và gửi lại làm lịch sử (server validate lại như dữ liệu không tin cậy) */
export type ChatTurn = { user: string; model: { message: string; follow_up: string; slugs: string[] } }

export type ChatReply = {
  kind: 'answer' | 'crisis'
  message: string
  books: ChatBookCard[]
  followUp: string | null
  /** Khách viết ngôn ngữ khác: client thêm câu cố định "Mây hiện chỉ hỗ trợ tiếng Việt" */
  languageNotice: boolean
  /** Tên cuốn đang xem khi câu hỏi gắn với trang sách (server tự tra theo slug) */
  aboutBook: string | null
  turn: ChatTurn
}

const VISITOR_ID = /^[A-Za-z0-9_-]{22}$/

async function visitorCookie(): Promise<string> {
  const jar = await cookies()
  const existing = jar.get(VISITOR_COOKIE.name)?.value
  if (existing && VISITOR_ID.test(existing)) return existing
  const id = randomBytes(16).toString('base64url')
  jar.set(VISITOR_COOKIE.name, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: VISITOR_COOKIE.maxAgeSeconds,
  })
  return id
}

const timeFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function quotaFailure(code: 'CHAT_QUOTA_EXCEEDED' | 'CHAT_FREE_QUOTA', scope: string | null, resetsAt: Date | null): Failure {
  return {
    ok: false,
    code,
    details: { scope: scope ?? 'unknown', ...(resetsAt && { resetTime: timeFormat.format(resetsAt) }) },
  }
}

const unavailable: Failure = { ok: false, code: 'CHAT_UNAVAILABLE' }

async function crisisReply(message: string): Promise<Result<ChatReply>> {
  const t = await getTranslations({ locale: LOCALE, namespace: 'chat' })
  const text = t('crisis')
  return {
    ok: true,
    data: {
      kind: 'crisis',
      message: text,
      books: [],
      followUp: null,
      languageNotice: false,
      aboutBook: null,
      turn: { user: message, model: { message: text, follow_up: '', slugs: [] } },
    },
  }
}

function authorNames(row: { book_authors: { role: string; authors: { name: string } | null }[] }) {
  return row.book_authors.flatMap((ba) => (ba.role === 'author' && ba.authors ? [ba.authors.name] : []))
}

async function bookCards(reply: ValidReply): Promise<ChatBookCard[]> {
  const rows = await getChatBookCards(reply.books.map((book) => book.slug))
  const bySlug = new Map<string, ChatBookCardRow>(rows.map((row) => [row.slug, row]))
  const format = await getFormatter({ locale: LOCALE })
  return reply.books.flatMap((book) => {
    const row = bySlug.get(book.slug)
    if (!row) return []
    return [
      {
        slug: row.slug,
        title: row.title,
        authors: authorNames(row).join(', '),
        coverUrl: row.cover_url,
        priceLabel: format.number(row.price, 'price'),
        reason: book.reason,
      },
    ]
  })
}

async function ask(input: unknown): Promise<Result<ChatReply>> {
  const parsed = askSchema.safeParse(input)
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' }
  const { message, history, slug } = parsed.data

  const mode = resolveChatMode()
  if (mode.kind === 'off') return unavailable

  // Trước bước khu vực: câu trả lời cố định không gọi AI, khách ở đâu cũng phải nhận được
  if (isCrisisMessage(message)) return crisisReply(message)

  const requestHeaders = await headers()
  if (isBlockedCountry(requestHeaders.get('x-vercel-ip-country'))) return { ok: false, code: 'CHAT_REGION' }

  const [user, catalog, categories, current] = await Promise.all([
    getCurrentUser(),
    getChatCatalog(),
    getCategories(),
    slug ? getBookBySlug(slug) : Promise.resolve(null),
  ])

  const now = new Date()
  const identity = user
    ? { visitor: hashId(mode.quotaToken, 'user', user.id, now), ip: null }
    : {
        visitor: hashId(mode.quotaToken, 'visitor', await visitorCookie(), now),
        ip: hashId(mode.quotaToken, 'ip', clientIp(requestHeaders) ?? 'unknown', now),
      }
  // Sau 429: không gọi Gemini, không trừ lượt. AI giả: cooldown theo khách (gemini.ts)
  const cooldownKey = mode.kind === 'mock' ? identity.visitor : GLOBAL_COOLDOWN
  const cooling = activeCooldown(cooldownKey)
  if (cooling) return quotaFailure('CHAT_FREE_QUOTA', cooling.scope, cooling.resetsAt)

  const quota = await consumeQuota({ token: mode.quotaToken, ...identity, limits: quotaLimits(mode.kind === 'mock') })
  if (!quota.ok) {
    return quota.code === 'CHAT_UNAVAILABLE' ? unavailable : quotaFailure(quota.code, quota.scope, quota.resetsAt)
  }

  const candidates = selectCandidates({ books: catalog, categories, message, currentSlug: current?.slug })
  const currentBook: CurrentBook | null = current
    ? {
        ...(candidates.find((candidate) => candidate.slug === current.slug) ?? fallbackCandidate(current)),
        longDescription: current.description ? truncateText(current.description, CHAT_INPUT.currentBookDescription) : '',
      }
    : null
  const prompt = fitPromptBudget({
    message,
    candidates,
    currentBook,
    history,
    knownSlugs: new Set(catalog.map((book) => book.slug)),
  })
  const body = buildRequestBody(prompt)
  const outcome = await callGemini(
    quota.ticket,
    mode.kind === 'mock'
      ? { model: DEFAULT_MODEL, apiKey: 'mock', body, fetchImpl: mockFetch, cooldownKey }
      : { model: mode.model, apiKey: mode.apiKey, body, cooldownKey },
  )
  if (!outcome.ok) {
    return outcome.kind === 'quota' ? quotaFailure('CHAT_FREE_QUOTA', outcome.scope, outcome.resetsAt) : unavailable
  }

  const reply = validateReply(outcome.text, new Set(prompt.candidates.map((candidate) => candidate.slug)))
  if (!reply) {
    console.warn('[chat] câu trả lời của AI sai schema')
    return unavailable
  }
  if (reply.intent === 'crisis') return crisisReply(message)

  const books = await bookCards(reply)
  return {
    ok: true,
    data: {
      kind: 'answer',
      message: reply.message,
      books,
      followUp: reply.followUp || null,
      languageNotice: reply.nonVietnamese,
      aboutBook: current?.title ?? null,
      turn: {
        user: message,
        model: { message: reply.message, follow_up: reply.followUp, slugs: books.map((book) => book.slug) },
      },
    },
  }
}

/** Cuốn đang xem không nằm trong catalog rút gọn (cache cũ hơn trang sách): dựng từ dữ liệu trang sách */
function fallbackCandidate(book: NonNullable<Awaited<ReturnType<typeof getBookBySlug>>>): Candidate {
  return {
    slug: book.slug,
    title: book.title,
    authors: authorNames(book),
    category: '',
    language: book.language,
    description: book.description ? truncateText(book.description, CHAT_INPUT.candidateDescription) : '',
  }
}

/**
 * Hỏi Mây một câu (input dạng AskInput; nhận unknown vì Server Action gọi thẳng được bằng action ID, mọi thứ parse lại).
 * Lỗi bất kỳ (Supabase, mạng…) → CHAT_UNAVAILABLE, không bao giờ throw ra UI.
 */
export async function askMay(input: unknown): Promise<Result<ChatReply>> {
  try {
    return await ask(input)
  } catch (error) {
    console.error('[chat] askMay:', error instanceof Error ? `${error.name}: ${error.message}` : 'lỗi khác')
    return unavailable
  }
}
