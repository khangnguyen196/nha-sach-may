#!/usr/bin/env bash
# migration-check: chuẩn hóa pg_dump --schema-only để so hai DB dựng theo hai đường khác nhau (origin/main + migration
# với schema.sql mới). Bỏ dòng comment, SET, SELECT pg_catalog.set_config, \restrict / \unrestrict (pg_dump ≥ 17.6 in
# khóa ngẫu nhiên mỗi lần), dòng trống, khoảng trắng cuối dòng, dấu phẩy cuối dòng (cột cuối bảng không có phẩy); rồi
# sắp xếp dòng: bỏ qua thứ tự cột / thứ tự câu. Dùng: normalize-dump.sh <dump.sql> > <dump.norm>
set -euo pipefail

grep -v \
  -e '^--' \
  -e '^SET ' \
  -e '^SELECT pg_catalog.set_config' \
  -e '^\\restrict ' \
  -e '^\\unrestrict ' \
  -e '^[[:space:]]*$' \
  "$1" |
  sed -e 's/[[:space:]]*$//' -e 's/,$//' |
  LC_ALL=C sort
