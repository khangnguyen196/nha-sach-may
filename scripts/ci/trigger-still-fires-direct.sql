-- migration-check (.github/workflows/migration-check.yml), cách M2 của run_trigger_still_fires
-- (scripts/ci/migration-check-lib.sh): chỉ dùng khi M1 (supabase_admin + set local role, trigger-still-fires.sql) thăm
-- dò không được. Chạy bằng chính supabase_auth_admin (đăng nhập thẳng, role GoTrue dùng tạo user, không có EXECUTE trên
-- handle_new_user); không dùng postgres làm role gây ra trigger: postgres là owner của hàm nên phép thử thành vô nghĩa.
-- Insert TỰ COMMIT (không begin … rollback): supabase_auth_admin thường không đọc được public.profiles nên không kiểm
-- profile trong cùng phiên; postgres đọc locale của profile ở phiên sau (chỉ đọc) rồi xóa user thử (cascade xóa profile),
-- kể cả khi bước kiểm lỗi. Chạy bằng psql -q -A -t; in "f" (không có quyền) rồi "supabase_auth_admin"; dòng "en" do
-- postgres đọc thêm.

select has_function_privilege('supabase_auth_admin', 'public.handle_new_user()', 'execute');

select current_user;

insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000c1c1', 'authenticated', 'authenticated',
        'ci-trigger@example.invalid', '{"locale":"en"}', now(), now());
