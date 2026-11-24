# SQL dữ liệu (`supabase/data/`)

File SQL **sửa dữ liệu** (không đổi cấu trúc), mỗi đợt một thư mục `supabase/data/<đợt>/`. Chủ dự án chạy file ghi bằng
tay trong Supabase SQL Editor; Claude chỉ chạy câu kiểm chỉ đọc qua MCP. Workflow `data-check`
(`.github/workflows/data-check.yml`, `scripts/ci/data-check.sh`) chạy thử mọi file ghi trên Supabase local của CI, **phải
xanh** mới đưa file cho chủ dự án. Quy ước tên, (d), chế độ: `mo-ta-song-ngu/README.md`. File ghi đã chạy production:
`da-chay-production.txt`.

## Chuỗi nhiều dòng: bọc `replace(…, chr(13), '')`

Mọi chuỗi **nhiều dòng** ghi vào cột văn bản (VD mô tả có nhiều đoạn) phải bọc khi ghi:

```sql
update public.books set description = replace($mota$Đoạn 1.

Đoạn 2.$mota$, chr(13), '')
where id = 123 and md5(description) = '<md5 bản gốc>';
```

- Lý do: dán file vào SQL Editor trên Windows (chép bằng `Get-Content -Raw | Set-Clipboard` rồi Ctrl+V) thì mọi xuống dòng
  thành CRLF, **kể cả xuống dòng bên trong chuỗi** → DB nhận chuỗi có CR. CI đọc file LF nên không gặp.
- md5 kỳ vọng (khối `do $$` kiểm cuối file, file kiểm, điều kiện `where` của file hoàn tác) tính trên **bản LF**. Khối kiểm
  cuối file giữ nguyên: so md5 của cột trong DB (sau replace, luôn là bản LF).
- Chuỗi một dòng không bị ảnh hưởng; bọc luôn cũng được (file hoàn tác của chuan-bi-demo bọc cả chuỗi gốc một dòng cho
  cùng một quy ước).
- (d) (`scripts/ci/data-check-text.mjs`) kiểm chuỗi bên trong `$mota$…$mota$` như cũ (NFC, ký tự ẩn, không CR); bọc
  `replace` không đổi gì ở (d).
- data-check **bước (g) CRLF** (đường CHƯA GHI): tạo bản sao LF → CRLF của từng file ghi (và file hoàn tác nếu có), kiểm
  bản sao có CR còn file trong repo 0 CR; đưa DB về bản chụp đầu (chạy bản CRLF của file hoàn tác, hoặc chép lại các cột
  được ghi từ bản chụp nếu không có đường hoàn tác) → chạy bản CRLF của file ghi: số dòng đổi = số câu, cột ngoài danh
  sách giữ nguyên, kết quả cùng md5 từng dòng với lần ghi bản LF, chạy lần 2 = 0 dòng. Chế độ ĐÃ GHI: bỏ qua (ghi lý do).
  Quên bọc → khối kiểm cuối file raise P0001 khi chạy bản CRLF → (g) đỏ.

## Sự cố 2026-11-24 (chuan-bi-demo vòng 1)

Chủ dự án chạy `chuan-bi-demo/vong-1-sach-viet-lai.sql` (bản chưa bọc, commit `b114aea`) trong SQL Editor: khối kiểm cuối
file báo P0001 "khop duoc khac 7" → cả file rollback, DB không đổi (kiểm lại bằng MCP chỉ đọc: 7 sách còn đúng md5 / cờ bản
gốc, không có CR trong dữ liệu). Nguyên nhân: mô tả mới có 3 đoạn, đường dán của Windows đổi LF giữa đoạn thành CRLF → md5
lệch md5 kỳ vọng (tính trên bản LF). data-check trên CI xanh vì đọc file LF. Sửa: bọc `replace(…, chr(13), '')` ở file ghi
và file hoàn tác, thêm bước (g) vào data-check, câu báo lỗi của khối kiểm kèm id + cột lệch (không kèm mô tả).

File vòng 3 / 4 của `mo-ta-song-ngu/` (đã chạy production 2026-11-20) giữ nguyên, không bọc: mọi chuỗi của các file đó là
một dòng nên không gặp lỗi này.
