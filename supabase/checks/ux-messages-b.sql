-- Kiểm tra sau migration B (20261018130000_error_reasons.sql). Chạy trong SQL Editor, từng khối một.
-- Chỉ chạy B SAU khi bản app mới đã deploy (xem đầu file migration).
-- KB1–KB2 chỉ đọc. KB3 tự rollback bằng một lỗi CÓ CHỦ Ý ở cuối khối: kết quả nằm trong thông báo lỗi "KB3 XONG …".
-- Đối chiếu với cột "mong đợi". Giờ trong detail theo múi giờ của phiên SQL Editor (mặc định UTC → +00:00).

-- KB1. Thân hàm đã là bản mới. Mong đợi: 4 cột true
select pg_get_functiondef('private.voucher_discount(public.vouchers, integer)'::regprocedure) like '%VOUCHER_NOT_STARTED%' as voucher_moi,
       pg_get_functiondef('private.voucher_discount(public.vouchers, integer)'::regprocedure) not like '%INVALID_VOUCHER%' as het_invalid_voucher,
       pg_get_functiondef('public.cancel_order(bigint, text)'::regprocedure) like '%ORDER_IN_PROGRESS%' as huy_don_moi,
       pg_get_functiondef('public.cancel_order(bigint, text)'::regprocedure) like '%for update%' as khoa_dong;

-- KB2. Quyền + security definer + search_path (create or replace giữ nguyên quyền cũ). Mong đợi:
--   private.voucher_discount  secdef = false, config = {"search_path=\"\""}
--   public.cancel_order       secdef = true,  config = {"search_path=\"\""}, anon = false, authenticated = true
select n.nspname || '.' || p.proname as ham, p.prosecdef as secdef, p.proconfig as config,
       case when n.nspname = 'public' then has_function_privilege('anon', p.oid, 'execute') end          as anon,
       case when n.nspname = 'public' then has_function_privilege('authenticated', p.oid, 'execute') end as authenticated
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where (n.nspname, p.proname) in (('private', 'voucher_discount'), ('public', 'cancel_order'))
 order by 1;

-- KB3. Thử từng mã lỗi với dữ liệu tạm. Cả khối kết thúc bằng lỗi có chủ ý → mọi thay đổi bị rollback:
--   • 6 voucher tạm KTRA-B-…, 8 đơn tạm mã NSKTRAB… (mã đơn đặt tay nên không đốt số thứ tự đơn thật;
--     id identity bị đốt vài số, vô hại). Đơn tạm không có dòng sách → hủy không đổi tồn kho.
--   • giỏ của tài khoản tạo sớm nhất bị xóa tạm rồi thêm 1 sách → rollback trả lại nguyên giỏ
--   • request.jwt.claims đặt cục bộ trong transaction để auth.uid() = tài khoản đó
do $$
declare
  v_user  uuid;
  v_book  bigint;
  v_price int;
  v       public.vouchers;
  v_ids   bigint[];
  out     text := '';
  r       text;
  d       text;
  i       int;
  labels  text[] := array[
    'pending, chưa trả | mong đợi ok, status = cancelled, lý do = ktra',
    'confirmed | mong đợi ORDER_IN_PROGRESS {"status" : "confirmed"}',
    'shipping | mong đợi ORDER_IN_PROGRESS {"status" : "shipping"}',
    'delivered | mong đợi ORDER_DELIVERED',
    'cancelled | mong đợi ORDER_ALREADY_CANCELLED',
    'pending, đã trả (chuyển khoản) | mong đợi ORDER_PAID',
    'đơn không có chủ (giả lập đơn của tài khoản khác) | mong đợi ORDER_NOT_CANCELLABLE',
    'id không tồn tại | mong đợi ORDER_NOT_CANCELLABLE'
  ];
begin
  select id into v_user from public.profiles order by created_at limit 1;
  select id, price into v_book, v_price from public.books where is_active and price > 0 order by id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  -- ---------- Voucher: gọi thẳng private.voucher_discount ----------
  insert into public.vouchers (code, discount_type, discount_value, min_order_value, is_active, starts_at, ends_at, usage_limit, used_count) values
    ('KTRA-B-OK',      'fixed', 1000, 0,      true,  null,                                    null,                                    null, 0),
    ('KTRA-B-OFF',     'fixed', 1000, 0,      false, null,                                    null,                                    null, 0),
    ('KTRA-B-FUTURE',  'fixed', 1000, 0,      true,  timestamptz '2099-01-02 03:04:05+07',     null,                                    null, 0),
    ('KTRA-B-EXPIRED', 'fixed', 1000, 0,      true,  null,                                    timestamptz '2020-01-02 03:04:05+07',     null, 0),
    ('KTRA-B-USED',    'fixed', 1000, 0,      true,  null,                                    null,                                    5,    5),
    ('KTRA-B-MIN',     'fixed', 1000, 200000, true,  null,                                    null,                                    null, 0);

  begin perform private.voucher_discount(null::public.vouchers, 150000); r := 'ok';
  exception when others then get stacked diagnostics d = pg_exception_detail; r := sqlerrm || ' ' || coalesce(d, ''); end;
  out := out || E'\nV1. không có mã | mong đợi VOUCHER_NOT_FOUND | ' || r;

  for v in select * from public.vouchers where code like 'KTRA-B-%' order by id loop
    begin r := private.voucher_discount(v, 150000)::text;
    exception when others then get stacked diagnostics d = pg_exception_detail; r := sqlerrm || ' ' || coalesce(d, ''); end;
    out := out || E'\nV. ' || v.code || ' | mong đợi ' || case v.code
      when 'KTRA-B-OK'      then '1000'
      when 'KTRA-B-OFF'     then 'VOUCHER_INACTIVE'
      when 'KTRA-B-FUTURE'  then 'VOUCHER_NOT_STARTED {"starts_at" : "2099-01-01T20:04:05+00:00"}'
      when 'KTRA-B-EXPIRED' then 'VOUCHER_EXPIRED {"ends_at" : "2020-01-01T20:04:05+00:00"}'
      when 'KTRA-B-USED'    then 'VOUCHER_EXHAUSTED'
      when 'KTRA-B-MIN'     then 'VOUCHER_MIN_ORDER {"min_order_value" : 200000, "shortfall" : 50000}'
    end || ' | ' || r;
  end loop;

  -- Mã lỗi đi tới app qua quote_order (giỏ 1 cuốn)
  delete from public.cart_items where user_id = v_user;
  insert into public.cart_items (user_id, book_id, quantity) values (v_user, v_book, 1);
  begin perform * from public.quote_order('khong-co-ma-nay'); r := 'ok';
  exception when others then r := sqlerrm; end;
  out := out || E'\nV2. quote_order(mã không có) | mong đợi VOUCHER_NOT_FOUND | ' || r;
  begin perform * from public.quote_order('ktra-b-expired'); r := 'ok';
  exception when others then r := sqlerrm; end;
  out := out || E'\nV3. quote_order(mã hết hạn) | mong đợi VOUCHER_EXPIRED | ' || r;

  -- ---------- Hủy đơn ----------
  with ins as (
    insert into public.orders (order_code, user_id, status, payment_method, payment_status,
                               recipient_name, phone, province, ward, street, subtotal, shipping_fee, discount, total)
    select 'NSKTRAB' || lpad(o.n::text, 4, '0'), o.owner, o.status::public.order_status, o.method::public.payment_method,
           o.paid::public.payment_status, 'Kiểm tra', '0900000000', 'Hà Nội', 'Ba Đình', 'Số 1', 0, 0, 0, 0
      from (values
        (1, v_user, 'pending',   'cod',           'unpaid'),
        (2, v_user, 'confirmed', 'cod',           'unpaid'),
        (3, v_user, 'shipping',  'cod',           'unpaid'),
        (4, v_user, 'delivered', 'cod',           'paid'),
        (5, v_user, 'cancelled', 'cod',           'unpaid'),
        (6, v_user, 'pending',   'bank_transfer', 'paid'),
        (7, null,   'pending',   'cod',           'unpaid')
      ) as o(n, owner, status, method, paid)
    returning id, order_code
  )
  select array_agg(id order by order_code) into v_ids from ins;
  v_ids := v_ids || (-1)::bigint;

  for i in 1 .. array_length(v_ids, 1) loop
    begin
      select o.status || ', lý do = ' || coalesce(o.cancelled_reason, 'null') into r
        from public.cancel_order(v_ids[i], ' ktra ') o;
      r := 'ok, status = ' || r;
    exception when others then get stacked diagnostics d = pg_exception_detail; r := sqlerrm || ' ' || coalesce(d, ''); end;
    out := out || E'\nH' || i || '. ' || labels[i] || ' | ' || r;
  end loop;

  raise exception 'KB3 XONG (lỗi có chủ ý để rollback, không để lại dữ liệu):%', out;
end $$;
