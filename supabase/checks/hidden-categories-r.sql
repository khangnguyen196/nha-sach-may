-- docs/plans/sau-ux.md mục 6: quy tắc ẩn danh mục. MỌI CÂU CHỈ ĐỌC (select). Chạy trong SQL Editor, dán kết quả cho
-- Claude. "Danh mục đang hiện" = is_active và (là gốc, hoặc cha cũng is_active) — như visibleCategoryIds
-- (src/features/books/utils.ts). Cây danh mục tối đa 2 cấp (admin chặn cấp 3).

-- H1. Sách đang bán theo trạng thái danh mục: bao nhiêu cuốn sẽ biến khỏi /sach, tìm kiếm, chatbot khi áp quy tắc.
with c as (
  select c.id, c.name, c.slug, c.is_active, c.parent_id, p.is_active as parent_active,
         c.is_active and (c.parent_id is null or coalesce(p.is_active, false)) as dang_hien
    from public.categories c
    left join public.categories p on p.id = c.parent_id
)
select case
         when b.category_id is null then 'không có danh mục'
         when c.dang_hien then 'danh mục đang hiện'
         when not c.is_active then 'danh mục ẩn'
         else 'danh mục con của gốc ẩn'
       end as trang_thai,
       count(*) as so_sach
  from public.books b
  left join c on c.id = b.category_id
 where b.is_active
 group by 1
 order by 1;

-- H2. Chi tiết: danh mục không hiện mà còn sách đang bán (tên danh mục, cha, số sách, vài tên sách).
with c as (
  select c.id, c.name, c.slug, c.is_active, c.parent_id, p.name as parent_name, p.is_active as parent_active,
         c.is_active and (c.parent_id is null or coalesce(p.is_active, false)) as dang_hien
    from public.categories c
    left join public.categories p on p.id = c.parent_id
)
select c.id, c.name, c.slug, c.is_active, c.parent_name, c.parent_active,
       count(b.id) as so_sach,
       (array_agg(b.title order by b.id))[1:5] as vai_sach
  from c
  join public.books b on b.category_id = c.id and b.is_active
 where not c.dang_hien
 group by c.id, c.name, c.slug, c.is_active, c.parent_name, c.parent_active
 order by so_sach desc;

-- H3. Sách đang bán không có danh mục (category_id null): hiện có trên /sach và tìm kiếm, không lên trang chủ / sitemap.
select b.id, b.title, b.slug, b.created_at
  from public.books b
 where b.is_active and b.category_id is null
 order by b.id;
