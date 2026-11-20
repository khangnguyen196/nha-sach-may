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

Vòng ghi cột khác vòng 3 / 4: thêm dòng `-- data-check: cot-duoc-ghi = a, b` vào đầu file ghi (mặc định vòng 3:
`description_en, description_auto_translated`; vòng 4: thêm `description`).

## File

| File | Nguồn (bản chốt, nội dung y hệt) | Trạng thái |
|---|---|---|
| `vong-3-sach-viet.sql` | `D:/Bán sách-backup/mo-ta-song-ngu/vong-3-sach-viet-v3.sql` | đã chạy production 2026-11-20 (67 dòng) |
| `vong-3-kiem.sql` | `D:/Bán sách-backup/mo-ta-song-ngu/vong-3-kiem-v3.sql` | đã kiểm sau ghi: vi 72 / 71 / 67 / 67 |

Không lưu bản v1 / v2 và file chụp trước (`*-truoc.json`, ở thư mục backup). Comment trong file còn nhắc tên cũ
(`-v3`, `vong-3-sach-viet.sql` "bị thay"): giữ nguyên văn bản đã chạy.
