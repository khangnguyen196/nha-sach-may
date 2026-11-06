-- migration-check: 4 truy vấn chính xác bổ sung cho pg_dump đã chuẩn hóa (dump sắp xếp dòng nên không thấy thứ tự /
-- vị trí; trigger trên auth.users không nằm trong dump public / private). Chạy bằng psql -q -A -t.
-- Truy vấn 1 (policy used_listings) và 3 (index 5 bảng) gắn với đợt db-advisors: dump đã phủ public / private nói chung,
-- nhưng migration sau đụng bảng / schema khác (auth, storage…) thì phải thêm truy vấn cho chỗ đó (dump không thấy).

-- 1. Policy của used_listings
select 'policy', policyname, permissive, roles::text, cmd, qual, coalesce(with_check, '')
  from pg_policies
 where schemaname = 'public' and tablename = 'used_listings'
 order by policyname;

-- 2. Quyền EXECUTE của 9 hàm trigger (aclitem sắp xếp: thứ tự grant / revoke không làm lệch)
select 'acl', p.proname,
       coalesce((select string_agg(a::text, ',' order by a::text) from unnest(p.proacl) as a), 'NULL')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('handle_new_user', 'book_authors_touch_book', 'authors_touch_books', 'handle_order_status_change',
                     'reviews_set_display_name', 'refresh_book_rating', 'used_listings_set_seller_name',
                     'used_listings_status_change', 'handle_used_order_change')
 order by p.proname;

-- 3. Index của 5 bảng có khóa ngoại mới được index
select 'index', tablename, indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename in ('cart_items', 'orders', 'reviews', 'seller_payouts', 'user_blocks')
 order by tablename, indexname;

-- 4. Trigger trên auth.users (handle_new_user)
select 'auth-trigger', t.tgname, t.tgenabled, pg_get_triggerdef(t.oid)
  from pg_trigger t
 where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
 order by t.tgname;
