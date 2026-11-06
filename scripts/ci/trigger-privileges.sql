-- migration-check (.github/workflows/migration-check.yml): quyền EXECUTE của mọi hàm trigger security definer trong
-- schema public, đọc từ catalog (cũng là cách advisors của Supabase xét). Danh sách hàm lấy từ catalog, không ghi tay:
-- hàm trigger mới mà quên thu quyền thì bảng "sau" lệch expected. Chạy bằng psql -q -A -t, mỗi hàm một dòng:
--   proname|anon|authenticated|public|service_role|supabase_auth_admin
-- Cột public là pseudo-role PUBLIC: bắt trường hợp sót "from public" (anon vẫn có quyền qua PUBLIC).
-- supabase_auth_admin là role GoTrue dùng để tạo user: nó chỉ có quyền qua PUBLIC, nên thu "from public" làm nó mất quyền
-- (trigger vẫn chạy, xem trigger-still-fires.sql).
-- Chỉ xét hàm security definer, như advisors; hàm trigger security invoker (VD set_updated_at) chạy bằng quyền người
-- gọi, để nguyên quyền mặc định.

select p.proname,
       has_function_privilege('anon', p.oid, 'execute'),
       has_function_privilege('authenticated', p.oid, 'execute'),
       has_function_privilege('public', p.oid, 'execute'),
       has_function_privilege('service_role', p.oid, 'execute'),
       has_function_privilege('supabase_auth_admin', p.oid, 'execute')
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.prorettype = 'trigger'::regtype
   and p.prosecdef
 order by p.proname;
