-- data-check (.github/workflows/data-check.yml): hàm kiểm trên Supabase local của CI, schema riêng ci_data_check
-- (không thuộc public / private nên không lọt vào bảng đếm số dòng). Không bao giờ chạy trên production.
-- Mọi hàm chỉ trả id, tên cột, số đếm: không trả nội dung mô tả (log của CI là công khai).
drop schema if exists ci_data_check cascade;
create schema ci_data_check;

-- Bản chụp toàn bộ public.books (mọi cột) vào ci_data_check.<name>
create function ci_data_check.snap(name text) returns void language plpgsql as $f$
begin
  execute format('drop table if exists ci_data_check.%I', name);
  execute format('create table ci_data_check.%I as select * from public.books', name);
end;
$f$;

-- id của các dòng khác nhau giữa hai bảng (có ở một bên, hoặc md5 của dòng khác), bỏ qua các cột trong ignore
create function ci_data_check.changed_ids(a regclass, b regclass, ignore text[] default '{}')
returns setof bigint language plpgsql as $f$
begin
  return query execute format(
    'select coalesce(s.id, t.id) from %s s full join %s t on s.id = t.id
      where s.id is null or t.id is null
         or md5((to_jsonb(s) - $1)::text) is distinct from md5((to_jsonb(t) - $1)::text)
      order by 1', a, b) using ignore;
end;
$f$;

-- Cột nào (ngoài allowed) đổi giữa hai bảng: tên cột, số dòng đổi, danh sách id (so md5 từng cột theo id)
create function ci_data_check.changed_columns(a regclass, b regclass, allowed text[])
returns table (col text, n bigint, ids text) language plpgsql as $f$
begin
  return query execute format(
    'select e.key, count(*), string_agg(s.id::text, '','' order by s.id)
       from %s s join %s t on s.id = t.id
       cross join lateral jsonb_each(to_jsonb(s)) e
      where not (e.key = any($1))
        and md5(e.value::text) is distinct from md5(coalesce(to_jsonb(t) -> e.key, ''null''::jsonb)::text)
      group by e.key order by e.key', a, b) using allowed;
end;
$f$;

-- Số dòng mọi bảng của public + private (kiểm file ghi không đụng bảng khác, không thêm / xóa sách)
create function ci_data_check.table_counts() returns table (tbl text, n bigint) language plpgsql as $f$
declare
  r record;
begin
  for r in select schemaname, tablename from pg_tables where schemaname in ('public', 'private')
           order by schemaname, tablename loop
    tbl := r.schemaname || '.' || r.tablename;
    execute format('select count(*) from %I.%I', r.schemaname, r.tablename) into n;
    return next;
  end loop;
end;
$f$;
