-- Phase 8: chiều rộng thật (px) của ảnh bìa đang nằm ở cover_url.
--   • Kệ trang chủ ưu tiên sách bìa nét (cover_width >= 300); null = chưa đo / không có bìa.
--   • Ai ghi: script import, upload bìa ở admin, scripts/covers.ts (--measure đo toàn bộ bìa hiện có sau khi chạy file này).
--   • Không phải cột do DB quản lý → thêm vào quyền cột update của admin.
-- Chạy một lần trong SQL Editor. Idempotent (add column if not exists, revoke / grant). Không đổi dữ liệu có sẵn.

begin;

alter table public.books
  add column if not exists cover_width smallint
  constraint books_cover_width_check check (cover_width between 1 and 10000);

-- Admin upload bìa ghi cover_width bằng client theo phiên → cùng danh sách quyền cột với 20261015160000_admin.sql + cover_width
revoke update on public.books from anon, authenticated;
grant  update (
  title, slug, subtitle, description, description_en, category_id, publisher_id, isbn,
  price, original_price, stock, cover_url, cover_width, page_count, format, language, published_year,
  weight_grams, dimensions, is_active, is_featured
) on public.books to authenticated;

commit;

-- Kiểm tra sau khi chạy (kỳ vọng: 1 dòng smallint; 'YES' cho authenticated):
--   select data_type from information_schema.columns where table_schema = 'public' and table_name = 'books' and column_name = 'cover_width';
--   select privilege_type, is_grantable from information_schema.column_privileges
--    where table_schema = 'public' and table_name = 'books' and column_name = 'cover_width' and grantee = 'authenticated';
