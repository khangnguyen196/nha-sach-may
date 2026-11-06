-- migration-check (.github/workflows/migration-check.yml): trigger vẫn chạy khi role gây ra trigger KHÔNG có EXECUTE trên
-- hàm trigger. supabase_auth_admin là role GoTrue dùng để tạo user thật và mất quyền khi thu "from public"; Postgres chỉ
-- kiểm EXECUTE của hàm trigger lúc CREATE TRIGGER, không kiểm lúc trigger chạy. Không đổi role sang postgres: postgres là
-- owner của hàm nên phép thử thành vô nghĩa. Chạy bằng psql -q -A -t; in "f" (không có quyền) rồi "en" (profile do
-- handle_new_user tạo, locale lấy từ raw_user_meta_data). Một transaction, rollback ở cuối: không để lại dữ liệu.

begin;

select has_function_privilege('supabase_auth_admin', 'public.handle_new_user()', 'execute');

set local role supabase_auth_admin;

insert into auth.users (id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-00000000c1c1', 'authenticated', 'authenticated',
        'ci-trigger@example.invalid', '{"locale":"en"}');

reset role;

select locale from public.profiles where id = '00000000-0000-4000-8000-00000000c1c1';

rollback;
