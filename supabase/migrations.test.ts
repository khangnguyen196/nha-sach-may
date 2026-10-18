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

// Phase 11: khóa publishable nằm trên trình duyệt nên ai cũng gọi được consume_chat_quota → chỉ token của server web
// mở được bộ đếm; bảng đếm không lộ qua PostgREST
describe('bộ đếm chatbot (Phase 11)', () => {
  const functionBody = (name: string) => {
    const statement = schema.find((s) => s.startsWith(`create or replace function ${name}(`))
    if (!statement) throw new Error(`schema.sql không có hàm ${name}`)
    return statement
  }

  it.each(['private.chat_quota', 'private.chat_settings'])('%s nằm trong private, bật RLS, không policy, không cấp quyền', (table) => {
    expect(createTableBody(table)).toBeTruthy()
    expect(schema).toContain(`alter table ${table} enable row level security`)
    expect(schemaText).not.toMatch(new RegExp(`create policy [^;]* on ${table.replace('.', '\\.')}\\b`))
    expect(schemaText).not.toMatch(new RegExp(`grant [^;]* on (table )?${table.replace('.', '\\.')}\\b`))
  })

  it('consume_chat_quota kiểm token trước khi cộng bộ đếm', () => {
    const body = functionBody('public.consume_chat_quota')
    expect(body).toContain('security definer')
    const tokenCheck = body.indexOf("raise exception 'forbidden'")
    expect(tokenCheck).toBeGreaterThan(-1)
    expect(body.indexOf('private.chat_quota_take(')).toBeGreaterThan(tokenCheck)
  })

  it('set_chat_quota_token chỉ service_role; consume_chat_quota cho anon + authenticated', () => {
    expect(schema).toContain('revoke execute on function public.set_chat_quota_token(text) from public, anon, authenticated')
    expect(schema).toContain('grant execute on function public.set_chat_quota_token(text) to service_role')
    expect(schemaText).not.toMatch(/grant execute on function public\.set_chat_quota_token\(text\) to [^;]*\b(anon|authenticated)\b/)
    expect(schema).toContain('grant execute on function public.consume_chat_quota(text, text, text, jsonb) to anon, authenticated')
  })

  it('cửa sổ ngày của trần chung theo America/Los_Angeles (Google reset RPD lúc 0h giờ Thái Bình Dương)', () => {
    const body = functionBody('public.consume_chat_quota')
    expect(body).toContain("date_trunc('day', v_now at time zone 'america/los_angeles')")
    expect(body).toMatch(/'gemini:day', v_la_day at time zone 'america\/los_angeles'/)
  })
})
