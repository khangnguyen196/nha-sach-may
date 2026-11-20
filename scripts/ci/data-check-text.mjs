// data-check (d): kiểm chữ của file SQL dữ liệu (không cần DB). Dùng: node scripts/ci/data-check-text.mjs [--json <ra>] <file>...
// Mọi chuỗi giữa $mota$…$mota$: NFC, không ký tự ẩn (mọi \p{Cf}, \p{Zl}, \p{Zp}, \p{Zs} khác U+0020), không ký tự điều
// khiển (\p{Cc}) trừ LF, không CR, không chứa $$ hay $mota$, không khoảng trắng thừa đầu / cuối, không rỗng. Phần code
// ngoài chuỗi: không \p{Cf} / \p{Zl} / \p{Zp} (VD U+202E đảo chiều làm câu SQL đọc khác chạy). Mỗi câu UPDATE có cùng số
// chuỗi (K ≥ 1) → số lần $mota$ = 2 × K × số câu (vòng 3: K = 1); mỗi id đúng một câu (`where id = N`). Khối
// `do $$ … $$;` kiểm cả lô: tập id trong `id in (…)` = tập id các câu UPDATE của CHÍNH file, số so sánh (`<> N`, `!= N`,
// `is distinct from N`) = số câu. Chỉ in id + loại lỗi, KHÔNG in nội dung (log CI công khai).
// --json: ghi { "<file>": { "updates": n, "ids": [...] } } cho data-check.sh.
// Ký tự đặc biệt chỉ viết dạng escape \u…: không để ký tự ẩn thật trong mã nguồn.
import { readFileSync, writeFileSync } from 'node:fs'

const DELIMITER = '$mota$'
const INVISIBLE = /[\p{Cf}\p{Zl}\p{Zp}]/u
const SPACE_SEPARATOR = /\p{Zs}/u
const CONTROL = /\p{Cc}/u

function codePoint(char) {
  return `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`
}

// Mã các ký tự ẩn / điều khiển trong chuỗi mô tả (LF được phép, CR báo riêng)
function hiddenInString(text) {
  const found = new Set()
  for (const char of text) {
    if (char === '\n' || char === '\r') continue
    if (INVISIBLE.test(char) || CONTROL.test(char) || (SPACE_SEPARATOR.test(char) && char !== ' ')) found.add(codePoint(char))
  }
  return [...found]
}

function hiddenInCode(text) {
  const found = new Set()
  for (const char of text) if (INVISIBLE.test(char)) found.add(codePoint(char))
  return [...found]
}

function stringProblems(text) {
  const problems = []
  if (text.length === 0) problems.push('chuỗi rỗng')
  if (text !== text.normalize('NFC')) problems.push('không NFC')
  for (const name of hiddenInString(text)) problems.push(`ký tự ẩn / điều khiển ${name}`)
  if (text.includes('\r')) problems.push('có CR')
  if (text.includes('$$')) problems.push('chứa $$')
  if (text.includes('$mota')) problems.push('chứa $mota')
  if (/^\s|\s$/u.test(text)) problems.push('khoảng trắng thừa đầu / cuối')
  return problems
}

// Khối `do $$ … $$;` (code đã thay chuỗi + bỏ comment): id trong `id in (…)` và số so sánh phải khớp file
function doBlockProblems(code, ids) {
  const errors = []
  const blocks = [...code.matchAll(/\bdo\s+\$\$([\s\S]*?)\$\$\s*;/gi)].map((m) => m[1])
  if (blocks.length === 0) return ['không có khối "do $$ … $$;" kiểm cả lô']
  const expected = [...new Set(ids)].sort((a, b) => a - b).join(',')
  let checked = 0
  blocks.forEach((block, i) => {
    const lists = [...block.matchAll(/\bid\s+in\s*\(([^)]*)\)/gi)].map((m) => m[1])
    if (lists.length === 0) return
    checked++
    for (const list of lists) {
      const tokens = list.split(',').map((token) => token.trim())
      if (!tokens.every((token) => /^\d+$/.test(token))) {
        errors.push(`khối do $$ thứ ${i + 1}: "id in (…)" có phần tử không phải số`)
        continue
      }
      const numbers = tokens.map(Number)
      if (new Set(numbers).size !== numbers.length) errors.push(`khối do $$ thứ ${i + 1}: "id in (…)" có id lặp`)
      const got = [...new Set(numbers)].sort((a, b) => a - b).join(',')
      if (got !== expected) {
        const missing = ids.filter((id) => !numbers.includes(id))
        const extra = numbers.filter((id) => !ids.includes(id))
        errors.push(
          `khối do $$ thứ ${i + 1}: id khác các câu UPDATE của file (thiếu: ${missing.join(', ') || 'không'}; thừa: ${extra.join(', ') || 'không'})`,
        )
      }
    }
    const comparisons = [...block.matchAll(/(?:<>|!=|\bis\s+distinct\s+from)\s*(\d+)/gi)].map((m) => Number(m[1]))
    if (comparisons.length === 0) errors.push(`khối do $$ thứ ${i + 1}: không có so sánh "<> N" với số câu`)
    for (const value of comparisons) {
      if (value !== ids.length) errors.push(`khối do $$ thứ ${i + 1}: so với ${value}, file có ${ids.length} câu UPDATE`)
    }
  })
  if (checked === 0) errors.push('không khối do $$ nào có "id in (…)"')
  return errors
}

function checkSql(sql) {
  const errors = []
  const parts = sql.split(DELIMITER)
  if (parts.length % 2 === 0) {
    return { errors: ['số lần $mota$ lẻ (thiếu dấu đóng)'], updates: 0, ids: [], perStatement: 0, delimiters: parts.length - 1 }
  }
  // Ngoài chuỗi: thay mỗi chuỗi bằng dấu giữ chỗ để tách câu không bị chữ trong mô tả đánh lừa, rồi bỏ comment `--`
  const strings = parts.filter((_, i) => i % 2 === 1)
  const codeParts = parts.filter((_, i) => i % 2 === 0)
  for (const name of hiddenInCode(codeParts.join(''))) errors.push(`ký tự ẩn ${name} ngoài chuỗi $mota$ (code / comment)`)
  const outside = parts.map((part, i) => (i % 2 === 1 ? `\u0000S${(i - 1) / 2}\u0000` : part)).join('')
  const code = outside.replace(/--[^\n]*/g, '')
  const starts = [...code.matchAll(/^\s*update\s/gim)].map((m) => m.index)
  const statements = starts.map((start, i) => code.slice(start, starts[i + 1] ?? code.length))
  const ids = []
  const counts = new Set()
  statements.forEach((statement, i) => {
    const idMatches = [...statement.matchAll(/\bwhere\s+id\s*=\s*(\d+)\b/gi)].map((m) => Number(m[1]))
    const stringIndexes = [...statement.matchAll(/\u0000S(\d+)\u0000/g)].map((m) => Number(m[1]))
    if (idMatches.length !== 1) {
      errors.push(`câu UPDATE thứ ${i + 1}: ${idMatches.length} điều kiện "where id = N" (cần đúng 1)`)
      return
    }
    const id = idMatches[0]
    ids.push(id)
    counts.add(stringIndexes.length)
    if (stringIndexes.length === 0) errors.push(`id ${id}: câu không có chuỗi $mota$`)
    for (const index of stringIndexes) {
      for (const problem of stringProblems(strings[index])) errors.push(`id ${id}: ${problem}`)
    }
  })
  // Chuỗi nằm ngoài mọi câu UPDATE (VD trước câu đầu): vẫn kiểm, báo theo số thứ tự
  const firstStart = starts[0] ?? code.length
  for (const m of code.slice(0, firstStart).matchAll(/\u0000S(\d+)\u0000/g)) {
    errors.push(`chuỗi $mota$ thứ ${Number(m[1]) + 1} nằm ngoài câu UPDATE`)
  }
  if (statements.length === 0) errors.push('không có câu UPDATE nào')
  const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]
  if (duplicates.length > 0) errors.push(`id có nhiều hơn một câu: ${duplicates.join(', ')}`)
  if (counts.size > 1) errors.push(`số chuỗi $mota$ mỗi câu không đều: ${[...counts].sort().join(' / ')}`)
  const perStatement = counts.size === 1 ? [...counts][0] : 0
  const delimiters = parts.length - 1
  if (perStatement > 0 && delimiters !== 2 * perStatement * statements.length) {
    errors.push(`số lần $mota$ = ${delimiters}, cần 2 × ${perStatement} × ${statements.length}`)
  }
  if (ids.length > 0) errors.push(...doBlockProblems(code, ids))
  return { errors, updates: statements.length, ids, perStatement, delimiters }
}

function main(argv) {
  let jsonOut = null
  const files = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') jsonOut = argv[++i]
    else files.push(argv[i])
  }
  if (files.length === 0) {
    console.error('dùng: node scripts/ci/data-check-text.mjs [--json <ra>] <file>...')
    return 2
  }
  let failed = false
  const report = {}
  for (const file of files) {
    const result = checkSql(readFileSync(file, 'utf8'))
    report[file] = { updates: result.updates, ids: result.ids }
    console.log(
      `${file}: ${result.updates} câu UPDATE, ${result.delimiters} lần $mota$, ${result.perStatement} chuỗi / câu, ${result.errors.length} lỗi`,
    )
    for (const error of result.errors) console.log(`::error::(d) ${file}: ${error}`)
    if (result.errors.length > 0) failed = true
  }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report))
  return failed ? 1 : 0
}

process.exitCode = main(process.argv.slice(2))
