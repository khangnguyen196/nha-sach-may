-- migration-check (.github/workflows/migration-check.yml), cách M1 của run_trigger_still_fires
-- (scripts/ci/migration-check-lib.sh): trigger vẫn chạy khi role gây ra trigger KHÔNG có EXECUTE trên hàm trigger.
-- supabase_auth_admin là role GoTrue dùng để tạo user thật và mất quyền khi thu "from public"; Postgres chỉ kiểm EXECUTE
-- của hàm trigger lúc CREATE TRIGGER, không kiểm lúc trigger chạy. Không dùng postgres làm role gây ra trigger: postgres
-- là owner của hàm nên phép thử thành vô nghĩa (và postgres của Supabase không SET ROLE được supabase_auth_admin, run
-- 42253981733).
-- M1: đăng nhập supabase_admin (superuser của stack local) rồi set local role supabase_auth_admin; một transaction,
-- rollback ở cuối: không để lại dữ liệu. M2 (trigger-still-fires-direct.sql) chỉ dùng khi M1 thăm dò không được.
-- Chạy bằng psql -q -A -t; in "f" (không có quyền), "supabase_auth_admin" (role gây ra trigger) rồi "en" (profile do
-- handle_new_user tạo, locale lấy từ raw_user_meta_data).

begin;

select has_function_privilege('supabase_auth_admin', 'public.handle_new_user()', 'execute');

set local role supabase_auth_admin;
select current_user;

insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000c1c1', 'authenticated', 'authenticated',
        'ci-trigger@example.invalid', '{"locale":"en"}', now(), now());

reset role;

select locale from public.profiles where id = '00000000-0000-4000-8000-00000000c1c1';

rollback;
