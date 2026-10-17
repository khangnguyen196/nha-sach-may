/**
 * Nạp sách test vào Supabase local của e2e (sau `npx supabase start`; danh mục + voucher đã có từ seed của config.toml):
 *   npx tsx scripts/e2e-seed.ts
 *
 * - Sách: e2e/fixtures/books.json, 48 cuốn trích từ preview đã duyệt (scripts/out/preview-approved*.json), mô tả cắt
 *   ≤ 300 ký tự, không có URL ảnh. Bất biến mà spec dựa vào (sapiens, > 1 trang lưới, nhóm tồn kho…) kiểm ở
 *   scripts/e2e-seed.test.ts.
 * - Bìa giả sinh bằng sharp (màu theo ISBN) → Storage local, không gọi mạng ngoài, không gọi Google Books.
 * - Ghi qua save() của import-books.ts (cùng đường ghi với dữ liệu thật). Sách đã có (ISBN) bị bỏ qua → chạy lại an toàn.
 * - Chỉ chạy trên Supabase local (loadLocalSupabase từ chối production / host cloud).
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { z } from 'zod'
import { toCoverWebp } from '../src/lib/cover-image'
import { loadLocalSupabase } from './e2e-env'
import {
  bookFieldsSchema,
  ORIGINAL_PRICE_MESSAGE,
  save,
  validOriginalPrice,
  type BookInput,
  type CoverSource,
} from './import-books'

const FIXTURE = new URL('../e2e/fixtures/books.json', import.meta.url)

const fixtureSchema = z.array(
  bookFieldsSchema
    .omit({ cover_small: true, cover_large: true })
    .refine(validOriginalPrice, { message: ORIGINAL_PRICE_MESSAGE }),
)

export function readFixture(): BookInput[] {
  const parsed = fixtureSchema.safeParse(JSON.parse(readFileSync(FIXTURE, 'utf8')))
  if (!parsed.success) throw new Error(`e2e/fixtures/books.json không hợp lệ:\n${z.prettifyError(parsed.error)}`)
  // Bìa do placeholderCover sinh, không tải URL
  return parsed.data.map((book) => ({ ...book, cover_small: '', cover_large: null }))
}

/** Màu tối ổn định theo ISBN (kênh 40–160) */
function color(isbn: string) {
  let hash = 0
  for (const ch of isbn) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return { r: 40 + (hash % 120), g: 40 + ((hash >>> 8) % 120), b: 40 + ((hash >>> 16) % 120) }
}

/** Bìa 600×900 một màu, qua toCoverWebp như ảnh thật */
const placeholderCover: CoverSource = async (book) => {
  const png = await sharp({ create: { width: 600, height: 900, channels: 3, background: color(book.isbn) } })
    .png()
    .toBuffer()
  const webp = await toCoverWebp(png)
  return webp ? { webp, source: 'bìa giả' } : null
}

async function main() {
  const { url } = loadLocalSupabase()
  const books = readFixture()
  console.log(`Nạp ${books.length} sách test vào Supabase local ${url}`)
  await save(books, placeholderCover)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
