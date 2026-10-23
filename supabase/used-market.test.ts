import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Chợ sách cũ (docs/plans/cho-sach-cu.md, mục 15 của schema.sql). Phí sàn không có hàm TS (client không tự tính, số
// lấy từ RPC used_listing_quote): Vitest giữ hằng trong schema.sql, bảng giá → phí kiểm bằng e2e qua RPC
// (e2e/used-market-rls-account.spec.ts).
const schemaSql = readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8')
const schema = schemaSql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').toLowerCase()

function functionStatement(name: string) {
  const start = schema.indexOf(`create or replace function ${name}(`)
  if (start < 0) throw new Error(`schema.sql không có hàm ${name}`)
  const bodyStart = schema.indexOf('$$', start)
  const bodyEnd = schema.indexOf('$$', bodyStart + 2)
  return schema.slice(start, bodyEnd + 2)
}

/** Thân `create table <table> ( … );` (chưa bỏ xuống dòng, để tách cột theo dấu phẩy ngoài ngoặc) */
function createTableSql(table: string) {
  const text = schemaSql.replace(/--[^\n]*/g, '')
  const match = new RegExp(`create table ${table.replace('.', '\\.')} \\(([\\s\\S]*?)\\n\\);`).exec(text)
  if (!match?.[1]) throw new Error(`schema.sql không có create table ${table}`)
  return match[1]
}

/** Tên cột của một thân create table: phần tử ngoài ngoặc, bỏ ràng buộc bảng (constraint / check / unique / primary / foreign) */
function columnNames(body: string) {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of body) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts
    .map((part) => part.trim().split(/\s+/)[0]?.toLowerCase() ?? '')
    .filter((name) => name && !['constraint', 'check', 'unique', 'primary', 'foreign', 'exclude'].includes(name))
}

describe('hằng số chợ sách cũ trong schema.sql', () => {
  it('phí sàn 10%', () => {
    expect(functionStatement('private.used_fee_percent')).toContain('as $$ select 10 $$')
  })

  it('phí sàn tính trên numeric (nửa làm tròn lên), làm tròn tới 1.000₫', () => {
    const fee = functionStatement('private.used_platform_fee')
    expect(fee).toContain('::numeric')
    // round() của double precision làm tròn nửa về số chẵn: 5.000₫ → phí 0, sai quyết định của chủ dự án
    expect(fee).not.toMatch(/float|double precision|\breal\b/)
    expect(fee).toMatch(/round\(p_price::numeric \* private\.used_fee_percent\(\) \/ 100 \/ 1000\) \* 1000/)
    expect(fee).toContain('immutable')
  })

  it('tối đa 10 tin chờ duyệt, 30 ảnh mỗi người', () => {
    expect(functionStatement('private.used_pending_limit')).toContain('as $$ select 10 $$')
    expect(functionStatement('private.used_photo_limit')).toContain('as $$ select 30 $$')
  })

  it('bucket used-listing-photos không công khai, chỉ nhận webp ≤ 1MB', () => {
    expect(schema).toContain(
      "values ('used-listing-photos', 'used-listing-photos', false, array['image/webp'], 1048576)",
    )
  })
})

describe('không lưu tài khoản ngân hàng / thông tin thanh toán của người bán', () => {
  const BANK_LIKE = /bank|account|card|iban|stk|payment_info/i

  it.each(['public.used_listings', 'public.seller_payouts'])('%s không có cột nào giống tài khoản ngân hàng', (table) => {
    const columns = columnNames(createTableSql(table))
    expect(columns.length).toBeGreaterThan(5)
    expect(columns.filter((column) => BANK_LIKE.test(column))).toEqual([])
  })
})

describe('RPC chợ sách cũ', () => {
  const RPCS = [
    'used_listing_quote(int)',
    'create_used_listing(bigint, public.used_condition, int, text, text[])',
    'update_used_listing(bigint, public.used_condition, int, text, text[])',
    'withdraw_used_listing(bigint)',
    'review_used_listing(bigint, public.used_listing_status, boolean, text)',
    'quote_used_order(bigint)',
    'place_used_order(bigint, bigint, public.payment_method, text, uuid, int)',
    'my_used_sales()',
    'mark_payout_paid(bigint)',
    'can_upload_used_photo()',
  ]

  it.each(RPCS)('%s: security definer, search_path rỗng, chỉ authenticated gọi được', (signature) => {
    const name = signature.slice(0, signature.indexOf('('))
    const statement = functionStatement(`public.${name}`)
    expect(statement).toContain('security definer')
    expect(statement).toContain("set search_path = ''")
    expect(schema).toContain(`revoke execute on function public.${signature} from public, anon;`)
    expect(schema).toContain(`grant execute on function public.${signature} to authenticated;`)
    expect(schema).not.toMatch(new RegExp(`grant execute on function public\\.${name}\\([^;]*to [^;]*\\banon\\b`))
  })

  it('RPC của admin kiểm is_admin() trước mọi việc khác', () => {
    for (const name of ['public.review_used_listing', 'public.mark_payout_paid']) {
      const body = functionStatement(name)
      const check = body.indexOf("if not public.is_admin() then raise exception 'forbidden'")
      expect(check, name).toBeGreaterThan(-1)
      expect(body.indexOf('update public.'), name).toBeGreaterThan(check)
    }
  })

  it('my_used_sales không trả cột của người mua (mã đơn, tên, địa chỉ, điện thoại)', () => {
    const returns = /returns table \(([^)]*)\) language /.exec(functionStatement('public.my_used_sales'))?.[1] ?? ''
    expect(returns.trim()).not.toBe('')
    for (const column of ['order_code', 'order_id', 'user_id', 'recipient_name', 'phone', 'province', 'ward', 'street', 'note']) {
      expect(returns).not.toMatch(new RegExp(`\\b${column}\\b`))
    }
  })

  it('mọi policy Storage của ảnh sách cũ giới hạn đúng bucket', () => {
    const policies = [...schema.matchAll(/create policy "used_listing_photos_[a-z_]+" on storage\.objects [^;]*/g)].map(
      (match) => match[0],
    )
    expect(policies).toHaveLength(3)
    for (const policy of policies) expect(policy).toContain("bucket_id = 'used-listing-photos'")
    expect(schema).not.toMatch(/create policy "used_listing_photos_[a-z_]+" on storage\.objects for update/)
  })
})
