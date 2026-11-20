#!/usr/bin/env bash
# data-check (.github/workflows/data-check.yml): chạy thử MỘT vòng file SQL dữ liệu trên Supabase local của CI.
# Dùng: bash scripts/ci/data-check.sh <file ghi>...   (mọi file cùng thư mục, cùng vòng N)
# Quy ước tên (supabase/data/<đợt>/): file GHI vong-N-sach-*.sql; file kiểm (chỉ đọc) vong-N-kiem.sql; file hoàn tác
# vong-N-hoan-tac.sql (một file cho cả vòng N).
# Env: SUPABASE_PROD_URL, SUPABASE_PROD_KEY (khóa publishable / anon, chỉ để đọc REST công khai), RESULTS (file bảng kết
# quả markdown, nối thêm dòng), DB_CONTAINER (migration-check-lib.sh).
# Không in nội dung mô tả, URL hay khóa: log chỉ có id, tên cột, số đếm, SQLSTATE.
set -Eeuo pipefail

source scripts/ci/migration-check-lib.sh

WORK="${RUNNER_TEMP:-/tmp}/data-check"
RESULTS="${RESULTS:-$WORK/results.md}"
mkdir -p "$WORK"
UNIT="?"

row() {
  printf '| %s | %s | %s |\n' "$UNIT" "$1" "$2" >> "$RESULTS"
  echo "[$UNIT] $1: $2"
}

fail() {
  echo "::error::[$UNIT] $1: $2"
  row "$1" "**HỎNG**: $2"
  exit 1
}

trap 'echo "::error::[$UNIT] lỗi bất ngờ ở dòng $LINENO của data-check.sh"; row "lỗi bất ngờ" "**HỎNG** (dòng $LINENO của data-check.sh)"' ERR

# ---- Tham số ----
[ "$#" -ge 1 ] || { echo "::error::cần ít nhất một file ghi"; exit 2; }
dir=$(dirname "$1")
round=""
for file in "$@"; do
  name=$(basename "$file")
  [[ "$name" =~ ^vong-([0-9]+)-sach-[^/]+\.sql$ ]] || fail "tên file" "$file không đúng quy ước vong-N-sach-*.sql"
  [ -f "$file" ] || fail "tên file" "$file không có"
  [ "$(dirname "$file")" = "$dir" ] || fail "tên file" "các file phải cùng thư mục"
  if [ -z "$round" ]; then round="${BASH_REMATCH[1]}"; fi
  [ "${BASH_REMATCH[1]}" = "$round" ] || fail "tên file" "các file phải cùng vòng"
done
UNIT="$dir vòng $round"
files=("$@")
undo="$dir/vong-$round-hoan-tac.sql"
check_file="$dir/vong-$round-kiem.sql"

# Đủ mọi file ghi của vòng? (hoàn tác là của cả vòng: chỉ chạy đường hoàn tác khi đang kiểm đủ vòng)
mapfile -t all_files < <(find "$dir" -maxdepth 1 -type f -name "vong-$round-sach-*.sql" | sort)
mapfile -t given_sorted < <(printf '%s\n' "${files[@]}" | sort)
full_round=false
if [ "${all_files[*]}" = "${given_sorted[*]}" ]; then full_round=true; fi
echo "[$UNIT] file ghi: ${files[*]} (đủ vòng: $full_round)"

# ---- Cột được phép ghi ----
# Khai báo trong comment đầu file: "-- data-check: cot-duoc-ghi = a, b, c" (mọi file của vòng phải giống nhau);
# không có thì theo vòng (vòng 3: sách Việt → description_en + cờ; vòng 4: sách ngoại văn → thêm description).
declared=""
for file in "${files[@]}"; do
  line=$(grep -m1 -E '^-- data-check: cot-duoc-ghi = ' "$file" || true)
  value=$(printf '%s' "${line#-- data-check: cot-duoc-ghi = }" | tr -d ' ')
  if [ -n "$declared" ] && [ "$value" != "$declared" ]; then fail "cột được ghi" "các file khai báo khác nhau"; fi
  declared="$value"
done
if [ -n "$declared" ]; then
  allowed="$declared"
else
  case "$round" in
    3) allowed="description_en,description_auto_translated" ;;
    4) allowed="description,description_en,description_auto_translated" ;;
    *) fail "cột được ghi" "vòng $round chưa khai báo (thêm comment '-- data-check: cot-duoc-ghi = …' vào file ghi)" ;;
  esac
fi
[[ "$allowed" =~ ^[a-z_]+(,[a-z_]+)*$ ]] || fail "cột được ghi" "khai báo sai dạng"
allowed_pg="{$allowed,updated_at}"
row "cột được ghi" "$allowed (+ updated_at do trigger)"

# ---- (d) chữ trong file (không cần DB) ----
if ! node scripts/ci/data-check-text.mjs --json "$WORK/text.json" "${files[@]}"; then
  fail "(d) chữ" "xem các dòng (d) ở trên"
fi
declare -A file_ids file_updates
all_ids=()
for file in "${files[@]}"; do
  file_updates[$file]=$(jq -r --arg f "$file" '.[$f].updates' "$WORK/text.json")
  file_ids[$file]=$(jq -r --arg f "$file" '.[$f].ids | join(",")' "$WORK/text.json")
  IFS=, read -r -a ids <<< "${file_ids[$file]}"
  all_ids+=("${ids[@]}")
done
dup=$(printf '%s\n' "${all_ids[@]}" | sort -n | uniq -d | paste -sd, -)
[ -z "$dup" ] || fail "(d) chữ" "id có ở nhiều file của vòng: $dup"
id_list=$(printf '%s\n' "${all_ids[@]}" | sort -n | paste -sd, -)
id_count=${#all_ids[@]}
row "(d) chữ" "đạt: $id_count câu / $id_count id, NFC, không ký tự ẩn, không CR, \$mota\$ đúng cặp"

# ---- DB local: dọn sách của vòng trước, nạp hàm kiểm ----
db_psql -c 'delete from public.books' < /dev/null
db_psql < scripts/ci/data-check-lib.sql

# ---- Lấy sách từ production qua REST công khai ----
[ -n "${SUPABASE_PROD_URL:-}" ] && [ -n "${SUPABASE_PROD_KEY:-}" ] || fail "lấy production" "thiếu secret NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
# category_id / publisher_id (khóa ngoại, DB local không có) để null; search_text do trigger tự sinh khi nạp
columns=$(db_psql -c "select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns
  where table_schema = 'public' and table_name = 'books' and column_name not in ('category_id', 'publisher_id', 'search_text')" < /dev/null)
: > "$WORK/chunks.txt"
chunk=0
mapfile -t sorted_ids < <(printf '%s\n' "${all_ids[@]}" | sort -n)
for ((i = 0; i < id_count; i += 40)); do
  part=$(printf '%s\n' "${sorted_ids[@]:i:40}" | paste -sd, -)
  out="$WORK/chunk-$chunk.json"
  # -f: HTTP lỗi → exit ≠ 0, không in body; -sS: chỉ in lỗi của curl (không kèm URL)
  if ! curl -sS -f --retry 2 --max-time 60 -o "$out" -G "$SUPABASE_PROD_URL/rest/v1/books" \
      -H "apikey: $SUPABASE_PROD_KEY" -H 'Accept: application/json' \
      --data-urlencode "select=$columns" --data-urlencode "id=in.($part)" --data-urlencode 'order=id'; then
    fail "lấy production" "REST lỗi ở lô $chunk"
  fi
  echo "$out" >> "$WORK/chunks.txt"
  chunk=$((chunk + 1))
done
mapfile -t chunk_files < "$WORK/chunks.txt"
jq -s 'add' "${chunk_files[@]}" > "$WORK/books.json"
got=$(jq -r 'map(.id) | sort | map(tostring) | join(",")' "$WORK/books.json")
if [ "$got" != "$id_list" ]; then
  missing=$(comm -23 <(tr , '\n' <<< "$id_list" | sort) <(tr , '\n' <<< "$got" | sort) | sort -n | paste -sd, -)
  extra=$(comm -13 <(tr , '\n' <<< "$id_list" | sort) <(tr , '\n' <<< "$got" | sort) | sort -n | paste -sd, -)
  fail "lấy production" "file nhắc $id_count id, production trả $(jq length "$WORK/books.json") dòng; thiếu (không có / ẩn): ${missing:-không}; thừa: ${extra:-không}"
fi
# Nạp giữ nguyên id. JSON đi qua base64 (COPY dạng text hiểu \ là ký tự thoát, base64 không có \). Lỗi chỉ in SQLSTATE:
# DETAIL "Failing row contains (…)" của Postgres chép cả mô tả
if ! {
  echo 'create temp table ci_in (b64 text);'
  echo 'copy ci_in from stdin;'
  base64 -w0 "$WORK/books.json"
  echo
  echo '\.'
  echo "insert into public.books select * from jsonb_populate_recordset(null::public.books,
    (select convert_from(decode(b64, 'base64'), 'UTF8')::jsonb from ci_in));"
} | db_psql -v VERBOSITY=verbose 2> "$WORK/load.err"; then
  grep -oE '^psql:[^:]*:[0-9]+: ERROR: +[A-Z0-9]{5}' "$WORK/load.err" || true
  fail "lấy production" "nạp vào DB local lỗi"
fi
loaded=$(db_psql -c 'select count(*) from public.books' < /dev/null)
[ "$loaded" = "$id_count" ] || fail "lấy production" "nạp được $loaded / $id_count dòng"
row "lấy production" "$id_count dòng (REST công khai, khóa publishable; category_id / publisher_id = null)"

# File kiểm (chỉ đọc) của vòng: chạy được trên dữ liệu này (in số đếm / id, không nội dung)
if [ -f "$check_file" ]; then
  echo "::group::$check_file (chỉ đọc)"
  { echo 'set default_transaction_read_only = on;'; cat "$check_file"; } | db_psql
  echo "::endgroup::"
  row "file kiểm" "$check_file chạy được (chỉ đọc)"
fi

# ---- Hàm chạy / so ----
snap() { db_psql -c "select ci_data_check.snap('$1')" < /dev/null > /dev/null; }

# Số dòng khác giữa bản chụp $1 và public.books (bỏ qua cột trong $2, mặc định không bỏ cột nào): "n|id,id"
changed() {
  local ignore="${2:-}"
  [ -n "$ignore" ] || ignore='{}'
  db_psql -c "select count(*) || '|' || coalesce(string_agg(x::text, ',' order by x), '')
    from ci_data_check.changed_ids('ci_data_check.$1', 'public.books', '$ignore') x" < /dev/null
}

counts() { db_psql -c "select tbl || '=' || n from ci_data_check.table_counts()" < /dev/null > "$WORK/counts-$1.txt"; }

# Chạy file SQL bằng psql (ON_ERROR_STOP), stdout / stderr vào file; chỉ in vị trí + SQLSTATE của dòng ERROR
run_sql() {
  local file="$1" tag="$2"
  if db_psql -v VERBOSITY=verbose < "$file" > "$WORK/$tag.out" 2> "$WORK/$tag.err"; then
    return 0
  fi
  grep -oE '^psql:[^:]*:[0-9]+: ERROR: +[A-Z0-9]{5}' "$WORK/$tag.err" || echo "(không có dòng ERROR có SQLSTATE)"
  return 1
}

# Cột ngoài danh sách được ghi không đổi so với bản chụp $1 + số dòng mọi bảng không đổi so với counts-$1
columns_kept() {
  local label="$1" snapshot="$2" diff_cols
  diff_cols=$(db_psql -c "select col || ': ' || n || ' dòng (id ' || ids || ')'
    from ci_data_check.changed_columns('ci_data_check.$snapshot', 'public.books', '$allowed_pg')" < /dev/null)
  [ -z "$diff_cols" ] || fail "$label" "cột không được ghi bị đổi: $(paste -sd';' <<< "$diff_cols")"
  counts "$snapshot-after"
  diff -u "$WORK/counts-$snapshot.txt" "$WORK/counts-$snapshot-after.txt" > "$WORK/counts.diff" \
    || fail "$label" "số dòng bảng đổi: $(grep -E '^[-+][a-z]' "$WORK/counts.diff" | paste -sd' ' -)"
}

# Ghi từng file một lần: số dòng đổi = số câu UPDATE, đúng các id của file; cột ngoài danh sách không đổi
write_all() {
  local label="$1" file result n ids
  for file in "${files[@]}"; do
    snap pre; counts pre
    run_sql "$file" write || fail "$label" "$(basename "$file") lỗi khi ghi"
    result=$(changed pre); n=${result%%|*}; ids=${result#*|}
    [ "$n" = "${file_updates[$file]}" ] || fail "$label" "$(basename "$file"): $n dòng đổi, cần ${file_updates[$file]}"
    [ "$ids" = "$(tr , '\n' <<< "${file_ids[$file]}" | sort -n | paste -sd, -)" ] \
      || fail "$label" "$(basename "$file"): dòng đổi không đúng các id của file"
    columns_kept "$label" pre
    row "$label" "$(basename "$file"): $n dòng đổi = ${file_updates[$file]} câu; cột ngoài {$allowed} giữ nguyên md5; số dòng mọi bảng không đổi"
  done
}

# Chạy lại mọi file: 0 dòng đổi, không lỗi
rerun_zero() {
  local label="$1" file result
  for file in "${files[@]}"; do
    snap pre; counts pre
    run_sql "$file" rerun || fail "$label" "$(basename "$file") lỗi khi chạy lại"
    result=$(changed pre)
    [ "${result%%|*}" = "0" ] || fail "$label" "$(basename "$file"): ${result%%|*} dòng đổi (id ${result#*|}), cần 0"
    columns_kept "$label" pre
    row "$label" "$(basename "$file"): 0 dòng đổi, không lỗi"
  done
}

# (e) sửa 1 ký tự của description ở một dòng của file → chạy file phải lỗi P0001 (raise) và 0 dòng đổi toàn bảng;
# xong trả lại mô tả cũ. Dòng chọn: id nhỏ nhất của file có description.
broken_original() {
  local file id result
  for file in "${files[@]}"; do
    id=$(db_psql -c "select id from public.books where id = any('{${file_ids[$file]}}') and coalesce(description, '') <> ''
      order by id limit 1" < /dev/null)
    [ -n "$id" ] || fail "(e) sửa mô tả gốc" "$(basename "$file"): không có dòng nào có description"
    db_psql -c "drop table if exists ci_data_check.e_saved;
      create table ci_data_check.e_saved as select id, description from public.books where id = $id;
      update public.books set description = case when left(description, 1) = 'X' then 'Y' else 'X' end || substr(description, 2)
       where id = $id" < /dev/null
    snap pre_e
    if run_sql "$file" broken; then
      fail "(e) sửa mô tả gốc" "$(basename "$file"): mô tả gốc id $id bị sửa mà file vẫn chạy không lỗi"
    fi
    grep -qE 'ERROR: +P0001' "$WORK/broken.err" \
      || fail "(e) sửa mô tả gốc" "$(basename "$file"): lỗi nhưng không phải raise của khối kiểm (P0001)"
    result=$(changed pre_e)
    [ "${result%%|*}" = "0" ] || fail "(e) sửa mô tả gốc" "$(basename "$file"): ${result%%|*} dòng đổi sau lỗi, cần 0 (rollback cả lô)"
    db_psql -c "update public.books b set description = s.description from ci_data_check.e_saved s where b.id = s.id" < /dev/null
    row "(e) sửa mô tả gốc" "$(basename "$file"): sửa id $id → lỗi P0001, 0 dòng đổi toàn bảng; đã trả mô tả cũ"
  done
}

# ---- Chế độ theo trạng thái snapshot ----
mode_row=$(db_psql -c "select count(*) filter (where description_en is null and not description_auto_translated)
  || '|' || count(*) filter (where description_auto_translated) from public.books" < /dev/null)
not_written=${mode_row%%|*}
written=${mode_row#*|}
if [ "$not_written" = "$id_count" ]; then
  mode="CHƯA GHI"
elif [ "$written" = "$id_count" ]; then
  mode="ĐÃ GHI"
else
  odd=$(db_psql -c "select string_agg(id::text, ',' order by id) from public.books
    where not description_auto_translated and description_en is not null" < /dev/null)
  flag_off=$(db_psql -c "select string_agg(id::text, ',' order by id) from public.books where not description_auto_translated" < /dev/null)
  fail "chế độ" "lẫn lộn: $not_written dòng chưa ghi, $written dòng đã ghi / $id_count; cờ false: ${flag_off:-không}; cờ false mà đã có description_en: ${odd:-không}"
fi
echo "[$UNIT] Chế độ: $mode"
row "chế độ" "$mode ($id_count / $id_count dòng)"

snap s0; counts s0

if [ "$mode" = "CHƯA GHI" ]; then
  broken_original
  result=$(changed s0 '{updated_at}')
  [ "${result%%|*}" = "0" ] || fail "(e) sửa mô tả gốc" "trả mô tả cũ xong mà ${result%%|*} dòng khác bản chụp đầu"
  write_all "(a)+(c) lần 1"
  snap s1
  rerun_zero "(b) lần 2"
  if [ ! -f "$undo" ]; then
    row "(f) hoàn tác" "bỏ qua: chưa có $(basename "$undo")"
  elif [ "$full_round" != true ]; then
    row "(f) hoàn tác" "bỏ qua: chỉ kiểm một phần file ghi của vòng"
  else
    snap pre; counts pre
    run_sql "$undo" undo || fail "(f) hoàn tác" "$(basename "$undo") lỗi"
    result=$(changed s0 '{updated_at}')
    [ "${result%%|*}" = "0" ] || fail "(f) hoàn tác" "${result%%|*} dòng chưa về bản chụp đầu (id ${result#*|})"
    columns_kept "(f) hoàn tác" pre
    row "(f) hoàn tác" "mọi cột (trừ updated_at) về đúng bản chụp đầu"
    write_all "(f) ghi lại"
    result=$(changed s1 '{updated_at}')
    [ "${result%%|*}" = "0" ] || fail "(f) ghi lại" "${result%%|*} dòng khác lần ghi đầu (id ${result#*|})"
    rerun_zero "(f) lần 2"
  fi
else
  rerun_zero "(a) lần 1 (đã ghi)"
  rerun_zero "(b) lần 2"
  row "(c) cột" "đạt: 0 dòng đổi ở cả hai lần (mọi cột giữ nguyên md5)"
  if [ ! -f "$undo" ]; then
    row "(e) sửa mô tả gốc" "bỏ qua: production đã ghi và chưa có $(basename "$undo") để đưa về trạng thái trước ghi"
    row "(f) hoàn tác" "bỏ qua: chưa có $(basename "$undo")"
  elif [ "$full_round" != true ]; then
    row "(e) sửa mô tả gốc" "bỏ qua: chỉ kiểm một phần file ghi của vòng (hoàn tác là của cả vòng)"
    row "(f) hoàn tác" "bỏ qua: chỉ kiểm một phần file ghi của vòng"
  else
    snap pre; counts pre
    run_sql "$undo" undo || fail "(f) hoàn tác" "$(basename "$undo") lỗi"
    bad=$(db_psql -c "select string_agg(id::text, ',' order by id) from public.books
      where description_en is not null or description_auto_translated" < /dev/null)
    [ -z "$bad" ] || fail "(f) hoàn tác" "còn description_en / cờ ở id $bad"
    columns_kept "(f) hoàn tác" pre
    row "(f) hoàn tác" "$id_count dòng về trạng thái trước ghi (description_en null, cờ false, cột ngoài {$allowed} giữ nguyên)"
    snap u; counts u
    run_sql "$undo" undo2 || fail "(f) hoàn tác lần 2" "$(basename "$undo") lỗi"
    result=$(changed u)
    [ "${result%%|*}" = "0" ] || fail "(f) hoàn tác lần 2" "${result%%|*} dòng đổi, cần 0"
    row "(f) hoàn tác lần 2" "0 dòng đổi"
    broken_original
    result=$(changed u '{updated_at}')
    [ "${result%%|*}" = "0" ] || fail "(e) sửa mô tả gốc" "trả mô tả cũ xong mà ${result%%|*} dòng khác trạng thái sau hoàn tác"
    write_all "(f) ghi lại (a)+(c)"
    result=$(changed s0 '{updated_at}')
    [ "${result%%|*}" = "0" ] || fail "(f) ghi lại" "${result%%|*} dòng khác production (id ${result#*|})"
    row "(f) ghi lại" "mọi cột (trừ updated_at) khớp đúng dữ liệu production"
    rerun_zero "(f) lần 2"
  fi
fi

row "KẾT QUẢ" "ĐẠT"
