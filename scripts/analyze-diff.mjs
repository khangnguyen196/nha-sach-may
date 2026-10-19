// So module JS client trước / sau một thay đổi, từ file JSON Lines của `next analyze export` (có sẵn trong Next 16,
// không cần dependency). measure:js chỉ thấy script tải ngay trong HTML prerender; script này thấy cả chunk tải lười
// (palette ⌘K, khung chat, sheet bộ lọc…) và chỉ ra module nào thêm / bớt / đổi cỡ (docs/plans/perf-js.md, bước 0).
//
//   npx next analyze -o --snapshot before                      # ở commit trước (cần env như build)
//   npx next analyze export --snapshot before > ../before.jsonl  # lưu NGOÀI .next (rm -rf .next sẽ mất snapshot)
//   …sửa code…
//   npx next analyze -o --snapshot after
//   npx next analyze export --snapshot after > ../after.jsonl
//   node scripts/analyze-diff.mjs ../before.jsonl ../after.jsonl --route "/[locale]/books/[slug]"
//
// --route: route nội bộ như trong export (VD "/[locale]", "/[locale]/books", "/[locale]/books/[slug]"); bỏ trống = mọi
// route có trong cả hai file. --all: in cả module không đổi cỡ.
// Cỡ là `compressed_size` của next analyze (ước lượng nén theo từng module), KHÔNG cộng ra đúng số gzip của measure:js;
// dùng để so chênh lệch giữa hai lần đo.
// "tải ngay": chunk nằm trong nhóm bootstrap / render_dependent của route, hoặc không thuộc nhóm nào (VD polyfill
// noModule, measure:js cũng đếm); "tải lười": chỉ nằm trong nhóm async (next/dynamic, import()). Chỉ tính file .js
// client (`[client-fs]/_next/static/…`), bỏ chunk server, font, ảnh.
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const flag = (name) => {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  const value = args[index + 1]
  args.splice(index, 2)
  return value
}
const showAll = args.includes('--all')
if (showAll) args.splice(args.indexOf('--all'), 1)
const onlyRoute = flag('--route')
const [beforePath, afterPath] = args

if (!beforePath || !afterPath) {
  console.error('Cách dùng: node scripts/analyze-diff.mjs <before.jsonl> <after.jsonl> [--route "<route>"] [--all]')
  process.exit(1)
}

const CLIENT = '[client-fs]/_next/static/'
const isClientScript = (filename) => filename.startsWith(CLIENT) && filename.endsWith('.js')

/** route → { modules: Map<module, { initial, lazy }> } (byte nén), chỉ chunk client */
function load(path) {
  const parts = []
  const initialChunks = new Map()
  const lazyChunks = new Map()
  const add = (map, route, chunk) => {
    if (!map.has(route)) map.set(route, new Set())
    map.get(route).add(chunk)
  }
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const record = JSON.parse(line)
    if (record.type === 'part' && isClientScript(record.filename)) parts.push(record)
    if (record.type === 'group') {
      for (const chunk of record.outputs) {
        if (!isClientScript(chunk)) continue
        add(record.kind === 'async' ? lazyChunks : initialChunks, record.route, chunk)
      }
    }
  }

  const routes = new Map()
  for (const part of parts) {
    if (onlyRoute && part.route !== onlyRoute) continue
    if (!routes.has(part.route)) routes.set(part.route, new Map())
    const modules = routes.get(part.route)
    const entry = modules.get(part.source_path) ?? { initial: 0, lazy: 0 }
    // Chunk vừa tải ngay vừa nằm trong nhóm async (dùng chung) → tính là tải ngay
    const initial = initialChunks.get(part.route)?.has(part.filename) || !lazyChunks.get(part.route)?.has(part.filename)
    entry[initial ? 'initial' : 'lazy'] += part.compressed_size
    modules.set(part.source_path, entry)
  }
  return routes
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)}KB`
const signed = (bytes) => `${bytes > 0 ? '+' : ''}${kb(bytes)}`
const short = (source) => source.replace(/^\[project\]\//, '')

const before = load(beforePath)
const after = load(afterPath)
const routes = [...new Set([...before.keys(), ...after.keys()])].filter((route) => before.has(route) && after.has(route))

if (routes.length === 0) {
  console.error(onlyRoute ? `Không có route "${onlyRoute}" trong cả hai file.` : 'Hai file không có route chung.')
  process.exit(1)
}
const onlyOne = [...before.keys(), ...after.keys()].filter((route) => !(before.has(route) && after.has(route)))
if (!onlyRoute && onlyOne.length > 0) console.log(`Bỏ qua route chỉ có ở một file: ${[...new Set(onlyOne)].join(', ')}\n`)

for (const route of routes.sort()) {
  const a = before.get(route)
  const b = after.get(route)
  const rows = []
  const totals = { initial: [0, 0], lazy: [0, 0] }
  for (const source of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(source) ?? { initial: 0, lazy: 0 }
    const y = b.get(source) ?? { initial: 0, lazy: 0 }
    for (const kind of ['initial', 'lazy']) {
      totals[kind][0] += x[kind]
      totals[kind][1] += y[kind]
      const delta = y[kind] - x[kind]
      if (delta === 0 && !showAll) continue
      if (x[kind] === 0 && y[kind] === 0) continue
      const status = x[kind] === 0 ? 'thêm' : y[kind] === 0 ? 'bớt' : delta === 0 ? '' : 'đổi'
      rows.push({ kind, status, source: short(source), before: x[kind], after: y[kind], delta })
    }
  }
  rows.sort((p, q) => Math.abs(q.delta) - Math.abs(p.delta))

  console.log(`== ${route}`)
  for (const kind of ['initial', 'lazy']) {
    const [x, y] = totals[kind]
    console.log(`${kind === 'initial' ? 'Tải ngay' : 'Tải lười'}: ${kb(x)} → ${kb(y)} (${signed(y - x)})`)
  }
  if (rows.length === 0) {
    console.log('Không có module nào đổi.\n')
    continue
  }
  console.table(
    rows.map((row) => ({
      loai: row.kind === 'initial' ? 'ngay' : 'lười',
      '': row.status,
      module: row.source,
      truoc: kb(row.before),
      sau: kb(row.after),
      chenh: signed(row.delta),
    })),
  )
  console.log('')
}
