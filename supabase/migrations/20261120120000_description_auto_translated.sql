-- mo-ta-song-ngu: cột đánh dấu mô tả là bản dịch tự động (docs/plans/mo-ta-song-ngu.md). Chỉ thêm cột, KHÔNG đổi dữ
-- liệu: mọi sách có sẵn nhận false. Phần nào là bản dịch xác định theo books.language: sách 'vi' → description_en, sách
-- 'en' → description. Trang sách hiện dòng "Bản dịch tự động" khi cờ = true và đang hiện phần dịch; admin sửa phần dịch
-- (hoặc đổi ngôn ngữ sách) thì app ghi false → admin cần quyền update cột này (grant bên dưới).
-- Chạy MỘT lần trong SQL Editor, TRƯỚC file ghi dữ liệu bản dịch (cả file là một transaction). Không dùng if not
-- exists: chạy lần 2 lỗi "already exists" ở câu đầu, rollback, không đổi gì.

begin;

set local lock_timeout = '5s';

alter table public.books add column description_auto_translated boolean not null default false;

-- Cùng danh sách quyền cột với 20261025000000_prefs_warnings.sql + cột mới
revoke update on public.books from anon, authenticated;
grant  update (
  title, slug, subtitle, description, description_en, description_auto_translated, category_id, publisher_id, isbn,
  price, original_price, stock, cover_url, cover_width, page_count, format, language, published_year,
  weight_grams, dimensions, is_active, is_featured, content_warnings, content_warnings_reviewed_at
) on public.books to authenticated;

commit;
