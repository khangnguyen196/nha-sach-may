-- =====================================================================
-- DANH MỤC "SÁCH NGOẠI VĂN" (sách tiếng Anh). Chỉ INSERT, chạy được nhiều lần (bỏ qua slug đã có).
-- Chạy SAU seed.sql: Supabase Dashboard → SQL Editor → dán → Run.
-- Script import cho phép language 'en' riêng các danh mục này (khai báo trong scripts/book-list.json).
-- =====================================================================

insert into public.categories (name, name_en, slug, sort_order) values
  ('Sách ngoại văn', 'Foreign Books', 'sach-ngoai-van', 7)
on conflict (slug) do nothing;

insert into public.categories (parent_id, name, name_en, slug, sort_order)
select p.id, c.name, c.name_en, c.slug, c.sort_order
from (values
  ('Văn học',              'Fiction',              'ngoai-van-van-hoc',          1),
  ('Kinh doanh',           'Business',             'ngoai-van-kinh-doanh',       2),
  ('Kỹ năng sống',         'Self-help',            'ngoai-van-ky-nang-song',     3),
  ('Thiếu nhi',            'Children''s Books',    'ngoai-van-thieu-nhi',        4),
  ('Lịch sử - Khoa học',   'History & Science',    'ngoai-van-lich-su-khoa-hoc', 5)
) as c(name, name_en, slug, sort_order)
join public.categories p on p.slug = 'sach-ngoai-van'
on conflict (slug) do nothing;
