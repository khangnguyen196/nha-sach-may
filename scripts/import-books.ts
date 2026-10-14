/**
 * Import sách thật từ Google Books API vào Supabase.
 *
 *   npm run import:books                    # import vào database
 *   npm run import:books -- --dry-run       # chỉ xem trước, ghi ra scripts/out/preview.json
 *   npm run import:books -- --hires-covers  # lấy ảnh bìa lớn hơn (thêm 1 request/sách)
 *
 * Env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   — CHỈ dùng trong scripts/ chạy local, không bao giờ trong src/
 *   GOOGLE_BOOKS_API_KEY        — tùy chọn, có key thì quota cao hơn
 *
 * Danh sách truy vấn theo danh mục: scripts/book-list.json
 * Google Books không có giá bán lẻ VN → giá/tồn kho được sinh tự động (ổn định theo ISBN).
 *
 * Chạy lại an toàn: sách đã có (theo ISBN) được BỎ QUA hoàn toàn, nên giá, tồn kho, mô tả,
 * tác giả đã sửa trong admin hay tồn kho đã bị trừ bởi đơn hàng đều giữ nguyên.
 * Tác giả / NXB đã có (theo slug) cũng không bị ghi đè tên.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

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
    imageLinks?: ImageLinks
  }
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
  cover_url: string
  price: number
  original_price: number | null
  stock: number
  category_slug: string
}

type BookList = Record<string, string[]> // category_slug → queries
type IdSlug = { id: number; slug: string }
type DbResult<T> = { data: T | null; error: { message: string } | null }

// ---------- Helpers ----------
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
}

const stripHtml = (s: string) =>
  s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim()

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

/** Trả về null nếu thiếu dữ liệu tối thiểu (tên, ISBN, ảnh bìa) */
export function mapVolume(v: GoogleVolume, categorySlug: string): BookInput | null {
  const info = v.volumeInfo
  const isbn = pickIsbn(info.industryIdentifiers)
  const cover_url = bestCover(info.imageLinks)
  if (!info.title?.trim() || !isbn || !cover_url) return null

  const year = info.publishedDate ? Number.parseInt(info.publishedDate.slice(0, 4), 10) : NaN
  const page_count = info.pageCount && info.pageCount > 0 ? info.pageCount : null

  return {
    title: info.title.trim(),
    subtitle: info.subtitle?.trim() || null,
    // Tên toàn ký tự đặc biệt → slugify ra rỗng → dùng ISBN
    slug: slugify(info.title) || isbn,
    description: info.description ? stripHtml(info.description) : null,
    isbn,
    authors: [...new Set((info.authors ?? []).map((a) => a.trim()).filter(Boolean))],
    publisher: info.publisher?.trim() || null,
    published_year: year >= 1800 && year <= 2100 ? year : null,
    page_count,
    cover_url,
    category_slug: categorySlug,
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
      slug = `${base}-${b.isbn.slice(-4)}${n > 1 ? `-${n}` : ''}`
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

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url)
    if (res.status === 429 || res.status >= 500) {
      await sleep(1000 * 2 ** attempt)
      continue
    }
    if (!res.ok) throw new Error(`Google Books ${res.status}: ${await res.text()}`)
    const json: T = await res.json()
    return json
  }
  throw new Error(`Google Books: hết lượt thử cho ${url}`)
}

function withKey(params: URLSearchParams) {
  if (process.env.GOOGLE_BOOKS_API_KEY) params.set('key', process.env.GOOGLE_BOOKS_API_KEY)
  return params
}

async function searchVolumes(query: string, max = 20): Promise<GoogleVolume[]> {
  const params = withKey(
    new URLSearchParams({
      q: query,
      langRestrict: 'vi',
      printType: 'books',
      maxResults: String(Math.min(max, 40)),
    }),
  )
  const json = await getJson<{ items?: GoogleVolume[] }>(`https://www.googleapis.com/books/v1/volumes?${params}`)
  return json.items ?? []
}

/** Endpoint chi tiết thường có thêm small/medium/large; không có thì trả về null */
async function fetchLargerCover(volumeId: string): Promise<string | null> {
  const params = withKey(new URLSearchParams({ fields: 'volumeInfo/imageLinks' }))
  const json = await getJson<{ volumeInfo?: { imageLinks?: ImageLinks } }>(
    `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(volumeId)}?${params}`,
  )
  return bestCover(json.volumeInfo?.imageLinks)
}

async function collect(list: BookList, opts: { hiresCovers: boolean }): Promise<BookInput[]> {
  const byIsbn = new Map<string, BookInput>()
  for (const [category, queries] of Object.entries(list)) {
    for (const q of queries) {
      const volumes = await searchVolumes(q)
      let added = 0
      for (const v of volumes) {
        const book = mapVolume(v, category)
        if (!book || byIsbn.has(book.isbn)) continue
        if (opts.hiresCovers) {
          book.cover_url = (await fetchLargerCover(v.id).catch(() => null)) ?? book.cover_url
          await sleep(150)
        }
        byIsbn.set(book.isbn, book)
        added++
      }
      console.log(`  [${category}] "${q}": +${added}`)
      await sleep(300)
    }
  }
  return [...byIsbn.values()]
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

/** Thêm tác giả/NXB mới; cái đã có (theo slug) giữ nguyên tên. Trả về slug → id. */
async function ensureNamed(db: SupabaseClient, table: 'authors' | 'publishers', names: string[]) {
  const rows = [...new Map(names.map((n) => [slugify(n), { name: n, slug: slugify(n) }])).values()].filter(
    (r) => r.slug !== '',
  )
  for (const part of chunk(rows, 500)) {
    const res = await db.from(table).upsert(part, { onConflict: 'slug', ignoreDuplicates: true })
    if (res.error) throw new Error(`${table}: ${res.error.message}`)
  }

  const ids = new Map<string, number>()
  for (const part of chunk(rows.map((r) => r.slug), 200)) {
    const found: IdSlug[] = must(await db.from(table).select('id, slug').in('slug', part), table)
    for (const r of found) ids.set(r.slug, r.id)
  }
  return ids
}

async function save(books: BookInput[]) {
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
  const existingIsbns = new Set(existing.flatMap((b) => (b.isbn ? [b.isbn] : [])))

  const newBooks = books.filter((b) => categoryId.has(b.category_slug) && !existingIsbns.has(b.isbn))
  const skipped = books.length - newBooks.length
  if (newBooks.length === 0) {
    console.log(`Không có sách mới (bỏ qua ${skipped} sách đã có hoặc thiếu danh mục).`)
    return
  }

  // Sách chưa có ISBN trong DB vẫn giữ slug → dùng khóa riêng để không bao giờ trùng ISBN thật
  dedupeSlugs(newBooks, new Map(existing.map((b) => [b.slug, b.isbn ?? `id:${b.id}`])))

  const publisherId = await ensureNamed(db, 'publishers', newBooks.flatMap((b) => b.publisher ?? []))
  const authorId = await ensureNamed(db, 'authors', newBooks.flatMap((b) => b.authors))

  const rows = newBooks.map((b) => ({
    title: b.title,
    subtitle: b.subtitle,
    slug: b.slug,
    description: b.description,
    isbn: b.isbn,
    published_year: b.published_year,
    page_count: b.page_count,
    cover_url: b.cover_url,
    price: b.price,
    original_price: b.original_price,
    stock: b.stock,
    category_id: categoryId.get(b.category_slug) ?? null,
    publisher_id: b.publisher ? (publisherId.get(slugify(b.publisher)) ?? null) : null,
  }))

  const bookId = new Map<string, number>()
  for (const part of chunk(rows, 200)) {
    const inserted: { id: number; isbn: string }[] = must(
      await db.from('books').insert(part).select('id, isbn'),
      'books',
    )
    for (const b of inserted) bookId.set(b.isbn, b.id)
  }

  const links = newBooks.flatMap((b) =>
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
    `✔ Thêm ${bookId.size} sách mới (bỏ qua ${skipped}), ${authorId.size} tác giả, ${publisherId.size} NXB liên quan`,
  )
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
  const list: BookList = JSON.parse(readFileSync(new URL('./book-list.json', import.meta.url), 'utf8'))

  console.log(`Đang lấy dữ liệu từ Google Books${hiresCovers ? ' (ảnh bìa lớn)' : ''}…`)
  const books = dedupeSlugs(await collect(list, { hiresCovers }))
  console.log(`Thu được ${books.length} sách hợp lệ (có ISBN + ảnh bìa).`)

  if (dryRun) {
    mkdirSync(new URL('./out/', import.meta.url), { recursive: true })
    writeFileSync(new URL('./out/preview.json', import.meta.url), JSON.stringify(books, null, 2))
    console.log('Dry run → scripts/out/preview.json')
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
