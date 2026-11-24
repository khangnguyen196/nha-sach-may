# SQL dữ liệu: mo-ta-sach-ngan (`docs/plans/mo-ta-sach-ngan.md`)

Viết mô tả song ngữ mới cho 13 sách thiếu hoặc quá ngắn mô tả: id 2, 3, 8, 20, 171 (sách Việt, `language = 'vi'`) và 207,
209, 218, 248, 272, 281, 292, 302 (sách ngoại văn, `language = 'en'`). Bản mới viết mới cả tiếng Việt (`description`) và
tiếng Anh (`description_en`), cờ `description_auto_translated = false` (không phải bản dịch tự động). Với 2, 3, 20, 171, cột
tiếng Việt hiện đang chứa chữ tiếng Anh (từ Google Books): bản mới đưa chữ Việt vào `description`, chữ Anh vào
`description_en`.

Quy ước chung (tên file, (d), bọc `replace(…, chr(13), '')`, bước (g) CRLF, lệnh chép `-Encoding utf8`, đọc chuỗi `lech`):
`supabase/data/README.md`. File ghi khai báo `-- data-check: che-do = viet-lai`: 5 sách đang có bản dịch tự động (cờ true),
8 sách chưa có (`description_en` null, cờ false) nằm chung một file, CI chạy đường CHƯA GHI không dựa vào cờ ((e) → ghi →
lần 2 = 0 → hoàn tác về đúng bản chụp production → hoàn tác lần 2 = 0 → ghi lại → lần 2 = 0 → (g) bản sao CRLF).

| File | Loại | Ai chạy |
|---|---|---|
| `vong-1-kiem.sql` | SELECT kiểm, chỉ đọc (không select cột mô tả): cột null?, độ dài, md5 từng cột = bản gốc? = bản mới?, cờ | Claude (MCP chỉ đọc), trước và sau |
| `vong-1-sach-viet-lai.sql` | file GHI: 13 câu, mỗi câu điều kiện id + language + 2 cột mô tả đúng bản gốc (md5, hoặc `is null` với cột đang trống) + cờ gốc; khối `do $$` kiểm đủ 13 id có md5 bản mới + cờ false, khác 13 → raise → rollback | chủ dự án, SQL Editor |
| `vong-1-hoan-tac.sql` | hoàn tác: chép nguyên văn bản gốc (sinh bằng script từ bản đọc production, không gõ tay), cột trống lúc đọc gán `null`, chỉ khi mô tả còn là bản mới | chủ dự án, **chỉ khi cần** |

Thứ tự chạy (sau khi data-check xanh):

0. Thử đường chép (chỉ đọc): `D:\Bán sách-backup\chuan-bi-demo\paste-test.sql`, đọc kết quả theo `supabase/data/README.md`.
   Lỗi bảng mã → **không chạy file ghi**.
1. Claude chạy `vong-1-kiem.sql` qua MCP chỉ đọc: kỳ vọng 13 dòng ở trạng thái gốc (dòng cuối 13 / 0).
2. Chủ dự án chép file ghi rồi dán vào SQL Editor, bấm Run:

   ```powershell
   Get-Content -Raw -Encoding utf8 "D:\Bán sách\supabase\data\mo-ta-sach-ngan\vong-1-sach-viet-lai.sql" | Set-Clipboard
   ```

   `-Encoding utf8` **bắt buộc** với Windows PowerShell 5.1. Kết quả mong đợi: "Success. No rows returned".
   Lỗi P0001 `mo-ta-sach-ngan vong 1: … khop duoc N / 13, rollback; lech: …`: cả file đã rollback, DB không đổi; chép
   nguyên câu lỗi gửi lại Claude (đọc `lech` theo `supabase/data/README.md`).
3. Claude chạy lại `vong-1-kiem.sql`: kỳ vọng 13 dòng ở trạng thái mới, cờ false (dòng cuối 0 / 13).
4. Lỡ bấm Run lần 2: 0 dòng đổi, không lỗi.

Hoàn tác chỉ khi cần: `vong-1-hoan-tac.sql` (chép bằng cùng lệnh, đổi tên file) → `vong-1-kiem.sql`.

Sau khi chạy file ghi: thêm dòng `supabase/data/mo-ta-sach-ngan/vong-1-sach-viet-lai.sql <ngày chạy>` vào
`supabase/data/da-chay-production.txt` trong commit docs cuối đợt (không thì data-check của các đợt sau đỏ: dữ liệu đã đổi).

Trạng thái: **CHƯA chạy production.**
