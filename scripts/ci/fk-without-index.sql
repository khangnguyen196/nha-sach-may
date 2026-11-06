-- migration-check: khóa ngoại trong schema public chưa có index bắt đầu bằng đúng các cột của khóa (cùng cách xét với
-- advisor unindexed_foreign_keys của Supabase: so tiền tố cột của index, không xét điều kiện của index một phần).
-- Phải in ra rỗng. Chạy bằng psql -q -A -t.
select c.conrelid::regclass::text || ' ' || c.conname
  from pg_constraint c
  join pg_namespace n on n.oid = c.connamespace
 where c.contype = 'f'
   and n.nspname = 'public'
   and not exists (
     select 1
       from pg_index i
      where i.indrelid = c.conrelid
        and i.indisvalid
        and (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] = c.conkey
   )
 order by 1;
