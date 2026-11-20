# SQL dữ liệu: mô tả song ngữ (`docs/plans/mo-ta-song-ngu.md`)

File SQL **dữ liệu** (không phải migration, không đổi schema) của đợt mo-ta-song-ngu. Chủ dự án chạy tay trong Supabase
SQL Editor; Claude chỉ chạy câu kiểm chỉ đọc trên production qua MCP. CI `data-check` (`.github/workflows/data-check.yml`)
chạy thử mọi file ghi trên Supabase local (sách lấy từ production qua REST công khai): job đỏ thì không đưa file cho chủ
dự án chạy.

## Quy ước tên (workflow tự nhận theo tên, thêm file không cần sửa workflow)

| Tên | Loại | Ai chạy |
|---|---|---|
| `vong-N-sach-*.sql` | file GHI (UPDATE theo id, `$mota$`, khối `do $$ … raise $$` kiểm cả lô trước `commit`) | chủ dự án, SQL Editor |
| `vong-N-kiem.sql` | SELECT kiểm, chỉ đọc (trước / sau khi ghi) | Claude (MCP chỉ đọc) |
| `vong-N-hoan-tac.sql` | hoàn tác, **một file cho cả vòng N** (kể cả khi vòng có nhiều file ghi) | chủ dự án, chỉ khi cần |

- N là số không có số 0 đầu (`vong-4`, không `vong-04`); `*` chỉ chữ / số / `.` `_` `-`. README.md bỏ qua.
- Mọi `*.sql` dưới `supabase/data/` phải khớp một trong 3 mẫu, không thì job **đỏ** (nêu tên file); `vong-N-kiem.sql` /
  `vong-N-hoan-tac.sql` không có file ghi `vong-N-sach-*.sql` cùng thư mục → đỏ; không có file ghi nào → đỏ. Áp cho
  cả push lẫn chạy tay.
- Cột được ghi: mặc định (chỉ thư mục này) vòng 3 `description_en, description_auto_translated`, vòng 4 thêm
  `description`. Vòng khác, hoặc thư mục khác `mo-ta-song-ngu`: **bắt buộc** dòng `-- data-check: cot-duoc-ghi = a, b`
  trong mọi file ghi của vòng (giống nhau), thiếu → đỏ.

## Viết file ghi (để qua (d))

- Mỗi câu `update … where id = N …` đúng một id, mỗi id một câu; chuỗi trong `$mota$…$mota$`: NFC, không ký tự ẩn
  (mọi ký tự định dạng vô hình như U+00AD, U+200B–U+200F, U+202A–U+202E, U+2060–U+206F, U+FEFF; U+2028 / U+2029; mọi
  khoảng trắng khác dấu cách thường như U+00A0, U+2009, U+202F), không ký tự điều khiển trừ xuống dòng LF, không CR.
  Ngoài chuỗi (code, comment) cũng không có ký tự định dạng vô hình.
- Mỗi file có khối `do $$ … $$;` của **riêng file đó**: `where id in (…)` liệt kê đúng tập id các câu UPDATE của file,
  so sánh `<> N` (hoặc `!=`, `is distinct from`) với N = số câu của file. Vòng nhiều file: mỗi file một khối, chỉ đếm id
  của chính file (chạy riêng từng file vẫn đúng).
- Vòng 4 (sách ngoại văn): bản gốc tiếng Anh chép **trong DB** bằng `description_en = description` (file không chứa
  chuỗi bản gốc), bản dịch Việt ghi vào `description` → (d) chỉ kiểm bản dịch Việt trong file; bản gốc tiếng Anh không
  qua (d). Câu ghi có điều kiện `md5(description) = '<md5 bản gốc>'` để chỉ ghi khi mô tả gốc chưa đổi.
- File kiểm (`vong-N-kiem.sql`) chỉ in số đếm / id: **không select cột mô tả** (`description`, `description_en`): CI
  chạy file này và log của CI là công khai.

## Chế độ (theo từng file ghi)

CI xét **từng file ghi** theo các id của file đó: CHƯA GHI (mọi dòng `description_en` null + cờ false) hoặc ĐÃ GHI (mọi
dòng cờ true); lẫn lộn trong một file → đỏ. Vòng có file đã chạy production và file chưa chạy (VD vòng 4: chủ dự án chạy
file 1 xong, file 2 chưa) không đỏ: mỗi file kiểm riêng theo chế độ của nó ((a) (b) (c) (d), file CHƯA GHI thêm (e));
đường hoàn tác (f) của cả vòng (và (e) của file ĐÃ GHI) bỏ qua, ghi lý do. Hoàn tác (f) chạy khi có file hoàn tác, kiểm
đủ file ghi của vòng và mọi file cùng chế độ; ngoài ra CHƯA GHI và ĐÃ GHI đều chạy hoàn tác **lần 2** = 0 dòng đổi.

Chạy tay một file (chỉ file đó, đường hoàn tác bỏ qua):

```bash
gh workflow run data-check.yml --ref <nhánh> -f file=supabase/data/mo-ta-song-ngu/<file ghi>
```

## File

| File | Nguồn (bản chốt, nội dung y hệt) | Trạng thái |
|---|---|---|
| `vong-3-sach-viet.sql` | `D:/Bán sách-backup/mo-ta-song-ngu/vong-3-sach-viet-v3.sql` | đã chạy production 2026-11-20 (67 dòng) |
| `vong-3-kiem.sql` | `D:/Bán sách-backup/mo-ta-song-ngu/vong-3-kiem-v3.sql` | đã kiểm sau ghi: vi 72 / 71 / 67 / 67 |

Không lưu bản v1 / v2 và file chụp trước (`*-truoc.json`, ở thư mục backup). Comment trong file còn nhắc tên cũ
(`-v3`, `vong-3-sach-viet.sql` "bị thay"): giữ nguyên văn bản đã chạy.
