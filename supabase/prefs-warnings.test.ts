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
const normalize = (sql: string) => sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').toLowerCase()
const schema = normalize(schemaSql)

/** Mục 16 (tới khối chú thích cuối file) */
const section = (() => {
  const start = schemaSql.indexOf('-- 16. CẢNH BÁO NỘI DUNG')
  const end = schemaSql.indexOf('-- RPC cho app', start)
  if (start < 0 || end < 0) throw new Error('schema.sql không có mục 16')
  return normalize(schemaSql.slice(start, end))
})()

function functionStatement(name: string) {
  const start = schema.indexOf(`create or replace function ${name}(`)
  if (start < 0) throw new Error(`schema.sql không có hàm ${name}`)
  const bodyStart = schema.indexOf('$$', start)
  const bodyEnd = schema.indexOf('$$', bodyStart + 2)
  return schema.slice(start, bodyEnd + 2)
}

/** Câu `chat_quota_take('<bucket>', …)` trong một thân hàm, tới hết tham số scope */
function quotaTake(body: string, bucket: string) {
  const start = body.indexOf(`chat_quota_take('${bucket}',`)
  if (start < 0) throw new Error(`không có chat_quota_take('${bucket}')`)
  const end = body.indexOf(';', start)
  return { start, text: body.slice(start, end < 0 ? undefined : end) }
}

const ADMIN_RPCS = ['public.consume_warning_quota', 'public.review_warning_suggestion'] as const
const GRANTS = {
  'public.consume_warning_quota': 'public.consume_warning_quota(jsonb)',
  'public.review_warning_suggestion': 'public.review_warning_suggestion(bigint, public.content_warning[], boolean)',
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
    expect(body).toContain('for update')
    expect(body).toContain("if not found or v_status <> 'pending' then raise exception 'suggestion_status_changed'")
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
    expect(section).toContain('create trigger user_blocks_limit before insert on public.user_blocks')
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

  it('admin sửa được 2 cột mới', () => {
    expect(schema).toMatch(/grant update \([^)]*\bcontent_warnings, content_warnings_reviewed_at \) on public\.books to authenticated/)
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
