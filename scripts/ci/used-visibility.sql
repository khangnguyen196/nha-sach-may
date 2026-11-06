-- migration-check (.github/workflows/migration-check.yml): bảng vai × trạng thái của public.used_listings, chạy trên
-- Supabase local của CI trước và sau migration, kết quả phải giống từng chữ (và giống used-visibility.expected).
-- Một transaction, rollback ở cuối: không để lại dữ liệu. Chạy bằng psql -q -A -t (role postgres): in "vai|nhãn tin".
-- Nhãn tin nằm ở description (anon đọc được cột này; không đọc được seller_id) vì id đổi giữa hai lần chạy.

begin;

-- handle_new_user tạo profile (full_name từ metadata)
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'ci-seller@example.com', '{"full_name": "CI Seller"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'ci-other@example.com', '{"full_name": "CI Other"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'ci-buyer@example.com', '{"full_name": "CI Buyer"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'ci-admin@example.com', '{"full_name": "CI Admin"}', now(), now());

update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000000000a4';

insert into public.books (title, slug, price, original_price, stock)
values ('CI used visibility', 'ci-used-visibility', 50000, 60000, 1);

-- Ghi thẳng bằng postgres (owner, bỏ qua RLS); trigger trạng thái chỉ chạy khi update nên insert được mọi trạng thái
insert into public.used_listings (seller_id, book_id, condition, price, fee, description, photos, status)
select u.id, b.id, 'good', 40000, 4000, 'ci:' || u.label || ':' || s.status, array[u.id || '/ci.webp'], s.status::public.used_listing_status
  from (values ('00000000-0000-4000-8000-0000000000a1'::uuid, 'seller'),
               ('00000000-0000-4000-8000-0000000000a2'::uuid, 'other')) as u(id, label)
 cross join (values ('pending'), ('approved'), ('rejected'), ('sold'), ('withdrawn')) as s(status)
 cross join public.books b
 where b.slug = 'ci-used-visibility';

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select 'anon', description from public.used_listings where description like 'ci:%' order by description collate "C";
reset role;

set local role authenticated;
set local request.jwt.claims = '{"role": "authenticated", "sub": "00000000-0000-4000-8000-0000000000a3"}';
select 'buyer', description from public.used_listings where description like 'ci:%' order by description collate "C";
reset role;

set local role authenticated;
set local request.jwt.claims = '{"role": "authenticated", "sub": "00000000-0000-4000-8000-0000000000a1"}';
select 'seller', description from public.used_listings where description like 'ci:%' order by description collate "C";
reset role;

set local role authenticated;
set local request.jwt.claims = '{"role": "authenticated", "sub": "00000000-0000-4000-8000-0000000000a4"}';
select 'admin', description from public.used_listings where description like 'ci:%' order by description collate "C";
reset role;

-- Quyền cột không đổi: anon không đọc seller_id / fee, authenticated đọc được
select 'anon-seller_id', has_column_privilege('anon', 'public.used_listings', 'seller_id', 'select');
select 'anon-fee', has_column_privilege('anon', 'public.used_listings', 'fee', 'select');
select 'authenticated-seller_id', has_column_privilege('authenticated', 'public.used_listings', 'seller_id', 'select');

rollback;
