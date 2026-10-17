import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Supabase local của e2e (config.toml) dựng DB trống CHỈ từ schema.sql, không chạy migrations/. Test này giữ điều đó
// đúng: mọi thay đổi của từng migration phải có y hệt trong schema.sql.
const dir = import.meta.dirname
const normalize = (sql: string) => sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/** Tách câu lệnh theo `;`, bỏ qua `;` nằm trong thân hàm `$$ … $$` */
function statements(sql: string) {
  const text = sql.replace(/--[^\n]*/g, '')
  const out: string[] = []
  let start = 0
  let inBody = false
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('$$', i)) {
      inBody = !inBody
      i++
    } else if (text[i] === ';' && !inBody) {
      out.push(normalize(text.slice(start, i)))
      start = i + 1
    }
  }
  return out.filter((statement) => statement && statement !== 'begin' && statement !== 'commit')
}

const schemaSql = readFileSync(join(dir, 'schema.sql'), 'utf8')
const schema = statements(schemaSql)
const schemaText = schema.join(';\n')

function createTableBody(table: string) {
  const statement = schema.find((s) => s.startsWith(`create table ${table} (`))
  if (!statement) throw new Error(`schema.sql không có create table ${table}`)
  return statement
}

// Câu lệnh chỉ có nghĩa khi nâng cấp DB cũ, schema.sql thể hiện kết quả theo cách khác (đã kiểm tay)
const UPGRADE_ONLY = new Set([
  // place_order bản 4 tham số (trước idempotency): schema.sql chỉ có bản 6 tham số
  'drop function if exists public.place_order(bigint, public.payment_method, text, text)',
  // đi cặp với create policy ngay sau (đã kiểm ở nhánh create policy)
  'drop policy if exists "book_covers_admin_select" on storage.objects',
  // schema.sql tạo bucket với đúng giá trị này: insert … ('book-covers', …, array['image/webp'], 1048576)
  "update storage.buckets set allowed_mime_types = array['image/webp'], file_size_limit = 1048576 where id = 'book-covers'",
  // PostgREST nạp lại cache schema sau khi đổi chữ ký hàm; DB mới không cần
  "notify pgrst, 'reload schema'",
])

/** Câu lệnh bị migration sau ghi đè (cùng hàm, cùng quyền cột trên một bảng) → chỉ bản cuối phải có trong schema.sql */
function supersedeKey(statement: string) {
  const fn = /^create or replace function ([\w.]+)\(/.exec(statement)
  if (fn) return `function ${fn[1]}`
  const grant = /^grant update \(.*\) on ([\w.]+) to (.+)$/.exec(statement)
  return grant ? `grant ${grant[1]} ${grant[2]}` : null
}

const migrations = readdirSync(join(dir, 'migrations'))
  .filter((file) => file.endsWith('.sql'))
  .sort()
const migrationStatements = migrations.map((file) => ({
  file,
  statements: statements(readFileSync(join(dir, 'migrations', file), 'utf8')),
}))
const lastFile = new Map<string, string>()
for (const { file, statements: list } of migrationStatements) {
  for (const statement of list) {
    const key = supersedeKey(statement)
    if (key) lastFile.set(key, file)
  }
}

describe('schema.sql chứa mọi migration', () => {
  it('có migration để kiểm', () => expect(migrations.length).toBeGreaterThan(0))

  it.each(migrationStatements)('$file', ({ file, statements: list }) => {
    for (const statement of list) {
      if (UPGRADE_ONLY.has(statement)) continue
      const key = supersedeKey(statement)
      if (key && lastFile.get(key) !== file) continue
      const addColumn = /^alter table ([\w.]+) add column if not exists (.+)$/.exec(statement)
      if (addColumn?.[1] && addColumn[2]) {
        expect(createTableBody(addColumn[1]), statement).toContain(addColumn[2])
        continue
      }
      // `if not exists` chỉ cần khi chạy lại trên DB cũ
      expect(schemaText, statement).toContain(statement.replace(' if not exists', ''))
    }
  })

  it('bucket book-covers chỉ nhận webp ≤ 1MB', () => {
    expect(schemaText).toContain("values ('book-covers', 'book-covers', true, array['image/webp'], 1048576)")
  })
})
