-- ux-messages B: báo đúng lý do khi mã giảm giá không dùng được và khi khách không tự hủy được đơn
-- (docs/plans/ux-messages.md mục 1, 2).
--   1. private.voucher_discount: tách INVALID_VOUCHER thành VOUCHER_NOT_FOUND, VOUCHER_INACTIVE,
--      VOUCHER_NOT_STARTED (detail starts_at), VOUCHER_EXPIRED (detail ends_at), VOUCHER_EXHAUSTED.
--      VOUCHER_MIN_ORDER thêm shortfall (số tiền còn thiếu) vào detail. Thứ tự kiểm và mức giảm giữ nguyên.
--      place_order / quote_order / checkout_vouchers gọi hàm này nên tự đổi theo.
--   2. cancel_order: tách ORDER_NOT_CANCELLABLE thành ORDER_ALREADY_CANCELLED, ORDER_DELIVERED,
--      ORDER_IN_PROGRESS (detail status: confirmed | shipping), ORDER_PAID. Đơn không có / của tài khoản khác
--      vẫn là ORDER_NOT_CANCELLABLE (không lộ đơn nào tồn tại). Điều kiện được hủy giữ nguyên
--      (pending + chưa thanh toán); đọc đơn bằng select … for update rồi mới update.
-- ĐỔI MÃ LỖI → chạy SAU khi bản app hiểu mã mới đã deploy lên production (app mới hiểu cả mã cũ lẫn mã mới).
-- Chạy trước thì bản app cũ gặp mã lạ: /thanh-toan?voucher=<mã sai> ra trang lỗi, hủy đơn hiện "Đã có lỗi xảy ra".
-- Chạy một lần trong SQL Editor. Idempotent (create or replace). Không đổi dữ liệu có sẵn.
-- Kiểm tra sau khi chạy: supabase/checks/ux-messages-b.sql

begin;

-- 1. Kiểm tra voucher và trả về số tiền giảm. p_voucher toàn null = không tìm thấy mã.
create or replace function private.voucher_discount(p_voucher public.vouchers, p_subtotal int)
returns int language plpgsql stable set search_path = '' as $$
declare
  v_discount bigint;
begin
  if p_voucher.id is null then
    raise exception 'VOUCHER_NOT_FOUND';
  end if;

  if not p_voucher.is_active then
    raise exception 'VOUCHER_INACTIVE';
  end if;

  if p_voucher.starts_at is not null and now() < p_voucher.starts_at then
    raise exception 'VOUCHER_NOT_STARTED'
      using detail = json_build_object('starts_at', p_voucher.starts_at)::text;
  end if;

  if p_voucher.ends_at is not null and now() > p_voucher.ends_at then
    raise exception 'VOUCHER_EXPIRED'
      using detail = json_build_object('ends_at', p_voucher.ends_at)::text;
  end if;

  if p_voucher.usage_limit is not null and p_voucher.used_count >= p_voucher.usage_limit then
    raise exception 'VOUCHER_EXHAUSTED';
  end if;

  if p_subtotal < p_voucher.min_order_value then
    raise exception 'VOUCHER_MIN_ORDER'
      using detail = json_build_object(
        'min_order_value', p_voucher.min_order_value,
        'shortfall', p_voucher.min_order_value - p_subtotal
      )::text;
  end if;

  if p_voucher.discount_type = 'percent' then
    -- bigint: subtotal lớn × % có thể tràn int
    v_discount := p_subtotal::bigint * p_voucher.discount_value / 100;
    if p_voucher.max_discount is not null then
      v_discount := least(v_discount, p_voucher.max_discount);
    end if;
  else
    v_discount := p_voucher.discount_value;
  end if;

  return least(v_discount, p_subtotal)::int;
end;
$$;

-- 2. Khách tự hủy đơn: chỉ khi đơn còn 'pending' và chưa thanh toán (đơn chuyển khoản đã trả phải qua cửa hàng:
-- chưa có quy trình hoàn tiền). Đơn COD luôn 'unpaid' tới khi giao. Không hủy được thì báo đúng lý do.
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

  select * into v_order
    from public.orders
   where id = p_order_id
     and user_id = auth.uid()
     for update;

  -- Không có hoặc của tài khoản khác: cùng một mã, không lộ đơn nào tồn tại
  if not found then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'ORDER_ALREADY_CANCELLED';
  end if;

  if v_order.status = 'delivered' then
    raise exception 'ORDER_DELIVERED';
  end if;

  if v_order.status <> 'pending' then
    raise exception 'ORDER_IN_PROGRESS'
      using detail = json_build_object('status', v_order.status)::text;
  end if;

  if v_order.payment_status = 'paid' then
    raise exception 'ORDER_PAID';
  end if;

  update public.orders
     set status = 'cancelled',
         cancelled_reason = v_reason
   where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

commit;
