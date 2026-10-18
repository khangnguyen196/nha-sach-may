-- docs/plans/ux-messages.md mục 16: tên tác giả bị ngược thứ tự (dữ liệu Google Books, VD "Huy Thiệp Nguyễn").
-- CẢ HAI CÂU CHỈ ĐỌC. Chạy trong SQL Editor rồi dán kết quả cho Claude; câu UPDATE sẽ viết riêng theo danh sách bạn duyệt.
-- So khớp trên slug (đã bỏ dấu, chữ thường) nên không phải xử lý dấu.

-- R1. Tác giả có từ CUỐI là họ Việt phổ biến, từ ĐẦU không phải họ "chắc".
--   muc = 'chắc': họ hầu như không dùng làm tên riêng → gần như chắc bị ngược.
--   muc = 'cần xem': họ cũng hay là tên riêng (Mai, Hà, Lâm, Hoàng…) → xem từng dòng.
--   co_dau_viet = false: tên không có chữ cái riêng của tiếng Việt → có thể là tên nước ngoài, xem kỹ.
--   ten_de_xuat: đưa từ cuối lên đầu (chỉ để tham khảo).
with surnames(s, muc) as (values
  ('nguyen', 'chắc'), ('tran', 'chắc'), ('pham', 'chắc'), ('huynh', 'chắc'), ('phan', 'chắc'), ('vu', 'chắc'),
  ('vo', 'chắc'), ('dang', 'chắc'), ('bui', 'chắc'), ('do', 'chắc'), ('ngo', 'chắc'), ('dinh', 'chắc'),
  ('doan', 'chắc'), ('trinh', 'chắc'), ('truong', 'chắc'), ('le', 'chắc'), ('luong', 'chắc'), ('quach', 'chắc'),
  ('ta', 'chắc'),
  ('hoang', 'cần xem'), ('duong', 'cần xem'), ('ho', 'cần xem'), ('ly', 'cần xem'), ('mai', 'cần xem'),
  ('ha', 'cần xem'), ('lam', 'cần xem'), ('cao', 'cần xem'), ('to', 'cần xem'), ('chau', 'cần xem'),
  ('thai', 'cần xem'), ('luu', 'cần xem'), ('kieu', 'cần xem'), ('chu', 'cần xem'), ('trieu', 'cần xem'),
  ('van', 'cần xem')
),
a as (
  select au.id, au.name, au.slug,
         split_part(au.slug, '-', 1)                                   as first_word,
         regexp_replace(au.slug, '^.*-', '')                           as last_word,
         cardinality(regexp_split_to_array(btrim(au.name), '\s+'))     as so_tu,
         au.name ~ '[ăâđêôơưĂÂĐÊÔƠƯạ-ỹ]'                               as co_dau_viet,
         (select count(*) from public.book_authors ba where ba.author_id = au.id) as so_sach
    from public.authors au
)
select a.id, a.name, a.slug, s.muc, a.co_dau_viet, a.so_sach,
       regexp_replace(btrim(a.name), '^(.*\S)\s+(\S+)$', '\2 \1') as ten_de_xuat
  from a
  join surnames s on s.s = a.last_word
 where a.so_tu between 2 and 4
   and a.first_word not in (select s from surnames where muc = 'chắc')
 order by s.muc, a.co_dau_viet desc, a.name;

-- R2. Cặp tác giả cùng tập từ nhưng khác thứ tự (VD "Nguyễn Huy Thiệp" và "Huy Thiệp Nguyễn" là 2 dòng):
--   cùng một người bị tách đôi → khi sửa phải gộp sách về một id (Claude sẽ đề xuất giữ id nào).
select a1.id as id_1, a1.name as ten_1, a1.slug as slug_1,
       a2.id as id_2, a2.name as ten_2, a2.slug as slug_2
  from public.authors a1
  join public.authors a2 on a1.id < a2.id
 where (select array_agg(w order by w) from unnest(string_to_array(a1.slug, '-')) w)
     = (select array_agg(w order by w) from unnest(string_to_array(a2.slug, '-')) w)
 order by a1.name;
