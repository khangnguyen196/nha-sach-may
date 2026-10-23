import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '../messages/en.json'
import vi from '../messages/vi.json'

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

  it('câu LISTING_PENDING_LIMIT (vi / en) ghi đúng số tin chờ duyệt tối đa của schema.sql', () => {
    const limit = /as \$\$ select (\d+) \$\$/.exec(functionStatement('private.used_pending_limit'))?.[1]
    expect(limit).toBeDefined()
    for (const message of [vi.errors.LISTING_PENDING_LIMIT, en.errors.LISTING_PENDING_LIMIT]) {
      expect(message.match(/\d+/g)).toEqual([limit])
    }
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
    'can_upload_used_photo(text)',
    'can_delete_used_photo(text)',
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

/** Câu `create policy "<name>" on storage.objects …` (đã chuẩn hóa) */
function storagePolicy(name: string) {
  const match = new RegExp(`create policy "${name}" on storage\\.objects [^;]*`).exec(schema)
  if (!match) throw new Error(`schema.sql không có policy ${name}`)
  return match[0]
}

describe('ảnh tin sách cũ không đổi được sau khi duyệt', () => {
  it('policy xóa ảnh kiểm can_delete_used_photo(name); policy tải lên kiểm can_upload_used_photo(name)', () => {
    expect(storagePolicy('used_listing_photos_delete_own')).toContain('and public.can_delete_used_photo(name)')
    expect(storagePolicy('used_listing_photos_insert_own')).toContain('and public.can_upload_used_photo(name)')
  })

  it('ảnh gắn tin chờ duyệt / đã duyệt / đã bán không xóa được', () => {
    expect(functionStatement('public.can_delete_used_photo')).toContain(
      "where l.status in ('pending', 'approved', 'sold') and l.photos @> array[p_name]",
    )
  })

  it('lưu mọi tên ảnh đã từng gắn tin (private.used_photo_names, trigger sau khi đăng / đổi ảnh)', () => {
    expect(createTableSql('private.used_photo_names')).toMatch(/^\s*name\s+text primary key,/)
    expect(schema).toContain('alter table private.used_photo_names enable row level security;')
    expect(schema).not.toMatch(/create policy [^;]* on private\.used_photo_names\b/)
    expect(schema).not.toMatch(/grant [^;]* on (table )?private\.used_photo_names\b/)
    expect(schema).toContain(
      'create trigger used_listings_remember_photos after insert or update of photos on public.used_listings for each row execute function private.used_listings_remember_photos();',
    )
    const remember = functionStatement('private.used_listings_remember_photos')
    expect(remember).toContain('security definer')
    expect(remember).toContain(
      'insert into private.used_photo_names (name) select x.name from unnest(new.photos) as x(name) on conflict (name) do nothing;',
    )
  })

  it('tên ảnh đã từng gắn tin (mọi trạng thái, kể cả đã bỏ khỏi tin khi sửa) không tải lên lại được', () => {
    expect(functionStatement('public.can_upload_used_photo')).toMatch(
      /and not exists \( select 1 from private\.used_photo_names n where n\.name = p_name \); \$\$$/,
    )
  })

  it('duyệt tin kiểm lại ảnh còn đủ (mã riêng cho admin), dùng chung hàm kiểm storage.objects với lúc đăng / sửa', () => {
    const approve = functionStatement('public.review_used_listing')
    const approveBranch = approve.slice(approve.indexOf('if p_approve then'), approve.indexOf("set status = 'approved'"))
    expect(approveBranch).toContain(
      "if not private.used_photos_stored(v_listing.photos) then raise exception 'listing_photos_missing'; end if;",
    )
    expect(functionStatement('private.used_check_listing_input')).toMatch(
      /or not private\.used_photos_stored\(p_photos\) then raise exception 'listing_photos_invalid'/,
    )
    // Chỉ một chỗ đếm ảnh trong bucket để kiểm tin (không chép đôi)
    expect(schema.match(/and o\.name = any\(p_photos\)/g)).toHaveLength(1)
    expect(functionStatement('private.used_photos_stored')).toContain('and o.name = any(p_photos)')
  })

  it.each(['public.can_upload_used_photo', 'public.can_delete_used_photo'])(
    '%s chỉ nhận tên trong thư mục của người gọi (gọi thẳng như RPC không dò được ảnh của người khác)',
    (name) => {
      expect(functionStatement(name)).toContain(
        "select auth.uid() is not null and (storage.foldername(p_name))[1] = auth.uid()::text and ",
      )
    },
  )
})

describe('giới hạn ảnh, khóa ngoại, sổ tiền', () => {
  it('trần 30 ảnh không đếm ảnh của tin đã bán', () => {
    const count = functionStatement('public.can_upload_used_photo')
    expect(count).toContain(
      "and not exists ( select 1 from public.used_listings l where l.status = 'sold' and l.photos @> array[o.name] ) ) < private.used_photo_limit()",
    )
  })

  it('order_items.used_listing_id on delete restrict (hủy đơn không hoàn kho nhầm cho sách catalog)', () => {
    expect(schema).toContain(
      'alter table public.order_items add constraint order_items_used_listing_id_fkey foreign key (used_listing_id) references public.used_listings(id) on delete restrict;',
    )
  })

  it('authenticated đọc seller_payouts theo cột, không có order_id', () => {
    const grants = [...schema.matchAll(/grant select ([^;]*?)on (?:table )?public\.seller_payouts to ([^;]*);/g)]
    expect(grants).toHaveLength(1)
    const [, columns = '', roles = ''] = grants[0] ?? []
    expect(roles.trim()).toBe('authenticated')
    expect(columns).toMatch(/^\(.*\) $/)
    expect(columns).not.toMatch(/\border_id\b/)
    expect(columns).toContain('seller_id')
  })

  it('đánh dấu đã trả chỉ khi đơn còn đã giao + đã thanh toán', () => {
    expect(functionStatement('public.mark_payout_paid')).toContain(
      "where o.id = p.order_id and o.status = 'delivered' and o.payment_status = 'paid'",
    )
  })

  it('đánh dấu đã trả khóa dòng đơn (for share) trước khi kiểm và ghi', () => {
    const body = functionStatement('public.mark_payout_paid')
    const lock = body.indexOf(
      'perform 1 from public.orders o join public.seller_payouts p on p.order_id = o.id where p.id = p_id for share of o;',
    )
    expect(lock).toBeGreaterThan(-1)
    expect(body.indexOf('update public.seller_payouts')).toBeGreaterThan(lock)
  })

  it('đăng tin với sách không có → INVALID_INPUT (field book_id), sách ngừng bán → BOOK_UNAVAILABLE', () => {
    const check = functionStatement('private.used_check_book_price')
    expect(check).toContain(
      "if not found then raise exception 'invalid_input' using detail = json_build_object('field', 'book_id')::text; end if;",
    )
    expect(check).toContain("if not v_active then raise exception 'book_unavailable'")
  })
})
