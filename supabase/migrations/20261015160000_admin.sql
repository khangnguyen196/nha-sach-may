-- Phase 7: admin.
--   1. Luồng trạng thái đơn chặn ở DB (mọi role, kể cả service role): pending → confirmed → shipping → delivered,
--      hủy được từ pending / confirmed / shipping; delivered và cancelled là trạng thái cuối.
--      Mã lỗi mới ORDER_INVALID_TRANSITION (detail {"from", "to"}); cancelled → * vẫn là ORDER_REOPEN_FORBIDDEN.
--   2. Đơn COD chuyển delivered → payment_status = 'paid' trong cùng trigger.
--   3. Quyền cột: orders chỉ cho sửa status, payment_status, cancelled_reason; books chỉ cho sửa cột admin sửa được
--      (bỏ cột do DB quản lý). RLS giữ nguyên: policy *_admin_update đã giới hạn dòng cho admin.
--   4. Bucket book-covers chỉ nhận image/webp ≤ 1MB.
-- Chạy một lần trong SQL Editor. Idempotent (create or replace, revoke / grant, update).

begin;

-- 1 + 2. Bảng chuyển trạng thái hợp lệ. App có bản trùng (nextStatuses, Phase 7b) → sửa cả hai chỗ.
create or replace function private.order_status_transition_allowed(
  p_from public.order_status,
  p_to   public.order_status
)
returns boolean language sql immutable set search_path = '' as $$
  select case p_from
    when 'pending'   then p_to in ('confirmed', 'cancelled')
    when 'confirmed' then p_to in ('shipping', 'cancelled')
    when 'shipping'  then p_to in ('delivered', 'cancelled')
    else false
  end;
$$;

-- Trigger orders_status_change (before update of status) giữ nguyên, chỉ thay hàm.
-- Hủy → hoàn tồn kho và lượt dùng voucher; COD giao xong → đã thanh toán.
create or replace function public.handle_order_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Câu update có cột status nhưng không đổi giá trị: không phải chuyển trạng thái
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'cancelled' then
    raise exception 'ORDER_REOPEN_FORBIDDEN';
  end if;

  if not private.order_status_transition_allowed(old.status, new.status) then
    raise exception 'ORDER_INVALID_TRANSITION'
      using detail = json_build_object('from', old.status, 'to', new.status)::text;
  end if;

  if new.status = 'cancelled' then
    update public.books b
       set stock      = b.stock + oi.quantity,
           sold_count = greatest(b.sold_count - oi.quantity, 0)
      from public.order_items oi
     where oi.order_id = new.id and oi.book_id = b.id;

    if new.voucher_id is not null then
      update public.vouchers
         set used_count = greatest(used_count - 1, 0)
       where id = new.voucher_id;
    end if;
  end if;

  if new.status = 'delivered' and new.payment_method = 'cod' then
    new.payment_status := 'paid';
  end if;

  return new;
end;
$$;

-- 3. Quyền cột. Postgres chỉ xét cột có trong câu UPDATE: cột do trigger BEFORE ghi (updated_at, search_text,
-- payment_status khi giao COD) không bị chặn; hàm security definer (place_order, cancel_order, các trigger
-- *_touch_book*, refresh_book_rating) chạy bằng quyền owner. Revoke cả bảng cũng thu hồi quyền cột cũ.
revoke update on public.orders from anon, authenticated;
grant  update (status, payment_status, cancelled_reason) on public.orders to authenticated;

revoke update on public.books from anon, authenticated;
grant  update (
  title, slug, subtitle, description, description_en, category_id, publisher_id, isbn,
  price, original_price, stock, cover_url, page_count, format, language, published_year,
  weight_grams, dimensions, is_active, is_featured
) on public.books to authenticated;

-- 4. Server chỉ upload WebP đã xử lý (rộng 600px ≈ 30–120KB): bucket từ chối mọi thứ khác,
-- kể cả khi có phiên admin và gọi thẳng Storage API.
update storage.buckets
   set allowed_mime_types = array['image/webp'],
       file_size_limit    = 1048576
 where id = 'book-covers';

commit;
