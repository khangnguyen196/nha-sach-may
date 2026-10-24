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
  (`LISTING_PHOTOS_INVALID` (vòng 2 đổi thành `LISTING_PHOTOS_MISSING`); ảnh có thể mất ngoài policy: service role,
  xóa tay trong Storage). Storage không báo lỗi
  khi policy chặn xóa, chỉ trả mảng rỗng.
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
  8 phép kiểm quyền (anon đọc cột ẩn, anon đọc `seller_payouts`, authenticated đọc `order_id`, authenticated insert
  thẳng `used_listings`, anon gọi `place_used_order`, authenticated đọc `private.used_photo_names`) đều false; phí sàn
  5.000 / 25.000 / 98.000 → 1.000 / 3.000 / 10.000; 0 tin, 0 khoản trả, 0 tên ảnh, 0 dòng đơn sách cũ.
- Security advisor sau khi chạy: cảnh báo mới chỉ cùng loại với cảnh báo đã có (bảng `private` RLS bật không policy;
  hàm security definer gọi được bởi anon / authenticated, gồm hàm trigger như `handle_order_status_change` có sẵn).
- Quy trình: build ở thư mục chính bằng `git checkout --detach <commit>` thì `.next` là bản của nhánh (chạy với code
  cần bảng mới); không `npm start` ở thư mục chính trước khi SQL chạy trên production. Sau khi build nhánh thì build
  lại main, hoặc ghi rõ trong báo cáo `.next` đang là bản nào.

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
`/admin/tra-nguoi-ban` (P-C). Proxy: 404 thật cho `/cho-sach-cu/<id>` không công khai (`x-not-found: used-listing`); trang
sửa tin như trang sửa địa chỉ.

File dự kiến (`src/features/used/`): `schemas.ts` (zod, chỉ server), `status.ts` (đã có), `queries.ts` (công khai
`'use cache'` + tag `used-listings`, `used-listing:{id}`, `used-book:{bookId}`, lọc danh mục đang hiện), `actions.ts`,
`photos.ts` (`toListingPhotoWebp`: sharp, xoay theo EXIF, ≤ 1200px, WebP, bỏ EXIF / GPS), `signed-urls.ts` (file duy nhất
ký link), `components/` (form đăng tin, ô chọn ảnh thu nhỏ bằng canvas, thẻ tin, lưới, bộ lọc / sắp xếp qua URL).
Admin: `features/admin/used/actions.ts` (`assertAdmin` hai câu đầu).

### Việc phải làm ở P-B

- Một file duy nhất ký link ảnh (hằng TTL 604800 giây = 7 ngày).
- Query công khai `'use cache'` + `cacheLife('hours')`; trang người bán / admin ký theo request (không cache).
- Vitest kiểm tĩnh điều kiện (a): chỉ một file gọi `createSignedUrl(s)`, mọi `'use cache'` trong `features/used` gọi
  `cacheLife('hours'|'minutes'|'seconds')`, expire của `'hours'` (86400) < TTL.
- `next/image` `unoptimized` cho ảnh sách cũ; giữ `coverImagesConfig` (chỉ thêm pattern
  `/storage/v1/object/sign/used-listing-photos/**` nếu thật cần).
- Ghi chú demo song ngữ ("Tính năng demo, không có giao dịch thật") ở trang danh sách chợ sách cũ + form đăng tin.
- Link "Chợ sách cũ" ở footer + trang tài khoản.
- e2e: đăng tin có ảnh, tin chưa duyệt không hiện công khai, sửa → về chờ duyệt, rút, admin duyệt / từ chối.
- Admin duyệt tin: hiện `LISTING_PHOTOS_MISSING` (ảnh của tin không còn đủ) kèm gợi ý từ chối tin có lý do.
- Sửa tin: ảnh cũ không còn dùng thì xóa sau khi lưu (DB chặn xóa ảnh đang gắn tin `pending` / `approved` / `sold`,
  nên chỉ xóa được khi tin đã bỏ ảnh đó hoặc tin bị từ chối / đã rút). Có cách dọn ảnh tải lên bỏ dở (ảnh không gắn
  tin nào, VD bỏ form giữa chừng) để người bán không chạm trần 30 ảnh: xóa ngay khi bỏ ảnh khỏi form, và / hoặc dọn
  ảnh mồ côi của chính người bán khi mở form đăng tin.

### Việc phải làm ở P-C

- Ghi chú demo song ngữ ở trang thanh toán sách cũ; ẩn bong bóng chat ở trang mua.
- Đổi trạng thái đơn sách cũ (đặt, hủy, admin đổi) thì `updateTag` các tag của tin.
- "Đã trả người bán" chỉ là admin đánh dấu (`mark_payout_paid`), không chuyển tiền, không lưu tài khoản ngân hàng.
- Trang khoản tiền admin: `seller_payouts` không cho authenticated (kể cả admin) đọc `order_id` → tìm đơn qua
  `listing_id` (`order_items.used_listing_id`) hoặc RPC có kiểm `is_admin()`. Tìm qua `listing_id` phải lọc đơn
  `status <> 'cancelled'`: một tin có thể nằm trong nhiều đơn đã hủy, nhưng chỉ một đơn chưa hủy (trigger trạng thái tin:
  → `sold` chỉ khi có đơn chưa hủy, `sold` → `approved` chỉ khi không còn đơn nào như vậy).
- e2e: mua COD, hủy → tin về công khai, người bán không mua được, giao + trả tiền → khoản chờ trả, admin đánh dấu đã trả.

## Test (P-A)

- Vitest: `src/features/used/status.test.ts` (luồng trạng thái + enum khớp `schema.sql`), `supabase/used-market.test.ts`
  (hằng phí trên numeric, giới hạn, bucket, không cột ngân hàng, quyền RPC, `my_used_sales` không có cột người mua),
  `supabase/migrations.test.ts`, `src/lib/errors.test.ts`.
- "Vitest cho phí sàn" = Vitest đọc hằng trong `schema.sql` + e2e bảng giá → phí qua RPC (không có hàm TS tính phí:
  client không tự tính).
- e2e (CI, Supabase local): `e2e/used-market-rls-account.spec.ts` (supabase-js, không UI; user + sách test riêng mỗi lần
  chạy). Dọn dữ liệu (`scripts/e2e-user.ts`): khoản trả người bán → đơn → tin → ảnh (Storage API) → user; xóa sách test
  sau khi xóa tin của sách (book_id restrict).
