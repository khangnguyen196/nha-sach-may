# migration-check (.github/workflows/migration-check.yml): hàm dùng chung, `source` ở từng bước.
# Chỉ đụng Supabase local của CI (container Docker do `supabase start` dựng), không đọc file env, không dùng secret.
# psql / pg_dump chạy TRONG container DB: cùng bản với Postgres của server (pg_dump của runner có thể cũ hơn → từ chối).

DB_CONTAINER="${DB_CONTAINER:-supabase_db_nha-sach-may}"

# psql bằng role <user>, đọc SQL từ stdin; lỗi đầu tiên → dừng, exit ≠ 0. Mật khẩu "postgres" là mật khẩu demo của
# Supabase local (role đăng nhập được của stack Docker), không phải bí mật
db_psql_as() {
  local user="$1"
  shift
  docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" \
    psql -h 127.0.0.1 -U "$user" -d postgres -X -q -A -t -v ON_ERROR_STOP=1 "$@"
}

# psql bằng role postgres (như SQL Editor của chủ dự án)
db_psql() {
  db_psql_as postgres "$@"
}

# Cấu trúc (kèm quyền, policy, trigger, index) của schema public + private
db_dump() {
  docker exec -e PGPASSWORD=postgres "$DB_CONTAINER" \
    pg_dump -h 127.0.0.1 -U postgres -d postgres --schema-only --schema=public --schema=private
}

# Lỗi chạy lần 2 của migration được chấp nhận: dòng ERROR: của Postgres báo đối tượng đã có / không còn (stderr của psql
# đọc từ stdin). Chỉ tính dòng ERROR: dạng "psql:<stdin>:N: ERROR:  …" (neo ở đầu dòng hoặc sau ": "; chữ dính liền
# trước "ERROR:", VD "XERROR:" trong câu của NOTICE, thì không tính). NOTICE của `drop … if exists` ("does not exist,
# skipping") hay FATAL của lỗi kết nối (database "…" does not exist) đi kèm một lỗi khác (lock timeout, mất kết nối)
# không được nhận nhầm
is_rerun_error() {
  grep -qE '(^|: )ERROR: +.*(already exists|does not exist)'
}

# Bước 3: quyền EXECUTE của hàm trigger security definer TRƯỚC migration. Hai chế độ:
# - chính migration db_advisors là migration mới (nhánh db-advisors): so đúng từng chữ với
#   trigger-privileges.before.expected (mọi vai t), để "trước t / sau f" chứng minh chính migration đã thu quyền;
# - main đã có migration này (mọi nhánh sau): DB "trước" đã thu quyền nên before.expected không còn đúng → kiểm bất
#   biến mọi dòng = f|f|f|t|f. Không so với after.expected: nhánh thêm hàm trigger mới sửa after.expected (thêm dòng)
#   trong khi DB "trước" chưa có hàm đó.
DB_ADVISORS_MIGRATION='supabase/migrations/20261106120000_db_advisors.sql'
check_privileges_before() {
  local new_migrations="$1" before="$2" bad_count
  if grep -qxF "$DB_ADVISORS_MIGRATION" "$new_migrations"; then
    echo "bước 3: chế độ so trigger-privileges.before.expected ($DB_ADVISORS_MIGRATION là migration mới)"
    if ! diff -u scripts/ci/trigger-privileges.before.expected "$before"; then
      echo "::error::quyền EXECUTE của hàm trigger trước migration khác trigger-privileges.before.expected: các vai chưa có quyền EXECUTE thì bước 5 không chứng minh được gì"
      return 1
    fi
    return 0
  fi
  echo "bước 3: chế độ bất biến (main đã có $DB_ADVISORS_MIGRATION): mọi hàm trigger security definer = f|f|f|t|f"
  if [ ! -s "$before" ]; then
    echo "::error::không đọc được hàm trigger security definer nào trước migration (privileges-before rỗng)"
    return 1
  fi
  # Đếm cả dòng trống; grep -c in 0 và exit 1 khi không có dòng lệch
  bad_count=$(grep -cvE '^[a-z0-9_]+\|f\|f\|f\|t\|f$' "$before" || true)
  if [ "$bad_count" != "0" ]; then
    echo "::error::hàm trigger security definer trước migration còn quyền EXECUTE cho anon / authenticated / PUBLIC / supabase_auth_admin hoặc service_role mất quyền"
    grep -nvE '^[a-z0-9_]+\|f\|f\|f\|t\|f$' "$before" || true
    return 1
  fi
}

# Bước 5, 9: trigger vẫn chạy khi role gây ra trigger (supabase_auth_admin, role GoTrue dùng tạo user) không có
# EXECUTE trên handle_new_user. KHÔNG BAO GIỜ dùng postgres làm role gây ra trigger (owner của hàm: phép thử vô nghĩa);
# postgres của Supabase cũng không SET ROLE được supabase_auth_admin (run 42253981733). Thăm dò lần lượt, chọn cách
# ĐẦU TIÊN thăm dò được:
#   M1: đăng nhập supabase_admin + set local role supabase_auth_admin, trong rollback (trigger-still-fires.sql);
#   M2: đăng nhập thẳng supabase_auth_admin, insert tự commit (trigger-still-fires-direct.sql), postgres đọc profile
#       rồi xóa user thử (cascade xóa profile).
# Đã chọn cách mà phép thử lỗi thì đỏ, không chuyển sang cách khác (lỗi thật không được che). Ghi đúng 3 dòng vào $1:
# f / supabase_auth_admin / en; cách đã dùng ghi vào ${1%.txt}.method (artifact).
TRIGGER_TEST_USER_ID='00000000-0000-4000-8000-00000000c1c1'
run_trigger_still_fires() {
  local out="$1" method_file="${1%.txt}.method" m1_err="${1%.txt}.m1.err" m2_err="${1%.txt}.m2.err"
  local probe method line
  echo "::group::trigger-still-fires: chẩn đoán role"
  db_psql -c "select rolname, rolsuper from pg_roles where rolname in ('postgres', 'supabase_admin', 'supabase_auth_admin') order by rolname" < /dev/null || true
  db_psql -c "select pg_has_role('postgres', 'supabase_auth_admin', 'member')" < /dev/null || true
  echo "::endgroup::"

  if probe=$(printf '%s\n' 'begin;' 'set local role supabase_auth_admin;' 'select current_user;' 'rollback;' \
      | db_psql_as supabase_admin 2> "$m1_err") && [ "$probe" = "supabase_auth_admin" ]; then
    method=M1
  elif probe=$(db_psql_as supabase_auth_admin -c 'select current_user' < /dev/null 2> "$m2_err") \
      && [ "$probe" = "supabase_auth_admin" ]; then
    method=M2
  else
    echo "::error::trigger-still-fires: không thăm dò được cách nào để gây trigger bằng supabase_auth_admin"
    echo "M1 (supabase_admin + set local role supabase_auth_admin), stderr:"
    cat "$m1_err"
    echo "M2 (đăng nhập thẳng supabase_auth_admin), stderr:"
    cat "$m2_err"
    return 1
  fi
  line="trigger-still-fires: dùng cách $method"
  echo "$line"
  echo "$line" > "$method_file"

  if [ "$method" = "M1" ]; then
    if ! db_psql_as supabase_admin < scripts/ci/trigger-still-fires.sql > "$out"; then
      echo "::error::trigger-still-fires (M1) lỗi"
      return 1
    fi
    return 0
  fi
  run_trigger_still_fires_direct "$out"
}

# M2: supabase_auth_admin thường không đọc được public.profiles → postgres chỉ ĐỌC profile và DỌN (không gây trigger).
# Dọn chạy cả khi bước kiểm lỗi.
run_trigger_still_fires_direct() {
  local out="$1" id="$TRIGGER_TEST_USER_ID" existing rc=0
  if ! existing=$(db_psql_as supabase_auth_admin -c "select count(*) from auth.users where id = '$id'" < /dev/null); then
    echo "::error::trigger-still-fires (M2): không kiểm được user thử $id"
    return 1
  fi
  if [ "$existing" != "0" ]; then
    echo "::error::trigger-still-fires (M2): user thử $id đã có trước phép thử"
    return 1
  fi
  if ! db_psql_as supabase_auth_admin < scripts/ci/trigger-still-fires-direct.sql > "$out"; then
    echo "::error::trigger-still-fires (M2) lỗi khi insert bằng supabase_auth_admin"
    rc=1
  elif ! db_psql -c "select locale from public.profiles where id = '$id'" < /dev/null >> "$out"; then
    echo "::error::trigger-still-fires (M2) lỗi khi đọc profile"
    rc=1
  fi
  if ! db_psql -c "delete from auth.users where id = '$id'" < /dev/null \
      && ! db_psql_as supabase_auth_admin -c "delete from auth.users where id = '$id'" < /dev/null; then
    echo "::error::trigger-still-fires (M2): không xóa được user thử $id"
    rc=1
  fi
  return "$rc"
}
