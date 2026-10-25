import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHAT_LIMITS, WARNING_LIMITS } from '../src/features/chat/config'

// Cảnh báo nội dung + chặn theo sở thích (mục 16 của schema.sql, docs/plans/so-thich-canh-bao.md). Kiểm tĩnh quyền và
// phần đếm chung với Mây (quyết định chủ dự án 2026-10-25, câu 5): gợi ý cảnh báo dùng cùng khóa + model với Mây nên
// mỗi lượt phải cộng vào bucket chung gemini:minute / gemini:day, với ngưỡng chừa cho Mây là hằng cứng trong SQL.
// Kịch bản đếm thật (lượt 31 / 61 bị chặn, gemini:day = 300 thì gợi ý bị chặn còn Mây vẫn qua) chạy trên Postgres
// local lúc cắt SQL, không chạy e2e (ăn hết warn:day trên DB của CI làm đỏ test khác chạy cùng lượt).
const schemaSql = readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8')
const migrationSql = readFileSync(join(import.meta.dirname, 'migrations', '20261025000000_prefs_warnings.sql'), 'utf8')
/** Văn bản gốc: bỏ comment, gộp khoảng trắng, GIỮ chữ hoa / thường (chuỗi so trong PL/pgSQL phân biệt hoa thường) */
const raw = (sql: string) => sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ')
const normalize = (sql: string) => raw(sql).toLowerCase()
const schema = normalize(schemaSql)
const migration = normalize(migrationSql)

/** Mục 16 (tới khối chú thích cuối file), văn bản gốc */
const sectionSql = (() => {
  const start = schemaSql.indexOf('-- 16. CẢNH BÁO NỘI DUNG')
  const end = schemaSql.indexOf('-- RPC cho app', start)
  if (start < 0 || end < 0) throw new Error('schema.sql không có mục 16')
  return schemaSql.slice(start, end)
})()
const section = normalize(sectionSql)

function functionStatement(name: string, text = schema) {
  const start = text.indexOf(`create or replace function ${name}(`)
  if (start < 0) throw new Error(`${text === schema ? 'schema.sql' : 'nguồn SQL'} không có hàm ${name}`)
  const bodyStart = text.indexOf('$$', start)
  const bodyEnd = text.indexOf('$$', bodyStart + 2)
  return text.slice(start, bodyEnd + 2)
}

/** Câu `chat_quota_take('<bucket>', …)` trong một thân hàm, tới hết tham số scope */
function quotaTake(body: string, bucket: string) {
  const start = body.indexOf(`chat_quota_take('${bucket}',`)
  if (start < 0) throw new Error(`không có chat_quota_take('${bucket}')`)
  const end = body.indexOf(';', start)
  return { start, text: body.slice(start, end < 0 ? undefined : end) }
}

/** Tách danh sách quyền theo dấu phẩy nằm ngoài ngoặc: `select, insert (a, b)` → `select`, `insert (a, b)` */
function splitPrivileges(list: string) {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < list.length; i++) {
    if (list[i] === '(') depth++
    else if (list[i] === ')') depth--
    else if (list[i] === ',' && depth === 0) {
      out.push(list.slice(start, i).trim())
      start = i + 1
    }
  }
  out.push(list.slice(start).trim())
  return out
}

/**
 * Mọi quyền bảng cấp trong schema.sql, dạng `<người nhận>: <quyền>`. So bằng cả danh sách nên bắt được mọi câu grant
 * thêm vào sau: `grant all`, `grant insert` cả bảng (không kèm danh sách cột), `grant update` / `delete`, cấp cho anon…
 */
function tableGrants(table: string) {
  const pattern = new RegExp(`grant ([^;]*?) on (?:table )?${table.replace('.', '\\.')} to ([^;]*)`, 'g')
  return [...schema.matchAll(pattern)]
    .flatMap((m) => {
      const grantees = (m[2] ?? '').split(',').map((grantee) => grantee.trim())
      return splitPrivileges(m[1] ?? '').flatMap((privilege) => grantees.map((grantee) => `${grantee}: ${privilege}`))
    })
    .sort()
}

const ADMIN_RPCS = ['public.consume_warning_quota', 'public.review_warning_suggestion'] as const
const GRANTS = {
  'public.consume_warning_quota': 'public.consume_warning_quota(jsonb)',
  'public.review_warning_suggestion':
    'public.review_warning_suggestion(bigint, public.content_warning[], boolean, timestamptz)',
} as const

describe('consume_warning_quota: đếm chung với Mây', () => {
  const body = functionStatement('public.consume_warning_quota')

  it('cộng warn:minute, warn:day rồi bucket chung gemini:minute, gemini:day (đúng thứ tự)', () => {
    const order = ['warn:minute', 'warn:day', 'gemini:minute', 'gemini:day'].map((bucket) => quotaTake(body, bucket).start)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('mỗi bucket báo WARNING_QUOTA_EXCEEDED với scope riêng', () => {
    const scopes = { 'warn:minute': 'warn_minute', 'warn:day': 'warn_day', 'gemini:minute': 'gemini_minute', 'gemini:day': 'chat_reserve' }
    for (const [bucket, scope] of Object.entries(scopes)) {
      expect(quotaTake(body, bucket).text).toContain(`'warning_quota_exceeded', '${scope}'`)
    }
  })

  it('gemini:day dùng ngưỡng cứng private.warning_gemini_day_ceiling(), không lấy từ p_limits', () => {
    const geminiDay = quotaTake(body, 'gemini:day').text
    expect(geminiDay).toContain('private.warning_gemini_day_ceiling()')
    expect(geminiDay).not.toContain('p_limits')
    expect(body).not.toMatch(/p_limits ->>? 'geminicallsperday'/)
  })

  it('cửa sổ ngày theo America/Los_Angeles như consume_chat_quota (cùng window_start của gemini:day)', () => {
    expect(body).toContain("date_trunc('day', v_now at time zone 'america/los_angeles')")
    expect(quotaTake(body, 'gemini:day').text).toContain("v_la_day at time zone 'america/los_angeles'")
    expect(functionStatement('public.consume_chat_quota')).toMatch(/'gemini:day', v_la_day at time zone 'america\/los_angeles'/)
  })

  it('ngưỡng chừa cho Mây = CHAT_LIMITS.geminiCallsPerDay − WARNING_LIMITS.chatReserve (300)', () => {
    const value = /as \$\$ select (\d+) \$\$/.exec(functionStatement('private.warning_gemini_day_ceiling'))?.[1]
    expect(Number(value)).toBe(CHAT_LIMITS.geminiCallsPerDay - WARNING_LIMITS.chatReserve)
    expect(Number(value)).toBe(300)
    expect(schema).toContain(
      'revoke execute on function private.warning_gemini_day_ceiling() from public, anon, authenticated',
    )
  })

  it('cận trên warnCallsPerDay trong SQL = WARNING_LIMITS.hardCallsPerDay (60)', () => {
    const value = /when 'warncallsperday' then (\d+)/.exec(body)?.[1]
    expect(Number(value)).toBe(WARNING_LIMITS.hardCallsPerDay)
    expect(Number(value)).toBe(60)
  })

  it('kiểm admin trước khi cộng bộ đếm', () => {
    const forbidden = body.indexOf("raise exception 'forbidden'")
    expect(forbidden).toBeGreaterThan(-1)
    expect(body.indexOf('chat_quota_take(')).toBeGreaterThan(forbidden)
  })

  // e2e không đọc được private.chat_quota (PostgREST không lộ schema private) → không kiểm được "tham số sai không đổi
  // bucket" ở đó. Exception nào cũng rollback cả lời gọi; giữ thêm thứ tự: mọi INVALID_INPUT nằm trước lần cộng đầu tiên
  it.each([
    ['schema.sql', schema],
    ['migration', migration],
  ] as const)('%s: kiểm tham số (INVALID_INPUT) trước khi cộng bộ đếm', (_, text) => {
    const fn = functionStatement('public.consume_warning_quota', text)
    const raises = [...fn.matchAll(/raise exception 'invalid_input'/g)].map((m) => m.index)
    expect(raises).toHaveLength(2)
    const firstTake = fn.indexOf('chat_quota_take(')
    expect(firstTake).toBeGreaterThan(-1)
    for (const index of raises) expect(index).toBeLessThan(firstTake)
  })
})

describe('RPC admin của mục 16', () => {
  it.each(ADMIN_RPCS)('%s: security definer, không phải admin → FORBIDDEN, chỉ authenticated gọi được', (name) => {
    const body = functionStatement(name)
    expect(body).toContain('security definer')
    expect(body).toContain("if not (select public.is_admin()) then raise exception 'forbidden'")
    expect(schema).toContain(`revoke execute on function ${GRANTS[name]} from public, anon`)
    expect(schema).toContain(`grant execute on function ${GRANTS[name]} to authenticated`)
    const escaped = GRANTS[name].replace(/[.()[\]]/g, '\\$&')
    expect(schema).not.toMatch(new RegExp(`grant execute on function ${escaped} to [^;]*\\b(anon|public)\\b`))
  })

  it('review_warning_suggestion: khóa dòng, chỉ gợi ý pending, lệch → SUGGESTION_STATUS_CHANGED', () => {
    const body = functionStatement('public.review_warning_suggestion')
    expect(body).toContain('from public.content_warning_suggestions s where s.id = p_id for update;')
    expect(body).toContain("if not found or v_status <> 'pending' then raise exception 'suggestion_status_changed'")
  })

  it('review_warning_suggestion: không ghi đè nhãn admin vừa sửa tay (so content_warnings_reviewed_at, không updated_at)', () => {
    const body = functionStatement('public.review_warning_suggestion')
    expect(body).toContain('p_approve boolean, p_expected_reviewed_at timestamptz )')
    const lockSuggestion = body.indexOf('from public.content_warning_suggestions s where s.id = p_id for update')
    // Sách khóa for no key update (không chặn FOR KEY SHARE của khóa ngoại cart_items / order_items); gợi ý for update
    const lockBook = body.indexOf(
      'select b.content_warnings_reviewed_at into v_reviewed_at from public.books b where b.id = v_book_id for no key update;',
    )
    const compare = body.indexOf(
      "if v_reviewed_at is distinct from p_expected_reviewed_at then raise exception 'suggestion_status_changed'",
    )
    // Khóa gợi ý → khóa sách → so, trước khi rẽ nhánh duyệt / bỏ qua (áp cho cả hai)
    expect(lockSuggestion).toBeGreaterThan(-1)
    expect(lockBook).toBeGreaterThan(lockSuggestion)
    expect(compare).toBeGreaterThan(lockBook)
    expect(body.indexOf('if p_approve then')).toBeGreaterThan(compare)
    expect(body).not.toContain('updated_at')
  })
})

describe('user_blocks: chỉ chủ tài khoản', () => {
  const policies = [...section.matchAll(/create policy "[^"]+" on public\.user_blocks ([^;]*)/g)].map((m) => m[1] ?? '')

  it('RLS bật; select / insert / delete theo auth.uid(), không update, không admin / anon', () => {
    expect(section).toContain('alter table public.user_blocks enable row level security')
    expect(policies.map((policy) => /^for (\w+)/.exec(policy)?.[1]).sort()).toEqual(['delete', 'insert', 'select'])
    for (const policy of policies) {
      expect(policy).toMatch(/^for \w+ to authenticated (using|with check) \(user_id = \(select auth\.uid\(\)\)\)$/)
      expect(policy).not.toContain('is_admin')
    }
  })

  it('quyền: không update; insert không có user_id (luôn default auth.uid())', () => {
    expect(section).toContain('revoke all on table public.user_blocks from anon, authenticated')
    expect(section).toContain('grant select, delete on public.user_blocks to authenticated')
    expect(section).toContain(
      'grant insert (kind, category_id, author_id, publisher_id, warning) on public.user_blocks to authenticated',
    )
    expect(schema).not.toMatch(/grant [^;]*\bupdate\b[^;]* on (table )?public\.user_blocks\b/)
    expect(schema).not.toMatch(/grant [^;]* on (table )?public\.user_blocks to [^;]*\banon\b/)
  })

  it('≤ 50 mục / tài khoản, khóa theo user trước khi đếm', () => {
    expect(functionStatement('private.user_blocks_limit')).toContain('as $$ select 50 $$')
    const body = functionStatement('private.user_blocks_check_limit')
    const lock = body.indexOf('pg_advisory_xact_lock(')
    expect(lock).toBeGreaterThan(-1)
    expect(body.indexOf('count(*)')).toBeGreaterThan(lock)
    expect(body).toContain("raise exception 'prefs_limit'")
    expect(section).toContain(
      'create trigger user_blocks_check_limit before insert on public.user_blocks for each row execute function private.user_blocks_check_limit()',
    )
  })

  it('đúng 3 quyền bảng cho authenticated: select, delete, insert theo cột (không all / update / insert cả bảng / anon)', () => {
    expect(tableGrants('public.user_blocks')).toEqual([
      'authenticated: delete',
      'authenticated: insert (kind, category_id, author_id, publisher_id, warning)',
      'authenticated: select',
    ])
  })

  it('chống trùng bằng unique index theo từng kind', () => {
    for (const [kind, column] of [['category', 'category_id'], ['author', 'author_id'], ['publisher', 'publisher_id'], ['warning', 'warning']]) {
      expect(section).toMatch(new RegExp(`create unique index \\w+ on public\\.user_blocks \\(user_id, ${column}\\) where kind = '${kind}'`))
    }
  })
})

describe('content_warning_suggestions: chỉ admin, đổi trạng thái qua RPC', () => {
  it('RLS bật; chỉ policy select / insert cho admin', () => {
    expect(section).toContain('alter table public.content_warning_suggestions enable row level security')
    const policies = [...section.matchAll(/create policy "[^"]+" on public\.content_warning_suggestions ([^;]*)/g)].map((m) => m[1] ?? '')
    expect(policies).toEqual([
      'for select to authenticated using ((select public.is_admin()))',
      'for insert to authenticated with check ((select public.is_admin()))',
    ])
  })

  it('authenticated không có update / delete; anon không có quyền gì', () => {
    expect(section).toContain('revoke all on table public.content_warning_suggestions from anon, authenticated')
    expect(section).toContain('grant insert (book_id, labels, reason, model) on public.content_warning_suggestions to authenticated')
    expect(schema).not.toMatch(/grant [^;]*\b(update|delete|all)\b[^;]* on (table )?public\.content_warning_suggestions\b/)
    expect(schema).not.toMatch(/grant [^;]* on (table )?public\.content_warning_suggestions to [^;]*\banon\b/)
  })

  it('đúng 2 quyền bảng cho authenticated: select, insert theo cột (không all / update / delete / insert cả bảng / anon)', () => {
    expect(tableGrants('public.content_warning_suggestions')).toEqual([
      'authenticated: insert (book_id, labels, reason, model)',
      'authenticated: select',
    ])
  })

  it('trigger chuẩn hóa nhãn chạy cả khi insert lẫn update cột labels', () => {
    expect(section).toContain(
      'create trigger content_warning_suggestions_labels before insert or update of labels on public.content_warning_suggestions for each row execute function private.content_warning_suggestions_normalize_labels()',
    )
  })

  it('một gợi ý pending / sách', () => {
    expect(section).toMatch(/create unique index \w+ on public\.content_warning_suggestions \(book_id\) where status = 'pending'/)
  })
})

describe('nhãn trên sách', () => {
  it('check của books không gọi hàm private (admin sửa sách bằng authenticated); trigger chuẩn hóa là security definer', () => {
    const check = /constraint books_content_warnings_check check \(([^;]*?)\), content_warnings_reviewed_at/.exec(schema)?.[1]
    expect(check).toBe('cardinality(content_warnings) <= 5 and array_position(content_warnings, null) is null')
    expect(functionStatement('private.books_normalize_content_warnings')).toContain('security definer')
    expect(functionStatement('private.content_warning_suggestions_normalize_labels')).toContain('security definer')
  })

  it('trigger chuẩn hóa nhãn chạy cả khi insert lẫn update cột content_warnings', () => {
    expect(section).toContain(
      'create trigger books_content_warnings before insert or update of content_warnings on public.books for each row execute function private.books_normalize_content_warnings()',
    )
  })

  it('có nhãn thì phải đã xét: check books_content_warnings_reviewed_check ở cả schema.sql lẫn migration', () => {
    const statement =
      'alter table public.books add constraint books_content_warnings_reviewed_check check (cardinality(content_warnings) = 0 or content_warnings_reviewed_at is not null)'
    expect(schema).toContain(statement)
    expect(migration).toContain(statement)
  })

  it('admin sửa được 2 cột mới', () => {
    expect(schema).toMatch(/grant update \([^)]*\bcontent_warnings, content_warnings_reviewed_at \) on public\.books to authenticated/)
  })
})

// "Có nhãn ⇒ đã xét" và thời điểm xét do DB giữ (trigger), không dựa vào form admin: form quên gửi reviewed_at thì
// review_warning_suggestion vẫn thấy lệch, không đè nhãn vừa sửa tay.
describe('trigger books_content_warnings: DB tự ghi content_warnings_reviewed_at khi nhãn đổi', () => {
  const name = 'private.books_normalize_content_warnings'
  const sources = [
    ['schema.sql', functionStatement(name)],
    ['migration', functionStatement(name, migration)],
  ] as const

  it.each(sources)('%s: insert có nhãn mà reviewed_at null → now()', (_, body) => {
    expect(body).toContain(
      "if tg_op = 'insert' then if cardinality(new.content_warnings) > 0 and new.content_warnings_reviewed_at is null then new.content_warnings_reviewed_at := now(); end if;",
    )
  })

  it.each(sources)('%s: update đổi nhãn (is distinct from) mà không đổi reviewed_at → now(); gửi reviewed_at khác thì giữ', (_, body) => {
    expect(body).toContain(
      'elsif new.content_warnings is distinct from old.content_warnings and new.content_warnings_reviewed_at is not distinct from old.content_warnings_reviewed_at then new.content_warnings_reviewed_at := now(); end if;',
    )
  })

  it.each(sources)('%s: chuẩn hóa nhãn TRƯỚC khi so (khác thứ tự không tính là đổi)', (_, body) => {
    const sorted = body.indexOf('new.content_warnings := private.content_warnings_sorted(new.content_warnings);')
    expect(sorted).toBeGreaterThan(-1)
    expect(body.indexOf("if tg_op = 'insert'")).toBeGreaterThan(sorted)
    expect(body.indexOf('new.content_warnings is distinct from old.content_warnings')).toBeGreaterThan(sorted)
  })

  it('schema.sql và migration giống hệt', () => {
    expect(sources[1][1]).toBe(sources[0][1])
  })
})

// Các test trên so văn bản đã hạ chữ thường → không thấy lỗi viết nhầm chữ thường trong chuỗi: tg_op = 'insert' không
// bao giờ đúng (TG_OP luôn 'INSERT') → nhánh insert không chạy, sách mới có nhãn thiếu reviewed_at; mã lỗi viết
// thường thì app không map được sang errors.<CODE>. Kiểm trên văn bản gốc.
describe('chuỗi trong SQL giữ đúng chữ hoa / thường', () => {
  const rawSources = [
    ['schema.sql', raw(schemaSql)],
    ['migration', raw(migrationSql)],
  ] as const
  // Phạm vi quét "mọi chỗ": schema.sql chỉ mục 16 (mục khác có mã / tg_op riêng), migration cả file
  const rawParts = [
    ['schema.sql (mục 16)', raw(sectionSql)],
    ['migration (cả file)', raw(migrationSql)],
  ] as const

  it.each(rawSources)("%s: trigger books_content_warnings so tg_op = 'INSERT'", (_, text) => {
    expect(functionStatement('private.books_normalize_content_warnings', text)).toContain("if tg_op = 'INSERT' then")
  })

  it.each(rawSources)('%s: mã lỗi viết hoa', (_, text) => {
    expect(text).toContain("raise exception 'PREFS_LIMIT'")
    expect(text).toContain("raise exception 'SUGGESTION_STATUS_CHANGED'")
    expect(text).toContain("'WARNING_QUOTA_EXCEEDED', 'warn_minute'")
    expect(text).toContain("'WARNING_QUOTA_EXCEEDED', 'warn_day'")
    expect(text).toContain("'WARNING_QUOTA_EXCEEDED', 'gemini_minute'")
    expect(text).toContain("'WARNING_QUOTA_EXCEEDED', 'chat_reserve'")
  })

  /**
   * Mọi chuỗi đem so với tg_op, có / không dấu cách: `tg_op = 'X'` (cả <>, !=), `'X' = tg_op`, `tg_op [not] in ('X', 'Y')`
   * (mọi phần tử), `case tg_op when 'X'` (when đầu tiên)
   */
  const tgOpLiterals = (text: string) => [
    ...[...text.matchAll(/tg_op\s*(?:=|<>|!=)\s*'(\w+)'/gi)].map((m) => m[1]),
    ...[...text.matchAll(/'(\w+)'\s*(?:=|<>|!=)\s*tg_op\b/gi)].map((m) => m[1]),
    ...[...text.matchAll(/tg_op\s+(?:not\s+)?in\s*\(([^)]*)\)/gi)].flatMap((m) =>
      [...(m[1] ?? '').matchAll(/'(\w+)'/g)].map((literal) => literal[1]),
    ),
    ...[...text.matchAll(/case\s+tg_op\s+when\s+'(\w+)'/gi)].map((m) => m[1]),
  ]

  // toContain chỉ cần một chỗ đúng; mã xuất hiện nhiều lần (SUGGESTION_STATUS_CHANGED 2 lần, FORBIDDEN, INVALID_INPUT…)
  // thì mọi chỗ trong phạm vi quét đều phải viết hoa
  it.each(rawParts)('%s: mọi chỗ nhắc mã lỗi / tg_op đều viết hoa', (_, part) => {
    const codes = ['PREFS_LIMIT', 'SUGGESTION_STATUS_CHANGED', 'WARNING_QUOTA_EXCEEDED', 'FORBIDDEN', 'INVALID_INPUT']
    for (const code of codes) {
      const found = [...part.matchAll(new RegExp(`'${code}'`, 'gi'))].map((m) => m[0])
      expect(found.length).toBeGreaterThan(0)
      expect(found).toEqual(found.map(() => `'${code}'`))
    }
    expect(tgOpLiterals(part)).toEqual(['INSERT'])
  })

  it('tgOpLiterals bắt =, <>, !=, so ngược, mọi phần tử của [not] in (…), when đầu tiên của case tg_op', () => {
    expect(tgOpLiterals("if tg_op='insert' then")).toEqual(['insert'])
    expect(tgOpLiterals("if tg_op <> 'UPDATE' or 'delete' = tg_op then")).toEqual(['UPDATE', 'delete'])
    expect(tgOpLiterals("if tg_op in ('INSERT', 'update') then")).toEqual(['INSERT', 'update'])
    expect(tgOpLiterals("if tg_op not in ('INSERT') then")).toEqual(['INSERT'])
    expect(tgOpLiterals("case tg_op when 'insert' then")).toEqual(['insert'])
  })
})

// tableGrants chỉ thấy câu grant một bảng; câu cấp gộp (cả schema, nhiều bảng một lúc) lọt qua nó → chặn riêng
describe('không cấp quyền gộp cho bảng của mục 16', () => {
  const texts = [
    ['schema.sql', schema],
    ['migration', migration],
  ] as const

  it.each(texts)('%s: không grant on all tables in schema public', (_, text) => {
    expect(text).not.toContain('on all tables in schema public')
  })

  it.each(texts)('%s: không câu grant nhiều bảng nhắc tới user_blocks / content_warning_suggestions', (_, text) => {
    const targets = [...text.matchAll(/grant [^;]*? on (?:table )?([^;]*?) to /g)].map((m) => m[1] ?? '')
    const grouped = targets.filter(
      (target) => /\b(?:public\.)?(?:user_blocks|content_warning_suggestions)\b/.test(target) && target.includes(','),
    )
    expect(grouped).toEqual([])
  })
})

describe('mọi hàm của mục 16 có search_path rỗng', () => {
  const functions = [...section.matchAll(/create or replace function ([\w.]+)\(/g)].map((m) => m[1] ?? '')

  it('đủ 8 hàm', () => {
    expect(functions.sort()).toEqual([
      'private.books_normalize_content_warnings',
      'private.content_warning_suggestions_normalize_labels',
      'private.content_warnings_sorted',
      'private.user_blocks_check_limit',
      'private.user_blocks_limit',
      'private.warning_gemini_day_ceiling',
      'public.consume_warning_quota',
      'public.review_warning_suggestion',
    ])
  })

  it.each(functions)('%s', (name) => {
    expect(functionStatement(name)).toContain("set search_path = ''")
  })
})
