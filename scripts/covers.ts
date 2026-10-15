/**
 * Ảnh bìa: đo chiều rộng bìa đang dùng và thay bìa mờ bằng bìa lớn hơn từ Open Library (docs/plans/phase-8.md, mục 1).
 *
 *   npm run covers -- --measure                          # ghi books.cover_width cho bìa trong bucket còn null
 *                                                         # (cần migration 20261016010000_cover_width.sql; không gọi API ngoài)
 *   npm run covers -- --openlibrary --dry-run            # chọn sách bìa < 300px, tải bìa Open Library (giãn cách),
 *                                                         # ghi scripts/out/covers-preview.json + ảnh gốc + lưới so sánh
 *   npm run covers -- --openlibrary --apply <file>       # chỉ ghi mục `approved: true`, dùng ảnh đã tải ở dry-run
 *
 * Quy trình như import: dry-run → xem lưới "bìa cũ | bìa mới", đặt `approved: true` cho bìa chắc chắn đúng sách → apply.
 * Mỗi ISBN đúng một request Open Library cho cả quy trình (apply không gọi lại). Open Library giới hạn tra bìa theo ISBN
 * ở 100 request / IP / 5 phút: giãn ≥ 3.5 giây, gặp 403 / 429 thì dừng hẳn.
 *
 * Chỉ đụng bìa do import tạo (`<isbn>.webp`); bìa admin đã thay (`<book_id>-<8 hex>.webp`) giữ nguyên.
 * apply chỉ đổi cover_url (điều kiện cover_url = URL cũ: admin vừa thay bìa thì không đè); cover_width ghi bằng --measure.
 *
 * Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (chỉ dùng trong scripts/ chạy local).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp, { type OverlayOptions } from 'sharp'
import { z } from 'zod'
import { storageObjectPath } from '../src/features/admin/db-errors'
import { SHARP_COVER_WIDTH, toCoverWebp } from '../src/lib/cover-image'
import type { Database } from '../src/types/database'

type Db = SupabaseClient<Database>

const COVER_BUCKET = 'book-covers'
const OPEN_LIBRARY_GAP_MS = 3_500
const USER_AGENT = 'NhaSachMay/1.0 (non-commercial student project; https://github.com/khangnguyen196/nha-sach-may)'
const OUT_DIR = new URL('./out/', import.meta.url)
const OL_DIR = new URL('./out/ol-covers/', import.meta.url)

// ---------- Hàm thuần (Vitest) ----------

/** Bìa do import tạo có tên `<isbn>.webp`; bìa admin đã thay mang tên khác → không đụng tới */
export function isImportCoverPath(path: string | null, isbn: string | null): boolean {
  return Boolean(path && isbn && path === `${isbn}.webp`)
}

export type ImageInfo = { format?: string; width?: number; height?: number }

export type Verdict = { ok: true } | { ok: false; reason: string }

/**
 * Nhận ảnh Open Library khi: định dạng ảnh thường, rộng ≥ 300px và ≥ 2 lần bìa hiện tại (nét hơn thấy rõ), tỉ lệ
 * cao / rộng 1.2–1.8 (bìa sách; loại ảnh hỏng, ảnh vuông, ảnh gáy sách).
 */
export function judgeOpenLibraryImage(info: ImageInfo, currentWidth: number): Verdict {
  const { format, width, height } = info
  if (format !== 'jpeg' && format !== 'png' && format !== 'webp') return { ok: false, reason: `định dạng ${format ?? '?'}` }
  if (!width || !height) return { ok: false, reason: 'không đọc được kích thước' }
  if (width < SHARP_COVER_WIDTH) return { ok: false, reason: `rộng ${width}px < ${SHARP_COVER_WIDTH}px` }
  if (width < currentWidth * 2) return { ok: false, reason: `rộng ${width}px < 2 × bìa hiện tại (${currentWidth}px)` }
  const ratio = height / width
  if (ratio < 1.2 || ratio > 1.8) return { ok: false, reason: `tỉ lệ cao/rộng ${ratio.toFixed(2)} ngoài 1.2–1.8` }
  return { ok: true }
}

/** Tên object mới mỗi lần (ảnh cũ bị CDN cache 1 năm, ghi đè cùng tên thì người xem vẫn thấy bìa cũ) */
export function openLibraryObjectPath(isbn: string, suffix = randomBytes(4).toString('hex')) {
  return `ol-${isbn}-${suffix}.webp`
}

const previewEntrySchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  isbn: z.string().regex(/^[0-9X]{10,13}$/),
  language: z.string(),
  old_url: z.url(),
  old_width: z.number().int().positive(),
  status: z.enum(['accepted', 'rejected', 'missing', 'error']),
  reason: z.string().nullable(),
  file: z.string().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  approved: z.boolean(),
  note: z.string().nullable(),
})

export type PreviewEntry = z.infer<typeof previewEntrySchema>

/** Mục được ghi ở --apply: đã nhận ở dry-run, có file, và người duyệt đặt approved */
export function approvedEntries(entries: PreviewEntry[]): PreviewEntry[] {
  return entries.filter((entry) => entry.approved && entry.status === 'accepted' && entry.file !== null)
}

export function readCoversPreview(json: string): PreviewEntry[] {
  const parsed = z.array(previewEntrySchema).safeParse(JSON.parse(json))
  if (!parsed.success) throw new Error(`File preview không hợp lệ:\n${z.prettifyError(parsed.error)}`)
  const ids = parsed.data.map((entry) => entry.id)
  if (new Set(ids).size !== ids.length) throw new Error('File preview có id sách trùng')
  return parsed.data
}

// ---------- I/O ----------

function connect(): Db {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    /* đã có env từ shell */
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY')
  return createClient<Database>(url, key, { auth: { persistSession: false } })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

/** Chiều rộng thật của ảnh ở public URL (Storage của project, không phải API ngoài); lỗi → null */
async function measureUrl(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return null
    const { width } = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    return width ?? null
  } catch {
    return null
  }
}

function publicBase(db: Db) {
  return db.storage.from(COVER_BUCKET).getPublicUrl('').data.publicUrl
}

// ---------- --measure ----------

async function measure() {
  const db = connect()
  const { data, error } = await db
    .from('books')
    .select('id, cover_url')
    .not('cover_url', 'is', null)
    .is('cover_width', null)
    .order('id')
  if (error) throw new Error(`books: ${error.message} (đã chạy migration cover_width chưa?)`)
  const base = publicBase(db)
  const inBucket = data.filter((book) => storageObjectPath(book.cover_url, base) !== null)
  console.log(`Đo ${inBucket.length} bìa (bỏ qua ${data.length - inBucket.length} bìa ngoài bucket).`)

  const failed: number[] = []
  const histogram = new Map<string, number>()
  await mapLimit(inBucket, 6, async (book) => {
    const width = book.cover_url ? await measureUrl(book.cover_url) : null
    if (!width) {
      failed.push(book.id)
      return
    }
    // Điều kiện cover_url: admin vừa thay bìa trong lúc đo thì không ghi chiều rộng của ảnh cũ
    const { error: updateError } = await db
      .from('books')
      .update({ cover_width: width })
      .eq('id', book.id)
      .eq('cover_url', book.cover_url ?? '')
    if (updateError) throw new Error(`book ${book.id}: ${updateError.message}`)
    const bucket = width < SHARP_COVER_WIDTH ? `< ${SHARP_COVER_WIDTH}px` : width < 600 ? '300–599px' : '≥ 600px'
    histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1)
  })
  for (const [bucket, count] of histogram) console.log(`  ${bucket}: ${count}`)
  if (failed.length > 0) console.warn(`  ⚠ Không đo được ${failed.length} bìa (id: ${failed.join(', ')})`)
}

// ---------- --openlibrary --dry-run ----------

type Candidate = { id: number; title: string; isbn: string; language: string; old_url: string; old_width: number }

async function findCandidates(db: Db): Promise<Candidate[]> {
  const { data, error } = await db.from('books').select('id, title, isbn, language, cover_url').order('id')
  if (error) throw new Error(`books: ${error.message}`)
  const base = publicBase(db)

  const measured = await mapLimit(data, 6, async (book) => {
    const path = storageObjectPath(book.cover_url, base)
    if (!book.cover_url || !path) return null
    const width = await measureUrl(book.cover_url)
    return { book, path, width }
  })

  const candidates: Candidate[] = []
  let sharpCount = 0
  const skipped: string[] = []
  for (const item of measured) {
    if (!item) continue
    const { book, path, width } = item
    if (width === null) {
      skipped.push(`${book.title}: không đo được bìa hiện tại`)
      continue
    }
    if (width >= SHARP_COVER_WIDTH) {
      sharpCount++
      continue
    }
    if (!book.isbn) skipped.push(`${book.title}: không có ISBN`)
    else if (!isImportCoverPath(path, book.isbn)) skipped.push(`${book.title}: bìa đã thay trong admin (${path})`)
    else candidates.push({ id: book.id, title: book.title, isbn: book.isbn, language: book.language, old_url: book.cover_url ?? '', old_width: width })
  }
  console.log(`${data.length} sách: ${sharpCount} bìa ≥ ${SHARP_COVER_WIDTH}px, ${candidates.length} cần tìm bìa, ${skipped.length} bỏ qua.`)
  for (const line of skipped) console.log(`  - ${line}`)
  return candidates
}

class RateLimited extends Error {}

async function fetchOpenLibrary(isbn: string): Promise<{ bytes: Buffer; info: ImageInfo } | null> {
  const res = await fetch(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  })
  if (res.status === 403 || res.status === 429) throw new RateLimited(`HTTP ${res.status}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  try {
    const { format, width, height } = await sharp(bytes).metadata()
    return { bytes, info: { format, width, height } }
  } catch {
    return { bytes, info: {} }
  }
}

async function dryRun() {
  const db = connect()
  const candidates = await findCandidates(db)
  mkdirSync(OL_DIR, { recursive: true })

  const entries: PreviewEntry[] = []
  const base = { reason: null, file: null, width: null, height: null, approved: false, note: null }
  let stoppedAt: number | null = null
  for (const [index, candidate] of candidates.entries()) {
    if (index > 0) await sleep(OPEN_LIBRARY_GAP_MS)
    try {
      const image = await fetchOpenLibrary(candidate.isbn)
      if (!image) {
        entries.push({ ...candidate, ...base, status: 'missing' })
        console.log(`[${index + 1}/${candidates.length}] ${candidate.isbn} không có bìa`)
        continue
      }
      const verdict = judgeOpenLibraryImage(image.info, candidate.old_width)
      const file = `${candidate.isbn}.${image.info.format === 'jpeg' ? 'jpg' : (image.info.format ?? 'bin')}`
      writeFileSync(new URL(file, OL_DIR), image.bytes)
      entries.push({
        ...candidate,
        ...base,
        status: verdict.ok ? 'accepted' : 'rejected',
        reason: verdict.ok ? null : verdict.reason,
        file,
        width: image.info.width ?? null,
        height: image.info.height ?? null,
      })
      console.log(
        `[${index + 1}/${candidates.length}] ${candidate.isbn} ${image.info.width}×${image.info.height} ${verdict.ok ? 'nhận' : `loại (${verdict.reason})`}`,
      )
    } catch (err) {
      if (err instanceof RateLimited) {
        stoppedAt = index
        console.error(`Open Library chặn (${err.message}) → dừng. ${candidates.length - index} sách chưa chạy.`)
        break
      }
      entries.push({ ...candidate, ...base, status: 'error', reason: err instanceof Error ? err.message : String(err) })
      console.warn(`[${index + 1}/${candidates.length}] ${candidate.isbn} lỗi: ${err instanceof Error ? err.message : err}`)
    }
  }

  const path = fileURLToPath(new URL('covers-preview.json', OUT_DIR))
  writeFileSync(`${path}.tmp`, JSON.stringify(entries, null, 2))
  renameSync(`${path}.tmp`, path)
  const accepted = entries.filter((entry) => entry.status === 'accepted')
  console.log(`→ scripts/out/covers-preview.json: ${accepted.length} nhận, ${entries.length - accepted.length} không dùng.`)
  if (stoppedAt !== null) {
    console.log(`Chưa chạy: ${candidates.slice(stoppedAt).map((c) => c.isbn).join(', ')}`)
  }
  await writeGrids(accepted)
}

// ---------- Lưới so sánh "bìa cũ | bìa mới" ----------

const CELL_W = 200
const CELL_H = 300
const CAPTION_H = 44
const PAIRS_PER_ROW = 3
const ROWS_PER_PAGE = 4

function escapeXml(text: string) {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

async function fitCell(input: Buffer | string) {
  return sharp(input)
    .resize({ width: CELL_W, height: CELL_H, fit: 'contain', background: { r: 40, g: 40, b: 40 } })
    .png()
    .toBuffer()
}

async function writeGrids(entries: PreviewEntry[]) {
  const pageSize = PAIRS_PER_ROW * ROWS_PER_PAGE
  const pairW = CELL_W * 2 + 16
  const rowH = CELL_H + CAPTION_H + 16
  for (let page = 0; page * pageSize < entries.length; page++) {
    const slice = entries.slice(page * pageSize, (page + 1) * pageSize)
    const layers: OverlayOptions[] = []
    for (const [i, entry] of slice.entries()) {
      const x = (i % PAIRS_PER_ROW) * (pairW + 24)
      const y = Math.floor(i / PAIRS_PER_ROW) * rowH
      const old = await fetch(entry.old_url).then(async (res) => Buffer.from(await res.arrayBuffer()))
      const fresh = fileURLToPath(new URL(entry.file ?? '', OL_DIR))
      layers.push({ input: await fitCell(old), left: x, top: y })
      layers.push({ input: await fitCell(fresh), left: x + CELL_W + 16, top: y })
      const label = `#${page * pageSize + i} ${entry.old_width}px → ${entry.width}px · ${entry.title.slice(0, 40)}`
      const caption = `<svg xmlns="http://www.w3.org/2000/svg" width="${pairW}" height="${CAPTION_H}"><text x="0" y="18" font-family="Arial" font-size="13" fill="#eee">${escapeXml(label)}</text><text x="0" y="36" font-family="Arial" font-size="12" fill="#aaa">${escapeXml(entry.isbn)}</text></svg>`
      layers.push({ input: Buffer.from(caption), left: x, top: y + CELL_H + 4 })
    }
    const rows = Math.ceil(slice.length / PAIRS_PER_ROW)
    const out = fileURLToPath(new URL(`covers-grid-${page + 1}.png`, OUT_DIR))
    await sharp({
      create: {
        width: PAIRS_PER_ROW * (pairW + 24),
        height: rows * rowH,
        channels: 3,
        background: { r: 20, g: 20, b: 20 },
      },
    })
      .composite(layers)
      .png()
      .toFile(out)
    console.log(`→ ${out}`)
  }
}

// ---------- --openlibrary --apply ----------

async function apply(file: string) {
  const entries = approvedEntries(readCoversPreview(readFileSync(file, 'utf8')))
  console.log(`Ghi ${entries.length} bìa đã duyệt từ ${file} (không gọi Open Library).`)
  const db = connect()
  const storage = db.storage.from(COVER_BUCKET)
  const base = publicBase(db)
  const result = { applied: 0, skipped: [] as string[] }

  for (const entry of entries) {
    const webp = await toCoverWebp(readFileSync(new URL(entry.file ?? '', OL_DIR)))
    if (!webp) {
      result.skipped.push(`${entry.title}: không chuyển được sang WebP`)
      continue
    }
    const path = openLibraryObjectPath(entry.isbn)
    const { error: uploadError } = await storage.upload(path, webp.data, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    })
    if (uploadError) throw new Error(`Storage ${path}: ${uploadError.message}`)

    // Chỉ khi bìa vẫn là bìa lúc dry-run: admin vừa thay bìa thì 0 dòng, không đè
    const { data, error } = await db
      .from('books')
      .update({ cover_url: storage.getPublicUrl(path).data.publicUrl })
      .eq('id', entry.id)
      .eq('cover_url', entry.old_url)
      .select('id')
    if (error || data.length === 0) {
      await storage.remove([path])
      result.skipped.push(`${entry.title}: ${error ? error.message : 'bìa đã đổi sau dry-run'}`)
      continue
    }
    result.applied++

    // Cùng quy tắc với admin: xóa ảnh cũ khi không đơn nào còn trỏ tới (order_items lưu bản sao cover_url)
    const oldPath = storageObjectPath(entry.old_url, base)
    const { count, error: countError } = await db
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('cover_url', entry.old_url)
    if (oldPath && !countError && (count ?? 0) === 0) {
      const { error: removeError } = await storage.remove([oldPath])
      if (removeError) console.warn(`  ⚠ Không xóa được ${oldPath}: ${removeError.message}`)
    }
    console.log(`  ✓ ${entry.title} → ${path} (${webp.width}px)`)
  }
  console.log(`Xong: ${result.applied} bìa mới, ${result.skipped.length} bỏ qua.`)
  for (const line of result.skipped) console.warn(`  - ${line}`)
  if (result.applied > 0) {
    console.log('Bìa mới có hiệu lực ở lần build kế tiếp (cache "hours"); sau migration chạy --measure để ghi cover_width.')
  }
}

// ---------- Main ----------

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  if (i === -1) return undefined
  const value = process.argv[i + 1]
  if (!value || value.startsWith('--')) throw new Error(`${flag} cần một giá trị`)
  return value
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--measure')) return measure()
  if (args.includes('--openlibrary')) {
    const applyFile = argValue('--apply')
    if (applyFile) return apply(applyFile)
    if (args.includes('--dry-run')) return dryRun()
  }
  throw new Error('Dùng: --measure | --openlibrary --dry-run | --openlibrary --apply <file>')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
