# SQL dữ liệu: chuan-bi-demo (`docs/plans/chuan-bi-demo.md`)

Viết lại mô tả song ngữ cho 7 sách ngoại văn (`language = 'en'`) trước buổi demo: id 213, 216, 217, 234, 244, 254, 280.
Bản cũ hứa đặc điểm bản in không chắc có (chữ ký, bản giới hạn, hộp, ảnh / bản đồ), dính quảng cáo hết hạn, chép lời khen,
bị cắt giữa câu, là tiểu sử tác giả hoặc chỉ là ghi chú thư viện. Bản mới viết mới cả tiếng Việt (`description`) và tiếng Anh
(`description_en`), cờ `description_auto_translated = false` (không phải bản dịch tự động).

Quy ước tên, (d), chế độ: xem `supabase/data/mo-ta-song-ngu/README.md`. File ghi khai báo
`-- data-check: che-do = viet-lai` (5 / 7 sách đang có bản dịch tự động, cờ true; CI không nhận chế độ theo cờ mà chạy đường
CHƯA GHI: (e) → ghi → lần 2 = 0 → hoàn tác về đúng bản chụp production → hoàn tác lần 2 = 0 → ghi lại → lần 2 = 0).

| File | Loại | Ai chạy |
|---|---|---|
| `vong-1-kiem.sql` | SELECT kiểm, chỉ đọc (không select cột mô tả): md5 từng cột = bản gốc? = bản mới?, cờ, độ dài | Claude (MCP chỉ đọc), trước và sau |
| `vong-1-sach-viet-lai.sql` | file GHI: 7 câu, mỗi câu có điều kiện md5 bản gốc (2 cột) + cờ gốc; khối `do $$` kiểm đủ 7 id có md5 bản mới + cờ false, khác 7 → raise → rollback | chủ dự án, SQL Editor |
| `vong-1-hoan-tac.sql` | hoàn tác: chép nguyên văn bản gốc (sinh bằng script từ bản đọc production, không gõ tay), chỉ khi mô tả còn là bản mới | chủ dự án, **chỉ khi cần** |

Thứ tự chạy (sau khi data-check xanh): `vong-1-kiem.sql` → `vong-1-sach-viet-lai.sql` → `vong-1-kiem.sql`.
Hoàn tác chỉ khi cần: `vong-1-hoan-tac.sql` → `vong-1-kiem.sql`.

Mọi chuỗi mô tả trong file ghi và file hoàn tác bọc `replace(…, chr(13), '')` (vòng 3, sau sự cố 2026-11-24: bản chưa bọc
dán vào SQL Editor → lỗi P0001, đã rollback; nghi do CRLF, chưa xác nhận, còn khả năng lỗi bảng mã khi chép; xem
`supabase/data/README.md`). Từ vòng 4 câu lỗi kèm độ dài / số CR của cột lệch để phân biệt hai khả năng.

Cách chạy file ghi (chủ dự án):

0. Thử đường chép trước (chỉ đọc, không ghi gì): chép `D:\Bán sách-backup\chuan-bi-demo\paste-test.sql` bằng đúng lệnh ở
   bước 1, dán vào SQL Editor, Run. Kỳ vọng `khop_sau_khi_bo_cr = true` (`co_cr = true` + `do_dai = 77` nghĩa là SQL Editor
   đã đổi xuống dòng sang CRLF, file ghi xử lý được). `khop_sau_khi_bo_cr = false` hoặc `do_dai` không phải 73 / 77 → lỗi
   bảng mã, **KHÔNG chạy file ghi**, gửi kết quả cho Claude. Chi tiết: `supabase/data/README.md`.
1. Chép cả file vào clipboard bằng PowerShell:

   ```powershell
   Get-Content -Raw -Encoding utf8 "D:\Bán sách\supabase\data\chuan-bi-demo\vong-1-sach-viet-lai.sql" | Set-Clipboard
   ```

   `-Encoding utf8` **BẮT BUỘC với Windows PowerShell 5.1** (Get-Content không có -Encoding đọc UTF-8 không BOM theo bảng mã
   ANSI → chữ Việt / ngoặc kép cong hỏng, md5 lệch, bọc replace không cứu được). Mở Supabase SQL Editor, dán (Ctrl+V), bấm
   Run. Dán bị đổi xuống dòng thành CRLF cũng không sao (đã bọc `replace`).
2. Kết quả mong đợi: "Success. No rows returned" (không có lỗi). Claude chạy `vong-1-kiem.sql` qua MCP chỉ đọc: 7 sách có
   md5 bản mới cả hai cột, cờ false.
3. Nếu báo lỗi P0001 `chuan-bi-demo vong 1: … khop duoc N / 7, rollback; lech: …`: **cả file đã rollback, DB không đổi**.
   Phần `lech:` liệt kê từng id:cột lệch, chỉ có số, không có nội dung mô tả: `vi` = description, `en` = description_en
   (kèm `len thực/kỳ vọng, cr số CR`), `co` = cờ description_auto_translated, `khong-co-sach` = không có id hoặc language
   khác 'en'. VD `lech: 213:vi(len 655/651, cr 4), 213:en(len 719/715, cr 4), 254:co`. Đọc:
   - len thực = kỳ vọng + cr, cr > 0 → lỗi CRLF;
   - len khác kỳ vọng, cr = 0 → lỗi bảng mã khi chép (VD `213:vi(len 838/651, cr 0)`; thường chỉ cột `vi`);
   - len bằng, cr = 0 → md5 lệch vì lý do khác.

   Chép nguyên câu lỗi gửi lại Claude.
4. Chạy lần 2 (lỡ bấm Run lần nữa): 0 dòng đổi, không lỗi.

Sau khi chủ dự án chạy file ghi: thêm dòng `supabase/data/chuan-bi-demo/vong-1-sach-viet-lai.sql <ngày chạy>` vào
`supabase/data/da-chay-production.txt` trong commit docs cuối (không thì data-check của các đợt sau đỏ: dữ liệu đã đổi).

Trạng thái: **CHƯA chạy production**.
