-- ux-messages A: gợi ý mã giảm giá ở trang thanh toán (docs/plans/ux-messages.md mục 1b).
--   1. vouchers.is_public: admin chọn mã nào hiện trong gợi ý. Mặc định false → mọi mã đang có KHÔNG hiện
--      tới khi admin bật. Mã không public vẫn dùng được bằng cách gõ tay như cũ.
--   2. Quyền cột vouchers: thêm is_public vào danh sách cột form admin được sửa.
--   3. private.cart_subtotal(user): số dòng + tạm tính giỏ (chỉ sách đang bán), dùng chung cho quote_order
--      và checkout_vouchers để hai bên không lệch. quote_order giữ nguyên chữ ký và kết quả.
--   4. RPC checkout_vouchers(): mã public đang dùng được + mức giảm / số tiền còn thiếu với giỏ hiện tại.
--      Khách vẫn không SELECT được bảng vouchers (RLS giữ nguyên); hàm security definer chỉ trả cột cần hiện,
--      không trả id, used_count, usage_limit, starts_at, is_active, is_public; mã không public không bao giờ ra.
-- Chỉ THÊM, không đổi mã lỗi → an toàn với bản app đang chạy. Chạy TRƯỚC khi code app (để sinh types).
-- Chạy một lần trong SQL Editor. Idempotent (add column if not exists, create or replace, revoke / grant).
-- Kiểm tra sau khi chạy: supabase/checks/ux-messages-a.sql

begin;

-- 1. Mã hiện trong gợi ý ở trang thanh toán
alter table public.vouchers add column if not exists is_public boolean not null default false;

-- 2. Quyền cột vouchers (bản trước: payments_email.sql), thêm is_public
revoke update on public.vouchers from anon, authenticated;
grant  update (
  code, description, description_en, discount_type, discount_value, max_discount,
  min_order_value, usage_limit, starts_at, ends_at, is_active, is_public
) on public.vouchers to authenticated;

-- 3. Tạm tính giỏ của một user: chỉ cộng sách đang bán (sách đã ẩn hiện "Ngừng bán" ở giỏ)
create or replace function private.cart_subtotal(p_user uuid, out item_count int, out subtotal int)
language sql stable set search_path = '' as $$
  select count(*)::int, coalesce(sum(b.price * c.quantity), 0)::int
    from public.cart_items c
    join public.books b on b.id = c.book_id and b.is_active
   where c.user_id = p_user;
$$;

-- Tiền tạm tính cho checkout (không khóa, không tăng used_count).
-- Giỏ trống → trả về toàn 0 để trang giỏ vẫn hiển thị được mốc freeship.
-- Chỉ cộng sách đang bán: sách đã ẩn hiện "Ngừng bán" ở trang giỏ, place_order chặn bằng BOOK_UNAVAILABLE.
create or replace function public.quote_order(p_voucher_code text default null)
returns table (
  item_count     int,
  subtotal       int,
  shipping_fee   int,
  discount       int,
  total          int,
  free_ship_from int
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user      uuid := auth.uid();
  v_count     int;
  v_subtotal  int;
  v_shipping  int;
  v_discount  int := 0;
  v_voucher   public.vouchers;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select s.item_count, s.subtotal into v_count, v_subtotal from private.cart_subtotal(v_user) s;

  if v_count = 0 then
    return query select 0, 0, 0, 0, 0, private.free_ship_from();
    return;
  end if;

  v_shipping := private.shipping_fee(v_subtotal);

  if nullif(btrim(p_voucher_code), '') is not null then
    select * into v_voucher from public.vouchers
     where code = upper(btrim(p_voucher_code));
    v_discount := private.voucher_discount(v_voucher, v_subtotal);
  end if;

  return query select v_count, v_subtotal, v_shipping, v_discount,
                      v_subtotal + v_shipping - v_discount, private.free_ship_from();
end;
$$;

-- 4. Mã gợi ý ở trang thanh toán: public, đang bật, đã tới ngày, chưa hết hạn, còn lượt.
--    discount: mức giảm với giỏ hiện tại (null khi chưa đủ đơn tối thiểu); shortfall: số tiền còn thiếu (0 = đủ).
--    Biên thời gian khớp private.voucher_discount (now() < starts_at hoặc now() > ends_at mới bị từ chối).
--    Giỏ trống → không trả dòng nào. Tối đa 20 mã, giảm nhiều nhất lên đầu.
create or replace function public.checkout_vouchers()
returns table (
  code            text,
  description     text,
  description_en  text,
  discount_type   public.discount_type,
  discount_value  int,
  max_discount    int,
  min_order_value int,
  ends_at         timestamptz,
  discount        int,
  shortfall       int
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user     uuid := auth.uid();
  v_count    int;
  v_subtotal int;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select s.item_count, s.subtotal into v_count, v_subtotal from private.cart_subtotal(v_user) s;

  if v_count = 0 then
    return;
  end if;

  return query
    select v.code, v.description, v.description_en, v.discount_type, v.discount_value, v.max_discount,
           v.min_order_value, v.ends_at,
           case when v_subtotal >= v.min_order_value then private.voucher_discount(v, v_subtotal) end,
           greatest(v.min_order_value - v_subtotal, 0)
      from public.vouchers v
     where v.is_public
       and v.is_active
       and (v.starts_at is null or v.starts_at <= now())
       and (v.ends_at is null or v.ends_at >= now())
       and (v.usage_limit is null or v.used_count < v.usage_limit)
     order by 9 desc nulls last, 10, 1
     limit 20;
end;
$$;

revoke execute on function public.checkout_vouchers() from public, anon;
grant  execute on function public.checkout_vouchers() to authenticated;

commit;

-- PostgREST nạp lại cache schema để thấy RPC mới ngay
notify pgrst, 'reload schema';
