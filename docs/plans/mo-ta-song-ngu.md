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

## Vòng 4: sách ngoại văn (file trong repo, `supabase/data/mo-ta-song-ngu/`)

- 117 sách `language = 'en'`, 114 có mô tả (3 cuốn không mô tả: 248, 281, 292). Dịch 114, **ghi SQL 112**:
  `vong-4-sach-en-1.sql` (56 câu, id 192–249), `vong-4-sach-en-2.sql` (56 câu, id 250–308). Mỗi câu:
  `description_en = description` (bản Anh gốc chép trong DB, giữ nguyên từng byte), `description` ← bản dịch Việt
  (`$mota$`, NFC), cờ true; chỉ khi đúng id, `language = 'en'`, `description_en is null` và `md5(description)` = md5 lúc
  đọc 2026-11-20. Khối `do $$` cuối mỗi file: đúng các id của file (`b.id in (…)`) có cờ + md5 bản gốc + md5 bản dịch,
  khác 56 → raise → rollback cả file.
- Quyết định: **không ghi SQL 217, 254** (giữ nguyên trên DB, trang vi và en đều hiện bản gốc tiếng Anh; chủ dự án tự
  viết trong admin nếu muốn): 217 The Agatha Christie Collection, mô tả gốc chép từ Wikipedia (CC BY-SA, chú thích
  [1] [2] [3], thông tin cũ "tính đến năm 2011"); 254 The SPEED of Trust, mô tả gốc chỉ là ghi chú thư viện "Part of
  NWTC's Talent Development collection.". Sau cả 2 file: còn đúng 2 sách en có mô tả mà chưa có `description_en`
  (217, 254).
- Thứ tự chủ dự án chạy (SQL Editor, sau khi CI data-check xanh): `vong-4-kiem.sql` → `vong-4-sach-en-1.sql` →
  `vong-4-kiem.sql` → `vong-4-sach-en-2.sql` → `vong-4-kiem.sql`. Kỳ vọng (ghi trong file kiểm): trước en 117 / 114 /
  0 / 0, sau file 1 en 117 / 114 / 56 / 56, sau file 2 en 117 / 114 / 112 / 112; vi luôn 72 / 71 / 67 / 67.
- Hoàn tác, **chỉ khi cần**: `vong-4-hoan-tac.sql` (112 câu, `description` ← bản Anh, `description_en` ← null, cờ
  false), `vong-3-hoan-tac.sql` (67 câu, `description_en` ← null, cờ false). Sách admin đã sửa tay bản dịch (cờ đã tắt)
  bị bỏ qua, khối kiểm báo bằng notice.
- Bản chốt trong repo = bản backup (`D:/Bán sách-backup/mo-ta-song-ngu/`, md5 y hệt): `vong-4-sach-en-{1,2}-v3.sql`
  (khác v2 chỉ ở khối kiểm thêm `b.id in (…)` để data-check (d) kiểm được id của từng file), `vong-4-kiem-v2.sql`,
  `vong-4-hoan-tac-v2.sql`, `vong-3-hoan-tac-v3.sql` (= v2, chỉ comment đổi tên tham chiếu sang `vong-3-sach-viet.sql`).
  Bảng dịch `vong-4-ban-dich-v2.md` và ảnh chụp trước `vong-4-truoc.json` chỉ ở backup.

### Cần chủ dự án biết (vòng 4, chi tiết ở `vong-4-ban-dich-v2.md`)

- Lời hứa về hàng thật mà cửa hàng có thể không giao đúng (dịch đúng như gốc; giữ / bỏ / sửa trong admin): 213 "hộp bìa
  vải" của ấn bản có chữ ký, 216 "Ấn bản giới hạn 800 bản", 280 Sapiens "Ấn bản chính thức tại Mỹ, minh họa màu".
- 244 Atomic Habits: dòng đầu là quảng cáo đặt trước sách khác (ngày 9/12/2025, đã qua), giữ nguyên theo quy tắc không
  thêm bớt. 234 Built to Last: bản gốc bị cắt giữa chữ, bản dịch dừng ở chỗ cắt. 253, 219: nói về ấn bản sách điện tử
  (cửa hàng bán sách in).
- Lỗi chính tả trong bản Anh gốc (VD 192, 199, 206, 211, 213, 225, 230, 236, 242, 244, 263, 264, 268, 278, 283, 289,
  297) vẫn hiện ở `/en` vì `description_en` = bản gốc nguyên byte; bản dịch Việt theo nghĩa đúng. Sửa trong admin ô mô
  tả tiếng Anh (với sách en là phần gốc, sửa không bỏ dấu "Bản dịch tự động").
- Sửa mô tả trong admin sau khi chạy: không cần chạy lại file ghi; nếu chạy lại thì khối kiểm có thể raise (rollback,
  không ghi gì). Trong lúc chạy SQL: không mở / lưu form sửa sách trong admin.
- Muốn bỏ thêm cuốn nào khỏi vòng 4: báo trước khi chạy, file được sinh lại không có cuốn đó.

## data-check (CI chạy thử file SQL dữ liệu, vòng 4a)

Thay việc gửi Claude chat chạy thử: file SQL dữ liệu lưu ở `supabase/data/mo-ta-song-ngu/` (README ở đó),
`.github/workflows/data-check.yml` (+ `scripts/ci/data-check.sh`, `data-check-lib.sql`, `data-check-text.mjs`) chạy
thử trên Supabase local của CI. **Job đỏ thì không đưa file cho chủ dự án chạy.**

- Quy ước tên: file GHI `vong-N-sach-*.sql`; file kiểm (chỉ đọc) `vong-N-kiem.sql`; file hoàn tác
  `vong-N-hoan-tac.sql` (một file cho cả vòng N). Workflow tự nhận file theo tên, gom theo vòng (cùng thư mục + N).
  Không có xanh giả do đặt sai tên (vòng 4c): mọi `*.sql` dưới `supabase/data/` phải khớp một trong 3 mẫu, file kiểm /
  hoàn tác phải có file ghi cùng thư mục + N, 0 file ghi → đỏ (cả push lẫn chạy tay; `data-check.sh --plan`).
  Cột được ghi: thư mục `mo-ta-song-ngu` mặc định vòng 3 `description_en, description_auto_translated`, vòng 4 thêm
  `description`; vòng khác / thư mục khác bắt buộc khai báo `-- data-check: cot-duoc-ghi = …` trong mọi file ghi.
- Chạy: tự động khi push nhánh khác main có đổi `supabase/data/**` (hoặc workflow / `schema.sql` / `seed*.sql`), mọi
  file ghi; chạy tay: `gh workflow run data-check.yml --ref <nhánh> -f file=supabase/data/mo-ta-song-ngu/<file ghi>`
  (chỉ file đó, đường hoàn tác bỏ qua). Đọc kết quả: `gh run view <run>` (bảng tóm tắt ở Summary, chỉ id và số đếm).
- Các bước: (d) chữ trong file (NFC; không ký tự ẩn: mọi `\p{Cf}`, `\p{Zl}`, `\p{Zp}`, `\p{Zs}` khác U+0020; không ký
  tự điều khiển trừ LF, không CR; `$mota$` đúng cặp, mỗi id một câu; khối `do $$` của từng file liệt kê đúng id các
  câu UPDATE của file và so với đúng số câu) → dựng Supabase local từ `schema.sql` + seed của nhánh (lỗi hạ tầng như
  "port 54322 already in use" → thử lại tối đa 3 lần) → lấy đúng các sách file nhắc tới từ production qua REST công
  khai (khóa publishable như build của `ci.yml`, che trong log; `data-check.sh` tự từ chối khóa không phải publishable
  / anon; không service role) → nạp giữ nguyên id → chế độ theo **từng file ghi** (chỉ các id của file):
  - **CHƯA GHI** (mọi dòng của file `description_en` null + cờ false): (e) sửa 1 ký tự mô tả gốc → file phải lỗi P0001
    (raise của khối kiểm cả lô), 0 dòng đổi; (a) lần 1 số dòng đổi = số câu UPDATE; (c) cột ngoài danh sách được ghi
    giữ nguyên md5, số dòng mọi bảng không đổi; (b) lần 2 = 0 dòng; (f) hoàn tác → về đúng bản chụp đầu → hoàn tác
    lần 2 = 0 dòng → ghi lại → lần 2 = 0.
  - **ĐÃ GHI** (mọi dòng của file cờ true): (a) lần 1 = 0 dòng, (b) lần 2 = 0 dòng; (f) hoàn tác → trạng thái trước
    ghi (`description_en` null, cờ false) → hoàn tác lần 2 = 0 → (e) → ghi lại (= số câu) → khớp bản chụp production đã
    nạp → lần 2 = 0.
  - (f) (và (e) của ĐÃ GHI) chạy ở mức vòng chỉ khi có file hoàn tác, kiểm đủ file ghi của vòng và mọi file cùng chế
    độ; không thì bỏ qua, ghi lý do (không đỏ). Vòng có file đã chạy production + file chưa chạy (VD vòng 4: file 1 đã
    chạy, file 2 chưa): mỗi file kiểm riêng theo chế độ của nó, không đỏ "lẫn lộn"; muốn chạy riêng: chạy tay
    `-f file=…` từng file.
  - Lẫn lộn trong **một** file → đỏ, in id lệch. "Dòng đổi" đếm bằng so md5 từng dòng theo id, không tin command tag.
- Vòng 4: bản gốc tiếng Anh chép trong DB (`description_en = description`, file không chứa chuỗi bản gốc) nên (d) chỉ
  kiểm bản dịch Việt; câu ghi có điều kiện `md5(description)` (bản gốc). File kiểm không select cột mô tả (log CI công
  khai).
- Giới hạn: dữ liệu production lấy qua REST công khai nên chỉ thấy sách `is_active` (sách ẩn → đỏ "thiếu"); anon đọc
  được mọi cột của `books` (kiểm 2026-11-20) nên các cột kiểm là dữ liệu thật, trừ `category_id` / `publisher_id` (null:
  DB local không có danh mục / NXB thật) và `search_text` (trigger tự sinh, không có tác giả). Vòng đã ghi mà sau đó
  admin sửa một bản dịch (cờ về false) → chế độ lẫn lộn → đỏ ở mọi push đổi `schema.sql` / seed sau này. Sửa production
  bằng tay giữa lúc job chạy và lúc chủ dự án chạy file: job không thấy (điều kiện md5 + khối kiểm cả lô trong file vẫn
  chặn). Không có bước in log Docker của DB (log Postgres có thể chép nguyên câu SQL kèm mô tả).
