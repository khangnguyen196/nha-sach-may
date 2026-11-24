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
| `vong-3-hoan-tac.sql` | `D:/Bán sách-backup/mo-ta-song-ngu/vong-3-hoan-tac-v3.sql` | chưa chạy (chỉ khi cần quay lại) |
| `vong-4-sach-en-1.sql` | `D:/Bán sách-backup/mo-ta-song-ngu/vong-4-sach-en-1-v3.sql` | chưa chạy (56 câu, id 192–249) |
| `vong-4-sach-en-2.sql` | `D:/Bán sách-backup/mo-ta-song-ngu/vong-4-sach-en-2-v3.sql` | chưa chạy (56 câu, id 250–308) |
| `vong-4-kiem.sql` | `D:/Bán sách-backup/mo-ta-song-ngu/vong-4-kiem-v2.sql` | chỉ đọc, chạy trước / giữa / sau |
| `vong-4-hoan-tac.sql` | `D:/Bán sách-backup/mo-ta-song-ngu/vong-4-hoan-tac-v2.sql` | chưa chạy (chỉ khi cần quay lại) |

Không lưu bản v1 / v2 và file chụp trước (`*-truoc.json`), bảng dịch (`*-ban-dich*.md`): ở thư mục backup. Comment
trong `vong-3-sach-viet.sql` / `vong-3-kiem.sql` còn nhắc tên cũ (`-v3`, `vong-3-sach-viet.sql` "bị thay"): giữ nguyên
văn bản đã chạy. File vòng 4 và `vong-3-hoan-tac.sql` nhắc đúng tên trong repo (bản trong repo là bản chốt, md5 y hệt
bản backup ở cột Nguồn).

## Vòng 4 (sách ngoại văn, `language = 'en'`)

- 114 sách en có mô tả: ghi 112 (bản Anh gốc chép sang `description_en` ngay trong DB, bản dịch Việt vào
  `description`, cờ `description_auto_translated = true`), chia 2 file theo id tăng dần.
- **Không ghi SQL 217, 254** (giữ nguyên trên DB: trang vi và en đều hiện bản gốc tiếng Anh; chủ dự án tự viết mô tả
  trong admin nếu muốn): 217 The Agatha Christie Collection, mô tả gốc chép từ Wikipedia (giấy phép CC BY-SA, có chú
  thích [1] [2] [3], thông tin cũ); 254 The SPEED of Trust, mô tả gốc chỉ là ghi chú thư viện, không nói gì về sách.
- Thứ tự chủ dự án chạy (SQL Editor), sau khi data-check xanh: `vong-4-kiem.sql` → `vong-4-sach-en-1.sql` →
  `vong-4-kiem.sql` → `vong-4-sach-en-2.sql` → `vong-4-kiem.sql` (file kiểm ghi sẵn số kỳ vọng trước / sau từng file).
- Hoàn tác, **chỉ khi cần**: `vong-4-hoan-tac.sql` (trả 112 sách về trước vòng 4), `vong-3-hoan-tac.sql` (trả 67 sách
  Việt về trước vòng 3). Sách admin đã sửa tay bản dịch (cờ đã tắt) bị bỏ qua, khối kiểm báo bằng notice.

## Sau đợt này (cập nhật 2026-11-24, đợt chuan-bi-demo)

- Vòng 3 và vòng 4 **đã chạy production 2026-11-20** (bảng File ở trên ghi trạng thái lúc soạn) và đã vào
  `supabase/data/da-chay-production.txt`: CI data-check **không kiểm lại** khi push (chạy tay `-f file=…` vẫn kiểm, kèm
  cảnh báo, kết quả có thể đỏ vì dữ liệu đã đổi). Các file `.sql` ở thư mục này giữ nguyên đúng từng byte bản đã chạy.
- Sau khi chủ dự án chạy `supabase/data/chuan-bi-demo/vong-1-sach-viet-lai.sql`: 213, 216, 234, 244, 280 có mô tả viết mới
  (cờ `description_auto_translated` false, không còn là bản dịch của vòng 4); 217, 254 có `description_en` (bản viết mới,
  cờ false). Câu (1), (3) và (4) của `vong-4-kiem.sql` vì vậy không còn đúng số kỳ vọng cũ: (1) dòng `en` ra
  117 / 114 / 114 / 107 thay vì 117 / 114 / 112 / 112 (`co_en` +2 vì 217, 254; `co_co` −5 vì 213, 216, 234, 244, 280;
  production đọc 2026-11-24 trước khi chạy: 117 / 114 / 112 / 112; dòng `vi` không đổi); (3) ra 7 (sách en có
  `description_en` mà cờ false; cộng thêm sách admin đã sửa tay, nếu có) thay vì 0; (4) ra 0 dòng thay vì 217, 254. `vong-4-hoan-tac.sql` không còn hoàn tác được
  5 sách trên (cờ đã tắt → bỏ qua, như sách admin đã sửa tay).
