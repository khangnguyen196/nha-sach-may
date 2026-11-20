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
   SELECT kiểm sau mỗi file. File vòng 3 (ngoài repo, `D:/Bán sách-backup/mo-ta-song-ngu/`): `vong-3-kiem-v3.sql` →
   `vong-3-sach-viet-v3.sql` (67 cuốn, mỗi câu kèm `md5(description)` lúc đọc, khối kiểm cả lô 67 trước commit) →
   `vong-3-kiem-v3.sql`; bảng dịch `vong-3-ban-dich-v3.md` (bản v3 thay các file không hậu tố và `-v2`), ảnh chụp trước `vong-3-truoc.json`. 4 sách Việt có mô tả gốc tiếng Anh (id 2, 3, 20, 171) chưa ghi.
4. Commit docs cuối đợt lên main → Vercel deploy mới, trang dựng lại từ dữ liệu mới (dữ liệu ghi ngoài app, không có
   `updateTag`; cache trang sách `cacheLife('hours')` nên tự hết hạn nếu sót) → kiểm production
   `/en/books/<sách Việt>` hiện mô tả Anh + "Automatically translated". Dự phòng: nếu Vercel không build (commit chỉ có
   docs) hoặc /en vẫn hiện bản cũ → Redeploy bản Production trên Vercel, bỏ chọn dùng build cache.

Trong lúc chủ dự án chạy SQL dữ liệu: không mở / lưu form sửa sách trong admin (`updateBook` so với bản DB mới nhất,
lưu form mở từ trước sẽ ghi đè bản dịch).

Build (máy và CI) đọc catalog production: query trang sách chọn cột mới nên build lỗi tới khi bước 1 xong (đã xong 2026-11-20).

## data-check (CI chạy thử file SQL dữ liệu, vòng 4a)

Thay việc gửi Claude chat chạy thử: file SQL dữ liệu lưu ở `supabase/data/mo-ta-song-ngu/` (README ở đó),
`.github/workflows/data-check.yml` (+ `scripts/ci/data-check.sh`, `data-check-lib.sql`, `data-check-text.mjs`) chạy
thử trên Supabase local của CI. **Job đỏ thì không đưa file cho chủ dự án chạy.**

- Quy ước tên: file GHI `vong-N-sach-*.sql`; file kiểm (chỉ đọc) `vong-N-kiem.sql`; file hoàn tác
  `vong-N-hoan-tac.sql` (một file cho cả vòng N). Workflow tự nhận file theo tên, gom theo vòng (cùng thư mục + N).
  Cột được ghi: vòng 3 `description_en, description_auto_translated`; vòng 4 thêm `description`; vòng khác khai báo
  `-- data-check: cot-duoc-ghi = …` trong file ghi.
- Chạy: tự động khi push nhánh khác main có đổi `supabase/data/**` (hoặc workflow / `schema.sql` / `seed*.sql`), mọi
  file ghi; chạy tay: `gh workflow run data-check.yml --ref <nhánh> -f file=supabase/data/mo-ta-song-ngu/<file ghi>`
  (chỉ file đó). Đọc kết quả: `gh run view <run>` (bảng tóm tắt ở Summary, chỉ id và số đếm).
- Các bước: (d) chữ trong file (NFC, không ký tự ẩn / điều khiển / CR, `$mota$` đúng cặp, mỗi id một câu) → dựng
  Supabase local từ `schema.sql` + seed của nhánh (lỗi hạ tầng như "port 54322 already in use" → thử lại tối đa 3 lần)
  → lấy đúng các sách file nhắc tới từ production qua REST công khai (khóa publishable như build của `ci.yml`, che
  trong log; không service role) → nạp giữ nguyên id → chế độ theo dữ liệu production:
  - **CHƯA GHI** (mọi dòng `description_en` null + cờ false): (e) sửa 1 ký tự mô tả gốc → file phải lỗi P0001 (raise
    của khối kiểm cả lô), 0 dòng đổi; (a) lần 1 số dòng đổi = số câu UPDATE; (c) cột ngoài danh sách được ghi giữ
    nguyên md5, số dòng mọi bảng không đổi; (b) lần 2 = 0 dòng; (f) có hoàn tác: hoàn tác → về đúng bản chụp đầu →
    ghi lại → lần 2 = 0.
  - **ĐÃ GHI** (mọi dòng cờ true): (a) lần 1 = 0 dòng, (b) lần 2 = 0 dòng; có hoàn tác: hoàn tác → trạng thái trước
    ghi (`description_en` null, cờ false) → (e) → ghi lại (= số câu) → khớp production → lần 2 = 0; không có hoàn tác
    thì (e) (f) bỏ qua, ghi lý do.
  - Lẫn lộn → đỏ, in id lệch. "Dòng đổi" đếm bằng so md5 từng dòng theo id, không tin command tag.
- Giới hạn: dữ liệu production lấy qua REST công khai nên chỉ thấy sách `is_active` (sách ẩn → đỏ "thiếu"); anon đọc
  được mọi cột của `books` (kiểm 2026-11-20) nên các cột kiểm là dữ liệu thật, trừ `category_id` / `publisher_id` (null:
  DB local không có danh mục / NXB thật) và `search_text` (trigger tự sinh, không có tác giả). Vòng đã ghi mà sau đó
  admin sửa một bản dịch (cờ về false) → chế độ lẫn lộn → đỏ ở mọi push đổi `schema.sql` / seed sau này. Sửa production
  bằng tay giữa lúc job chạy và lúc chủ dự án chạy file: job không thấy (điều kiện md5 + khối kiểm cả lô trong file vẫn
  chặn). Không có bước in log Docker của DB (log Postgres có thể chép nguyên câu SQL kèm mô tả).
