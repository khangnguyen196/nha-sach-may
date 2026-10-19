-- docs/plans/sau-ux.md mục 7: dọn dữ liệu tác giả / tên sách (dữ liệu Google Books). Danh sách do chủ dự án duyệt
-- (2026-10-19) sau khi xem kết quả supabase/checks/catalog-data-r.sql; KHÔNG suy tự động.
-- CHỈ chạy sau khi được duyệt (kiểm thử trên bản sao trước). SQL Editor: phần 0 (chỉ đọc, lưu kết quả lại), phần 1
-- (một khối DO = một lệnh nguyên tử: raise → không đổi gì), rồi phần 2 (chỉ đọc).
-- SQL Editor chỉ hiện kết quả của câu CUỐI khi chạy nhiều câu một lần → bôi đen TỪNG câu (P0a, P0b, khối DO, C1…C7)
-- rồi Run, đừng chạy cả file.
-- Không đổi slug của dòng còn lại (link cũ chạy tiếp). search_text do trigger tự tính lại.
-- Trường hợp R2 / R5 tìm thêm (tác giả trùng khác, tên không dấu khác) làm ở file sau, không ở đây.
-- SAU KHI CHẠY: Redeploy trên Vercel (trang đã prerender + catalog rút gọn của chatbot đang cache dữ liệu cũ; SQL chạy
-- ngoài app nên không làm mới cache).

-- =====================================================================
-- PHẦN 0. CHỈ ĐỌC, chạy TRƯỚC phần 1 và lưu kết quả.
-- =====================================================================
-- P0a. Slug hiện tại để đối chiếu C2 / C5 sau khi chạy.
select 'tac_gia' as loai, id, name as ten, slug from public.authors where id in (75, 87, 90, 94, 114)
union all
select 'sach', id, title, slug from public.books
 where title in (
   'Kien Chuot Va Ruoi',
   'Mười chín chân dùng nhà văn cùng thời',
   'Ngôn Ngữ - Tuyển Tập Truyện Ngắn Chọn Lọc 2025 (hardcover)',
   'Những Truyện Ngắn Hay Nhất Của Quê Hương Chúng Ta (soft cover - groundwood paper - new edition)',
   'Lịch Sử Việt Nam Thời Tự Chủ - Tập Hai (hard cover - groundwood)',
   'Lịch Sử Việt Nam Thời Tự Chủ - Tập Một (hard cover - groundwood)'
 )
 order by loai, id;

-- P0b. "Anthony Reid" đã có dưới slug khác? Phần 1 chỉ tìm theo slug `anthony-reid`: có dòng tên Anthony Reid mà slug
--      khác thì DỪNG, báo lại (chạy sẽ tạo bản trùng).
select id, name, slug from public.authors where name ilike '%anthony%reid%' order by id;

-- =====================================================================
-- PHẦN 1. Lệch bất kỳ số dòng / giá trị nào → raise exception → cả khối DO không đổi gì (DO là một lệnh nguyên tử;
-- không bọc begin / commit để phiên SQL Editor không kẹt ở trạng thái "transaction aborted" khi raise).
-- =====================================================================
do $$
declare
  n       int;
  extra   int;
  m       record;
  reid_id bigint;
  b_id    bigint;
begin
  -- -------------------------------------------------------------------
  -- 1. Gộp tác giả trùng: id giữ ← id gộp. Chỉ chạy khi tên trong DB còn đúng tên đã duyệt.
  --    KHÔNG gộp 101 "Stephen R. Covey" với 104 "Stephen M.R. Covey" (hai người), không đụng 99 "Dale Carnegie Training".
  -- -------------------------------------------------------------------
  create temp table merge_plan (keep_id bigint, keep_name text, drop_id bigint, drop_name text) on commit drop;
  insert into merge_plan values
    (87,  'Peter F. Drucker', 86,  'Peter Ferdinand Drucker'),
    (87,  'Peter F. Drucker', 88,  'Peter Drucker'),
    (114, 'Stephen Hawking',  113, 'Stephen W. Hawking'),
    (90,  'Jim Collins',      92,  'James Charles Collins'),
    (94,  'Jerry Porras',     93,  'Jerry I. Porras');

  select count(*) into n
    from merge_plan p
    join public.authors k on k.id = p.keep_id and k.name = p.keep_name
    join public.authors d on d.id = p.drop_id and d.name = p.drop_name;
  if n <> 5 then
    raise exception 'Gộp: % / 5 cặp khớp id + tên đã duyệt (dữ liệu đã khác) → rollback, không đổi gì', n;
  end if;

  -- Chuyển liên kết sang id giữ; khóa chính (book_id, author_id, role) → bỏ qua dòng đã có
  insert into public.book_authors (book_id, author_id, role)
  select ba.book_id, p.keep_id, ba.role
    from merge_plan p
    join public.book_authors ba on ba.author_id = p.drop_id
  on conflict (book_id, author_id, role) do nothing;

  -- Mọi liên kết của id gộp đã có ở id giữ (cùng sách, cùng vai trò)
  select count(*) into extra
    from merge_plan p
    join public.book_authors x on x.author_id = p.drop_id
   where not exists (
     select 1 from public.book_authors y
      where y.author_id = p.keep_id and y.book_id = x.book_id and y.role = x.role
   );
  if extra > 0 then
    raise exception 'Gộp: % liên kết của id gộp chưa có ở id giữ → rollback', extra;
  end if;

  delete from public.book_authors where author_id in (select drop_id from merge_plan);
  delete from public.authors where id in (select drop_id from merge_plan);
  get diagnostics n = row_count;
  if n <> 5 then
    raise exception 'Gộp: xóa được % / 5 tác giả → rollback', n;
  end if;

  -- -------------------------------------------------------------------
  -- 2. Tách id 75 "Trần Tuyết Nhung và Anthony Reid": id 75 → "Trần Tuyết Nhung" (giữ slug), Anthony Reid là tác giả
  --    riêng (slug anthony-reid; đã có thì dùng dòng đó), gắn vào đúng các sách id 75 đang gắn, cùng vai trò.
  -- -------------------------------------------------------------------
  update public.authors set name = 'Trần Tuyết Nhung'
   where id = 75 and name = 'Trần Tuyết Nhung và Anthony Reid';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Tách: id 75 không còn là "Trần Tuyết Nhung và Anthony Reid" → rollback';
  end if;

  select id into reid_id from public.authors where slug = 'anthony-reid';
  if reid_id is null then
    insert into public.authors (name, slug) values ('Anthony Reid', 'anthony-reid') returning id into reid_id;
  else
    perform 1 from public.authors where id = reid_id and name = 'Anthony Reid';
    if not found then
      raise exception 'Tách: slug anthony-reid đã có nhưng tên không phải "Anthony Reid" → rollback';
    end if;
  end if;

  insert into public.book_authors (book_id, author_id, role)
  select ba.book_id, reid_id, ba.role
    from public.book_authors ba
   where ba.author_id = 75
  on conflict (book_id, author_id, role) do nothing;

  select count(*) into extra
    from public.book_authors x
   where x.author_id = 75
     and not exists (
       select 1 from public.book_authors y
        where y.author_id = reid_id and y.book_id = x.book_id and y.role = x.role
     );
  if extra > 0 then
    raise exception 'Tách: % liên kết của id 75 chưa có ở Anthony Reid → rollback', extra;
  end if;
  select count(*) into n from public.book_authors where author_id = 75;
  if n = 0 then
    raise exception 'Tách: id 75 không gắn sách nào (dữ liệu đã khác) → rollback';
  end if;

  -- -------------------------------------------------------------------
  -- 3. Tổ chức ghi là tác giả: bỏ liên kết khỏi đúng sách đã duyệt, CHỈ KHI sách còn ≥ 1 tác giả role 'author' khác;
  --    rồi xóa tác giả nếu không còn liên kết nào. Giữ 22 "Nhà xuất bản Kim Đồng" và 24 "Nhiều tác giả".
  -- -------------------------------------------------------------------
  for m in
    select * from (values
      (89::bigint,  'Harvard Business Review', 'The Peter F. Drucker Reader'),
      (107::bigint, 'Ladybird',                'Ladybird Readers Level 4 - Roald Dahl - Esio Trot (ELT Graded Reader)')
    ) as v(author_id, author_name, book_title)
  loop
    perform 1 from public.authors where id = m.author_id and name = m.author_name;
    if not found then
      raise exception 'Tổ chức: id % không còn là "%" → rollback', m.author_id, m.author_name;
    end if;

    select count(*) into n from public.books where title = m.book_title;
    if n <> 1 then
      raise exception 'Tổ chức: % sách tên "%" (mong đợi 1) → rollback', n, m.book_title;
    end if;
    select id into b_id from public.books where title = m.book_title;

    select count(*) into n from public.book_authors where book_id = b_id and author_id = m.author_id;
    if n = 0 then
      raise exception 'Tổ chức: "%" không gắn với "%" → rollback', m.author_name, m.book_title;
    end if;

    -- Sau bước gộp ở trên (VD Drucker đã về id 87)
    select count(distinct o.author_id) into n
      from public.book_authors o
     where o.book_id = b_id and o.author_id <> m.author_id and o.role = 'author';
    if n = 0 then
      raise exception 'Tổ chức: "%" không còn tác giả role author nào khác ngoài "%" → rollback', m.book_title, m.author_name;
    end if;

    delete from public.book_authors where book_id = b_id and author_id = m.author_id;

    delete from public.authors a
     where a.id = m.author_id
       and not exists (select 1 from public.book_authors ba where ba.author_id = a.id);
    get diagnostics n = row_count;
    if n = 0 then
      raise notice 'Tổ chức: "%" còn gắn sách khác → giữ tác giả, chỉ bỏ liên kết với "%"', m.author_name, m.book_title;
    end if;
  end loop;

  -- -------------------------------------------------------------------
  -- 4. Tên sách: guard theo tên cũ CHÍNH XÁC (đúng 1 dòng mỗi tên), giữ slug. format null = giữ nguyên.
  -- -------------------------------------------------------------------
  create temp table title_plan (old_title text, new_title text, new_format public.book_format) on commit drop;
  insert into title_plan values
    ('Kien Chuot Va Ruoi', 'Kiến, Chuột và Ruồi', null),
    ('Mười chín chân dùng nhà văn cùng thời', 'Mười chín chân dung nhà văn cùng thời', null),
    ('Ngôn Ngữ - Tuyển Tập Truyện Ngắn Chọn Lọc 2025 (hardcover)',
     'Ngôn Ngữ - Tuyển Tập Truyện Ngắn Chọn Lọc 2025', 'hardcover'),
    ('Những Truyện Ngắn Hay Nhất Của Quê Hương Chúng Ta (soft cover - groundwood paper - new edition)',
     'Những Truyện Ngắn Hay Nhất Của Quê Hương Chúng Ta', 'paperback'),
    ('Lịch Sử Việt Nam Thời Tự Chủ - Tập Hai (hard cover - groundwood)',
     'Lịch Sử Việt Nam Thời Tự Chủ - Tập Hai', 'hardcover'),
    ('Lịch Sử Việt Nam Thời Tự Chủ - Tập Một (hard cover - groundwood)',
     'Lịch Sử Việt Nam Thời Tự Chủ - Tập Một', 'hardcover');

  -- Tên mới phải ở dạng NFC (như dữ liệu import, normalizeText): file lưu NFD thì tên hiển thị đúng nhưng search_text sai
  select count(*) into extra from title_plan where new_title is not nfc normalized;
  if extra > 0 then
    raise exception 'Tên sách: % tên mới không ở dạng NFC (file SQL bị lưu NFD?) → rollback', extra;
  end if;

  select count(*) into extra
    from title_plan p
   where (select count(*) from public.books b where b.title = p.old_title) <> 1;
  if extra > 0 then
    raise exception 'Tên sách: % / 6 tên cũ không khớp đúng 1 sách (dữ liệu đã khác) → rollback', extra;
  end if;

  update public.books b
     set title = p.new_title,
         format = coalesce(p.new_format, b.format)
    from title_plan p
   where b.title = p.old_title;
  get diagnostics n = row_count;
  if n <> 6 then
    raise exception 'Tên sách: sửa được % / 6 dòng → rollback', n;
  end if;
end $$;

-- =====================================================================
-- PHẦN 2. Kiểm tra sau khi chạy (CHỈ ĐỌC). Đối chiếu cột mong_doi.
-- =====================================================================

-- C1. Tác giả gộp / tổ chức đã xóa không còn (kể cả liên kết). Mong đợi: 0 | 0
--     (89 / 107 chỉ bị xóa khi không còn gắn sách nào khác: nếu Phần 1 báo NOTICE "giữ tác giả" thì id đó còn 1 dòng)
select (select count(*) from public.authors where id in (86, 88, 113, 92, 93, 89, 107))          as tac_gia_da_xoa,
       (select count(*) from public.book_authors where author_id in (86, 88, 113, 92, 93))       as lien_ket_id_gop;

-- C2. Tên tác giả giữ lại + slug không đổi. Mong đợi: 5 dòng, dung = true; slug giống kết quả Phần 0
select v.id, a.name, v.mong_doi, a.name = v.mong_doi as dung, a.slug,
       (select count(*) from public.book_authors ba where ba.author_id = v.id) as so_lien_ket
  from (values
    (87, 'Peter F. Drucker'), (114, 'Stephen Hawking'), (90, 'Jim Collins'), (94, 'Jerry Porras'),
    (75, 'Trần Tuyết Nhung')
  ) as v(id, mong_doi)
  left join public.authors a on a.id = v.id
 order by v.id;

-- C3. Anthony Reid gắn đúng các sách của id 75, cùng vai trò (đếm trên sách của id 75: Reid có sẵn sách khác cũng đúng).
--     Mong đợi: so_lien_ket_75 > 0, reid_tren_sach_75 = so_lien_ket_75, thieu_o_reid = 0
select (select count(*) from public.book_authors where author_id = 75) as so_lien_ket_75,
       (select count(*) from public.book_authors x
         where x.author_id = 75
           and exists (select 1 from public.book_authors y join public.authors a on a.id = y.author_id
                        where a.slug = 'anthony-reid' and y.book_id = x.book_id and y.role = x.role)) as reid_tren_sach_75,
       (select count(*) from public.book_authors x
         where x.author_id = 75
           and not exists (select 1 from public.book_authors y join public.authors a on a.id = y.author_id
                            where a.slug = 'anthony-reid' and y.book_id = x.book_id and y.role = x.role)) as thieu_o_reid;

-- C4. Hai sách bỏ tổ chức: không còn liên kết với 89 / 107, vẫn có ≥ 1 tác giả role author. Mong đợi: lien_ket_to_chuc = 0, so_tac_gia >= 1
select b.id, b.title,
       (select count(*) from public.book_authors ba where ba.book_id = b.id and ba.author_id in (89, 107)) as lien_ket_to_chuc,
       (select count(*) from public.book_authors ba where ba.book_id = b.id and ba.role = 'author') as so_tac_gia
  from public.books b
 where b.title in ('The Peter F. Drucker Reader', 'Ladybird Readers Level 4 - Roald Dahl - Esio Trot (ELT Graded Reader)')
 order by b.id;

-- C5. Tên sách mới + format. Mong đợi: 6 dòng, dung_ten = true; format như cột mong_doi_format (null = không đổi);
--     slug giống kết quả Phần 0
select v.new_title, b.id, b.slug, b.format, v.mong_doi_format, b.title is not null as dung_ten
  from (values
    ('Kiến, Chuột và Ruồi', null),
    ('Mười chín chân dung nhà văn cùng thời', null),
    ('Ngôn Ngữ - Tuyển Tập Truyện Ngắn Chọn Lọc 2025', 'hardcover'),
    ('Những Truyện Ngắn Hay Nhất Của Quê Hương Chúng Ta', 'paperback'),
    ('Lịch Sử Việt Nam Thời Tự Chủ - Tập Hai', 'hardcover'),
    ('Lịch Sử Việt Nam Thời Tự Chủ - Tập Một', 'hardcover')
  ) as v(new_title, mong_doi_format)
  left join public.books b on b.title = v.new_title
 order by v.new_title;

-- C6. Không còn tên cũ. Mong đợi: 0
select count(*) as con_ten_cu
  from public.books
 where title in (
   'Kien Chuot Va Ruoi',
   'Mười chín chân dùng nhà văn cùng thời',
   'Ngôn Ngữ - Tuyển Tập Truyện Ngắn Chọn Lọc 2025 (hardcover)',
   'Những Truyện Ngắn Hay Nhất Của Quê Hương Chúng Ta (soft cover - groundwood paper - new edition)',
   'Lịch Sử Việt Nam Thời Tự Chủ - Tập Hai (hard cover - groundwood)',
   'Lịch Sử Việt Nam Thời Tự Chủ - Tập Một (hard cover - groundwood)'
 );

-- C7. search_text của các sách đã đổi tên chứa tên mới (không dấu). Mong đợi: co_ten_moi = true ở mọi dòng
select b.id, b.title, b.search_text like '%' || public.normalize_vi(b.title) || '%' as co_ten_moi
  from public.books b
 where b.title in (
   'Kiến, Chuột và Ruồi', 'Mười chín chân dung nhà văn cùng thời', 'Ngôn Ngữ - Tuyển Tập Truyện Ngắn Chọn Lọc 2025',
   'Những Truyện Ngắn Hay Nhất Của Quê Hương Chúng Ta', 'Lịch Sử Việt Nam Thời Tự Chủ - Tập Hai',
   'Lịch Sử Việt Nam Thời Tự Chủ - Tập Một'
 )
 order by b.id;
