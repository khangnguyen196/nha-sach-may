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
         array(select u.w
                 from unnest(string_to_array(a.slug, '-')) with ordinality as u(w, n)
                where char_length(u.w) > 1
                order by u.n) as words,
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
--   so_tac_gia_khac: số tác giả KHÁC có role 'author' (không đếm dịch giả / minh họa) → > 0 thì bỏ liên kết tổ chức
--   không làm thẻ sách mất tác giả.
--   Lưu ý: ~* với chữ có dấu viết hoa (VD "NHÀ XUẤT BẢN") phụ thuộc collation / ctype của DB; các id đã biết liệt kê cứng
--   nên không sót, chỉ nhóm tìm thêm theo mẫu có thể sót.
select a.id, a.name, a.slug,
       b.id as book_id, b.title, ba.role,
       (select count(distinct o.author_id) from public.book_authors o
         where o.book_id = b.id and o.author_id <> a.id and o.role = 'author') as so_tac_gia_khac
  from public.authors a
  join public.book_authors ba on ba.author_id = a.id
  join public.books b on b.id = ba.book_id
 where a.id in (22, 24, 89, 107)
    or a.name ~* '(nhà xuất bản|^nxb|nhiều tác giả|tập thể|ban biên tập|various|publishing|press$|review$|ladybird|công ty|tổ chức|viện |hội )'
 order by a.id, b.title;

-- R5. Tên sách tiếng Việt không có dấu (dữ liệu Google Books mất dấu, VD "Kien Chuot Va Ruoi"):
--   không có chữ cái riêng của tiếng Việt nào và có ≥ 3 từ. Sách tên thật không dấu (tên riêng, tiếng Anh) sẽ lẫn vào → xem từng dòng.
--   Lưu ý: so khớp chữ có dấu (kể cả viết hoa) phụ thuộc collation / ctype của DB; danh sách ký tự dưới đây đã gồm cả hoa và thường.
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

-- R7. Tên sách còn hậu tố định dạng ("(hardcover)", "(hard cover…)", "(soft cover…)", "(paperback)", "(bìa cứng)", "(hộp…)"…),
--   kèm cột format hiện tại và format đề xuất theo hậu tố (chỉ để tham khảo). Slug giữ nguyên khi sửa tên.
--   CASE, WHERE và regexp_replace dùng CÙNG một bộ mẫu.
select b.id, b.title, b.slug, b.format as format_hien_tai,
       case
         when b.title ~* '\((hard\s*-?\s*(cover|back)|bìa cứng)' then 'hardcover'
         when b.title ~* '\((soft\s*-?\s*(cover|back)|paper\s*-?\s*(cover|back)|bìa mềm)' then 'paperback'
         when b.title ~* '\((box\s*-?\s*set|hộp)' then 'boxset'
       end as format_de_xuat,
       regexp_replace(b.title, '\s*\((hard\s*-?\s*(cover|back)|soft\s*-?\s*(cover|back)|paper\s*-?\s*(cover|back)|bìa cứng|bìa mềm|box\s*-?\s*set|hộp)[^)]*\)', '', 'gi') as ten_de_xuat
  from public.books b
 where b.title ~* '\((hard\s*-?\s*(cover|back)|soft\s*-?\s*(cover|back)|paper\s*-?\s*(cover|back)|bìa cứng|bìa mềm|box\s*-?\s*set|hộp)'
 order by b.id;
