-- Phase 9: thanh toán chuyển khoản (VietQR), voucher, email theo locale.
--   1. cancel_order: khách không tự hủy đơn đã thanh toán (payment_status = 'paid'): chưa có quy trình hoàn tiền.
--      Đơn COD luôn 'unpaid' tới khi giao (trigger đặt 'paid' khi delivered) → hành vi cũ giữ nguyên.
--   2. Quyền cột vouchers: admin chỉ sửa được cột của form admin; used_count do place_order / trigger hủy đơn quản lý
--      (đều security definer, không bị ảnh hưởng). RLS vouchers_admin_all giữ nguyên.
--   3. RPC order_contact(p_order_id) → (email, locale) của người đặt: email báo trạng thái đơn khi admin đổi trạng thái
--      (app không dùng service role; profiles không có email). Chỉ trả khi đơn của chính user hoặc người gọi là admin.
-- Chạy một lần trong SQL Editor. Idempotent (create or replace, revoke / grant). Không đổi dữ liệu có sẵn.

begin;

-- 1. Khách tự hủy đơn: chỉ khi đơn còn 'pending' và chưa thanh toán
create or replace function public.cancel_order(p_order_id bigint, p_reason text default null)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(btrim(p_reason), '');
  v_order  public.orders;
begin
  if char_length(v_reason) > 500 then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'reason', 'max', 500)::text;
  end if;

  update public.orders
     set status = 'cancelled',
         cancelled_reason = v_reason
   where id = p_order_id
     and user_id = auth.uid()
     and status = 'pending'
     and payment_status <> 'paid'
  returning * into v_order;

  if not found then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;

  return v_order;
end;
$$;

revoke execute on function public.cancel_order(bigint, text) from public, anon;
grant  execute on function public.cancel_order(bigint, text) to authenticated;

-- 2. Quyền cột vouchers (insert giữ nguyên: form tạo không gửi used_count, mặc định 0)
revoke update on public.vouchers from anon, authenticated;
grant  update (
  code, description, description_en, discount_type, discount_value, max_discount,
  min_order_value, usage_limit, starts_at, ends_at, is_active
) on public.vouchers to authenticated;

-- 3. Email + ngôn ngữ email của người đặt đơn
create or replace function public.order_contact(p_order_id bigint)
returns table (email text, locale text)
language sql stable security definer set search_path = '' as $$
  select u.email::text, p.locale
    from public.orders o
    join auth.users u on u.id = o.user_id
    join public.profiles p on p.id = o.user_id
   where o.id = p_order_id
     and (o.user_id = (select auth.uid()) or (select public.is_admin()));
$$;

revoke execute on function public.order_contact(bigint) from public, anon;
grant  execute on function public.order_contact(bigint) to authenticated;

commit;

-- Kiểm tra sau khi chạy:
--   -- (a) cancel_order có điều kiện payment_status (kỳ vọng: true)
--   select pg_get_functiondef('public.cancel_order(bigint, text)'::regprocedure) like '%payment_status <> ''paid''%';
--   -- (b) authenticated không còn quyền update used_count (kỳ vọng: 0 dòng)
--   select 1 from information_schema.column_privileges
--    where table_schema = 'public' and table_name = 'vouchers' and column_name = 'used_count'
--      and grantee = 'authenticated' and privilege_type = 'UPDATE';
--   -- (c) order_contact tồn tại, anon không gọi được (kỳ vọng: true, false)
--   select has_function_privilege('authenticated', 'public.order_contact(bigint)', 'execute'),
--          has_function_privilege('anon', 'public.order_contact(bigint)', 'execute');
