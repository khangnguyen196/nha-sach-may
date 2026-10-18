-- =====================================================================
-- DỮ LIỆU KHỞI TẠO: danh mục + mã giảm giá
-- Chạy SAU schema.sql. Sách, tác giả, NXB thật được nạp bằng:
--   npm run import:books
-- =====================================================================

-- ---------- Danh mục cha ----------
insert into public.categories (name, name_en, slug, sort_order) values
  ('Văn học',               'Literature',          'van-hoc',             1),
  ('Kinh tế',               'Business',            'kinh-te',             2),
  ('Tâm lý - Kỹ năng sống', 'Psychology & Self-help', 'tam-ly-ky-nang-song', 3),
  ('Thiếu nhi',             'Children',            'thieu-nhi',           4),
  ('Sách học ngoại ngữ',    'Language Learning',   'sach-hoc-ngoai-ngu',  5),
  ('Lịch sử - Địa lý',      'History & Geography', 'lich-su-dia-ly',      6);

-- ---------- Danh mục con ----------
insert into public.categories (parent_id, name, name_en, slug, sort_order)
select p.id, c.name, c.name_en, c.slug, c.sort_order
from (values
  ('van-hoc',             'Tiểu thuyết',           'Novels',                 'tieu-thuyet',         1),
  ('van-hoc',             'Truyện ngắn - Tản văn', 'Short Stories & Essays', 'truyen-ngan-tan-van', 2),
  ('van-hoc',             'Thơ',                   'Poetry',                 'tho',                 3),
  ('kinh-te',             'Quản trị - Lãnh đạo',   'Management & Leadership','quan-tri-lanh-dao',   1),
  ('kinh-te',             'Marketing - Bán hàng',  'Marketing & Sales',      'marketing-ban-hang',  2),
  ('kinh-te',             'Tài chính cá nhân',     'Personal Finance',       'tai-chinh-ca-nhan',   3),
  ('tam-ly-ky-nang-song', 'Kỹ năng sống',          'Life Skills',            'ky-nang-song',        1),
  ('tam-ly-ky-nang-song', 'Tâm lý học',            'Psychology',             'tam-ly-hoc',          2),
  ('thieu-nhi',           'Truyện tranh',          'Picture Books & Comics', 'truyen-tranh',        1),
  ('thieu-nhi',           'Kiến thức bách khoa',   'Encyclopedia',           'kien-thuc-bach-khoa', 2),
  ('sach-hoc-ngoai-ngu',  'Tiếng Anh',             'English',                'tieng-anh',           1),
  ('sach-hoc-ngoai-ngu',  'Tiếng Nhật',            'Japanese',               'tieng-nhat',          2)
) as c(parent_slug, name, name_en, slug, sort_order)
join public.categories p on p.slug = c.parent_slug;

-- ---------- Mã giảm giá mẫu ----------
-- is_public: hiện trong gợi ý ở trang thanh toán (cột mặc định false; production bật từng mã trong admin)
insert into public.vouchers (code, description, description_en, discount_type, discount_value, max_discount, min_order_value, is_public) values
  ('CHAOBAN10', 'Giảm 10% tối đa 50.000đ cho đơn từ 150.000đ', '10% off (up to 50,000₫) on orders from 150,000₫', 'percent', 10,    50000, 150000, true),
  ('GIAM20K',   'Giảm 20.000đ cho đơn từ 200.000đ',            '20,000₫ off on orders from 200,000₫',               'fixed',   20000, null,  200000, true);
