-- Phase 5a: tạm tính cho giỏ khách + quote_order chỉ cộng sách đang bán.
-- Chạy một lần trong SQL Editor. Idempotent (create or replace + grant).

-- Giỏ tài khoản: sách đã ẩn hiện là "Ngừng bán" ở trang giỏ, không tính tiền
-- (place_order vẫn chặn bằng BOOK_UNAVAILABLE).
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

  select count(*)::int, coalesce(sum(b.price * c.quantity), 0)::int
    into v_count, v_subtotal
    from public.cart_items c
    join public.books b on b.id = c.book_id and b.is_active
   where c.user_id = v_user;

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

-- Giỏ khách vãng lai: cùng công thức với quote_order, nhận giỏ từ localStorage.
-- security definer vì anon không có quyền trên schema private (shipping_fee, free_ship_from);
-- chỉ đọc books và tự lọc is_active nên không lộ thêm dữ liệu.
create or replace function public.quote_items(p_items jsonb)
returns table (
  item_count     int,
  subtotal       int,
  shipping_fee   int,
  total          int,
  free_ship_from int
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_count     int;
  v_subtotal  int;
  v_shipping  int;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'items', 'max', 100)::text;
  end if;

  -- Gộp trùng book_id và chặn 99 giống merge_cart, để khách thấy đúng số tiền sẽ có sau khi gộp
  select count(*)::int, coalesce(sum(b.price * q.quantity), 0)::int
    into v_count, v_subtotal
    from (
      select x.book_id, least(sum(x.quantity), 99)::int as quantity
        from jsonb_to_recordset(p_items) as x(book_id bigint, quantity int)
       where x.quantity > 0
       group by x.book_id
    ) q
    join public.books b on b.id = q.book_id and b.is_active;

  if v_count = 0 then
    return query select 0, 0, 0, 0, private.free_ship_from();
    return;
  end if;

  v_shipping := private.shipping_fee(v_subtotal);

  return query select v_count, v_subtotal, v_shipping,
                      v_subtotal + v_shipping, private.free_ship_from();
end;
$$;

revoke execute on function public.quote_items(jsonb) from public;
grant  execute on function public.quote_items(jsonb) to anon, authenticated;
