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

# Giá trị KEY="value" của `supabase status -o env` (khóa demo của stack local, không phải bí mật); không in ra log
status_value() {
  local workdir="$1" key="$2"
  supabase status --workdir "$workdir" -o env 2>/dev/null | sed -n "s/^${key}=\"\(.*\)\"$/\1/p"
}

# Cùng quy tắc scripts/e2e-env.ts: chỉ host 127.0.0.1 / localhost (không userinfo, không host khác)
is_local_url() {
  [[ "$1" =~ ^https?://(127\.0\.0\.1|localhost)(:[0-9]+)?(/.*)?$ ]]
}

# Lỗi chạy lần 2 của migration được chấp nhận: dòng ERROR: của Postgres báo đối tượng đã có / không còn (stderr của psql
# đọc từ stdin). Chỉ tính dòng ERROR:: NOTICE của `drop … if exists` ("does not exist, skipping") hay FATAL của lỗi kết
# nối (database "…" does not exist) đi kèm một lỗi khác (lock timeout, mất kết nối) không được nhận nhầm
is_rerun_error() {
  grep -qE 'ERROR: +.*(already exists|does not exist)'
}

# Kết quả call_rpc_as_anon (đọc từ stdin) là lỗi của Postgres khi chạy hàm trigger: PostgREST đã gọi tới hàm, tức anon
# còn quyền EXECUTE
is_trigger_call_error() {
  grep -qi 'trigger functions can only be called as triggers'
}

# Gọi thẳng /rest/v1/rpc/<hàm> bằng khóa anon; in "<mã HTTP> <body>"
call_rpc_as_anon() {
  local workdir="$1" fn="$2" url key
  local -a auth=()
  url="$(status_value "$workdir" API_URL)"
  key="$(status_value "$workdir" ANON_KEY)"
  # Khóa anon dạng JWT đi kèm Authorization; khóa publishable (sb_publishable_…) chỉ đi trong apikey
  if [ -n "$key" ]; then auth=(-H "Authorization: Bearer $key"); else key="$(status_value "$workdir" PUBLISHABLE_KEY)"; fi
  if [ -z "$url" ] || [ -z "$key" ]; then
    echo "supabase status không có API_URL / khóa anon" >&2
    return 1
  fi
  if ! is_local_url "$url"; then
    echo "API_URL không phải Supabase local (127.0.0.1 / localhost), không gọi" >&2
    return 1
  fi
  curl -s -o "$RUNNER_TEMP/rpc-body.txt" -w '%{http_code}' -X POST "$url/rest/v1/rpc/$fn" \
    -H "apikey: $key" "${auth[@]}" -H 'Content-Type: application/json' -d '{}' \
    > "$RUNNER_TEMP/rpc-code.txt"
  echo "$(cat "$RUNNER_TEMP/rpc-code.txt") $(cat "$RUNNER_TEMP/rpc-body.txt")"
}
