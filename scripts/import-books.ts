/**
 * Import sách thật từ Google Books API vào Supabase.
 *
 *   npm run import:books                                   # lấy từ Google Books rồi import luôn
 *   npm run import:books -- --dry-run                      # chỉ xem trước → scripts/out/preview.json
 *   npm run import:books -- --dry-run --hires-covers       # ảnh bìa lớn (thêm 1 request/sách) → scripts/out/preview-hires.json
 *   npm run import:books -- --from-preview scripts/out/preview.json   # import đúng file đã xem, không gọi Google Books
 *   --max-requests <n>  (mặc định 900) trần số request Books API của một lượt dry-run
 *
 * Ảnh bìa không hotlink: preview chỉ ghi cover_small / cover_large (URL Google). Lúc ghi DB, script tải ảnh
 * (ưu tiên lớn, fallback nhỏ nếu lỗi hoặc nghi là trang lót), đổi sang WebP rộng 600px, upload lên
 * Storage book-covers/<isbn>.webp rồi ghi public URL vào books.cover_url (kèm chiều rộng thật vào cover_width).
 *
 * Quy trình khuyến nghị: dry-run → xem file → --from-preview. Quota Books API có hạn (~1.000 request/ngày)
 * và dữ liệu vào DB phải đúng bản đã duyệt.
 *
 * Env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   — CHỈ dùng trong scripts/ chạy local, không bao giờ trong src/
 *   GOOGLE_BOOKS_API_KEY        — gần như bắt buộc: quota ẩn danh dùng chung thường đã hết
 *
 * Danh sách truy vấn theo danh mục: scripts/book-list.json
 * Google Books không có giá bán lẻ VN → giá/tồn kho được sinh tự động (ổn định theo ISBN).
 *
 * Chạy lại an toàn: sách đã có (theo ISBN) được BỎ QUA hoàn toàn, nên giá, tồn kho, mô tả,
 * tác giả đã sửa trong admin hay tồn kho đã bị trừ bởi đơn hàng đều giữ nguyên.
 * Ngoại lệ duy nhất: sách đã có nhưng chưa có tác giả nào (lần chạy trước bị ngắt) được gắn lại tác giả.
 * Tác giả / NXB đã có (theo slug) cũng không bị ghi đè tên.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { z } from 'zod'
import { toCoverWebp, type CoverWebp } from '../src/lib/cover-image'
import { slugify } from '../src/lib/slug'
import type { Database } from '../src/types/database'

// ---------- Types ----------
type ImageLinks = {
  smallThumbnail?: string
  thumbnail?: string
  small?: string
  medium?: string
  large?: string
  extraLarge?: string
}

type GoogleVolume = {
  id: string
  volumeInfo: {
    title?: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    industryIdentifiers?: { type: string; identifier: string }[]
    pageCount?: number
    language?: string
    imageLinks?: ImageLinks
  }
  accessInfo?: { viewability?: string }
}

export type BookInput = {
  title: string
  subtitle: string | null
  slug: string
  description: string | null
  isbn: string
  authors: string[]
  publisher: string | null
  published_year: number | null
  page_count: number | null
  /** Thumbnail từ kết quả search (~128px), luôn có */
  cover_small: string
  /** Ảnh lớn từ endpoint chi tiết (--hires-covers); null nếu không lấy hoặc trùng ảnh nhỏ */
  cover_large: string | null
  price: number
  original_price: number | null
  stock: number
  category_slug: string
  language: BookLanguage
}

/** category_slug → truy vấn. Chuỗi = 1 trang 40 kết quả; { q, pages } = nhiều trang (startIndex 0, 40, …) */
type BookQuery = string | { q: string; pages: number }
export type BookLanguage = 'vi' | 'en'
/**
 * Mảng truy vấn = sách tiếng Việt. `{ language: 'en', queries }` = danh mục cho phép ngôn ngữ khác
 * (chỉ dùng cho nhánh "Sách ngoại văn"); cả langRestrict lẫn bộ lọc volumeInfo.language đều theo giá trị này.
 */
type CategoryQueries = BookQuery[] | { language: BookLanguage; queries: BookQuery[] }
export type BookList = Record<string, CategoryQueries>

const categoryConfig = (entry: CategoryQueries) =>
  Array.isArray(entry) ? { language: 'vi' as const, queries: entry } : entry
type IdSlug = { id: number; slug: string }
type DbResult<T> = { data: T | null; error: { message: string } | null }

// ---------- Helpers ----------
const stripHtml = (s: string) =>
  s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim()

/**
 * Chuẩn hóa tiếng Việt từ nguồn ngoài. NFC thôi KHÔNG đủ: dữ liệu Google có chỗ để dấu thanh trước dấu mũ/trăng
 * ("Nguye\u0303\u0302n"). Hai dấu cùng combining class 230 nên chuẩn hóa Unicode giữ nguyên thứ tự sai đó và
 * không ghép được thành "ễ". Cách làm: NFD → đưa dấu mũ (U+0302) / dấu trăng (U+0306) lên trước dấu thanh
 * (huyền U+0300, sắc U+0301, ngã U+0303, hỏi U+0309) → NFC. Dấu nặng U+0323 (class 220) đã tự đứng trước.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/([\u0300\u0301\u0303\u0309]+)([\u0302\u0306])/g, '$2$1')
    .normalize('NFC')
    .trim()
}

const normalizeOptional = (input: string | undefined) => (input ? normalizeText(input) || null : null)

/** Tên lỗi mã hóa từ nguồn (VD: "L¿ch S¿ Vi¿t Nam") → không sửa được, loại hẳn */
export const isGarbled = (text: string) => /[¿\uFFFD]/.test(text)

/** Sách ăn theo (tóm tắt, sách bài tập, hướng dẫn học…) lẫn nhiều khi tìm theo tác giả tiếng Anh → loại ở danh mục 'en' */
export const isDerivativeTitle = (text: string) => /\b(summary|workbook|study guide|analysis of)\b/i.test(text)

/** Số giả-ngẫu-nhiên 0..1, ổn định theo seed → chạy lại ra cùng giá */
function seeded(seed: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return ((h >>> 0) % 10_000) / 10_000
}

const round1000 = (n: number) => Math.round(n / 1000) * 1000

export function generatePricing(isbn: string, pages: number | null) {
  const base = Math.min(Math.max(50_000 + (pages ?? 200) * 220, 45_000), 450_000)
  const price = round1000(base * (0.9 + seeded(isbn, 1) * 0.2))
  const original_price =
    seeded(isbn, 2) < 0.3 ? null : round1000(price * (1.1 + seeded(isbn, 3) * 0.25))
  const stock = seeded(isbn, 4) < 0.05 ? 0 : Math.floor(5 + seeded(isbn, 5) * 115)
  return { price, original_price, stock }
}

/** Ưu tiên ảnh lớn nhất có sẵn. Kết quả search thường chỉ có thumbnail (~128px ngang). */
export function bestCover(links: ImageLinks | undefined): string | null {
  const url =
    links?.extraLarge ?? links?.large ?? links?.medium ?? links?.small ?? links?.thumbnail ?? links?.smallThumbnail
  if (!url) return null
  return url.replace(/^http:/, 'https:').replace('&edge=curl', '')
}

function pickIsbn(ids: GoogleVolume['volumeInfo']['industryIdentifiers']): string | null {
  return (
    ids?.find((i) => i.type === 'ISBN_13')?.identifier ??
    ids?.find((i) => i.type === 'ISBN_10')?.identifier ??
    null
  )
}

/**
 * Trả về null nếu thiếu dữ liệu tối thiểu (tên, ISBN, ảnh bìa) hoặc không phải sách tiếng Việt.
 * langRestrict=vi của API không đủ chặt (vẫn lọt sách Anh/Nhật/Trung) → lọc lại theo volumeInfo.language.
 */
export function mapVolume(v: GoogleVolume, categorySlug: string, language: BookLanguage = 'vi'): BookInput | null {
  const info = v.volumeInfo
  if (info.language !== language) return null
  const isbn = pickIsbn(info.industryIdentifiers)
  const cover_small = bestCover(info.imageLinks)
  const title = normalizeOptional(info.title)
  if (!title || isGarbled(title) || !isbn || !cover_small) return null
  if (language === 'en' && isDerivativeTitle(`${title} ${info.subtitle ?? ''}`)) return null

  const year = info.publishedDate ? Number.parseInt(info.publishedDate.slice(0, 4), 10) : NaN
  const page_count = info.pageCount && info.pageCount > 0 ? info.pageCount : null

  return {
    title,
    subtitle: normalizeOptional(info.subtitle),
    // Tên toàn ký tự đặc biệt → slugify ra rỗng → dùng ISBN
    slug: slugify(title) || isbn.toLowerCase(),
    description: info.description ? normalizeOptional(stripHtml(info.description)) : null,
    isbn,
    authors: [...new Set((info.authors ?? []).map(normalizeText).filter(Boolean))],
    publisher: normalizeOptional(info.publisher),
    published_year: year >= 1800 && year <= 2100 ? year : null,
    page_count,
    cover_small,
    cover_large: null,
    category_slug: categorySlug,
    language,
    ...generatePricing(isbn, page_count),
  }
}

/**
 * Gắn hậu tố khi 2 sách khác nhau trùng slug: ten-sach → ten-sach-1234 → ten-sach-1234-2 …
 * `taken`: slug → ISBN (hoặc khóa bất kỳ) của sách đang giữ slug đó.
 */
export function dedupeSlugs(books: BookInput[], taken: Map<string, string> = new Map()) {
  for (const b of books) {
    const base = b.slug
    let slug = base
    for (let n = 1; taken.has(slug) && taken.get(slug) !== b.isbn; n++) {
      slug = `${base}-${b.isbn.slice(-4).toLowerCase()}${n > 1 ? `-${n}` : ''}`
    }
    b.slug = slug
    taken.set(slug, b.isbn)
  }
  return books
}

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size))

// ---------- Google Books ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Số request đã gọi tới Books API trong lượt chạy này (quota ~1.000/ngày/project) */
let apiRequests = 0

/** Lỗi từ Books API sau khi đã hết lượt thử lại. status 429 = hết quota / bị chặn tốc độ → nên dừng cả pha. */
export class BooksApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const isRateLimited = (err: unknown) => err instanceof BooksApiError && err.status === 429

async function getJson<T>(url: string): Promise<T> {
  let lastStatus = 0
  for (let attempt = 0; attempt < 4; attempt++) {
    apiRequests++
    const res = await fetch(url)
    lastStatus = res.status
    if (res.status === 429) {
      const body = await res.text()
      // Hết quota ngày thì thử lại vô ích → dừng ngay, quota reset lúc 0h giờ Pacific
      if (body.includes('per day')) throw new BooksApiError('Google Books: hết quota ngày.', 429)
      await sleep(1000 * 2 ** attempt)
      continue
    }
    if (res.status >= 500) {
      await sleep(1000 * 2 ** attempt)
      continue
    }
    if (!res.ok) throw new BooksApiError(`Google Books ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status)
    const json: T = await res.json()
    return json
  }
  throw new BooksApiError(`Google Books: hết lượt thử (HTTP ${lastStatus})`, lastStatus)
}

function withKey(params: URLSearchParams) {
  if (process.env.GOOGLE_BOOKS_API_KEY) params.set('key', process.env.GOOGLE_BOOKS_API_KEY)
  return params
}

// Xin 40 (tối đa theo tài liệu) nhưng thực tế API thường trả ≤ 20/trang → phân trang theo số cuốn nhận được
const MAX_RESULTS = 40

async function searchVolumes(
  query: string,
  startIndex: number,
  language: BookLanguage,
): Promise<{ items: GoogleVolume[]; totalItems: number }> {
  const params = withKey(
    new URLSearchParams({
      q: query,
      langRestrict: language,
      printType: 'books',
      maxResults: String(MAX_RESULTS),
      startIndex: String(startIndex),
    }),
  )
  const json = await getJson<{ items?: GoogleVolume[]; totalItems?: number }>(
    `https://www.googleapis.com/books/v1/volumes?${params}`,
  )
  return { items: json.items ?? [], totalItems: json.totalItems ?? 0 }
}

/** Endpoint chi tiết thường có thêm small/medium/large; không có thì trả về null */
async function fetchLargerCover(volumeId: string): Promise<string | null> {
  const params = withKey(new URLSearchParams({ fields: 'volumeInfo/imageLinks' }))
  const json = await getJson<{ volumeInfo?: { imageLinks?: ImageLinks } }>(
    `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(volumeId)}?${params}`,
  )
  return bestCover(json.volumeInfo?.imageLinks)
}

export type Candidate = {
  book: BookInput
  volumeId: string
  /** Có xem trước (PARTIAL / ALL_PAGES). Ảnh lớn lấy từ books/publisher/content nên thường chỉ sách này mới có. */
  previewable: boolean
}

export type CategoryStats = { books: number; large: number; requests: number }

const MAX_PER_CATEGORY = 40

const MAX_CONSECUTIVE_ERRORS = 3

/**
 * Pha 1: chạy HẾT truy vấn search. ISBN trùng giữa các danh mục → giữ lần gặp đầu (thứ tự file).
 * Gặp 429 hoặc 3 lỗi liên tiếp → dừng, trả về những gì đã có + các danh mục chưa search xong.
 * Lỗi lẻ (VD: 400 do cú pháp truy vấn) → bỏ qua truy vấn đó, đi tiếp.
 */
export async function searchAll(
  list: BookList,
  stats: Map<string, CategoryStats>,
): Promise<{ candidates: Candidate[]; incomplete: string[] }> {
  const byIsbn = new Map<string, Candidate>()
  const categories = Object.keys(list)
  let consecutiveErrors = 0
  for (const [index, [category, entry]] of Object.entries(list).entries()) {
    const { language, queries } = categoryConfig(entry)
    const stat = stats.get(category) ?? { books: 0, large: 0, requests: 0 }
    stats.set(category, stat)
    for (const query of queries) {
      const { q, pages } = typeof query === 'string' ? { q: query, pages: 1 } : query
      let added = 0
      let startIndex = 0
      for (let page = 0; page < pages; page++) {
        const before = apiRequests
        let result: Awaited<ReturnType<typeof searchVolumes>>
        try {
          result = await searchVolumes(q, startIndex, language)
          consecutiveErrors = 0
        } catch (err) {
          stat.requests += apiRequests - before
          consecutiveErrors++
          const message = err instanceof Error ? err.message : String(err)
          if (isRateLimited(err) || consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            const incomplete = categories.slice(index)
            console.warn(`  ⚠ Dừng search tại [${category}] "${q}": ${message}`)
            console.warn(`  ⚠ Danh mục chưa search xong: ${incomplete.join(', ')}`)
            return { candidates: [...byIsbn.values()], incomplete }
          }
          console.warn(`  ⚠ Bỏ qua truy vấn [${category}] "${q}": ${message}`)
          break
        }
        const { items: volumes, totalItems } = result
        stat.requests += apiRequests - before
        startIndex += volumes.length
        for (const v of volumes) {
          const book = mapVolume(v, category, language)
          if (!book || byIsbn.has(book.isbn)) continue
          const viewability = v.accessInfo?.viewability
          byIsbn.set(book.isbn, { book, volumeId: v.id, previewable: viewability === 'PARTIAL' || viewability === 'ALL_PAGES' })
          added++
        }
        await sleep(300)
        if (volumes.length === 0 || startIndex >= totalItems) break // hết kết quả, không tốn request cho trang rỗng
      }
      console.log(`  [${category}] "${q}": +${added}`)
    }
  }
  return { candidates: [...byIsbn.values()], incomplete: [] }
}

const editionKey = (b: BookInput) => `${slugify(b.title)}|${slugify(b.authors[0] ?? '')}`

/**
 * Gộp các ấn bản của cùng một cuốn (cùng slug tên + cùng tác giả đầu). Ưu tiên bản nhiều khả năng có ảnh lớn
 * (chưa gọi endpoint chi tiết nên chỉ đoán qua `previewable`), rồi đến năm xuất bản mới nhất.
 * Các bản thắng giữ nguyên thứ tự gốc (thứ tự liên quan của kết quả search).
 */
export function dedupeEditions(candidates: Candidate[]): Candidate[] {
  const better = (a: Candidate, b: Candidate) =>
    a.previewable !== b.previewable ? a.previewable : (a.book.published_year ?? 0) > (b.book.published_year ?? 0)
  const winners = new Map<string, Candidate>()
  for (const c of candidates) {
    const key = editionKey(c.book)
    const current = winners.get(key)
    if (!current || better(c, current)) winners.set(key, c)
  }
  const kept = new Set(winners.values())
  return candidates.filter((c) => kept.has(c))
}

/** Tối đa `max` sách mỗi danh mục, lấy xoay vòng theo tác giả đầu (mỗi vòng 1 cuốn/tác giả) để đa dạng */
export function capPerCategory(candidates: Candidate[], max = MAX_PER_CATEGORY): Candidate[] {
  const byCategory = new Map<string, Map<string, Candidate[]>>()
  for (const c of candidates) {
    const authors = byCategory.get(c.book.category_slug) ?? new Map<string, Candidate[]>()
    byCategory.set(c.book.category_slug, authors)
    const author = slugify(c.book.authors[0] ?? '')
    authors.set(author, [...(authors.get(author) ?? []), c])
  }

  const kept = new Set<Candidate>()
  for (const authors of byCategory.values()) {
    const queues = [...authors.values()]
    let taken = 0
    for (let round = 0; taken < max && queues.some((q) => q.length > round); round++) {
      for (const queue of queues) {
        const c = queue[round]
        if (!c || taken >= max) continue
        kept.add(c)
        taken++
      }
    }
  }
  return candidates.filter((c) => kept.has(c))
}

/**
 * Pha 2: lấy ảnh lớn bằng quota còn lại. Chạm trần maxRequests, gặp 429 hoặc 3 lỗi liên tiếp → dừng pha 2;
 * các sách còn lại giữ cover_large = null (import dùng ảnh nhỏ). Lỗi lẻ của một cuốn → cuốn đó dùng ảnh nhỏ.
 */
export async function fetchLargeCovers(
  candidates: Candidate[],
  maxRequests: number,
  stats: Map<string, CategoryStats>,
) {
  let consecutiveErrors = 0
  for (const [i, c] of candidates.entries()) {
    const remaining = candidates.length - i
    if (apiRequests >= maxRequests) {
      console.warn(`  ⚠ Chạm trần ${maxRequests} request: ${remaining} sách không lấy ảnh lớn, sẽ dùng ảnh nhỏ`)
      return
    }
    const before = apiRequests
    try {
      const large = await fetchLargerCover(c.volumeId)
      c.book.cover_large = large && large !== c.book.cover_small ? large : null
      consecutiveErrors = 0
    } catch (err) {
      consecutiveErrors++
      if (isRateLimited(err) || consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`  ⚠ Dừng pha 2 (${message}): ${remaining} sách không lấy ảnh lớn, sẽ dùng ảnh nhỏ`)
        return
      }
    } finally {
      const stat = stats.get(c.book.category_slug)
      if (stat) stat.requests += apiRequests - before
    }
    await sleep(150)
  }
}

function printSummary(candidates: Candidate[], stats: Map<string, CategoryStats>, hiresCovers: boolean) {
  for (const c of candidates) {
    const stat = stats.get(c.book.category_slug)
    if (!stat) continue
    stat.books++
    if (c.book.cover_large) stat.large++
  }
  const rows = [...stats].map(([category, s]) => ({ 'danh mục': category, sách: s.books, 'ảnh lớn': s.large, request: s.requests }))
  rows.push({
    'danh mục': 'TỔNG',
    sách: rows.reduce((n, r) => n + r.sách, 0),
    'ảnh lớn': rows.reduce((n, r) => n + r['ảnh lớn'], 0),
    request: apiRequests,
  })
  console.table(rows)

  if (hiresCovers) {
    const guessed = candidates.filter((c) => c.previewable)
    const hit = guessed.filter((c) => c.book.cover_large).length
    const missOthers = candidates.filter((c) => !c.previewable && c.book.cover_large).length
    console.log(
      `Đoán "có ảnh lớn" qua viewability: ${hit}/${guessed.length} đúng; ${missOthers} sách không xem trước nhưng vẫn có ảnh lớn.`,
    )
  }
}

/** Khóa của sách đã có trong DB (ISBN + tên|tác giả đầu) → bỏ khỏi dry-run, khỏi tốn quota pha 2 cho chúng */
export type ExistingKeys = { isbns: Set<string>; editions: Set<string> }

export function excludeExisting(candidates: Candidate[], existing: ExistingKeys): Candidate[] {
  return candidates.filter((c) => !existing.isbns.has(c.book.isbn) && !existing.editions.has(editionKey(c.book)))
}

/** Đọc sách đã có (cần SUPABASE_SERVICE_ROLE_KEY). Không có env → trả về null, dry-run vẫn chạy bình thường. */
async function loadExistingKeys(): Promise<ExistingKeys | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const db = createClient<Database>(url, key, { auth: { persistSession: false } })
  const rows = await selectAll<{ isbn: string | null; title: string; book_authors: { authors: { name: string } | null }[] }>(
    (from, to) => db.from('books').select('isbn, title, book_authors(authors(name))').order('id').range(from, to),
    'books',
  )
  const isbns = new Set(rows.flatMap((r) => (r.isbn ? [r.isbn] : [])))
  const editions = new Set(
    rows.map((r) => `${slugify(r.title)}|${slugify(r.book_authors[0]?.authors?.name ?? '')}`),
  )
  return { isbns, editions }
}

async function collect(list: BookList, opts: { hiresCovers: boolean; maxRequests: number }): Promise<BookInput[]> {
  const stats = new Map<string, CategoryStats>()
  const existing = await loadExistingKeys()
  if (!existing) console.warn('  ⚠ Không đọc được DB (thiếu env) → không lọc sách đã có, pha 2 có thể tốn thêm request')

  console.log('Pha 1: search…')
  const { candidates: found, incomplete } = await searchAll(list, stats)
  if (apiRequests > opts.maxRequests) console.warn(`  ⚠ Riêng pha search đã vượt trần ${opts.maxRequests} request`)

  const fresh = existing ? excludeExisting(found, existing) : found
  const unique = dedupeEditions(fresh)
  const capped = capPerCategory(unique)
  console.log(
    `  ${found.length} sách → bỏ ${found.length - fresh.length} đã có trong DB → gộp ấn bản còn ${unique.length} ` +
      `→ giới hạn ${MAX_PER_CATEGORY}/danh mục còn ${capped.length}`,
  )

  if (opts.hiresCovers) {
    console.log(`Pha 2: ảnh lớn (còn ${Math.max(opts.maxRequests - apiRequests, 0)} request)…`)
    await fetchLargeCovers(capped, opts.maxRequests, stats)
  }

  printSummary(capped, stats, opts.hiresCovers)
  if (incomplete.length > 0) console.warn(`⚠ Preview THIẾU các danh mục chưa search xong: ${incomplete.join(', ')}`)
  return capped.map((c) => c.book)
}

// ---------- Supabase ----------
function must<T>(r: DbResult<T>, ctx: string): T {
  if (r.error) throw new Error(`${ctx}: ${r.error.message}`)
  if (r.data === null) throw new Error(`${ctx}: không có dữ liệu trả về`)
  return r.data
}

/** PostgREST mặc định trả tối đa 1000 dòng → đọc theo trang */
async function selectAll<T>(page: (from: number, to: number) => PromiseLike<DbResult<T[]>>, ctx: string) {
  const size = 1000
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const rows = must(await page(from, from + size - 1), ctx)
    out.push(...rows)
    if (rows.length < size) return out
  }
}

/** Khóa so tên không theo thứ tự từ: "huy-thiep-nguyen" và "nguyen-huy-thiep" → cùng khóa */
export function nameTokensKey(slug: string) {
  return slug.split('-').filter(Boolean).sort().join('-')
}

/**
 * Tác giả mới có cùng các từ với tác giả đã có nhưng khác thứ tự (Google Books trả "Huy Thiệp Nguyễn" lẫn "Nguyễn Huy
 * Thiệp"; DB đã sửa tên một bản): dùng lại tác giả đã có thay vì tạo bản trùng. Trả về slug mới → id đã có.
 * Hai người khác nhau trùng đúng tập từ (hiếm) sẽ bị gộp: xem lại khi duyệt preview.
 */
export function reuseByNameTokens(incoming: string[], existing: IdSlug[]) {
  const known = new Set(existing.map((row) => row.slug))
  const byKey = new Map(existing.map((row) => [nameTokensKey(row.slug), row.id]))
  const reused = new Map<string, number>()
  for (const slug of incoming) {
    const id = known.has(slug) ? undefined : byKey.get(nameTokensKey(slug))
    if (id !== undefined) reused.set(slug, id)
  }
  return reused
}

/** Thêm tác giả/NXB mới; cái đã có (theo slug, tác giả: cả cùng tập từ) giữ nguyên tên. Trả về slug → id. */
async function ensureNamed(db: SupabaseClient, table: 'authors' | 'publishers', names: string[]) {
  const all = [...new Map(names.map((n) => [slugify(n), { name: n, slug: slugify(n) }])).values()].filter(
    (r) => r.slug !== '',
  )
  const reused =
    table === 'authors'
      ? reuseByNameTokens(
          all.map((r) => r.slug),
          await selectAll<IdSlug>((from, to) => db.from('authors').select('id, slug').range(from, to), 'authors'),
        )
      : new Map<string, number>()
  const rows = all.filter((r) => !reused.has(r.slug))
  for (const part of chunk(rows, 500)) {
    const res = await db.from(table).upsert(part, { onConflict: 'slug', ignoreDuplicates: true })
    if (res.error) throw new Error(`${table}: ${res.error.message}`)
  }

  const ids = new Map<string, number>()
  for (const part of chunk(rows.map((r) => r.slug), 200)) {
    const found: IdSlug[] = must(await db.from(table).select('id, slug').in('slug', part), table)
    for (const r of found) ids.set(r.slug, r.id)
  }
  for (const [slug, id] of reused) ids.set(slug, id)
  return ids
}

// ---------- Ảnh bìa: tải về → WebP 600px → Supabase Storage (không hotlink Google) ----------
const COVER_BUCKET = 'book-covers'
const PLACEHOLDER_PNG_MAX_BYTES = 40_000

type Image = { bytes: Buffer; type: string }

async function download(url: string): Promise<Image | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return null
    return { bytes: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '' }
  } catch {
    return null
  }
}

/** Ảnh lớn của Google đôi khi là trang lót toàn chữ (PNG rất nhẹ dù kích thước lớn) chứ không phải bìa */
export function isLikelyPlaceholder(img: Image) {
  return img.type.includes('png') && img.bytes.length < PLACEHOLDER_PNG_MAX_BYTES
}

/** WebP rộng 600px (src/lib/cover-image.ts, dùng chung với upload bìa ở admin); null nếu không decode được */
const toWebp = (img: Image) => toCoverWebp(img.bytes)

/** Lấy bìa WebP cho một sách; `source` chỉ để thống kê. null = không có bìa dùng được (sách bị bỏ qua). */
export type CoverSource = (book: BookInput) => Promise<{ webp: CoverWebp; source: string } | null>

/** Ưu tiên ảnh lớn; lỗi tải / nghi trang lót / không decode được → ảnh nhỏ. Trả về null nếu cả hai hỏng. */
const prepareCover: CoverSource = async (book) => {
  if (book.cover_large) {
    const large = await download(book.cover_large)
    const webp = large && !isLikelyPlaceholder(large) ? await toWebp(large) : null
    if (webp) return { webp, source: 'ảnh lớn' }
  }
  const small = await download(book.cover_small)
  const webp = small ? await toWebp(small) : null
  return webp ? { webp, source: 'ảnh nhỏ (fallback)' } : null
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      const item = items[i]
      if (item !== undefined) out[i] = await fn(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/** Upload bìa cho sách mới, trả về ISBN → public URL + chiều rộng. Sách không có bìa dùng được thì không có trong map. */
async function uploadCovers(db: SupabaseClient, books: BookInput[], coverSource: CoverSource) {
  const sources = new Map<string, number>()
  const failed: string[] = []
  const covers = new Map<string, { url: string; width: number }>()

  await mapLimit(books, 6, async (book) => {
    const cover = await coverSource(book)
    if (!cover) {
      failed.push(`${book.isbn} ${book.title}`)
      return
    }
    const path = `${book.isbn}.webp`
    // Cache 1 năm: mỗi ISBN chỉ upload một lần (sách đã có bị bỏ qua). Admin đổi bìa phải dùng tên file mới.
    const { error } = await db.storage
      .from(COVER_BUCKET)
      .upload(path, cover.webp.data, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' })
    if (error) throw new Error(`Storage ${path}: ${error.message}`)
    covers.set(book.isbn, { url: db.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl, width: cover.webp.width })
    sources.set(cover.source, (sources.get(cover.source) ?? 0) + 1)
  })

  const counts = [...sources].map(([source, count]) => `${count} ${source}`).join(', ')
  console.log(`  Bìa: ${counts || '0'}, ${failed.length} lỗi`)
  for (const f of failed) console.warn(`  ⚠ Không lấy được bìa, bỏ qua sách: ${f}`)
  return covers
}

/** Ghi sách mới vào DB của NEXT_PUBLIC_SUPABASE_URL. `coverSource` mặc định tải ảnh trong preview (e2e: bìa giả). */
export async function save(books: BookInput[], coverSource: CoverSource = prepareCover) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const categories: IdSlug[] = must(await db.from('categories').select('id, slug'), 'categories')
  const categoryId = new Map(categories.map((c) => [c.slug, c.id]))

  const unknown = [...new Set(books.map((b) => b.category_slug))].filter((s) => !categoryId.has(s))
  if (unknown.length > 0) {
    console.warn(`⚠ Danh mục không có trong DB (kiểm tra seed.sql / book-list.json), bỏ qua: ${unknown.join(', ')}`)
  }

  const existing = await selectAll<{ id: number; slug: string; isbn: string | null }>(
    (from, to) => db.from('books').select('id, slug, isbn').order('id').range(from, to),
    'books',
  )
  const existingId = new Map<string, number>()
  for (const b of existing) if (b.isbn) existingId.set(b.isbn, b.id)

  const newBooks = books.filter((b) => categoryId.has(b.category_slug) && !existingId.has(b.isbn))
  const orphans = await findBooksWithoutAuthors(db, books, existingId)
  const skipped = books.length - newBooks.length
  if (newBooks.length === 0 && orphans.length === 0) {
    console.log(`Không có sách mới (bỏ qua ${skipped} sách đã có hoặc thiếu danh mục).`)
    return
  }

  console.log(`Đang xử lý bìa cho ${newBooks.length} sách mới…`)
  const covers = await uploadCovers(db, newBooks, coverSource)
  const toInsert = newBooks.filter((b) => covers.has(b.isbn))

  // Sách chưa có ISBN trong DB vẫn giữ slug → dùng khóa riêng để không bao giờ trùng ISBN thật
  dedupeSlugs(toInsert, new Map(existing.map((b) => [b.slug, b.isbn ?? `id:${b.id}`])))

  const publisherId = await ensureNamed(db, 'publishers', toInsert.flatMap((b) => b.publisher ?? []))
  const authorId = await ensureNamed(db, 'authors', [...toInsert, ...orphans].flatMap((b) => b.authors))

  const rows = toInsert.map((b) => ({
    title: b.title,
    subtitle: b.subtitle,
    slug: b.slug,
    description: b.description,
    isbn: b.isbn,
    published_year: b.published_year,
    page_count: b.page_count,
    cover_url: covers.get(b.isbn)?.url ?? null,
    cover_width: covers.get(b.isbn)?.width ?? null,
    price: b.price,
    original_price: b.original_price,
    stock: b.stock,
    language: b.language,
    category_id: categoryId.get(b.category_slug) ?? null,
    publisher_id: b.publisher ? (publisherId.get(slugify(b.publisher)) ?? null) : null,
  }))

  const bookId = new Map<string, number>()
  for (const b of orphans) {
    const id = existingId.get(b.isbn)
    if (id) bookId.set(b.isbn, id)
  }
  for (const part of chunk(rows, 200)) {
    const inserted: { id: number; isbn: string }[] = must(
      await db.from('books').insert(part).select('id, isbn'),
      'books',
    )
    for (const b of inserted) bookId.set(b.isbn, b.id)
  }

  const links = [...toInsert, ...orphans].flatMap((b) =>
    b.authors.flatMap((name) => {
      const book_id = bookId.get(b.isbn)
      const author_id = authorId.get(slugify(name))
      return book_id && author_id ? [{ book_id, author_id, role: 'author' }] : []
    }),
  )
  for (const part of chunk(links, 500)) {
    const res = await db
      .from('book_authors')
      .upsert(part, { onConflict: 'book_id,author_id,role', ignoreDuplicates: true })
    if (res.error) throw new Error(`book_authors: ${res.error.message}`)
  }

  console.log(
    `✔ Thêm ${toInsert.length} sách mới (bỏ qua ${skipped}), gắn lại tác giả cho ${orphans.length} sách cũ, ` +
      `${authorId.size} tác giả, ${publisherId.size} NXB liên quan`,
  )
}

/**
 * Sách đã có trong DB nhưng chưa có dòng book_authors nào. Insert sách và gắn tác giả không cùng
 * transaction, nên lần chạy trước bị ngắt giữa chừng sẽ để lại sách mồ côi; lần sau phải vá lại
 * vì sách đã có thì bị bỏ qua.
 */
async function findBooksWithoutAuthors(db: SupabaseClient, books: BookInput[], existingId: Map<string, number>) {
  const candidates = books.filter((b) => b.authors.length > 0 && existingId.has(b.isbn))
  const ids = candidates.flatMap((b) => existingId.get(b.isbn) ?? [])

  const linked = new Set<number>()
  for (const part of chunk(ids, 200)) {
    const rows: { book_id: number }[] = must(
      await db.from('book_authors').select('book_id').in('book_id', part),
      'book_authors',
    )
    for (const r of rows) linked.add(r.book_id)
  }
  return candidates.filter((b) => !linked.has(existingId.get(b.isbn) ?? -1))
}

// ---------- Preview file ----------
export const bookFieldsSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().nullable(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().nullable(),
  isbn: z.string().regex(/^[0-9]{9}[0-9X]$|^[0-9]{13}$/),
  authors: z.array(z.string().trim().min(1)),
  publisher: z.string().nullable(),
  published_year: z.number().int().min(1800).max(2100).nullable(),
  page_count: z.number().int().positive().nullable(),
  cover_small: z.url({ protocol: /^https$/ }),
  cover_large: z.url({ protocol: /^https$/ }).nullable(),
  price: z.number().int().nonnegative(),
  original_price: z.number().int().nonnegative().nullable(),
  stock: z.number().int().nonnegative(),
  category_slug: z.string().min(1),
  // Preview cũ (trước khi có ngoại văn) không có field này → mặc định tiếng Việt
  language: z.enum(['vi', 'en']).default('vi'),
})

/** Giống check constraint trong DB */
export const validOriginalPrice = (b: { price: number; original_price: number | null }) =>
  b.original_price === null || b.original_price >= b.price
export const ORIGINAL_PRICE_MESSAGE = 'original_price phải >= price (giống check constraint trong DB)'

const bookInputSchema = bookFieldsSchema.refine(validOriginalPrice, {
  message: ORIGINAL_PRICE_MESSAGE,
}) satisfies z.ZodType<BookInput>

/** File preview có thể đã bị sửa tay → validate lại đúng các ràng buộc của DB trước khi ghi */
export function readPreview(path: string): BookInput[] {
  const parsed = z.array(bookInputSchema).safeParse(JSON.parse(readFileSync(path, 'utf8')))
  if (!parsed.success) throw new Error(`File preview không hợp lệ (${path}):\n${z.prettifyError(parsed.error)}`)
  const isbns = parsed.data.map((b) => b.isbn)
  if (new Set(isbns).size !== isbns.length) throw new Error(`File preview có ISBN trùng (${path})`)
  return parsed.data
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i === -1) return undefined
  const value = process.argv[i + 1]
  if (!value || value.startsWith('--')) throw new Error(`${flag} cần một giá trị`)
  return value
}

/**
 * Ghi preview an toàn: ghi ra .tmp rồi rename (không bao giờ để file dở dang). Lượt ra 0 sách → giữ nguyên
 * file cũ và báo lỗi, để một lượt hỏng (quota, cú pháp truy vấn…) không xóa mất preview đã duyệt.
 */
export function writePreview(path: string, books: BookInput[]) {
  if (books.length === 0) throw new Error(`Không có sách nào → giữ nguyên ${path}, không ghi đè.`)
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(books, null, 2))
  renameSync(tmp, path)
}

// ---------- Main ----------
async function main() {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    /* đã có env từ shell */
  }
  const dryRun = process.argv.includes('--dry-run')
  const hiresCovers = process.argv.includes('--hires-covers')
  const fromPreview = argValue('--from-preview')
  const maxRequests = Number(argValue('--max-requests') ?? 900)
  if (!Number.isInteger(maxRequests) || maxRequests <= 0) throw new Error('--max-requests phải là số nguyên dương')

  if (fromPreview) {
    if (dryRun || hiresCovers) throw new Error('--from-preview không dùng chung với --dry-run / --hires-covers')
    const books = readPreview(fromPreview)
    console.log(`Đọc ${books.length} sách từ ${fromPreview} (không gọi Google Books).`)
    await save(books)
    return
  }

  const list: BookList = JSON.parse(readFileSync(new URL('./book-list.json', import.meta.url), 'utf8'))

  console.log(`Đang lấy dữ liệu từ Google Books${hiresCovers ? ' (ảnh bìa lớn)' : ''}…`)
  const books = dedupeSlugs(await collect(list, { hiresCovers, maxRequests }))
  console.log(`Thu được ${books.length} sách hợp lệ (tiếng Việt, có ISBN + ảnh bìa). Đã gọi ${apiRequests} request Books API.`)

  if (dryRun) {
    // Hai biến thể ghi ra hai file riêng để so sánh, không ghi đè nhau
    const file = hiresCovers ? 'preview-hires.json' : 'preview.json'
    mkdirSync(new URL('./out/', import.meta.url), { recursive: true })
    writePreview(fileURLToPath(new URL(`./out/${file}`, import.meta.url)), books)
    console.log(`Dry run → scripts/out/${file}`)
    return
  }
  await save(books)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
