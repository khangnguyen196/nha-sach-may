// Đo JS client của một route đã prerender: lấy mọi <script src> trong .next/server/app/<route>.html,
// gzip level 9 từng file (kèm brotli để tham khảo) rồi cộng lại. Chạy sau `npm run build`.
//
//   node scripts/measure-js.mjs vi                     # trang chủ tiếng Việt
//   node scripts/measure-js.mjs en/books/<slug>        # đường dẫn NỘI BỘ (tên thư mục trong app/[locale])
//
// Baseline: app Next 16.4 + React 19.3 trống ≈ 170KB gzip. Ngân sách trong CLAUDE.md tính phần vượt baseline.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const BASELINE_GZIP_KB = 170
const route = (process.argv[2] ?? 'vi').replace(/^\/+|\/+$/g, '')
const htmlPath = join('.next', 'server', 'app', `${route}.html`)

if (!existsSync(htmlPath)) {
  console.error(`Không thấy ${htmlPath}. Chạy \`npm run build\` trước; route phải được prerender (có .html).`)
  process.exit(1)
}

const html = readFileSync(htmlPath, 'utf8')
const sources = [...new Set([...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]))]
const kb = (bytes) => (bytes / 1024).toFixed(1)

let gzipTotal = 0
let brotliTotal = 0
const rows = sources.map((src) => {
  const file = join('.next', src.replace(/^\/_next\//, '').split('?')[0])
  const body = readFileSync(file)
  const gzip = gzipSync(body, { level: 9 }).length
  const brotli = brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length
  gzipTotal += gzip
  brotliTotal += brotli
  return { src, raw: kb(body.length), gzip: kb(gzip), brotli: kb(brotli) }
})

console.table(rows)
console.log(`Route ${route}: ${rows.length} script, ${kb(gzipTotal)}KB gzip, ${kb(brotliTotal)}KB brotli`)
console.log(`Ngoài baseline framework (${BASELINE_GZIP_KB}KB gzip): ${kb(gzipTotal - BASELINE_GZIP_KB * 1024)}KB gzip`)
