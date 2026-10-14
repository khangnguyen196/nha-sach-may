/**
 * Import sách thật từ Google Books API vào Supabase.
 *
 *   npm run import:books              # import vào database
 *   npm run import:books -- --dry-run # chỉ xem trước, ghi ra scripts/out/preview.json
 *
 * Env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   — CHỈ dùng trong scripts/ chạy local, không bao giờ trong src/
 *   GOOGLE_BOOKS_API_KEY        — tùy chọn, có key thì quota cao hơn
 *
 * Danh sách truy vấn theo danh mục: scripts/book-list.json
 * Google Books không có giá bán lẻ VN → giá/tồn kho được sinh tự động (ổn định theo ISBN).
 * Chạy lại nhiều lần an toàn: upsert theo ISBN / slug.
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// ---------- Types ----------
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
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
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

function bestCover(links: GoogleVolume['volumeInfo']['imageLinks']): string | null {
  const url = links?.thumbnail ?? links?.smallThumbnail
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
  if (!info.title || !isbn || !cover_url) return null

  const year = info.publishedDate ? Number.parseInt(info.publishedDate.slice(0, 4), 10) : NaN
  const page_count = info.pageCount && info.pageCount > 0 ? info.pageCount : null

  return {
    title: info.title.trim(),
    subtitle: info.subtitle?.trim() || null,
    slug: slugify(info.title),
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

/** Gắn hậu tố ISBN khi 2 sách khác nhau trùng slug */
export function dedupeSlugs(books: BookInput[], taken: Map<string, string> = new Map()) {
  for (const b of books) {
    const owner = taken.get(b.slug)
    if (owner && owner !== b.isbn) b.slug = `${b.slug}-${b.isbn.slice(-4)}`
    taken.set(b.slug, b.isbn)
  }
  return books
}

// ---------- Google Books ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function searchVolumes(query: string, max = 20): Promise<GoogleVolume[]> {
  const params = new URLSearchParams({
    q: query,
    langRestrict: 'vi',
    printType: 'books',
    maxResults: String(Math.min(max, 40)),
  })
  if (process.env.GOOGLE_BOOKS_API_KEY) params.set('key', process.env.GOOGLE_BOOKS_API_KEY)

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`)
    if (res.status === 429 || res.status >= 500) {
      await sleep(1000 * 2 ** attempt)
      continue
    }
    if (!res.ok) throw new Error(`Google Books ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as { items?: GoogleVolume[] }
    return json.items ?? []
  }
  throw new Error(`Google Books: hết lượt thử cho "${query}"`)
}

async function collect(list: BookList): Promise<BookInput[]> {
  const byIsbn = new Map<string, BookInput>()
  for (const [category, queries] of Object.entries(list)) {
    for (const q of queries) {
      const volumes = await searchVolumes(q)
      let added = 0
      for (const v of volumes) {
        const book = mapVolume(v, category)
        if (book && !byIsbn.has(book.isbn)) {
          byIsbn.set(book.isbn, book)
          added++
        }
      }
      console.log(`  [${category}] "${q}": +${added}`)
      await sleep(300)
    }
  }
  return [...byIsbn.values()]
}

// ---------- Supabase ----------
async function save(books: BookInput[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY')
  const db = createClient(url, key, { auth: { persistSession: false } })

  const must = <T>(r: { data: T | null; error: { message: string } | null }, ctx: string): T => {
    if (r.error) throw new Error(`${ctx}: ${r.error.message}`)
    return r.data as T
  }

  const categories = must(await db.from('categories').select('id, slug'), 'categories')
  const categoryId = new Map(categories.map((c) => [c.slug, c.id]))

  const existing = must(await db.from('books').select('slug, isbn'), 'books')
  dedupeSlugs(books, new Map(existing.map((b) => [b.slug, b.isbn ?? ''])))

  const upsertNamed = async (table: 'authors' | 'publishers', names: string[]) => {
    const rows = [...new Map(names.map((n) => [slugify(n), { name: n, slug: slugify(n) }])).values()]
    if (rows.length === 0) return new Map<string, number>()
    const data = must(
      await db.from(table).upsert(rows, { onConflict: 'slug' }).select('id, slug'),
      table,
    )
    return new Map(data.map((r) => [r.slug, r.id as number]))
  }

  const publisherId = await upsertNamed('publishers', books.flatMap((b) => b.publisher ?? []))
  const authorId = await upsertNamed('authors', books.flatMap((b) => b.authors))

  const bookRows = books.map(({ authors, publisher, category_slug, ...b }) => ({
    ...b,
    category_id: categoryId.get(category_slug) ?? null,
    publisher_id: publisher ? publisherId.get(slugify(publisher)) ?? null : null,
  }))

  const saved: { id: number; isbn: string }[] = []
  for (let i = 0; i < bookRows.length; i += 200) {
    const chunk = bookRows.slice(i, i + 200)
    saved.push(...must(await db.from('books').upsert(chunk, { onConflict: 'isbn' }).select('id, isbn'), 'books'))
  }
  const bookId = new Map(saved.map((b) => [b.isbn, b.id]))

  const links = books.flatMap((b) =>
    b.authors.map((a) => ({ book_id: bookId.get(b.isbn)!, author_id: authorId.get(slugify(a))!, role: 'author' })),
  )
  for (let i = 0; i < links.length; i += 500) {
    must(
      await db.from('book_authors').upsert(links.slice(i, i + 500), { onConflict: 'book_id,author_id,role', ignoreDuplicates: true }),
      'book_authors',
    )
  }

  console.log(`✔ ${saved.length} sách, ${authorId.size} tác giả, ${publisherId.size} NXB`)
}

// ---------- Main ----------
async function main() {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    /* đã có env từ shell */
  }
  const dryRun = process.argv.includes('--dry-run')
  const list = JSON.parse(readFileSync(new URL('./book-list.json', import.meta.url), 'utf8')) as BookList

  console.log('Đang lấy dữ liệu từ Google Books…')
  const books = dedupeSlugs(await collect(list))
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
