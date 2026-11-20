# Mô tả sách song ngữ (đợt mo-ta-song-ngu)

Chủ dự án duyệt 2026-11-20 (vòng 0: mẫu 10 cuốn, `D:/Bán sách-backup/mo-ta-song-ngu/mau-10.md`).

## Mục tiêu

- Trang `/en/...` hiện mô tả tiếng Anh cho mọi sách, trang tiếng Việt hiện mô tả tiếng Việt cho mọi sách. Tên sách
  không dịch. Không dịch tiểu sử tác giả (bio / bio_en đều trống). Không làm nút dịch trong admin (đợt sau).
- Dữ liệu: sách `language = 'vi'` → bản dịch Anh vào `description_en`; sách `language = 'en'` → bản Anh gốc chuyển
  sang `description_en`, bản dịch Việt vào `description`. `localize` (`lib/i18n-db.ts`) không đổi: sau khi ghi dữ
  liệu, mọi chỗ đọc mô tả qua `localize` (mô tả, `generateMetadata`, JSON-LD) ra đúng ngôn ngữ; chat Mây (chỉ vi) và
  prompt gợi ý cảnh báo đọc `description` = tiếng Việt.

## Cột đánh dấu

- `books.description_auto_translated boolean not null default false` (migration
  `20261120120000_description_auto_translated.sql`, chạy riêng TRƯỚC file dữ liệu; thêm vào `grant update` của books).
- Phần dịch xác định theo `language`: sách `vi` → `description_en`, sách `en` → `description`.
- Trang sách: dòng nhỏ "Bản dịch tự động" / "Automatically translated" dưới mô tả khi cờ bật VÀ phần đang hiện là
  phần dịch (`showAutoTranslatedNote`, `features/books/translation.ts`). Render ở server, không thêm JS client.
- Admin (`updateBook`): cờ đang bật và (phần dịch đổi sau khi chuẩn hóa như form: CRLF → LF, trim, rỗng → null,
  hoặc `language` đổi) → ghi `false` trong cùng câu update (`shouldClearAutoTranslated`,
  `features/admin/books/translation-flag.ts`). Admin không bao giờ bật cờ. Form hiện câu nhắc dưới ô phần dịch khi cờ bật.

## Thứ tự trên production

1. Chủ dự án chạy migration cột trong SQL Editor (đã chạy 2026-11-20, kèm `notify pgrst`) → SELECT kiểm (cột
   boolean NOT NULL default false, 189 sách false, quyền admin sửa cột).
2. Push nhánh, CI check + e2e xanh → lên main (mọi cờ false, `description_en` trống → code mới chạy y như cũ).
3. Vòng 3: SQL sách Việt (`description_en` + cờ). Vòng 4: SQL sách ngoại văn (`description_en` ← bản Anh gốc,
   `description` ← bản dịch Việt + cờ). Dollar-quote `$mota$`, UPDATE theo id chỉ khi `description_en is null` (sách
   en kèm `language = 'en'`), NFC, 4 sách thiếu mô tả để trống; kiểm trên Postgres local 2 lần (lần 2 = 0 dòng đổi).
   SELECT kiểm sau mỗi file.
4. Commit docs cuối đợt lên main → Vercel deploy mới, trang dựng lại từ dữ liệu mới (dữ liệu ghi ngoài app, không có
   `updateTag`; cache trang sách `cacheLife('hours')` nên tự hết hạn nếu sót) → kiểm production
   `/en/books/<sách Việt>` hiện mô tả Anh + "Automatically translated".

Trong lúc chủ dự án chạy SQL dữ liệu: không mở / lưu form sửa sách trong admin (`updateBook` so với bản DB mới nhất,
lưu form mở từ trước sẽ ghi đè bản dịch).

Build (máy và CI) đọc catalog production: query trang sách chọn cột mới nên build lỗi tới khi bước 1 xong.
