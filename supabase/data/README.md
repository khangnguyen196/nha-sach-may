# SQL dữ liệu (`supabase/data/`)

File SQL **sửa dữ liệu** (không đổi cấu trúc), mỗi đợt một thư mục `supabase/data/<đợt>/`. Chủ dự án chạy file ghi bằng
tay trong Supabase SQL Editor; Claude chỉ chạy câu kiểm chỉ đọc qua MCP. Workflow `data-check`
(`.github/workflows/data-check.yml`, `scripts/ci/data-check.sh`) chạy thử mọi file ghi trên Supabase local của CI, **phải
xanh** mới đưa file cho chủ dự án. Quy ước tên, (d), chế độ: `mo-ta-song-ngu/README.md`. File ghi đã chạy production:
`da-chay-production.txt`.

## Chép file vào SQL Editor: luôn `-Encoding utf8`

Lệnh chép file (PowerShell) **luôn** có `-Encoding utf8`:

```powershell
Get-Content -Raw -Encoding utf8 "<đường dẫn file .sql>" | Set-Clipboard
```

**BẮT BUỘC với Windows PowerShell 5.1** (Get-Content không có -Encoding đọc UTF-8 không BOM theo bảng mã ANSI → chữ Việt /
ngoặc kép cong hỏng, md5 lệch, bọc replace không cứu được). Sau đó mở SQL Editor, Ctrl+V, Run.

### Thử đường chép trước khi chạy file ghi (chỉ đọc)

File thử nằm ngoài repo: `D:\Bán sách-backup\chuan-bi-demo\paste-test.sql` (một câu SELECT, không ghi gì). Chép bằng đúng
lệnh trên, dán vào SQL Editor, Run, rồi đọc một dòng kết quả:

- `khop_sau_khi_bo_cr = true`: đường chép giữ đúng chữ → được chạy file ghi.
- `co_cr = true`: SQL Editor (hoặc clipboard) đã đổi xuống dòng sang CRLF; `replace(…, chr(13), '')` trong file ghi xử lý
  được. Khi đó `khop_khong_bo_cr = false` và `do_dai = 77` (73 ký tự + 4 CR) là bình thường.
- `khop_sau_khi_bo_cr = false`, hoặc `do_dai` không phải 73 (LF) / 77 (CRLF): **lỗi bảng mã**, KHÔNG chạy file ghi; kiểm
  lại lệnh chép (thiếu `-Encoding utf8`?). Đo bằng node: đọc sai bảng mã windows-1252 cho `do_dai = 108` (ví dụ với windows-1252; bảng mã khác ra số khác, quy tắc "khác 73 / 77 là lỗi bảng mã" vẫn đúng).

### Đọc chuỗi `lech` của khối kiểm (lỗi P0001)

Khối `do $$` cuối file ghi (từ chuan-bi-demo vòng 4) báo mỗi cột md5 lệch kèm độ dài thực / kỳ vọng và số CR, VD
`213:vi(len 655/651, cr 4)`, `234:en(len 766/762, cr 0)`. Độ dài kỳ vọng là số ký tự của bản LF (hằng trong file).

- len thực = kỳ vọng + cr và cr > 0 → lỗi CRLF (file chưa bọc `replace`).
- len thực khác kỳ vọng mà cr = 0 (hoặc lệch kiểu khác) → lỗi bảng mã / ký tự khi chép (thường chỉ cột `vi` lệch, cột `en`
  chỉ lệch khi có ký tự ngoài ASCII như ngoặc kép cong).
- len bằng, cr = 0 → md5 lệch vì lý do khác (chữ khác cùng độ dài, khác chuẩn Unicode…): gửi nguyên câu lỗi cho Claude.

## Chuỗi nhiều dòng: bọc `replace(…, chr(13), '')`

Mọi chuỗi **nhiều dòng** ghi vào cột văn bản (VD mô tả có nhiều đoạn) phải bọc khi ghi:

```sql
update public.books set description = replace($mota$Đoạn 1.

Đoạn 2.$mota$, chr(13), '')
where id = 123 and md5(description) = '<md5 bản gốc>';
```

- Lý do (nghi, chưa xác nhận; xem Sự cố bên dưới): dán file vào SQL Editor trên Windows (chép bằng
  `Get-Content -Raw -Encoding utf8 … | Set-Clipboard` rồi Ctrl+V) có thể làm mọi xuống dòng thành CRLF, **kể cả xuống dòng
  bên trong chuỗi** → DB nhận chuỗi có CR. CI đọc file LF nên không gặp.
- md5 kỳ vọng (khối `do $$` kiểm cuối file, file kiểm, điều kiện `where` của file hoàn tác) tính trên **bản LF**. Khối kiểm
  cuối file: ý nghĩa giữ nguyên (so md5 của cột trong DB, sau replace luôn là bản LF; nay còn báo id / cột / độ dài / số CR
  lệch).
- Chuỗi một dòng không bị ảnh hưởng; bọc luôn cũng được (file hoàn tác của chuan-bi-demo bọc cả chuỗi gốc một dòng cho
  cùng một quy ước).
- (d) (`scripts/ci/data-check-text.mjs`) kiểm chuỗi bên trong `$mota$…$mota$` như cũ (NFC, ký tự ẩn, không CR); bọc
  `replace` không đổi gì ở (d).
- data-check **bước (g) CRLF** (đường CHƯA GHI): tạo bản sao LF → CRLF của từng file ghi (và file hoàn tác nếu có), kiểm
  bản sao có CR còn file trong repo 0 CR; đưa DB về bản chụp đầu (chạy bản CRLF của file hoàn tác, hoặc chép lại các cột
  được ghi từ bản chụp nếu không có đường hoàn tác) → chạy bản CRLF của file ghi: số dòng đổi = số câu, cột ngoài danh
  sách giữ nguyên, kết quả cùng md5 từng dòng với lần ghi bản LF, chạy lần 2 = 0 dòng. Chế độ ĐÃ GHI: bỏ qua (ghi lý do).
  Quên bọc → khối kiểm cuối file raise P0001 khi chạy bản CRLF → (g) đỏ. Nhánh "không có file hoàn tác" (chép lại cột từ
  bản chụp) **chưa được CI chạy lần nào** (chỉ đọc code): đợt đầu tiên có file ghi không kèm hoàn tác có thể thấy (g) đỏ vì
  chính nhánh này. (g) chỉ tái hiện lỗi CRLF, không tái hiện lỗi bảng mã khi chép (dùng file thử ở trên).

## Sự cố 2026-11-24 (chuan-bi-demo vòng 1)

Chủ dự án chạy `chuan-bi-demo/vong-1-sach-viet-lai.sql` (bản chưa bọc, commit `b114aea`) trong SQL Editor: khối kiểm cuối
file báo P0001 "khop duoc khac 7" → cả file rollback, DB không đổi (kiểm lại bằng MCP chỉ đọc: 7 sách còn đúng md5 / cờ bản
gốc, không có CR trong dữ liệu). Nghi nguyên nhân (suy ra; chưa xác nhận, còn khả năng lỗi bảng mã): mô tả mới có 3
đoạn, đường dán của Windows đổi LF giữa đoạn thành CRLF → md5 lệch md5 kỳ vọng (tính trên bản LF). Khả năng còn lại: chép
bằng Windows PowerShell 5.1 thiếu `-Encoding utf8` → chữ Việt hỏng. Câu lỗi lúc đó ("khop duoc khac 7") không phân biệt
được hai khả năng. data-check trên CI xanh vì đọc file LF. Sửa: bọc `replace(…, chr(13), '')` ở file ghi và file hoàn tác,
thêm bước (g) vào data-check, câu báo lỗi của khối kiểm kèm id + cột lệch (vòng 3) + độ dài / số CR (vòng 4, phân biệt
CRLF với bảng mã), lệnh chép bắt buộc `-Encoding utf8`, file thử đường chép (mục đầu).

File vòng 3 / 4 của `mo-ta-song-ngu/` (đã chạy production 2026-11-20) giữ nguyên, không bọc: mọi chuỗi của các file đó là
một dòng nên không gặp lỗi này.
