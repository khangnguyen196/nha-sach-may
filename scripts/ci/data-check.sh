#!/usr/bin/env bash
# data-check (.github/workflows/data-check.yml): chạy thử file SQL dữ liệu (supabase/data/**) trên Supabase local của CI.
# Hai cách gọi:
#   bash scripts/ci/data-check.sh --plan <ra> [<file ghi>]
#       Kiểm tên mọi *.sql dưới supabase/data/ rồi ghi vào <ra> các vòng cần kiểm, mỗi dòng một vòng (cùng thư mục +
#       cùng N, các file cách nhau bằng dấu cách). Có <file ghi> (chạy tay) → chỉ file đó. Không cần DB, không cần khóa.
#       Không có <file ghi> (push): bỏ qua vòng có MỌI file ghi nằm trong supabase/data/da-chay-production.txt (đã chạy
#       production, dữ liệu đã đổi nên kiểm lại sẽ đỏ); vòng chỉ có một phần file trong danh sách → đỏ. Bỏ qua hết → 0 vòng,
#       exit 0. Có <file ghi> nằm trong danh sách → vẫn kiểm, kèm ::warning::.
#   bash scripts/ci/data-check.sh <file ghi>...   (mọi file cùng thư mục, cùng vòng N): chạy thử MỘT vòng
# Quy ước tên (supabase/data/<đợt>/): file GHI vong-N-sach-*.sql; file kiểm (chỉ đọc) vong-N-kiem.sql; file hoàn tác
# vong-N-hoan-tac.sql (một file cho cả vòng N). *.sql khác tên, hoặc file kiểm / hoàn tác không có file ghi cùng vòng → đỏ.
# Danh sách đã chạy production (supabase/data/da-chay-production.txt, không phải .sql): mỗi dòng "<đường dẫn file ghi>
# <YYYY-MM-DD>", dòng bắt đầu bằng # là comment. Dòng sai dạng, trùng, hoặc trỏ file không có → đỏ (gõ nhầm).
# Khai báo trong comment của file ghi (mọi file của vòng giống nhau): "-- data-check: cot-duoc-ghi = a, b" (cột được ghi) và
# "-- data-check: che-do = viet-lai" (mô tả đã có được thay bằng bản viết mới: không nhận chế độ theo cờ, cả vòng chạy đường
# CHƯA GHI; giá trị khác → đỏ). Dòng khai báo che-do không được có chữ nào sau giá trị trên cùng dòng (ghi chú để ở dòng
# riêng): phần sau dấu = bị gộp lại (bỏ dấu cách) thành giá trị, chữ thừa → "giá trị không hỗ trợ" → đỏ.
# Env: SUPABASE_PROD_URL, SUPABASE_PROD_KEY (khóa publishable / anon, chỉ để đọc REST công khai), RESULTS (file bảng kết
# quả markdown, nối thêm dòng), DB_CONTAINER (migration-check-lib.sh).
# Không in nội dung mô tả, URL hay khóa: log chỉ có id, tên cột, số đếm, SQLSTATE.
set -Eeuo pipefail

DATA_ROOT=supabase/data
DIR_RE='^supabase/data(/[A-Za-z0-9._-]+)+$'
NAME_RE='^vong-([1-9][0-9]*)-(sach-[A-Za-z0-9._-]+|kiem|hoan-tac)\.sql$'
WRITE_RE='^supabase/data(/[A-Za-z0-9._-]+)+/vong-[1-9][0-9]*-sach-[A-Za-z0-9._-]+\.sql$'
DONE_LIST="$DATA_ROOT/da-chay-production.txt"

# ---- --plan: kiểm tên file + gom vòng ----
plan_units() {
  local out="$1" input="${2:-}" bad=0 file dir name key line path run_date skipped=0 dates
  local -a sql_files writes=() order=() unit_files listed unlisted
  local -A has_write=() unit=() done_date=()
  # Danh sách file ghi đã chạy production
  if [ -f "$DONE_LIST" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      line="${line%$'\r'}"
      if [[ "$line" =~ ^[[:space:]]*(#.*)?$ ]]; then continue; fi
      if ! [[ "$line" =~ ^([^[:space:]]+)[[:space:]]+([0-9]{4}-[0-9]{2}-[0-9]{2})[[:space:]]*$ ]]; then
        echo "::error::data-check: $DONE_LIST: dòng sai dạng (cần '<file ghi> <YYYY-MM-DD>'): $line"
        bad=1
        continue
      fi
      path="${BASH_REMATCH[1]}"
      run_date="${BASH_REMATCH[2]}"
      if ! [[ "$path" =~ $WRITE_RE ]] || [[ "$path" == *..* ]]; then
        echo "::error::data-check: $DONE_LIST: $path không phải file ghi supabase/data/…/vong-N-sach-*.sql"
        bad=1
      elif [ ! -f "$path" ]; then
        echo "::error::data-check: $DONE_LIST: không có file $path (gõ nhầm?)"
        bad=1
      elif [ -n "${done_date[$path]:-}" ]; then
        echo "::error::data-check: $DONE_LIST: $path có nhiều dòng"
        bad=1
      else
        done_date[$path]="$run_date"
      fi
    done < "$DONE_LIST"
  fi
  mapfile -t sql_files < <(find "$DATA_ROOT" -type f -iname '*.sql' 2> /dev/null | LC_ALL=C sort)
  for file in "${sql_files[@]}"; do
    dir=$(dirname "$file")
    name=$(basename "$file")
    if ! [[ "$dir" =~ $DIR_RE ]] || [[ "$dir" == *..* ]] || ! [[ "$name" =~ $NAME_RE ]]; then
      echo "::error::data-check: $file không khớp quy ước tên (vong-N-sach-*.sql, vong-N-kiem.sql, vong-N-hoan-tac.sql; thư mục chỉ chữ / số / . _ -)"
      bad=1
      continue
    fi
    key="$dir ${BASH_REMATCH[1]}"
    if [[ "${BASH_REMATCH[2]}" == sach-* ]]; then
      has_write[$key]=1
      writes+=("$file")
      if [ -z "${unit[$key]:-}" ]; then order+=("$key"); unit[$key]="$file"; else unit[$key]+=" $file"; fi
    fi
  done
  for file in "${sql_files[@]}"; do
    name=$(basename "$file")
    [[ "$name" =~ $NAME_RE ]] || continue
    [[ "${BASH_REMATCH[2]}" == sach-* ]] && continue
    key="$(dirname "$file") ${BASH_REMATCH[1]}"
    if [ -z "${has_write[$key]:-}" ]; then
      echo "::error::data-check: $file không có file ghi vong-${BASH_REMATCH[1]}-sach-*.sql cùng thư mục"
      bad=1
    fi
  done
  : > "$out"
  if [ -n "$input" ]; then
    if ! [[ "$input" =~ $WRITE_RE ]] || [[ "$input" == *..* ]]; then
      echo "::error::data-check: input file phải là supabase/data/…/vong-N-sach-*.sql"
      bad=1
    elif [ ! -f "$input" ]; then
      echo "::error::data-check: không có file $input trên ref này"
      bad=1
    else
      echo "$input" > "$out"
      if [ -n "${done_date[$input]:-}" ]; then
        echo "::warning::data-check: $input đã chạy production (${done_date[$input]}), kết quả có thể đỏ do dữ liệu đã đổi"
      fi
    fi
  else
    for key in "${order[@]}"; do
      read -r -a unit_files <<< "${unit[$key]}"
      listed=()
      unlisted=()
      for file in "${unit_files[@]}"; do
        if [ -n "${done_date[$file]:-}" ]; then listed+=("$file"); else unlisted+=("$file"); fi
      done
      if [ "${#listed[@]}" = 0 ]; then
        echo "${unit[$key]}" >> "$out"
      elif [ "${#unlisted[@]}" = 0 ]; then
        dates=$(for file in "${listed[@]}"; do echo "${done_date[$file]}"; done | LC_ALL=C sort -u | paste -sd, -)
        echo "bỏ qua (đã chạy production $dates): ${unit[$key]}"
        skipped=$((skipped + 1))
      else
        echo "::error::data-check: vòng ${key/ / vòng } chỉ có một phần file ghi trong $DONE_LIST (có: ${listed[*]}; chưa có: ${unlisted[*]}); thêm đủ hoặc bỏ hết"
        bad=1
      fi
    done
  fi
  if [ "$bad" = 0 ] && [ ! -s "$out" ]; then
    if [ -z "$input" ] && [ "${#writes[@]}" -gt 0 ] && [ "$skipped" -gt 0 ]; then
      echo "0 vòng cần kiểm (mọi vòng đã chạy production, xem $DONE_LIST)"
      return 0
    fi
    echo "::error::data-check: không có file ghi nào để kiểm (0 vòng)"
    bad=1
  fi
  [ "$bad" = 0 ] || return 1
  echo "$(wc -l < "$out") vòng cần kiểm:"
  cat "$out"
}

if [ "${1:-}" = "--plan" ]; then
  [ "$#" -ge 2 ] || { echo "::error::dùng: data-check.sh --plan <ra> [<file ghi>]"; exit 2; }
  plan_units "$2" "${3:-}"
  exit
fi

# ---- Chặn nhầm khóa bí mật (chạy cách nào cũng kiểm): chỉ nhận khóa publishable hoặc JWT có role anon ----
case "${SUPABASE_PROD_KEY:-}" in
  sb_publishable_*) ;;
  *.*.*)
    payload=$(cut -d. -f2 <<< "$SUPABASE_PROD_KEY" | tr '_-' '/+')
    while [ $(( ${#payload} % 4 )) -ne 0 ]; do payload="$payload="; done
    role=$(base64 -d <<< "$payload" 2> /dev/null | jq -r '.role' 2> /dev/null || true)
    if [ "$role" != "anon" ]; then echo "::error::khóa không phải anon / publishable"; exit 1; fi ;;
  *) echo "::error::khóa không phải anon / publishable (hoặc thiếu secret NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"; exit 1 ;;
esac

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
  [[ "$name" =~ ^vong-([1-9][0-9]*)-sach-[^/]+\.sql$ ]] || fail "tên file" "$file không đúng quy ước vong-N-sach-*.sql"
  [ -f "$file" ] || fail "tên file" "$file không có"
  [ "$(dirname "$file")" = "$dir" ] || fail "tên file" "các file phải cùng thư mục"
  if [ -z "$round" ]; then round="${BASH_REMATCH[1]}"; fi
  [ "${BASH_REMATCH[1]}" = "$round" ] || fail "tên file" "các file phải cùng vòng"
done
UNIT="$dir vòng $round"
files=("$@")
round_files=("$@")
undo="$dir/vong-$round-hoan-tac.sql"
check_file="$dir/vong-$round-kiem.sql"

# Đủ mọi file ghi của vòng? (hoàn tác là của cả vòng: chỉ chạy đường hoàn tác khi đang kiểm đủ vòng)
mapfile -t all_files < <(find "$dir" -maxdepth 1 -type f -name "vong-$round-sach-*.sql" | LC_ALL=C sort)
mapfile -t given_sorted < <(printf '%s\n' "${files[@]}" | LC_ALL=C sort)
full_round=false
if [ "${all_files[*]}" = "${given_sorted[*]}" ]; then full_round=true; fi
echo "[$UNIT] file ghi: ${files[*]} (đủ vòng: $full_round)"

# ---- Cột được phép ghi ----
# Khai báo trong comment của file ghi: "-- data-check: cot-duoc-ghi = a, b, c" (mọi file của vòng phải giống nhau, kể cả
# có / không khai báo). Không khai báo: chỉ thư mục mo-ta-song-ngu có mặc định theo vòng (vòng 3: sách Việt →
# description_en + cờ; vòng 4: sách ngoại văn → thêm description); thư mục khác bắt buộc khai báo.
declared=""
first=true
for file in "${files[@]}"; do
  line=$(grep -m1 -E '^-- data-check: cot-duoc-ghi = ' "$file" || true)
  value=$(printf '%s' "${line#-- data-check: cot-duoc-ghi = }" | tr -d ' ')
  if [ "$first" = true ]; then
    declared="$value"
    first=false
  elif [ "$value" != "$declared" ]; then
    fail "cột được ghi" "các file của vòng khai báo khác nhau (hoặc file có, file không)"
  fi
done
if [ -n "$declared" ]; then
  allowed="$declared"
elif [ "$(basename "$dir")" = "mo-ta-song-ngu" ]; then
  case "$round" in
    3) allowed="description_en,description_auto_translated" ;;
    4) allowed="description,description_en,description_auto_translated" ;;
    *) fail "cột được ghi" "vòng $round chưa khai báo (thêm comment '-- data-check: cot-duoc-ghi = …' vào file ghi)" ;;
  esac
else
  fail "cột được ghi" "thư mục $(basename "$dir") phải khai báo '-- data-check: cot-duoc-ghi = …' trong file ghi"
fi
[[ "$allowed" =~ ^[a-z_]+(,[a-z_]+)*$ ]] || fail "cột được ghi" "khai báo sai dạng"
allowed_pg="{$allowed,updated_at}"
row "cột được ghi" "$allowed (+ updated_at do trigger)"

# ---- Chế độ khai báo: "-- data-check: che-do = viet-lai" (mọi file của vòng giống nhau, kể cả có / không) ----
# viet-lai: mô tả đã có (có thể đã dịch, cờ true) được thay bằng bản viết mới → không nhận chế độ theo cờ, chạy đường CHƯA GHI
declared_mode=""
first=true
for file in "${files[@]}"; do
  line=$(grep -m1 -E '^-- data-check: *che-do' "$file" || true)
  value=""
  if [ -n "$line" ]; then
    value=$(printf '%s' "$line" | sed -E 's/^-- data-check: *che-do *= *//' | tr -d ' ')
    [ -n "$value" ] || value="(trống)"
  fi
  if [ "$first" = true ]; then
    declared_mode="$value"
    first=false
  elif [ "$value" != "$declared_mode" ]; then
    fail "che-do" "các file của vòng khai báo khác nhau (hoặc file có, file không)"
  fi
done
case "$declared_mode" in
  "" | viet-lai) ;;
  *) fail "che-do" "giá trị không hỗ trợ (chỉ nhận 'viet-lai')" ;;
esac

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
row "(d) chữ" "đạt: $id_count câu / $id_count id, NFC, không ký tự ẩn (Cf, Zl, Zp, Zs ≠ U+0020) / điều khiển (trừ LF), \$mota\$ đúng cặp, khối do \$\$ đúng id + số câu của từng file"

# ---- DB local: dọn sách của vòng trước, nạp hàm kiểm ----
db_psql -c 'delete from public.books' < /dev/null
db_psql < scripts/ci/data-check-lib.sql

# ---- Lấy sách từ production qua REST công khai ----
[ -n "${SUPABASE_PROD_URL:-}" ] || fail "lấy production" "thiếu secret NEXT_PUBLIC_SUPABASE_URL"
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

# File kiểm (chỉ đọc) của vòng: chạy được trên dữ liệu này (in số đếm / id, không nội dung). Không mở ::group:: riêng:
# workflow đã bọc cả vòng trong một group (group lồng nhau không được hỗ trợ)
if [ -f "$check_file" ]; then
  echo "----- $check_file (chỉ đọc) -----"
  { echo 'set default_transaction_read_only = on;'; cat "$check_file"; } | db_psql
  echo "----- hết $check_file -----"
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
  local label="$1" file result n ids hint
  for file in "${files[@]}"; do
    snap pre; counts pre
    run_sql "$file" write || fail "$label" "$(basename "$file") lỗi khi ghi"
    result=$(changed pre); n=${result%%|*}; ids=${result#*|}
    if [ "$n" != "${file_updates[$file]}" ]; then
      hint=""
      if [ "$n" = 0 ] && [ "$declared_mode" = viet-lai ]; then
        hint=" (che-do = viet-lai: có thể đã chạy production: thêm vào danh sách đã chạy $DONE_LIST)"
      fi
      fail "$label" "$(basename "$file"): $n dòng đổi, cần ${file_updates[$file]}$hint"
    fi
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

# Chạy hoàn tác lần 2 trên trạng thái vừa hoàn tác: 0 dòng đổi, không lỗi
undo_again_zero() {
  local result
  snap u; counts u
  run_sql "$undo" undo2 || fail "(f) hoàn tác lần 2" "$(basename "$undo") lỗi"
  result=$(changed u)
  [ "${result%%|*}" = "0" ] || fail "(f) hoàn tác lần 2" "${result%%|*} dòng đổi (id ${result#*|}), cần 0"
  columns_kept "(f) hoàn tác lần 2" u
  row "(f) hoàn tác lần 2" "0 dòng đổi"
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

# ---- Chế độ: tính theo TỪNG FILE ghi (chỉ các id của file đó) ----
# CHƯA GHI: mọi dòng của file description_en null + cờ false; ĐÃ GHI: mọi dòng của file cờ true; lẫn lộn trong một file → đỏ.
# Khai báo che-do = viet-lai: bỏ bước này, cả vòng một chế độ VIẾT LẠI (đường CHƯA GHI, không dựa vào cờ)
declare -A file_mode
mode_files=("${files[@]}")
if [ "$declared_mode" = viet-lai ]; then
  mode_files=()
  for file in "${files[@]}"; do file_mode[$file]="VIẾT LẠI"; done
  row "chế độ" "VIẾT LẠI (khai báo che-do = viet-lai): không nhận chế độ theo cờ; cả vòng chạy đường CHƯA GHI"
fi
for file in "${mode_files[@]}"; do
  mode_row=$(db_psql -c "select count(*) filter (where description_en is null and not description_auto_translated)
    || '|' || count(*) filter (where description_auto_translated) from public.books where id = any('{${file_ids[$file]}}')" < /dev/null)
  not_written=${mode_row%%|*}
  written=${mode_row#*|}
  if [ "$not_written" = "${file_updates[$file]}" ]; then
    file_mode[$file]="CHƯA GHI"
  elif [ "$written" = "${file_updates[$file]}" ]; then
    file_mode[$file]="ĐÃ GHI"
  else
    odd=$(db_psql -c "select string_agg(id::text, ',' order by id) from public.books where id = any('{${file_ids[$file]}}')
      and not description_auto_translated and description_en is not null" < /dev/null)
    flag_off=$(db_psql -c "select string_agg(id::text, ',' order by id) from public.books where id = any('{${file_ids[$file]}}')
      and not description_auto_translated" < /dev/null)
    fail "chế độ" "$(basename "$file") lẫn lộn: $not_written dòng chưa ghi, $written dòng đã ghi / ${file_updates[$file]}; cờ false: ${flag_off:-không}; cờ false mà đã có description_en: ${odd:-không}"
  fi
  row "chế độ" "$(basename "$file"): ${file_mode[$file]} (${file_updates[$file]} / ${file_updates[$file]} dòng)"
done
mapfile -t modes < <(printf '%s\n' "${file_mode[@]}" | sort -u)

# Đường hoàn tác (f) + (e) của vòng ĐÃ GHI chạy ở mức vòng: chỉ khi có file hoàn tác, đang kiểm đủ vòng và mọi file ghi
# cùng chế độ. Lý do bỏ qua ghi vào bảng (không đỏ)
if [ ! -f "$undo" ]; then
  undo_skip="chưa có $(basename "$undo")"
elif [ "$full_round" != true ]; then
  undo_skip="chỉ kiểm một phần file ghi của vòng (hoàn tác là của cả vòng)"
elif [ "${#modes[@]}" -gt 1 ]; then
  undo_skip="file ghi của vòng khác chế độ (có file CHƯA GHI, có file ĐÃ GHI; hoàn tác là của cả vòng)"
else
  undo_skip=""
fi

file_names() {
  local file out=""
  for file in "${files[@]}"; do out+="${out:+, }$(basename "$file")"; done
  printf '%s' "$out"
}

flow_not_written() {
  local result
  snap s0; counts s0
  broken_original
  result=$(changed s0 '{updated_at}')
  [ "${result%%|*}" = "0" ] || fail "(e) sửa mô tả gốc" "trả mô tả cũ xong mà ${result%%|*} dòng khác bản chụp đầu"
  write_all "(a)+(c) lần 1"
  snap s1
  rerun_zero "(b) lần 2"
  if [ -n "$undo_skip" ]; then
    row "(f) hoàn tác" "$(file_names): bỏ qua: $undo_skip"
    return
  fi
  snap pre; counts pre
  run_sql "$undo" undo || fail "(f) hoàn tác" "$(basename "$undo") lỗi"
  result=$(changed s0 '{updated_at}')
  [ "${result%%|*}" = "0" ] || fail "(f) hoàn tác" "${result%%|*} dòng chưa về bản chụp đầu (id ${result#*|})"
  columns_kept "(f) hoàn tác" pre
  row "(f) hoàn tác" "mọi cột (trừ updated_at) về đúng bản chụp đầu"
  undo_again_zero
  write_all "(f) ghi lại"
  result=$(changed s1 '{updated_at}')
  [ "${result%%|*}" = "0" ] || fail "(f) ghi lại" "${result%%|*} dòng khác lần ghi đầu (id ${result#*|})"
  rerun_zero "(f) lần 2"
}

flow_written() {
  local result bad
  snap s0; counts s0
  rerun_zero "(a) lần 1 (đã ghi)"
  rerun_zero "(b) lần 2"
  row "(c) cột" "đạt: 0 dòng đổi ở cả hai lần (mọi cột giữ nguyên md5)"
  if [ -n "$undo_skip" ]; then
    row "(e) sửa mô tả gốc" "$(file_names): bỏ qua: production đã ghi, cần hoàn tác để đưa về trạng thái trước ghi mà $undo_skip"
    row "(f) hoàn tác" "$(file_names): bỏ qua: $undo_skip"
    return
  fi
  snap pre; counts pre
  run_sql "$undo" undo || fail "(f) hoàn tác" "$(basename "$undo") lỗi"
  bad=$(db_psql -c "select string_agg(id::text, ',' order by id) from public.books
    where description_en is not null or description_auto_translated" < /dev/null)
  [ -z "$bad" ] || fail "(f) hoàn tác" "còn description_en / cờ ở id $bad"
  columns_kept "(f) hoàn tác" pre
  row "(f) hoàn tác" "$id_count dòng về trạng thái trước ghi (description_en null, cờ false, cột ngoài {$allowed} giữ nguyên)"
  undo_again_zero
  broken_original
  result=$(changed u '{updated_at}')
  [ "${result%%|*}" = "0" ] || fail "(e) sửa mô tả gốc" "trả mô tả cũ xong mà ${result%%|*} dòng khác trạng thái sau hoàn tác"
  write_all "(f) ghi lại (a)+(c)"
  result=$(changed s0 '{updated_at}')
  [ "${result%%|*}" = "0" ] || fail "(f) ghi lại" "${result%%|*} dòng khác bản chụp production đã nạp (id ${result#*|})"
  row "(f) ghi lại" "mọi cột (trừ updated_at) khớp bản chụp production đã nạp"
  rerun_zero "(f) lần 2"
}

if [ "${#modes[@]}" = 1 ]; then
  echo "[$UNIT] Chế độ cả vòng: ${modes[0]}"
  if [ "${modes[0]}" = "ĐÃ GHI" ]; then flow_written; else flow_not_written; fi
else
  # Vòng có file đã chạy production và file chưa chạy: kiểm riêng từng file theo chế độ của nó
  echo "[$UNIT] Chế độ khác nhau giữa các file: kiểm riêng từng file"
  for file in "${round_files[@]}"; do
    files=("$file")
    if [ "${file_mode[$file]}" = "CHƯA GHI" ]; then flow_not_written; else flow_written; fi
  done
  files=("${round_files[@]}")
fi

row "KẾT QUẢ" "ĐẠT"
