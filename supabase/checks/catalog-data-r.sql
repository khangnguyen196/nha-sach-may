-- docs/plans/sau-ux.md mục 7: dọn dữ liệu tác giả / tên sách (dữ liệu Google Books).
-- MỌI CÂU CHỈ ĐỌC (select). Chạy trong SQL Editor, dán kết quả cho Claude; câu sửa (theo mẫu authors-fix.sql: guard
-- theo id + giá trị cũ, đếm dòng, rollback nếu lệch) chỉ viết SAU khi chủ dự án duyệt kết quả dưới đây.

-- R1. Các tác giả đã biết cần xem (trùng, hai người một dòng, tổ chức / chung chung), kèm sách + vai trò.
select a.id, a.name, a.slug,
       b.id as book_id, b.title, b.is_active, ba.role
  from public.authors a
  left join public.book_authors ba on ba.author_id = a.id
  left join public.books b on b.id = ba.book_id
 where a.id in (86, 87, 88, 113, 114, 90, 92, 93, 94, 75, 22, 24, 89, 107)
 order by a.id, b.title;

-- R2. Tìm thêm tác giả trùng cùng kiểu (bỏ chữ đệm / viết tắt): so từ đầu + từ cuối của slug sau khi bỏ chữ viết tắt
--   một ký tự ("peter-f-drucker" ~ "peter-drucker"). Mỗi cặp một dòng, kèm số sách mỗi bên.
with t as (
  select a.id, a.name, a.slug,
         array_remove(array(select w from unnest(string_to_array(a.slug, '-')) as w where char_length(w) > 1), null) as words,
         (select count(*) from public.book_authors ba where ba.author_id = a.id) as so_sach
    from public.authors a
),
k as (
  select id, name, slug, so_sach, words[1] || ' ' || words[cardinality(words)] as khoa
    from t
   where cardinality(words) >= 2
)
select k1.khoa,
       k1.id as id_1, k1.name as ten_1, k1.slug as slug_1, k1.so_sach as sach_1,
       k2.id as id_2, k2.name as ten_2, k2.slug as slug_2, k2.so_sach as sach_2
  from k k1
  join k k2 on k2.khoa = k1.khoa and k2.id > k1.id
 order by k1.khoa, k1.id, k2.id;

-- R3. Tác giả có thể là hai người một dòng ("A và B", "A and B", "A & B", "A, B").
select a.id, a.name, a.slug,
       (select count(*) from public.book_authors ba where ba.author_id = a.id) as so_sach
  from public.authors a
 where a.name ~* '\s(và|and)\s' or a.name like '%&%' or a.name like '%,%'
 order by a.id;

-- R4. Tác giả là tổ chức / chung chung (NXB, "Nhiều tác giả", tạp chí, thương hiệu sách), kèm sách + vai trò.
--   Sách còn tác giả khác (cot so_tac_gia_khac > 0) → bỏ liên kết tổ chức không làm sách mất tác giả.
select a.id, a.name, a.slug,
       b.id as book_id, b.title, ba.role,
       (select count(*) from public.book_authors o where o.book_id = b.id and o.author_id <> a.id) as so_tac_gia_khac
  from public.authors a
  join public.book_authors ba on ba.author_id = a.id
  join public.books b on b.id = ba.book_id
 where a.id in (22, 24, 89, 107)
    or a.name ~* '(nhà xuất bản|^nxb|nhiều tác giả|tập thể|ban biên tập|various|publishing|press$|review$|ladybird|công ty|tổ chức|viện |hội )'
 order by a.id, b.title;

-- R5. Tên sách tiếng Việt không có dấu (dữ liệu Google Books mất dấu, VD "Kien Chuot Va Ruoi"):
--   không có chữ cái riêng của tiếng Việt nào và có ≥ 3 từ. Sách tên thật không dấu (tên riêng, tiếng Anh) sẽ lẫn vào → xem từng dòng.
select b.id, b.title, b.slug, b.language, b.is_active
  from public.books b
 where b.language = 'vi'
   and b.title !~ '[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]'
   and cardinality(regexp_split_to_array(btrim(b.title), '\s+')) >= 3
 order by b.title;

-- R6. Tên sách sai chính tả đã biết ("chân dùng" → "chân dung").
select b.id, b.title, b.slug, b.is_active
  from public.books b
 where b.title ilike '%chân dùng%'
 order by b.id;

-- R7. Tên sách còn hậu tố định dạng ("(hardcover)", "(hard cover…)", "(soft cover…)", "(paperback)", "(bìa cứng)"…),
--   kèm cột format hiện tại và format đề xuất theo hậu tố (chỉ để tham khảo). Slug giữ nguyên khi sửa tên.
select b.id, b.title, b.slug, b.format as format_hien_tai,
       case
         when b.title ~* '\((hard\s*-?\s*cover|hardback|bìa cứng)' then 'hardcover'
         when b.title ~* '\((soft\s*-?\s*cover|paper\s*-?\s*back|bìa mềm)' then 'paperback'
         when b.title ~* '\((box\s*-?\s*set|hộp)' then 'boxset'
       end as format_de_xuat,
       regexp_replace(b.title, '\s*\((hard|soft|paper)\s*-?\s*(cover|back)[^)]*\)|\s*\((hardback|box\s*-?\s*set|bìa cứng|bìa mềm)[^)]*\)', '', 'gi') as ten_de_xuat
  from public.books b
 where b.title ~* '\((hard|soft|paper)\s*-?\s*(cover|back)|\((hardback|box\s*-?\s*set|bìa cứng|bìa mềm)'
 order by b.id;
