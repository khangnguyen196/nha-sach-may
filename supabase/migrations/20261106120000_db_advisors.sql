-- db-advisors (Supabase advisors 2026-11-06): chỉ sửa cấu trúc / quyền, KHÔNG đổi dữ liệu.
--   (a) Thu EXECUTE của public / anon / authenticated trên 9 hàm trigger security definer (advisors
--       anon_/authenticated_security_definer_function_executable). Trigger vẫn chạy: Postgres chỉ kiểm quyền EXECUTE
--       của hàm trigger lúc CREATE TRIGGER, không kiểm lúc trigger chạy. Owner (postgres) và service_role giữ nguyên.
--   (b) 7 index cho khóa ngoại chưa có index (advisor unindexed_foreign_keys): xóa / sửa dòng cha không phải quét cả
--       bảng con. Bảng nhỏ nên tạo index thường trong transaction (không concurrently).
--   (c) Gộp 2 policy SELECT của used_listings thành một (advisor multiple_permissive_policies). Policy permissive vốn
--       gộp bằng OR → kết quả y hệt: anon (auth.uid() null, is_admin() false) chỉ thấy approved / sold; authenticated
--       thấy approved / sold + tin của mình; admin thấy tất cả. Quyền select theo cột không đổi.
-- Chạy MỘT lần trong SQL Editor (cả file là một transaction). Không dùng if exists / if not exists: chạy lần 2 lỗi ở
-- câu đầu tiên đụng đối tượng đã có / đã mất, rollback, không đổi gì.

begin;

set local lock_timeout = '5s';

-- (a) Hàm trigger không gọi qua /rest/v1/rpc được nữa
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.book_authors_touch_book() from public, anon, authenticated;
revoke execute on function public.authors_touch_books() from public, anon, authenticated;
revoke execute on function public.handle_order_status_change() from public, anon, authenticated;
revoke execute on function public.reviews_set_display_name() from public, anon, authenticated;
revoke execute on function public.refresh_book_rating() from public, anon, authenticated;
revoke execute on function public.used_listings_set_seller_name() from public, anon, authenticated;
revoke execute on function public.used_listings_status_change() from public, anon, authenticated;
revoke execute on function public.handle_used_order_change() from public, anon, authenticated;

-- (b) Index cho khóa ngoại
create index cart_items_book_id_idx on public.cart_items (book_id);
create index orders_voucher_id_idx on public.orders (voucher_id);
create index reviews_user_id_idx on public.reviews (user_id);
create index seller_payouts_listing_id_idx on public.seller_payouts (listing_id);
-- user_blocks: mỗi dòng chỉ có giá trị ở đúng một cột đích theo kind (check user_blocks_target_check), cột còn lại null
-- → index một phần bỏ dòng null. Câu xóa của khóa ngoại (<cột> = $1) suy ra <cột> is not null nên vẫn dùng được index.
create index user_blocks_category_id_idx on public.user_blocks (category_id) where category_id is not null;
create index user_blocks_author_id_idx on public.user_blocks (author_id) where author_id is not null;
create index user_blocks_publisher_id_idx on public.user_blocks (publisher_id) where publisher_id is not null;

-- (c) Một policy SELECT cho used_listings
drop policy "used_listings_public_read" on public.used_listings;
drop policy "used_listings_select_own_or_admin" on public.used_listings;
create policy "used_listings_select" on public.used_listings
  for select to anon, authenticated
  using (status in ('approved', 'sold') or seller_id = (select auth.uid()) or (select public.is_admin()));

notify pgrst, 'reload schema';

commit;
