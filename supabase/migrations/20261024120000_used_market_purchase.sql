-- cho-sach-cu P-C (docs/plans/cho-sach-cu.md): mọi SQL của phần mua + tiền người bán, chạy production MỘT lần.
--   1. review_used_listing thêm p_expected_updated_at (bắt buộc, quyết định chủ dự án 2026-10-24): admin duyệt /
--      từ chối / gỡ đúng bản tin đang xem; trạng thái hoặc updated_at lệch (so sau khi khóa dòng) →
--      LISTING_STATUS_CHANGED (mã có sẵn). Drop chữ ký cũ rồi tạo bản mới (không để 2 overload).
--   2. place_used_order thêm p_expected_updated_at (bắt buộc, đặt sau p_address_id; đề xuất điều phối, chủ dự án duyệt
--      khi chạy SQL): tin bị sửa rồi duyệt lại cùng giá → LISTING_CHANGED (detail total như cũ). Nhánh idempotency
--      (cùng key → trả đơn đã tạo) vẫn chạy trước mọi kiểm tin. Drop chữ ký cũ rồi tạo bản mới.
--   3. admin_seller_payouts(): admin đọc mọi khoản trả người bán kèm mã + trạng thái đơn (authenticated không đọc được
--      seller_payouts.order_id theo cột); không trả thông tin người mua.
--   4. Quyền: chỉ authenticated gọi được (revoke public, anon) với đúng chữ ký mới.
-- ĐỔI CHỮ KÝ RPC → bản app đang chạy (P-B: admin duyệt tin gọi review_used_listing 4 tham số) gọi hỏng tới khi app P-C
-- lên production: chạy ngay trước khi lên main, giữ khoảng này ngắn. Chưa có trang mua nào gọi place_used_order.
-- drop function KHÔNG kèm if exists: chữ ký cũ lệch (production khác schema.sql) thì báo lỗi, cả file rollback.
-- Chạy một lần trong SQL Editor (cả file là một transaction). Không đổi dữ liệu có sẵn.

begin;

-- 1. Admin duyệt / từ chối / gỡ: thêm p_expected_updated_at
drop function public.review_used_listing(bigint, public.used_listing_status, boolean, text);

-- Admin duyệt (pending → approved, kiểm lại sách đang bán + giá trần) hoặc từ chối / gỡ (pending | approved →
-- rejected, bắt buộc lý do). p_expected_status + p_expected_updated_at = trạng thái + updated_at của bản admin đang
-- thấy: khác → LISTING_STATUS_CHANGED (người bán sửa tin đã duyệt thì tin về pending với nội dung mới; chỉ so trạng
-- thái thì admin duyệt nội dung chưa xem). So sau khi khóa dòng: không còn khe giữa lúc đọc và lúc ghi.
create or replace function public.review_used_listing(
  p_id                  bigint,
  p_expected_status     public.used_listing_status,
  p_expected_updated_at timestamptz,
  p_approve             boolean,
  p_reason              text default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reason  text := nullif(btrim(p_reason), '');
  v_listing public.used_listings;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  if p_approve is null then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'approve')::text;
  end if;

  if p_expected_updated_at is null then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'expected_updated_at')::text;
  end if;

  select * into v_listing from public.used_listings where id = p_id for update;

  if not found
     or v_listing.status is distinct from p_expected_status
     or v_listing.updated_at is distinct from p_expected_updated_at then
    raise exception 'LISTING_STATUS_CHANGED';
  end if;

  if p_approve then
    if v_listing.status <> 'pending' then
      raise exception 'LISTING_INVALID_TRANSITION'
        using detail = json_build_object('from', v_listing.status, 'to', 'approved')::text;
    end if;

    perform private.used_check_book_price(v_listing.book_id, v_listing.price);
    -- Chốt cuối: không công khai tin thiếu ảnh (người bán không xóa được ảnh của tin chờ duyệt, nhưng service role /
    -- xóa tay trong Storage thì được). Mã riêng cho admin (người bán không làm gì sai): từ chối tin kèm lý do.
    if not private.used_photos_stored(v_listing.photos) then
      raise exception 'LISTING_PHOTOS_MISSING';
    end if;

    update public.used_listings
       set status = 'approved', approved_at = now(), reject_reason = null
     where id = v_listing.id;
    return;
  end if;

  if v_listing.status not in ('pending', 'approved') then
    raise exception 'LISTING_INVALID_TRANSITION'
      using detail = json_build_object('from', v_listing.status, 'to', 'rejected')::text;
  end if;

  if v_reason is null or char_length(v_reason) > 500 then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'reason', 'max', 500)::text;
  end if;

  update public.used_listings
     set status = 'rejected', reject_reason = v_reason
   where id = v_listing.id;
end;
$$;

revoke execute on function public.review_used_listing(bigint, public.used_listing_status, timestamptz, boolean, text) from public, anon;
grant  execute on function public.review_used_listing(bigint, public.used_listing_status, timestamptz, boolean, text) to authenticated;

-- 2. Mua một tin: thêm p_expected_updated_at
drop function public.place_used_order(bigint, bigint, public.payment_method, text, uuid, int);

-- Mua một tin (đơn riêng, không qua giỏ): idempotency như place_order (cùng key → trả đúng đơn đã tạo), khóa tin,
-- client không gửi giá (p_expected_total chỉ để so). Không đụng books.stock / sold_count.
-- Key dùng chung không gian với place_order (orders_user_idempotency_key: user_id + key): key của place_order gửi vào
-- đây trả đơn sách mới đó. Không trùng trong thực tế vì key sinh mới mỗi lần mở trang thanh toán.
-- p_expected_updated_at = updated_at của bản tin người mua đang xem (bắt buộc): tin bị sửa (tình trạng / mô tả / ảnh)
-- rồi được duyệt lại với cùng giá thì tổng không đổi → so thêm updated_at để người mua không mua nhầm bản đã đổi.
create or replace function public.place_used_order(
  p_listing_id          bigint,
  p_address_id          bigint,
  p_expected_updated_at timestamptz,
  p_payment_method      public.payment_method default 'cod',
  p_note                text default null,
  p_idempotency_key     uuid default null,
  p_expected_total      int default null
)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_user     uuid := auth.uid();
  v_note     text := nullif(btrim(p_note), '');
  v_addr     public.addresses;
  v_listing  public.used_listings;
  v_book     public.books;
  v_shipping int := private.flat_shipping_fee();
  v_total    int;
  v_order    public.orders;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_idempotency_key is null then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'idempotency_key')::text;
  end if;

  if p_expected_total is null then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'expected_total')::text;
  end if;

  if p_expected_updated_at is null then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'expected_updated_at')::text;
  end if;

  -- Cùng khóa với place_order: request song song cùng key chờ ở đây rồi thấy đơn của request đầu
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_idempotency_key::text, 0));

  -- Trước mọi kiểm tin: gửi lại cùng key sau khi đặt xong (tin đã sold, updated_at đã đổi) vẫn trả đúng đơn đã tạo
  select * into v_order from public.orders
   where user_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    return v_order;
  end if;

  if p_payment_method is null then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'payment_method')::text;
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

  select * into v_listing from public.used_listings where id = p_listing_id for update;
  if not found or v_listing.status <> 'approved' then
    raise exception 'LISTING_UNAVAILABLE';
  end if;

  if v_listing.seller_id = v_user then
    raise exception 'LISTING_OWN';
  end if;

  select * into v_book from public.books where id = v_listing.book_id;
  if not found or not v_book.is_active then
    raise exception 'BOOK_UNAVAILABLE'
      using detail = json_build_object('book_id', v_listing.book_id, 'title', v_book.title)::text;
  end if;

  v_total := v_listing.price + v_shipping;

  if p_expected_total <> v_total or v_listing.updated_at is distinct from p_expected_updated_at then
    raise exception 'LISTING_CHANGED'
      using detail = json_build_object('total', v_total)::text;
  end if;

  insert into public.orders (
    user_id, payment_method,
    recipient_name, phone, province, ward, street, note,
    subtotal, shipping_fee, discount, total, idempotency_key
  ) values (
    v_user, p_payment_method,
    v_addr.recipient_name, v_addr.phone, v_addr.province, v_addr.ward, v_addr.street, v_note,
    v_listing.price, v_shipping, 0, v_total, p_idempotency_key
  )
  returning * into v_order;

  insert into public.order_items (order_id, book_id, title, cover_url, unit_price, quantity, used_listing_id)
  values (v_order.id, v_book.id, v_book.title, v_book.cover_url, v_listing.price, 1, v_listing.id);

  update public.used_listings set status = 'sold' where id = v_listing.id;

  return v_order;
end;
$$;

revoke execute on function public.place_used_order(bigint, bigint, timestamptz, public.payment_method, text, uuid, int) from public, anon;
grant  execute on function public.place_used_order(bigint, bigint, timestamptz, public.payment_method, text, uuid, int) to authenticated;

-- 3. admin_seller_payouts
-- Khoản trả người bán cho trang admin (/admin/tra-nguoi-ban): kèm mã + trạng thái đơn (authenticated, kể cả admin,
-- không đọc được seller_payouts.order_id theo cột) và tên hiển thị người bán. Không trả gì của người mua (tên, email,
-- điện thoại, địa chỉ, user_id). Mỗi khoản gắn đúng một đơn (đơn đạt đã giao + đã thanh toán), không lẫn đơn đã hủy
-- của cùng tin.
create or replace function public.admin_seller_payouts()
returns table (
  id             bigint,
  order_id       bigint,
  order_code     text,
  order_status   public.order_status,
  payment_status public.payment_status,
  listing_id     bigint,
  seller_id      uuid,
  seller_name    text,
  title          text,
  price          int,
  fee            int,
  amount         int,
  status         text,
  paid_at        timestamptz,
  created_at     timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select p.id, p.order_id, o.order_code, o.status, o.payment_status, p.listing_id, p.seller_id, l.seller_name,
         p.title, p.price, p.fee, p.amount, p.status, p.paid_at, p.created_at
    from public.seller_payouts p
    join public.orders o on o.id = p.order_id
    join public.used_listings l on l.id = p.listing_id
   order by p.created_at desc, p.id desc;
end;
$$;

revoke execute on function public.admin_seller_payouts() from public, anon;
grant  execute on function public.admin_seller_payouts() to authenticated;

-- PostgREST nạp lại cache schema (chữ ký hàm đổi)
notify pgrst, 'reload schema';

commit;
