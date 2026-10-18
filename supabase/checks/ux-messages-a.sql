-- Kiểm tra sau migration A (20261018120000_voucher_suggestions.sql). Chạy trong SQL Editor, từng khối một.
-- KA1–KA5 chỉ đọc. KA6 tự rollback bằng một lỗi CÓ CHỦ Ý ở cuối khối: kết quả nằm trong thông báo lỗi "KA6 XONG …".
-- Đối chiếu với cột "mong đợi".

-- KA1. Cột is_public. Mong đợi: 1 dòng | boolean | NO | false
select data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'vouchers' and column_name = 'is_public';

-- KA2. Mã đang có chưa hiện trong gợi ý (★1). Mong đợi: tong = số mã đang có, dang_public = 0
select count(*) as tong, count(*) filter (where is_public) as dang_public from public.vouchers;

-- KA3. Quyền cột của authenticated. Mong đợi:
--   is_public  true  (form admin sửa được)
--   used_count false (chỉ place_order / trigger hủy đơn đổi)
--   created_at false
select c.col,
       has_column_privilege('authenticated', 'public.vouchers', c.col, 'update') as authenticated_update
  from (values ('is_public'), ('used_count'), ('created_at')) as c(col);

-- KA4. Quyền gọi hàm. Mong đợi:
--   public.checkout_vouchers   anon = false, authenticated = true
--   public.quote_order         anon = false, authenticated = true   (không đổi)
--   schema private: anon / authenticated không có quyền usage (private.cart_subtotal không gọi được qua API)
select 'public.checkout_vouchers' as ham,
       has_function_privilege('anon', 'public.checkout_vouchers()', 'execute')          as anon,
       has_function_privilege('authenticated', 'public.checkout_vouchers()', 'execute') as authenticated
union all
select 'public.quote_order',
       has_function_privilege('anon', 'public.quote_order(text)', 'execute'),
       has_function_privilege('authenticated', 'public.quote_order(text)', 'execute')
union all
select 'schema private (usage)',
       has_schema_privilege('anon', 'private', 'usage'),
       has_schema_privilege('authenticated', 'private', 'usage');

-- KA5. security definer + search_path. Mong đợi:
--   checkout_vouchers  secdef = true,  config = {"search_path=\"\""}
--   quote_order        secdef = true,  config = {"search_path=\"\""}
--   cart_subtotal      secdef = false, config = {"search_path=\"\""}
select n.nspname || '.' || p.proname as ham, p.prosecdef as secdef, p.proconfig as config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where (n.nspname, p.proname) in (('public', 'checkout_vouchers'), ('public', 'quote_order'), ('private', 'cart_subtotal'))
 order by 1;

-- KA6. Thử hành vi với dữ liệu tạm. Cả khối kết thúc bằng lỗi có chủ ý → mọi thay đổi bị rollback:
--   • 7 voucher tạm KTRA-A-… (chỉ sống trong khối; id identity bị đốt vài số, vô hại)
--   • giỏ của một tài khoản có sẵn (tài khoản tạo sớm nhất) bị xóa tạm rồi thêm 1 sách → rollback trả lại nguyên giỏ
--   • request.jwt.claims đặt cục bộ trong transaction để auth.uid() = tài khoản đó
do $$
declare
  v_user     uuid;
  v_book     bigint;
  v_price    int;
  out        text := '';
  r          text;
begin
  select id into v_user from public.profiles order by created_at limit 1;
  select id, price into v_book, v_price from public.books where is_active and price > 0 order by id limit 1;

  -- 0. Chưa đăng nhập
  perform set_config('request.jwt.claims', '', true);
  begin perform * from public.checkout_vouchers(); r := 'ok';
  exception when others then r := sqlerrm; end;
  out := out || E'\n0. chưa đăng nhập | mong đợi AUTH_REQUIRED | ' || r;

  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  -- 1. Giỏ trống → không có mã nào
  delete from public.cart_items where user_id = v_user;
  select count(*)::text into r from public.checkout_vouchers();
  out := out || E'\n1. giỏ trống | mong đợi 0 | ' || r;

  -- 2. Giỏ 1 cuốn: tạm tính = giá sách
  insert into public.cart_items (user_id, book_id, quantity) values (v_user, v_book, 1);
  select q2.item_count || ' cuốn, ' || q2.subtotal into r from public.quote_order() q2;
  out := out || E'\n2. quote_order sau khi thêm 1 cuốn | mong đợi 1 cuốn, ' || v_price || ' | ' || r;

  insert into public.vouchers (code, discount_type, discount_value, min_order_value, is_public, is_active, starts_at, ends_at, usage_limit, used_count) values
    ('KTRA-A-PUBLIC',  'fixed',   1000, 0,                 true,  true,  null,                    null,                    null, 0),
    ('KTRA-A-MIN',     'percent', 10,   v_price + 50000,   true,  true,  null,                    null,                    null, 0),
    ('KTRA-A-PRIVATE', 'fixed',   1000, 0,                 false, true,  null,                    null,                    null, 0),
    ('KTRA-A-OFF',     'fixed',   1000, 0,                 true,  false, null,                    null,                    null, 0),
    ('KTRA-A-FUTURE',  'fixed',   1000, 0,                 true,  true,  now() + interval '1 day', null,                   null, 0),
    ('KTRA-A-EXPIRED', 'fixed',   1000, 0,                 true,  true,  null,                    now() - interval '1 day', null, 0),
    ('KTRA-A-USED',    'fixed',   1000, 0,                 true,  true,  null,                    null,                    5,    5);

  -- 3. Chỉ mã public đang dùng được (mã thật đã bật is_public cũng có thể hiện, bỏ qua chúng)
  select string_agg(c.code || ' discount=' || coalesce(c.discount::text, 'null') || ' shortfall=' || c.shortfall, '; ' order by c.code)
    into r
    from public.checkout_vouchers() c
   where c.code like 'KTRA-A-%';
  out := out || E'\n3. mã KTRA-A trả về | mong đợi KTRA-A-MIN discount=null shortfall=50000; KTRA-A-PUBLIC discount=1000 shortfall=0 | ' || coalesce(r, '(trống)');

  -- 4. Thứ tự: mã đủ điều kiện (discount không null) đứng trước mã chưa đủ
  select string_agg(c.code, ' > ' order by c.n) into r
    from (select f.code, row_number() over () as n from public.checkout_vouchers() f) c
   where c.code like 'KTRA-A-%';
  out := out || E'\n4. thứ tự | mong đợi KTRA-A-PUBLIC > KTRA-A-MIN | ' || coalesce(r, '(trống)');

  -- 5. Cột trả về: không có id / used_count / usage_limit / starts_at / is_active / is_public
  select string_agg(a.attname, ', ' order by a.attnum) into r
    from pg_proc p, unnest(p.proargnames, p.proargmodes) with ordinality as a(attname, mode, attnum)
   where p.oid = 'public.checkout_vouchers()'::regprocedure and a.mode = 't';
  out := out || E'\n5. cột trả về | mong đợi code, description, description_en, discount_type, discount_value, max_discount, min_order_value, ends_at, discount, shortfall | ' || r;

  -- 6. Mã không public vẫn dùng được khi gõ tay (đi qua quote_order như cũ)
  select q3.discount::text into r from public.quote_order('ktra-a-private') q3;
  out := out || E'\n6. quote_order(''ktra-a-private'') | mong đợi discount = 1000 (hoặc = tạm tính nếu sách rẻ hơn 1.000₫) | ' || r;

  raise exception 'KA6 XONG (lỗi có chủ ý để rollback, không để lại dữ liệu):%', out;
end $$;
