# Chợ sách cũ (đợt 1: mua bán)

Kế hoạch đã duyệt (chủ dự án, 23/10/2026). Đợt 1 chỉ MUA BÁN; trao đổi sách và email cho người bán làm đợt sau. Không thêm
dependency. Không đổi luồng giỏ / `quote_order` / `quote_items` / `place_order` / `checkout_vouchers` / `cancel_order`.

## Quyết định chủ dự án (23/10/2026)

Chủ dự án DUYỆT 11 đề xuất + điều chỉnh:

1. Chia 3 phần: P-A DB (đợt này) → P-B bán + duyệt + xem → P-C mua + tiền người bán; mỗi phần lên main riêng.
2. Ship đơn sách cũ luôn 30.000₫ = `private.flat_shipping_fee()`, không áp freeship 300.000₫, không voucher.
3. Trần giá = `coalesce(books.original_price, books.price)`; kiểm khi đăng, sửa, và khi admin duyệt.
4. Phí sàn 10% làm tròn tới 1.000₫ gần nhất, NỬA THÌ LÀM TRÒN LÊN (5.000 → 1.000; 25.000 → 3.000; 4.999 → 0).
5. Tin đã bán vẫn xem được ở trang chi tiết (nhãn "Đã bán"), không lên danh sách; đơn bị hủy → tin tự về đang bán.
6. Admin gỡ được tin đã duyệt (approved → rejected, bắt buộc lý do).
7. Ảnh: bucket KHÔNG công khai + link ký có hạn + tối đa 30 ảnh / người; chấp nhận rủi ro còn lại (gọi thẳng Storage API
   vẫn qua được bước nén; admin xem ảnh trước khi duyệt là chốt cuối). Kèm 3 điều kiện:
   (a) cache của mọi trang / query chứa link ảnh NGẮN HƠN hạn link. Chốt: link ký hạn 7 ngày (604800 giây); mọi hàm
   `'use cache'` tạo link ảnh gọi rõ `cacheLife('hours')` (expire 1 ngày), KHÔNG dùng default (không có expire) /
   `'days'` / `'weeks'` / `'max'`; trang người bán / admin ký theo từng request (không cache). P-B có Vitest kiểm tĩnh:
   chỉ một file gọi `createSignedUrl(s)` (giữ hằng TTL), mọi `'use cache'` trong `features/used` gọi
   `cacheLife('hours'|'minutes'|'seconds')`, và expire của `'hours'` (86400) < TTL.
   (b) ảnh sách cũ hiển thị bằng `next/image` `unoptimized` (đã nén WebP lúc tải lên; mỗi link ký là một URL khác nên
   không qua bộ tối ưu Vercel). `unoptimized` không đi qua `/_next/image` → giữ nguyên `coverImagesConfig`; chỉ khi thật
   cần mới thêm pattern, và chỉ đúng `/storage/v1/object/sign/used-listing-photos/**`.
   (c) bucket chỉ nhận `image/webp` ≤ 1MB (1048576) như `book-covers`.
8. Người mua sách cũ đã nhận được viết đánh giá sách (giữ policy `reviews_insert_if_purchased`).
9. Email đơn chỉ gửi người mua (như đơn thường); người bán chưa có email (đợt sau).
10. Danh mục ẩn → ẩn luôn tin sách cũ của sách đó khỏi danh sách.
11. Link "Chợ sách cũ" ở footer + trang tài khoản, không thêm vào header.

Thêm: KHÔNG thu, KHÔNG lưu số tài khoản ngân hàng hay thông tin thanh toán của người bán; "đã trả người bán" là mô
phỏng do admin đánh dấu.

Thêm: trang chợ sách cũ, form đăng tin (P-B) và trang thanh toán sách cũ (P-C) hiện ghi chú "Tính năng demo, không có
giao dịch thật" (song ngữ vi / en), giống cảnh báo VietQR demo.

## Chia phần

| Phần | Nhánh | Nội dung | Lên main khi |
|---|---|---|---|
| P-A | `cho-sach-cu-1` | Toàn bộ SQL (một migration) + `schema.sql` + mã lỗi + Vitest + e2e RLS / RPC bằng supabase-js, không UI | CI xanh + chủ dự án báo "ĐÃ CHẠY SQL" + kiểm MCP chỉ đọc thấy bảng / hàm / policy / bucket |
| P-B | `cho-sach-cu-2` | Đăng / sửa / rút tin có ảnh, "Sách tôi bán", admin duyệt / từ chối / gỡ, trang danh sách + chi tiết tin, "Có N bản cũ từ X ₫" ở trang sách | CI xanh |
| P-C | `cho-sach-cu-3` | Trang thanh toán một tin, `place_used_order`, đơn sách cũ ở tài khoản / admin, tiền sẽ nhận, admin khoản chờ trả + đánh dấu đã trả | CI xanh |

Phần sau cần sửa SQL → migration mới, lại dừng chờ chủ dự án chạy SQL.

## DB (P-A, migration `20261024000000_used_market.sql`, `schema.sql` mục 15)

- Kiểu: `used_condition` (`like_new`, `good`, `fair`, `worn` = Như mới / Tốt / Khá / Cũ nhiều), `used_listing_status`
  (`pending`, `approved`, `rejected`, `sold`, `withdrawn`).
- Hằng (`private`, immutable): `used_fee_percent()` = 10, `used_platform_fee(price)` (tính trên numeric: `round` của
  double precision làm tròn nửa về số chẵn), `used_pending_limit()` = 10, `used_photo_limit()` = 30.
- `used_listings`: người bán (`seller_id`, `seller_name` do trigger điền từ profile), sách catalog (`book_id`, restrict),
  tình trạng, giá, `fee` (phí chụp lúc đăng / sửa), mô tả ≤ 500, 1–3 ảnh, trạng thái, lý do từ chối ≤ 500,
  `approved_at`. Không có `sold_order_id`: nối qua `order_items.used_listing_id`.
- Luồng trạng thái (`private.used_listing_transition_allowed`, trigger BEFORE mọi role; app: `features/used/status.ts`):
  pending → approved | rejected | withdrawn; approved → pending (sửa) | sold | withdrawn | rejected (gỡ);
  rejected → pending | withdrawn; sold → approved (đơn bị hủy); withdrawn cuối. → sold chỉ khi có đơn chưa hủy chứa tin;
  sold → approved chỉ khi không còn đơn như vậy.
- RLS: công khai (anon + authenticated) tin `approved` / `sold`; người bán thấy tin của mình; admin thấy tất cả. Không ai
  ghi thẳng (revoke all, ghi qua RPC). Quyền cột: anon không đọc `seller_id`, `fee`, `reject_reason`.
- Đơn sách cũ = đơn thường (`orders`) một dòng `order_items` (quantity 1, bìa catalog, `used_listing_id`). Hủy đơn không
  hoàn kho dòng sách cũ (`handle_order_status_change`); trigger AFTER `orders_used_market`: hủy → tin về approved; lần
  đầu đạt delivered + paid → `seller_payouts`.
- `seller_payouts`: sổ tiền MÔ PHỎNG (giá, phí, số tiền = giá − phí, `pending` / `paid`, `paid_at`). Không có cột ngân
  hàng / tài khoản / thông tin thanh toán (Vitest `supabase/used-market.test.ts`). restrict ở đơn / tin / người bán:
  tài khoản đã có khoản tiền không xóa được. Người bán đọc khoản của mình, admin đọc tất cả; không ai ghi thẳng.
- RPC (security definer, chỉ authenticated): `used_listing_quote`, `create_used_listing`, `update_used_listing`,
  `withdraw_used_listing`, `review_used_listing` (admin, kèm `p_expected_status`), `quote_used_order`,
  `place_used_order` (idempotency key + expected total bắt buộc; key dùng chung không gian với `place_order`),
  `my_used_sales` (không trả mã đơn / thông tin người mua), `mark_payout_paid` (admin; chỉ khi đơn còn delivered + paid),
  `can_upload_used_photo(name)`, `can_delete_used_photo(name)` (dùng trong policy ảnh).
- Bucket `used-listing-photos`: không công khai, `image/webp` ≤ 1MB, đường dẫn `<seller_id>/<uuid>.webp`. Policy: đọc =
  chủ thư mục / admin / ảnh của tin approved / sold; ghi = chủ thư mục, đúng mẫu tên, ≤ 30 ảnh / người (không đếm ảnh
  của tin đã bán), tên chưa từng gắn tin (`private.used_photo_names`); xóa = chủ thư mục + ảnh không gắn tin chờ duyệt /
  đã duyệt / đã bán; không có update. RPC đăng / sửa / duyệt kiểm ảnh có trong `storage.objects` (mimetype webp,
  ≤ 1MB, hàm dùng chung `private.used_photos_stored`), chỉ đọc.
- Mã lỗi mới: `LISTING_PENDING_LIMIT`, `LISTING_PRICE_INVALID`, `LISTING_PHOTOS_INVALID`, `LISTING_PHOTOS_MISSING`,
  `LISTING_NOT_EDITABLE`, `LISTING_STATUS_CHANGED`, `LISTING_UNAVAILABLE`, `LISTING_OWN`, `LISTING_CHANGED`,
  `LISTING_INVALID_TRANSITION`, `PAYOUT_STATUS_CHANGED`.

Rủi ro chấp nhận (câu 7): gọi thẳng Storage API vẫn tải được ảnh WebP chưa qua bước nén của server (bucket chỉ kiểm
Content-Type + cỡ); admin xem ảnh trước khi duyệt là chốt cuối.

### Sửa sau review vòng 1 (điều phối chọn theo quyết định 7, 23/10; chủ dự án xem lại lúc duyệt file SQL)

- P1 Chặn đổi ảnh sau khi duyệt (trước đó: xóa ảnh rồi tải lại cùng tên là đổi được ảnh của tin đã duyệt):
  `can_delete_used_photo(name)` trong policy xóa (ảnh gắn tin `pending` / `approved` / `sold` không xóa được; ảnh chưa
  gắn tin, của tin `rejected` / `withdrawn` xóa được), `can_upload_used_photo(name)` trong policy tải lên (tên đã gắn
  tin ở bất kỳ trạng thái nào không tải lên lại được), `review_used_listing` khi duyệt kiểm lại ảnh còn đủ
  (`LISTING_PHOTOS_INVALID` (sửa sau review vòng 2 đổi thành `LISTING_PHOTOS_MISSING`); ảnh có thể mất ngoài
  policy: service role, xóa tay trong Storage). Storage không báo lỗi khi policy chặn xóa, chỉ trả mảng rỗng.
- P2 Trần 30 ảnh chỉ đếm ảnh trong thư mục của mình KHÔNG thuộc tin `sold` (đếm cả thì bán 10 tin × 3 ảnh là khóa
  đăng tin vĩnh viễn).
- P3 `order_items.used_listing_id` on delete restrict (trước: set null + profiles xóa dây chuyền tin → dòng sách cũ
  thành dòng sách mới, hủy đơn hoàn kho nhầm cho sách catalog). Tài khoản người bán có tin nằm trong đơn (kể cả đơn đã
  hủy) không xóa được, như `seller_payouts`. Dọn e2e (`deleteUsedListings`): tìm đơn theo tin (đơn còn khi người mua
  bị xóa: `orders.user_id` set null), xóa khoản trả + đơn trước tin; ảnh xóa bằng service role.
- P4 `used_check_book_price`: sách không có → `INVALID_INPUT` (`field: book_id`), sách ngừng bán vẫn `BOOK_UNAVAILABLE`.
  `seller_payouts`: authenticated đọc theo cột, không có `order_id`. `mark_payout_paid` chỉ khi đơn của khoản còn
  `delivered` + `paid`, khác → `PAYOUT_STATUS_CHANGED`. `place_used_order` dùng chung không gian idempotency key với
  `place_order` (key sinh mới mỗi trang nên không trùng).
- Gợi ý review đã chấp nhận (không sửa): `seller_id` lộ qua đường dẫn ảnh `<seller_id>/<uuid>.webp` (uuid không phải
  chốt bảo mật, RLS mới là chốt); đếm ảnh không khóa nên tải song song có thể vượt 30 một chút; role `postgres`
  (chủ các hàm security definer) có BYPASSRLS (đã kiểm qua MCP chỉ đọc 23/10) nên hàm dùng trong policy đọc được
  `used_listings` / `storage.objects` không đệ quy RLS.

### Sửa sau review vòng 2 (24/10)

- Lịch sử tên ảnh: `private.used_photo_names` (RLS bật, không policy) + trigger AFTER insert / update of `photos` trên
  `used_listings` lưu mọi tên ảnh đã từng gắn tin; `can_upload_used_photo` chặn tên trong bảng này. Trước đó chỉ xét
  tên đang gắn tin: tin đã duyệt đổi ảnh X → Y, xóa X, tải lại tên X với ảnh khác → link ký cũ của X (hạn 7 ngày) hiện
  ảnh chưa duyệt. Bảng chỉ thêm, không xóa (kể cả khi xóa tin).
- `can_upload_used_photo` / `can_delete_used_photo` kiểm thư mục đầu của tên = `auth.uid()` (gọi thẳng như RPC không
  dò được tên ảnh của người khác). `mark_payout_paid` khóa dòng đơn (`for share`) trước khi kiểm và ghi.
- Admin duyệt tin mà ảnh không còn đủ → `LISTING_PHOTOS_MISSING` (người bán không làm gì sai: admin từ chối tin kèm lý
  do); người bán đăng / sửa thiếu ảnh vẫn `LISTING_PHOTOS_INVALID`. Hàm dùng chung đổi thành
  `private.used_photos_stored(photos) returns boolean`.
- Gợi ý đã chấp nhận (không sửa): ảnh của tin `sold` không tính vào trần 30; đơn bị hủy → tin về `approved` → ảnh tính
  lại vào trần, người bán có thể vượt 30 ảnh (hiếm; chỉ chặn tải thêm tới khi xuống dưới trần).

### Chạy SQL production (24/10)

- File `D:/Bán sách-backup/2026-10-24-cho-sach-cu-1.sql` = migration `20261024000000_used_market.sql` tại `2285889`,
  sha256 `0db2500ab9317ccf6c7082bdec6431fc5505dd6ba235dc533d358a19b89f35e5`. Chủ dự án chạy trong SQL Editor lúc 9:03
  ngày 24/10/2026 (giờ Việt Nam), "Success. No rows returned", không thêm `lock_timeout` (cả file là một transaction).
  Kiểm trước / sau qua MCP chỉ đọc: `2026-10-24-cho-sach-cu-1-truoc.json`, `2026-10-24-cho-sach-cu-1-sau.json`
  (cùng thư mục backup, không dữ liệu cá nhân).
- Kết quả sau khi chạy (S0–S9, đúng mọi kỳ vọng): phiên MCP `transaction_read_only = on`; bucket `used-listing-photos`
  không công khai, chỉ `image/webp`, ≤ 1048576 byte; 6 policy (3 `public`, 3 `storage.objects`); RLS bật ở 3 bảng
  (`used_listings`, `seller_payouts`, `private.used_photo_names`); 24 hàm (10 `private` + 14 `public`); `orders` thêm
  trigger `orders_used_market` (2 trigger cũ còn nguyên), `used_listings` có 4 trigger; FK
  `order_items_used_listing_id_fkey` restrict; `handle_order_status_change` có nhánh `oi.used_listing_id is null`;
  8 phép kiểm quyền (anon đọc 3 cột ẩn `seller_id`, `fee`, `reject_reason` (3 phép), anon đọc `seller_payouts`,
  authenticated đọc `order_id`, authenticated insert thẳng `used_listings`, anon gọi `place_used_order`, authenticated
  đọc `private.used_photo_names`) đều false; phí sàn
  5.000 / 25.000 / 98.000 → 1.000 / 3.000 / 10.000; 0 tin, 0 khoản trả, 0 tên ảnh, 0 dòng đơn sách cũ.
- Security advisor sau khi chạy: cảnh báo mới chỉ cùng loại với cảnh báo đã có (bảng `private` RLS bật không policy;
  hàm security definer gọi được bởi anon / authenticated, gồm hàm trigger như `handle_order_status_change` có sẵn).
- Quy trình: build ở thư mục chính bằng `git checkout --detach <commit>` thì `.next` khi đó là bản của nhánh; `npm start`
  ở thư mục chính sẽ chạy code nhánh với DB production, nên không `npm start` trước khi SQL chạy. Sau khi build nhánh
  thì build lại main, hoặc ghi rõ trong báo cáo `.next` đang là bản nào.
- Nguồn gốc types: `src/types/database.ts` chép từ artifact `database-types` của run 39990438048 (`06a055a`); bước
  'Check src/types/database.ts' xanh trên `2285889` (e2e 39995297803) và `9fe026f` (e2e 40053340070) → khớp `schema.sql`
  tại 2285889 (cùng nội dung file migration đã chạy production 2026-10-24 9:03).

## App (P-B, P-C)

Routing (`i18n/routing.ts`):

| vi | en | Phần |
|---|---|---|
| `/cho-sach-cu` | `/en/used-books` | P-B |
| `/cho-sach-cu/[id]` | `/en/used-books/[id]` | P-B |
| `/cho-sach-cu/[id]/mua` | `/en/used-books/[id]/buy` | P-C (cần đăng nhập, ẩn chat) |
| `/tai-khoan/sach-toi-ban` | `/en/account/my-listings` | P-B |
| `/tai-khoan/sach-toi-ban/dang-tin` | `/en/account/my-listings/new` | P-B |
| `/tai-khoan/sach-toi-ban/[id]` | `/en/account/my-listings/[id]` | P-B |

Đặt xong dùng lại `/thanh-toan/thanh-cong/[code]`. Admin: `/admin/sach-cu`, `/admin/sach-cu/[id]` (P-B),
`/admin/tra-nguoi-ban` (P-C). Proxy: 404 thật cho `/cho-sach-cu/<id>` không công khai (`x-not-found: used-market`,
vòng 9; đếm tin theo id + status approved / sold); trang sửa tin như trang sửa địa chỉ (`x-not-found: used-listing`).
Danh sách chợ nhận `?cat=`, `?sort=` (`newest` mặc định / `price-asc` / `price-desc`), `?page=` như `/sach`, cộng
`?book=<slug>` (dòng "Có N bản cũ" ở trang sách luôn trỏ tới đây).

File dự kiến (`src/features/used/`): `schemas.ts` (zod, chỉ server), `status.ts` (đã có), `queries.ts` (công khai
`'use cache'` + tag `used-listings`, `used-listing:{id}`, `used-book:{bookId}`, lọc danh mục đang hiện), `actions.ts`,
`photos.ts` (`toListingPhotoWebp`: sharp, xoay theo EXIF, ≤ 1200px, WebP, bỏ EXIF / GPS), `signed-urls.ts` (file duy nhất
ký link), `components/` (form đăng tin, ô chọn ảnh thu nhỏ bằng canvas, thẻ tin, lưới, bộ lọc / sắp xếp qua URL).
Admin: `features/admin/used/actions.ts` (`assertAdmin` hai câu đầu).

### Việc phải làm ở P-B

Chia 3 vòng con trên nhánh `cho-sach-cu-2` (điều phối 24/10): 7 = người bán, 8 = admin duyệt / từ chối / gỡ, 9 = trang
công khai + "Có N bản cũ từ X ₫" + proxy 404 + link footer; 10 = sửa e2e CI vòng 9 + review vòng 9. Lên main một lần
khi xong P-B. [x] = đã làm (vòng 7, 8, 9, 10). **P-B đã lên `main` `881969a`** (ff `18499fa..881969a` 2026-10-24
10:18:34Z, vòng 11–12 sửa e2e / review + link "Về cửa hàng" trên điện thoại ở admin; không SQL mới).

- [x] P-B việc đầu: e2e/used-market-rls-account.spec.ts bước sửa tin với mô tả rỗng đổi `p_description: ''` thành `'   '`
  để kiểm cả btrim của update_used_listing (GỢI Ý 1 review vòng 5; giữ assert description: null).
- [x] Một file duy nhất ký link ảnh (`features/used/signed-urls.ts`, hằng `USED_PHOTO_URL_TTL` = 604800 giây = 7 ngày).
- [x] Query công khai `'use cache'` + `cacheLife('hours')` (vòng 9, `features/used/public-queries.ts`: client anon,
  danh sách `books!inner` bỏ tin của sách ngừng bán, tag `used-listings` + `book:{id}`; một tin `used-listing:{id}` +
  `book:{id}` (vòng 10: nhúng sách không `!inner`, gắn tag sách trước khi trả null cho sách ngừng bán); "Có N bản cũ"
  `used-book:{bookId}` không ký link); [x] trang người bán ký theo request (không cache);
  [x] admin ký theo request (`features/admin/used/queries.ts`, không cache; vòng 8).
- [x] Vitest kiểm tĩnh điều kiện (a) (`features/used/cache-life.test.ts`): chỉ một file gọi `createSignedUrl(s)`, mọi
  `'use cache'` trong file import signed-urls / features/used/queries (trực tiếp hay bắc cầu: bao đóng import trong src,
  kể cả `export … from`, `import()`, `import type`; vòng 8) gọi `cacheLife('hours'|'minutes'|'seconds')`, không có
  `'use cache'` đầu file, expire của các profile đó (đọc `defaultConfig` của Next; next.config.ts không khai báo
  cacheLife) < TTL.
- [x] `next/image` `unoptimized` cho ảnh sách cũ; giữ `coverImagesConfig` (build không đòi thêm pattern).
- [x] Ghi chú demo song ngữ ở form đăng / sửa tin; [x] trang danh sách chợ sách cũ + trang tin (vòng 9).
- [x] Link "Sách tôi bán" ở trang tài khoản; [x] link "Chợ sách cũ" ở footer + trang tài khoản (vòng 9).
- [x] Trang công khai (vòng 9): `/cho-sach-cu` (lưới thẻ tin, ảnh `unoptimized` khung 3:4, lọc danh mục + sắp xếp bằng
  link, phân trang, rỗng, ghi chú demo, `?page=` vượt quá → InlineNotFound), `/cho-sach-cu/[id]` (params đọc trong
  Suspense, `instant = false`, mọi ảnh ký, nhãn Đã bán, không nút mua, noindex + hreflang, không vào sitemap); proxy 404
  `used-market`; trang sách "Có N bản cũ từ X ₫" (Suspense riêng, giữ chỗ một dòng, chỉ khi danh mục của sách đang hiện).
  Ẩn danh mục: danh sách nhận id danh mục đang hiện làm tham số (khóa cache) từ `getCategories()` (tag `categories`,
  action danh mục của admin đã updateTag) → không cần updateTag `used-listings` ở action danh mục.
- [x] e2e trang công khai (`e2e/used-market-public-account.spec.ts`, vòng 9): mỗi project một sách thật, duyệt / gỡ / rút
  qua giao diện. Trang chợ chưa vào crawl.spec (tin do spec song song tạo / xóa).
- [x] Sửa review vòng 8 (vòng 9): admin so `updated_at` của tin trong app (ô ẩn `expected_updated_at`; còn khe ms giữa
  select và RPC, bản chặt cần `p_expected_updated_at` trong RPC = SQL, chờ chủ dự án); trang sửa tin cũng dọn ảnh mồ côi.
- [x] e2e người bán (`e2e/used-listing-account.spec.ts`): đăng tin có ảnh, tin chưa duyệt không công khai, sửa → về chờ
  duyệt, rút, bỏ ảnh khỏi form, giá vượt trần, 404 trang sửa tin; vòng 8 thêm: focus bàn phím khi rút tin / chọn sách /
  bỏ ảnh, hai lượt chọn ảnh liên tiếp (tối đa 3 ô, tải lần lượt), trần 30 ảnh (LISTING_PHOTO_LIMIT), dự phòng `<img>` khi
  createImageBitmap lỗi; [x] admin duyệt / từ chối / gỡ qua UI (`e2e/admin-used-listings.spec.ts`, vòng 8).
- [x] Admin duyệt tin (vòng 8): `/admin/sach-cu` (lọc trạng thái qua URL, mặc định chờ duyệt cũ nhất trước, trạng thái
  khác mới nhất trước), `/admin/sach-cu/[id]` (mọi ảnh ký theo request, ảnh mất → "Ảnh không còn"; sách + trần giá hiện
  tại; Duyệt / Từ chối kèm lý do / Gỡ tin hỏi lại tại chỗ; rejected / sold / withdrawn chỉ xem). Action
  `features/admin/used/actions.ts` (assertAdmin hai câu đầu, `expected_status` ô ẩn, updateTag theo `usedListingTags` +
  refresh()). Hiện `LISTING_PHOTOS_MISSING` (ảnh của tin không còn đủ) kèm gợi ý từ chối tin có lý do,
  `LISTING_STATUS_CHANGED` (trang render lại trạng thái mới), giá vượt trần lúc duyệt: câu riêng của admin (tối đa {max}).
  Admin chỉ thấy tên hiển thị người bán (`seller_name`, null → "Thành viên").
- [x] Sửa tin: ảnh cũ không còn dùng thì xóa sau khi lưu (DB chặn xóa ảnh đang gắn tin `pending` / `approved` / `sold`,
  nên chỉ xóa được khi tin đã bỏ ảnh đó hoặc tin bị từ chối / đã rút). Dọn ảnh tải lên bỏ dở: xóa ngay khi bỏ ảnh khỏi
  form, và dọn ảnh mồ côi (> 24 giờ) của chính người bán khi mở form đăng tin; rút tin thì xóa ảnh của tin. Ảnh chỉ bị
  xóa khi không nằm trong tin chưa rút nào của người bán (`features/used/photo-storage.ts`).
- [x] Schema zod form đăng / sửa tin `.trim()` mô tả trước khi gọi RPC (`btrim` của DB chỉ cắt dấu cách; mô tả chỉ có
  xuống dòng / tab sẽ lưu nguyên).
- [x] Trần 30 ảnh: policy bucket chặn tải lên → mã app `LISTING_PHOTO_LIMIT` (không đổi SQL).
- [x] Vòng 10 (sửa e2e CI 1c6e7ef + review vòng 9): e2e sau điều hướng client chỉ xét phần tử đang hiển thị (Next giữ
  trang vừa rời trong `<main>` ở dạng ẩn, Activity): (p1) người bán ở trang tin, (p5) thứ tự lưới sau chip sắp xếp; ca
  (10) một init script theo chế độ trong sessionStorage; dọn cuối ca không che lỗi gốc; bất biến sách chợ trong
  `scripts/e2e-seed.test.ts` (danh mục lá đang bật kể cả cha, giá gốc > mọi giá tin, giá tin viết thẳng). Dòng "Có N bản
  cũ" `min-h-[1lh]`; thẻ lưới `prefetch={false}`; trang tin gắn tag sách trước khi trả null; admin duyệt / từ chối tin đã
  bị xóa → `ITEM_DELETED` (không `refresh()`: trang render lại là 404) + e2e admin (i); comment `instant = false` của
  trang tin theo kết quả kiểm (bỏ dòng vẫn build được, dev không báo; giữ tới khi quyết).

### Việc phải làm ở P-C

Chia vòng trên nhánh `cho-sach-cu-3` (điều phối 24/10): 14 = SQL + types + e2e RLS; 15 = trang mua
`/cho-sach-cu/[id]/mua` + đơn sách cũ + e2e mua; 16 = tiền người bán + `/admin/tra-nguoi-ban` + GỢI Ý vòng 12; sau đó
cắt SQL, chủ dự án chạy, rồi mới lên main. [x] = đã làm (vòng 14, 15, 16, 17).

- [x] Migration `20261024120000_used_market_purchase.sql` (vòng 14, gom mọi SQL của P-C để production chạy một lần;
  chép vào `schema.sql` cùng commit):
  - `review_used_listing` thêm `p_expected_updated_at` (bắt buộc; null → `INVALID_INPUT` field `expected_updated_at`;
    so sau `for update`, trạng thái hoặc `updated_at` lệch → `LISTING_STATUS_CHANGED`). Quyết định của chủ dự án
    2026-10-24.
  - `place_used_order` thêm `p_expected_updated_at` (bắt buộc, sau `p_address_id`): tin bị sửa (tình trạng / mô tả /
    ảnh) rồi duyệt lại cùng giá → `LISTING_CHANGED` (detail `total` như cũ); idempotency vẫn trước mọi kiểm tin. Đề
    xuất của điều phối, chủ dự án duyệt lúc chạy SQL.
  - `admin_seller_payouts()` (admin, `is_admin()` → `FORBIDDEN`): khoản trả kèm mã + trạng thái đơn, tên hiển thị
    người bán; không trả thông tin người mua.
  - `drop function` chữ ký cũ KHÔNG kèm `if exists` (lệch chữ ký thì cả file rollback); revoke `public, anon` / grant
    `authenticated` đúng chữ ký mới. Thứ tự: SQL chạy trên production **trước** khi app mới lên `main` (app mới gửi
    tham số mới); trong khoảng giữa, app P-B trên production không duyệt tin được → giữ khoảng này ngắn.
  - Types: `src/types/database.ts` vòng 14 sửa tay đúng 3 mục theo định dạng CLI (không có Docker); bước "Check
    src/types/database.ts" trên CI phân xử, lệch thì chép artifact `database-types`.
- [x] Admin duyệt / từ chối gửi `expected_updated_at` nguyên chuỗi vào RPC (vòng 14), bỏ phép so trong app.
- [x] Đổi trạng thái đơn sách cũ thì `updateTag` các tag của tin: `expireOrderBooks` đọc `used_listing_id`, dòng sách
  cũ → `usedListingTags`, dòng sách mới → `book:{id}` (Vitest); [x] đặt (vòng 15: `placeUsedOrder`), hủy / admin hủy
  (vòng 14).
- [x] e2e RLS (vòng 14, `used-market-rls-account.spec.ts`): (r1) duyệt / từ chối với `updated_at` cũ, (r2) mua với
  `updated_at` cũ sau khi tin được sửa rồi duyệt lại cùng giá, (r3) `admin_seller_payouts` chỉ admin, đơn hủy + đơn đã
  giao của cùng tin → đúng một khoản kèm mã đơn đã giao.
- [x] Trang mua `/cho-sach-cu/[id]/mua` (vòng 15): cần đăng nhập (proxy chuyển sang đăng nhập cho GET / HEAD), tin không
  công khai / id sai dạng → 404 `used-market`; tin đọc theo phiên không cache (lọc approved / sold), `updated_at` cùng
  lần đọc với nội dung đang hiện, tiền từ `quote_used_order`; đã bán / ngừng bán / tin của mình → không có form; COD /
  VietQR như đơn thường (`getBankAccount`: đủ 4 biến `VIETQR_*` thì tài khoản thật, thiếu → demo), không voucher;
  idempotency key sinh ở phần động. `placeUsedOrder`: lỗi tin / sách / địa chỉ → updateTag tag của tin (book_id đọc lại
  ở server) + `refresh()`; UNKNOWN / mạng giữ key. Nút "Mua ngay" ở trang tin đang bán.
- [x] Ghi chú demo song ngữ ở trang thanh toán sách cũ; [x] ẩn bong bóng chat ở trang mua (vòng 15).
- [x] Đơn sách cũ ở tài khoản / admin (vòng 15): nhãn "Sách cũ · <tình trạng>" (tin đã rút sau khi hủy → "Sách cũ"),
  admin thêm "Người bán: <tên hiển thị>"; người mua không đọc seller_id. Vòng 16: đơn của khách chỉ nhúng
  `used_listings(condition)` (không tên người bán), query admin giữ `seller_name`.
- [x] "Thêm địa chỉ" ở trang mua quay lại đúng trang mua (vòng 16): `parseAddressNext` (`features/account/address-return.ts`)
  chỉ nhận `?next=` là /thanh-toan hoặc trang mua cùng locale (id chỉ chữ số, nguyên dương an toàn); `createAddress`
  nhận `'checkout' | { usedListingId }` (parse lại), dựng URL từ mẫu route; trang mua chọn sẵn `?address=` như
  /thanh-toan. Ghi chú đơn đã gõ mất khi rời trang (chấp nhận). Trang mua kiểm theo thứ tự `place_used_order`.
- [x] Tiền người bán ở "Sách tôi bán" (vòng 16): khối "Đã bán" (`getMySales`: `my_used_sales` + ngày trả từ
  `seller_payouts` của chính người bán), trạng thái Đang giao / Chờ người mua thanh toán / Chờ trả / Đã trả + ngày
  (`saleStatus`, Vitest), tổng chờ trả / đã trả, ghi chú demo.
- [x] `/admin/tra-nguoi-ban` (vòng 16): RPC `admin_seller_payouts()`, lọc `?trang-thai=cho-tra | da-tra` (không có =
  tất cả), phân trang `.range()` + count exact, `markPayoutPaid` (assertAdmin, `payoutIdSchema`,
  `PAYOUT_STATUS_CHANGED` → `refresh()` + câu tại dòng), nút chỉ khi chờ trả + đơn đã giao + đã thanh toán; mục nav.
- "Đã trả người bán" chỉ là admin đánh dấu (`mark_payout_paid`), không chuyển tiền, không lưu tài khoản ngân hàng.
- Trang khoản tiền admin: `seller_payouts` không cho authenticated (kể cả admin) đọc `order_id` → dùng RPC
  `admin_seller_payouts()` (vòng 14). Tìm qua `listing_id` (nếu cần) phải lọc đơn `status <> 'cancelled'`: một tin có
  thể nằm trong nhiều đơn đã hủy, nhưng chỉ một đơn chưa hủy (trigger trạng thái tin: → `sold` chỉ khi có đơn chưa hủy,
  `sold` → `approved` chỉ khi không còn đơn nào như vậy).
- [x] e2e mua (vòng 15, `e2e/used-purchase-account.spec.ts` (m1)–(m7)): đăng nhập từ nút Mua ngay, mua COD, hủy → tin
  về công khai, người bán không mua được, LISTING_CHANGED, tin đã bán / chờ duyệt / id sai, mất mạng. [x] (m8) "Thêm
  địa chỉ" từ trang mua, (m9) giao + trả tiền → "Chờ trả" → admin đánh dấu → "Đã trả" (vòng 16);
  [x] `e2e/admin-used-payouts.spec.ts` (vòng 16): lọc, bấm "Đã trả", hai tab PAYOUT_STATUS_CHANGED, trang đơn admin.
- [x] GỢI Ý review vòng 12 (vòng 16): (p5) duyệt mid → cheap → dear để "mới duyệt" khác id / created_at; kiểm câu en số
  ít "1 used copy from ₫40,000"; link "Về cửa hàng" mobile admin cùng kiểu nút giao diện (Button ghost, 44px).

- [x] Sửa review vòng 16 (vòng 17): regex (m8) trong template literal (`\\?`, `\\d+`) + bật `no-useless-escape` cho
  `e2e/**` (thử đỏ đúng 2 dòng); (m8) chỉ xét dòng địa chỉ đang hiển thị (Activity); ngày trả chỉ khi trạng thái là "Đã
  trả" (`saleStatusWithPaidAt`, Vitest); `pickAddressId` (`features/checkout/address-selection.ts`, Vitest) dùng chung
  /thanh-toan + trang mua; comment `AddressOptions`; aria-label nút "Đã trả: “<tên sách>”" ở `/admin/tra-nguoi-ban`.

- [x] Vòng 19: 404 segment prefetch `(shop)` ở /vi/* (flaky (m5)) → `experimental.prefetchInlining: false` (phương án A,
  chủ dự án chọn); (m8) chờ `ready` thật (bộ đếm ghi chú) trước khi kiểm nút khóa; CLAUDE.md (pathnames trang mua, chữ
  ký RPC + `admin_seller_payouts`, chat ẩn ở trang mua, `/admin/tra-nguoi-ban`, VietQR, Mutation, regex e2e, cờ prefetch).
  Chủ dự án quyết (2026-10-24): duyệt `place_used_order` + `p_expected_updated_at`; giữ `seller_id` đọc được với
  authenticated; `VIETQR_*` Production là số demo → giữ cách hiện QR như đơn thường.

Còn lại: cắt khối SQL của migration `20261024120000_used_market_purchase.sql` (tại commit đã duyệt) ra file ngoài
repo + chụp trước bằng MCP chỉ đọc → DỪNG chờ chủ dự án chạy SQL ("ĐÃ CHẠY SQL") + test điện thoại luồng mua trên
Preview → lên main. Giữa lúc chạy SQL và lúc lên main, admin trên web thật không duyệt / từ chối tin được.

## Test (P-A)

- Vitest: `src/features/used/status.test.ts` (luồng trạng thái + enum khớp `schema.sql`), `supabase/used-market.test.ts`
  (hằng phí trên numeric, giới hạn, bucket, không cột ngân hàng, quyền RPC, `my_used_sales` không có cột người mua),
  `supabase/migrations.test.ts`, `src/lib/errors.test.ts`.
- "Vitest cho phí sàn" = Vitest đọc hằng trong `schema.sql` + e2e bảng giá → phí qua RPC (không có hàm TS tính phí:
  client không tự tính).
- e2e (CI, Supabase local): `e2e/used-market-rls-account.spec.ts` (supabase-js, không UI; user + sách test riêng mỗi lần
  chạy). Dọn dữ liệu (`scripts/e2e-user.ts`): khoản trả người bán → đơn → tin → ảnh (Storage API) → user; xóa sách test
  sau khi xóa tin của sách (book_id restrict).
