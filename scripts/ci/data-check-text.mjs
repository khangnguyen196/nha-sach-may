// data-check (d): kiểm chữ của file SQL dữ liệu (không cần DB). Dùng: node scripts/ci/data-check-text.mjs [--json <ra>] <file>...
// Mọi chuỗi giữa $mota$…$mota$: NFC, không ký tự ẩn / điều khiển (trừ LF), không CR, không chứa $$ hay $mota$, không
// khoảng trắng thừa đầu / cuối, không rỗng. Mỗi câu UPDATE có cùng số chuỗi (K ≥ 1) → số lần $mota$ = 2 × K × số câu
// (vòng 3: K = 1); mỗi id đúng một câu (`where id = N`). Chỉ in id + loại lỗi, KHÔNG in nội dung (log CI công khai).
// --json: ghi { "<file>": { "updates": n, "ids": [...] } } cho data-check.sh.
import { readFileSync, writeFileSync } from 'node:fs'

const DELIMITER = '$mota$'
const HIDDEN = new Map([
  ['​', 'U+200B'],
  ['‌', 'U+200C'],
  ['‍', 'U+200D'],
  ['﻿', 'U+FEFF'],
  [' ', 'U+00A0'],
  [' ', 'U+202F'],
  ['⁠', 'U+2060'],
])
// C0 trừ LF (CR báo riêng), DEL, C1
const CONTROL = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/u

function stringProblems(text) {
  const problems = []
  if (text.length === 0) problems.push('chuỗi rỗng')
  if (text !== text.normalize('NFC')) problems.push('không NFC')
  for (const [char, name] of HIDDEN) if (text.includes(char)) problems.push(`ký tự ẩn ${name}`)
  if (text.includes('\r')) problems.push('có CR')
  if (CONTROL.test(text)) problems.push('ký tự điều khiển')
  if (text.includes('$$')) problems.push('chứa $$')
  if (text.includes('$mota')) problems.push('chứa $mota')
  if (/^\s|\s$/u.test(text)) problems.push('khoảng trắng thừa đầu / cuối')
  return problems
}

function checkSql(sql) {
  const errors = []
  const parts = sql.split(DELIMITER)
  if (parts.length % 2 === 0) {
    return { errors: ['số lần $mota$ lẻ (thiếu dấu đóng)'], updates: 0, ids: [], perStatement: 0, delimiters: parts.length - 1 }
  }
  // Ngoài chuỗi: thay mỗi chuỗi bằng dấu giữ chỗ để tách câu không bị chữ trong mô tả đánh lừa, rồi bỏ comment `--`
  const strings = parts.filter((_, i) => i % 2 === 1)
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
