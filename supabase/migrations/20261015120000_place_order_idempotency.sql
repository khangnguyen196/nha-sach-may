-- Phase 5b: place_order chống đặt trùng (idempotency key) + so tổng tiền đang hiển thị.
-- Chạy một lần trong SQL Editor. Idempotent (if not exists, drop if exists, create or replace).
-- Đổi chữ ký place_order nên phải drop bản 4 tham số: nếu để cả hai, gọi bằng tên tham số sẽ mơ hồ.

begin;

alter table public.orders add column if not exists idempotency_key uuid;

-- Chốt cuối ở mức DB: một key chỉ gắn với một đơn của mỗi user (key null không bị ràng buộc)
create unique index if not exists orders_user_idempotency_key
  on public.orders (user_id, idempotency_key);

drop function if exists public.place_order(bigint, public.payment_method, text, text);

-- Phí ship: xem private.shipping_fee() trong schema.sql
create or replace function public.place_order(
  p_address_id      bigint,
  p_payment_method  public.payment_method default 'cod',
  p_voucher_code    text default null,
  p_note            text default null,
  p_idempotency_key uuid default null,
  p_expected_total  int default null
)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_user      uuid := auth.uid();
  v_note      text := nullif(btrim(p_note), '');
  v_addr      public.addresses;
  v_voucher   public.vouchers;
  v_item      record;
  v_book_ids  bigint[] := '{}';
  v_qtys      int[]    := '{}';
  v_subtotal  int := 0;
  v_shipping  int;
  v_discount  int := 0;
  v_total     int;
  v_order     public.orders;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- (a) Gửi lại cùng key (bấm 2 lần, mất phản hồi rồi gửi lại) → trả đúng đơn đã tạo, kể cả khi
  -- giỏ đã rỗng hay địa chỉ đã đổi. Khóa theo (user, key): request song song cùng key chờ ở đây
  -- tới khi request đầu commit, rồi thấy đơn của nó (mỗi câu lệnh plpgsql đọc snapshot mới).
  if p_idempotency_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_idempotency_key::text, 0));

    select * into v_order from public.orders
     where user_id = v_user and idempotency_key = p_idempotency_key;
    if found then
      return v_order;
    end if;
  end if;

  if char_length(v_note) > 500 then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'note', 'max', 500)::text;
  end if;

  select * into v_addr from public.addresses
   where id = p_address_id and user_id = v_user;
  if not found then
    raise exception 'INVALID_ADDRESS';
  end if;

  -- (b) Khóa CẢ dòng giỏ lẫn dòng sách. Nếu chỉ khóa sách, request thứ hai (bấm đặt hàng 2 lần)
  -- vẫn thấy dòng giỏ cũ trong snapshot, tính ra tiền, rồi tạo một đơn không có sách nào.
  for v_item in
    select c.book_id, c.quantity, b.title, b.price, b.stock, b.is_active
      from public.cart_items c
      join public.books b on b.id = c.book_id
     where c.user_id = v_user
     order by b.id
       for update of c, b
  loop
    if not v_item.is_active then
      raise exception 'BOOK_UNAVAILABLE'
        using detail = json_build_object('book_id', v_item.book_id, 'title', v_item.title)::text;
    end if;
    if v_item.stock < v_item.quantity then
      raise exception 'OUT_OF_STOCK'
        using detail = json_build_object('book_id', v_item.book_id, 'title', v_item.title, 'stock', v_item.stock)::text;
    end if;
    v_book_ids := v_book_ids || v_item.book_id;
    v_qtys     := v_qtys || v_item.quantity;
    v_subtotal := v_subtotal + v_item.price * v_item.quantity;
  end loop;

  if cardinality(v_book_ids) = 0 then
    raise exception 'CART_EMPTY';
  end if;

  v_shipping := private.shipping_fee(v_subtotal);

  if nullif(btrim(p_voucher_code), '') is not null then
    select * into v_voucher from public.vouchers
     where code = upper(btrim(p_voucher_code))
       for update;
    v_discount := private.voucher_discount(v_voucher, v_subtotal);
  end if;

  v_total := v_subtotal + v_shipping - v_discount;

  -- (c) Tổng người dùng đang thấy khác tổng thật (giỏ sửa ở tab khác, admin đổi giá) → không đặt.
  -- So sau khi đã khóa giỏ nên không còn khe hở giữa lúc so và lúc đặt.
  if p_expected_total is not null and p_expected_total <> v_total then
    raise exception 'CART_CHANGED'
      using detail = json_build_object('total', v_total)::text;
  end if;

  -- (d) Đặt hàng
  if v_voucher.id is not null then
    update public.vouchers set used_count = used_count + 1 where id = v_voucher.id;
  end if;

  insert into public.orders (
    user_id, payment_method,
    recipient_name, phone, province, ward, street, note,
    subtotal, shipping_fee, discount, total,
    voucher_id, voucher_code, idempotency_key
  ) values (
    v_user, p_payment_method,
    v_addr.recipient_name, v_addr.phone, v_addr.province, v_addr.ward, v_addr.street, v_note,
    v_subtotal, v_shipping, v_discount, v_total,
    v_voucher.id, v_voucher.code, p_idempotency_key
  )
  returning * into v_order;

  -- Chỉ dùng đúng các dòng đã khóa và kiểm tra ở trên (sách thêm vào giỏ song song không lọt vào đơn)
  insert into public.order_items (order_id, book_id, title, cover_url, unit_price, quantity)
  select v_order.id, b.id, b.title, b.cover_url, b.price, x.quantity
    from unnest(v_book_ids, v_qtys) as x(book_id, quantity)
    join public.books b on b.id = x.book_id;

  update public.books b
     set stock      = b.stock - x.quantity,
         sold_count = b.sold_count + x.quantity
    from unnest(v_book_ids, v_qtys) as x(book_id, quantity)
   where b.id = x.book_id;

  delete from public.cart_items
   where user_id = v_user and book_id = any(v_book_ids);

  return v_order;
end;
$$;

revoke execute on function public.place_order(bigint, public.payment_method, text, text, uuid, int) from public, anon;
grant  execute on function public.place_order(bigint, public.payment_method, text, text, uuid, int) to authenticated;

commit;

-- PostgREST nạp lại danh sách hàm (chữ ký place_order đã đổi)
notify pgrst, 'reload schema';
