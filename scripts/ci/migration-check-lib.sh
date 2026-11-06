# migration-check (.github/workflows/migration-check.yml): hàm dùng chung, `source` ở từng bước.
# Chỉ đụng Supabase local của CI (container Docker do `supabase start` dựng), không đọc file env, không dùng secret.
# psql / pg_dump chạy TRONG container DB: cùng bản với Postgres của server (pg_dump của runner có thể cũ hơn → từ chối).

DB_CONTAINER="${DB_CONTAINER:-supabase_db_nha-sach-may}"

# psql bằng role postgres (như SQL Editor của chủ dự án), đọc SQL từ stdin; lỗi đầu tiên → dừng, exit ≠ 0
db_psql() {
  docker exec -i -e PGPASSWORD=postgres "$DB_CONTAINER" \
    psql -h 127.0.0.1 -U postgres -d postgres -X -q -A -t -v ON_ERROR_STOP=1 "$@"
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
