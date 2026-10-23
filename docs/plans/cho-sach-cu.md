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
  `place_used_order` (idempotency key + expected total bắt buộc), `my_used_sales` (không trả mã đơn / thông tin người
  mua), `mark_payout_paid` (admin), `can_upload_used_photo` (dùng trong policy).
- Bucket `used-listing-photos`: không công khai, `image/webp` ≤ 1MB, đường dẫn `<seller_id>/<uuid>.webp`. Policy: đọc =
  chủ thư mục / admin / ảnh của tin approved / sold; ghi = chủ thư mục, đúng mẫu tên, còn dưới 30 ảnh; xóa = chủ thư
  mục; không có update. RPC đăng / sửa kiểm ảnh có trong `storage.objects` (mimetype webp, ≤ 1MB), chỉ đọc.
- Mã lỗi mới: `LISTING_PENDING_LIMIT`, `LISTING_PRICE_INVALID`, `LISTING_PHOTOS_INVALID`, `LISTING_NOT_EDITABLE`,
  `LISTING_STATUS_CHANGED`, `LISTING_UNAVAILABLE`, `LISTING_OWN`, `LISTING_CHANGED`, `LISTING_INVALID_TRANSITION`,
  `PAYOUT_STATUS_CHANGED`.

Rủi ro chấp nhận (câu 7): gọi thẳng Storage API vẫn tải được ảnh WebP chưa qua bước nén của server (bucket chỉ kiểm
Content-Type + cỡ); admin xem ảnh trước khi duyệt là chốt cuối.

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

### Việc phải làm ở P-C

- Ghi chú demo song ngữ ở trang thanh toán sách cũ; ẩn bong bóng chat ở trang mua.
- Đổi trạng thái đơn sách cũ (đặt, hủy, admin đổi) thì `updateTag` các tag của tin.
- "Đã trả người bán" chỉ là admin đánh dấu (`mark_payout_paid`), không chuyển tiền, không lưu tài khoản ngân hàng.
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
