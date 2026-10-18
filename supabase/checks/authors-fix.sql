-- docs/plans/ux-messages.md mục 16: sửa tên tác giả bị ngược thứ tự (dữ liệu Google Books) + gộp tác giả trùng.
-- Danh sách do chủ dự án duyệt tay (đã xác nhận qua bìa sách), KHÔNG suy tự động từ R1.
-- CHỈ chạy sau khi được duyệt. Chạy trong SQL Editor: phần 1 (một transaction), rồi phần 2 (chỉ đọc).
-- Không đổi slug (link cũ của trang tác giả chạy tiếp), không đổi bảng books (search_text do trigger tự tính lại).
-- SAU KHI CHẠY: Redeploy trên Vercel (trang đã prerender + catalog rút gọn của chatbot đang cache tên cũ; SQL chạy
-- ngoài app nên không làm mới cache).

-- =====================================================================
-- PHẦN 1. Đổi tên + gộp. Lệch bất kỳ số dòng nào → raise exception → rollback cả khối, không đổi gì.
-- =====================================================================
begin;

do $$
declare
  n     int;
  extra int;
begin
  -- 1. Đổi 8 tên: chỉ sửa khi tên trong DB còn đúng tên cũ (chạy lại / dữ liệu đã đổi → 0 dòng → rollback)
  update public.authors a
     set name = v.new_name
    from (values
      (3,  'Thụy Dương',         'Dương Thụy'),
      (5,  'Tá Nhí Nguyễn',      'Nguyễn Tá Nhí'),
      (6,  'Huy Thiệp Nguyễn',   'Nguyễn Huy Thiệp'),
      (13, 'Luan Hoan',          'Luân Hoán'),
      (14, 'Dong Ngac Nguyen',   'Nguyễn Đông Ngạc'),
      (28, 'Bach Thao Ho',       'Hồ Bạch Thảo'),
      (31, 'Nguyen Phuong Ngoc', 'Nguyễn Phương Ngọc'),
      (63, 'Thế Dân Quan',       'Quan Thế Dân')
    ) as v(id, old_name, new_name)
   where a.id = v.id
     and a.name = v.old_name;
  get diagnostics n = row_count;
  if n <> 8 then
    raise exception 'Đổi tên: % / 8 dòng khớp tên cũ (dữ liệu đã khác danh sách duyệt) → rollback, không đổi gì', n;
  end if;

  -- 2. Gộp id 8 "Lap Nguyen" và id 9 "Quang Lập Nguyễn" vào id 1 "Nguyễn Quang Lập"
  perform 1 from public.authors where id = 1 and name = 'Nguyễn Quang Lập';
  if not found then
    raise exception 'Gộp: id 1 không còn là "Nguyễn Quang Lập" → rollback';
  end if;
  select count(*) into n from public.authors
   where (id = 8 and name = 'Lap Nguyen') or (id = 9 and name = 'Quang Lập Nguyễn');
  if n <> 2 then
    raise exception 'Gộp: id 8 / 9 không khớp tên dự kiến (% / 2 dòng) → rollback', n;
  end if;

  -- id 8, 9 chỉ được gắn sách "Kien Chuot Va Ruoi"; gắn sách khác ngoài dự kiến → dừng để xem lại
  select count(*) into extra
    from public.book_authors ba
    join public.books b on b.id = ba.book_id
   where ba.author_id in (8, 9)
     and b.title <> 'Kien Chuot Va Ruoi';
  if extra > 0 then
    raise exception 'Gộp: id 8 / 9 còn gắn % liên kết sách khác ngoài "Kien Chuot Va Ruoi" → rollback', extra;
  end if;

  -- Chuyển liên kết sang id 1; khóa chính (book_id, author_id, role) → bỏ qua dòng trùng
  insert into public.book_authors (book_id, author_id, role)
  select ba.book_id, 1, ba.role
    from public.book_authors ba
   where ba.author_id in (8, 9)
  on conflict (book_id, author_id, role) do nothing;

  -- Mọi liên kết của id 8, 9 đã có ở id 1 (cùng sách, cùng vai trò)
  select count(*) into extra
    from public.book_authors x
   where x.author_id in (8, 9)
     and not exists (
       select 1 from public.book_authors y
        where y.author_id = 1 and y.book_id = x.book_id and y.role = x.role
     );
  if extra > 0 then
    raise exception 'Gộp: % liên kết của id 8 / 9 chưa có ở id 1 → rollback', extra;
  end if;

  -- id 1 gắn "Kien Chuot Va Ruoi" đúng 1 lần (vai trò khác nhau sẽ thành 2 dòng → dừng để xem lại)
  select count(*) into n
    from public.book_authors ba
    join public.books b on b.id = ba.book_id
   where ba.author_id = 1
     and b.title = 'Kien Chuot Va Ruoi';
  if n <> 1 then
    raise exception 'Gộp: id 1 gắn "Kien Chuot Va Ruoi" % lần (mong đợi 1) → rollback', n;
  end if;

  delete from public.book_authors where author_id in (8, 9);
  delete from public.authors where id in (8, 9);
  get diagnostics n = row_count;
  if n <> 2 then
    raise exception 'Gộp: xóa được % / 2 tác giả → rollback', n;
  end if;
end $$;

commit;

-- =====================================================================
-- PHẦN 2. Kiểm tra sau khi chạy (CHỈ ĐỌC). Đối chiếu cột mong_doi.
-- =====================================================================

-- K1. 8 tên mới. Mong đợi: 8 dòng, dung = true ở mọi dòng
select v.id, a.name, v.new_name as mong_doi, a.name = v.new_name as dung
  from (values
    (3, 'Dương Thụy'), (5, 'Nguyễn Tá Nhí'), (6, 'Nguyễn Huy Thiệp'), (13, 'Luân Hoán'),
    (14, 'Nguyễn Đông Ngạc'), (28, 'Hồ Bạch Thảo'), (31, 'Nguyễn Phương Ngọc'), (63, 'Quan Thế Dân')
  ) as v(id, new_name)
  left join public.authors a on a.id = v.id
 order by v.id;

-- K2. id 8, 9 không còn (tác giả lẫn liên kết sách). Mong đợi: 0 | 0
select (select count(*) from public.authors where id in (8, 9))          as tac_gia_8_9,
       (select count(*) from public.book_authors where author_id in (8, 9)) as lien_ket_8_9;

-- K3. id 1 gắn sách "Kien Chuot Va Ruoi" đúng 1 lần. Mong đợi: 1
select count(*) as so_lan
  from public.book_authors ba
  join public.books b on b.id = ba.book_id
 where ba.author_id = 1
   and b.title = 'Kien Chuot Va Ruoi';

-- K4. Cột tìm kiếm (search_text, trigger tự tính lại) của sách liên quan đã có tên mới (không dấu).
--     Mong đợi: mỗi sách của các tác giả trên một dòng, co_ten_moi = true ở mọi dòng
select a.id as tac_gia, a.name, b.id as sach, b.title,
       b.search_text like '%' || public.normalize_vi(a.name) || '%' as co_ten_moi
  from public.authors a
  join public.book_authors ba on ba.author_id = a.id
  join public.books b on b.id = ba.book_id
 where a.id in (1, 3, 5, 6, 13, 14, 28, 31, 63)
 order by a.id, b.id;

-- K5. Slug không đổi (link cũ chạy tiếp). Mong đợi: slug như trước khi chạy (VD id 6 vẫn "huy-thiep-nguyen")
select id, name, slug from public.authors where id in (1, 3, 5, 6, 13, 14, 28, 31, 63) order by id;
