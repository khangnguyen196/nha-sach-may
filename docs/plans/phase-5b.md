# Phase 5b: Checkout COD + trang đặt hàng thành công

Trạng thái: **đã duyệt** (2026-10-15): chọn hết các ★, sửa 2 điểm (xem "Sửa khi duyệt"). Làm trên nhánh `phase-5b`.

## Sửa khi duyệt

1. **Mục 1 và 3 xung đột.** Bản cũ: action gọi `quote_order` (so `expected_total`) **trước** `place_order`. Gửi lại sau khi mất phản hồi (đơn đã tạo, giỏ đã rỗng) thì quote = 0 ≠ `expected_total` → `CART_CHANGED`, thay vì trả lại đơn cũ như mục 1 hứa.
   Sửa: phép so nằm trong `place_order`, tham số `p_expected_total int default null`, cùng migration idempotency. Thứ tự trong hàm:
   (a) key đã có đơn → trả đơn đó;
   (b) khóa giỏ, tính tiền;
   (c) `p_expected_total` khác tổng vừa tính → `raise 'CART_CHANGED'` (detail: `{"total": <tổng mới>}`);
   (d) đặt hàng.
   Action **bỏ** lời gọi `quote_order`. `CART_CHANGED` là mã của DB: có trong danh sách mã lỗi cuối `schema.sql`. Có test (e2e gọi RPC) cho ca "gửi lại cùng key sau khi đơn đã tạo → trả đơn cũ, không `CART_CHANGED`".
2. **Idempotency key sinh trong phần động của trang** (trong `<Suspense>`, sau khi đọc phiên), không ở static shell: giá trị ngẫu nhiên trong phần prerender sẽ lỗi build hoặc bị đóng băng vào HTML tĩnh (giống lỗi `Date.now()` ở Phase 4).

Phạm vi: trang `/thanh-toan` (chọn địa chỉ đã lưu, ghi chú, COD), Server Action `placeOrder` gọi RPC `place_order`, xử lý từng mã lỗi ở UI, chống đặt trùng, làm mới cache tồn kho sau khi đặt, trang đặt hàng thành công. **Không** có: voucher và VietQR (Phase 9), danh sách / chi tiết / hủy đơn trong tài khoản (Phase 6), email xác nhận đơn (Phase 9).

## Cần chọn

★ = đề xuất.

1. **Chống đặt hàng 2 lần** (DB đã chặn: request thứ hai khóa cùng dòng giỏ, chờ request đầu commit rồi gặp giỏ rỗng → `CART_EMPTY`. Lỗi này hiện ra sau khi đơn đã đặt thành công thì người dùng không hiểu)
   - ★ **Idempotency key**: trang checkout sinh một `uuid` cho mỗi lần render (hidden input). `place_order` nhận thêm `p_idempotency_key`; key này đã có đơn thì trả lại đúng đơn đó thay vì báo lỗi. Bao được cả bấm 2 lần khi chưa có JS (trình duyệt POST 2 lần), bấm lại vì mạng chậm, và mất phản hồi rồi gửi lại. UI vẫn khóa nút khi đang gửi. Cần migration (chi tiết ở mục Database).
   - Không đổi schema: gặp `CART_EMPTY` thì action tìm đơn `pending` của user tạo trong 60 giây gần nhất, có thì chuyển tới trang thành công của đơn đó. Đoán theo thời gian nên có thể nhầm (VD đặt ở tab khác thật).
   - Chỉ khóa nút khi đang gửi (`pending`). Không bao được trường hợp chưa có JS và gửi lại khi mạng chậm.

2. **Làm mới cache sau khi `place_order` thành công** (trang sách, danh sách lọc "còn hàng", sắp "bán chạy", giỏ khách đều cache `hours`). Trong Server Action, Next 16 có **`updateTag(tag)`** cho read-your-own-writes: hết hạn ngay, request kế tiếp chờ dữ liệu mới, không trả bản cũ. `revalidateTag(tag, 'max')` thì vẫn trả bản cũ một lần trong lúc làm mới ngầm.
   - ★ `updateTag('book:{id}')` cho từng sách trong đơn, **và gắn thêm tag `book:{id}` của từng sách trả về vào mọi cache danh sách** (`listBooks`, `getNewBooks`, `getRelatedBooks`, `searchBookHits`; tối đa 128 tag / lần gọi `cacheTag`, `PAGE_SIZE` nhỏ hơn nhiều). Nhờ vậy chỉ trang sách và những trang danh sách **đang chứa** sách đó bị làm mới, không làm mới cả catalog (đúng quy tắc "revalidate đúng tag" trong CLAUDE.md). Giới hạn: sách hết hàng biến khỏi danh sách "còn hàng" đang chứa nó, nhưng `count` / phân trang của các trang khác trong cùng bộ lọc cũ tới khi hết `hours`. Sách tăng hạng "bán chạy" ở danh sách chưa chứa nó cũng phải chờ hết `hours`.
   - `updateTag('books')`: chính xác tuyệt đối nhưng mỗi đơn hàng làm mới toàn bộ catalog.
   - `updateTag('book:{id}')` + `revalidateTag('books', 'max')`: catalog làm mới ngầm sau mỗi đơn. Đơn giản nhưng vẫn là cả catalog, và người xem kế tiếp vẫn thấy bản cũ một lần.
   - Cả ba phương án: gặp `OUT_OF_STOCK` / `BOOK_UNAVAILABLE` cũng `updateTag('book:{book_id}')` của sách trong `details`, vì lỗi này có nghĩa cache đang cũ.

3. **Tổng tiền đổi giữa lúc xem và lúc bấm** (giỏ bị sửa ở tab khác, admin đổi giá)
   - ★ Form gửi kèm tổng tiền đang hiển thị (hidden input, **chỉ để so sánh**, không dùng để tính). ~~Action gọi `quote_order` ngay trước `place_order`~~ → **`place_order(p_expected_total)` tự so** sau khi khóa giỏ (xem "Sửa khi duyệt" 1). Lệch thì không đặt, raise `CART_CHANGED`, action `refresh()` để trang hiện số mới, kèm thông báo "Giỏ hàng vừa thay đổi, kiểm tra lại trước khi đặt". Không tốn thêm RPC, không còn khe hở giữa hai lần đọc.
   - Không kiểm tra; trang thành công hiện số thật của đơn.

4. **Chưa có địa chỉ / muốn thêm địa chỉ mới**
   - ★ Link "Thêm địa chỉ" sang `/tai-khoan/dia-chi/moi?next=%2Fthanh-toan`. `createAddress` nhận thêm `next` (qua `safeNextPath`), lưu xong quay lại checkout với địa chỉ mới được chọn sẵn (`?address=<id>`). Dùng lại form Phase 4, checkout không kéo thêm JS của ô tỉnh / phường.
   - Form địa chỉ ngay trong checkout (nhúng `AddressForm`). Ít bước hơn nhưng trang nặng hơn và form địa chỉ có hai nơi submit.

5. **Route trang thành công**
   - ★ `/thanh-toan/thanh-cong/[code]` ↔ `/en/checkout/success/[code]` (pathname nội bộ `/checkout/success/[code]`). Cần đăng nhập. Đọc đơn theo `order_code` bằng client theo phiên (RLS chỉ trả đơn của mình), không thấy thì `notFound()`. Đặt `noindex`. Phase 6 thêm link "Xem đơn hàng" sang trang chi tiết đơn.
   - Query `?ma=<code>` trên một trang cố định: URL kém rõ ràng, không lợi gì thêm.
   - Chuyển thẳng sang trang chi tiết đơn của Phase 6: phải làm trước một phần Phase 6.

6. **Vào checkout lúc giỏ khách còn đang chờ gộp** (khách bấm "Thanh toán" → đăng nhập → về `/thanh-toan`. Server render trang trước khi `CartSync` gộp xong nên giỏ trên trang thiếu sách vừa thêm khi còn là khách)
   - ★ Nút "Đặt hàng" bị khóa, hiện "Đang cập nhật giỏ hàng…" trong lúc localStorage còn giỏ khách. `CartSync` gộp xong → `router.refresh()` → trang hiện đúng giỏ → nút mở. Đọc từ store sẵn có, không tốn thêm JS đáng kể.
   - Không xử lý: người bấm nhanh sẽ đặt thiếu sách.

7. **Giỏ có vấn đề ngay lúc mở checkout** (có dòng vượt tồn kho, ngừng bán, hoặc giỏ rỗng; `getCart()` ở server đã biết)
   - ★ Chặn sớm: hiện cảnh báo theo từng dòng + link "Về giỏ hàng để sửa", khóa nút "Đặt hàng". Giỏ rỗng thì hiện `EmptyState` + link về trang chủ. `place_order` vẫn là chốt chặn cuối.
   - Để người dùng bấm rồi `place_order` báo lỗi.

8. **Dữ liệu cho e2e** (đặt hàng thật trừ tồn kho thật trên project Supabase dùng chung)
   - ★ Dùng sách thật. Sau mỗi test, admin chuyển các đơn của user e2e sang `cancelled` (trigger `handle_order_status_change` hoàn lại `stock` và `sold_count`) rồi xóa đơn. `cleanupE2eUsers` / teardown làm việc này **trước** khi xóa user (`orders.user_id` là `on delete set null`, không dọn thì đơn mồ côi và tồn kho bị trừ vĩnh viễn). Riêng `BOOK_UNAVAILABLE`: tạo tạm một sách **ẩn** (`is_active = false`, không bao giờ hiện ra ngoài), xóa ở cuối test. Mỗi project (`desktop-account`, `mobile-account`) dùng sách khác nhau để chạy song song trên CI không giẫm tồn kho của nhau.
   - Tạo sách fixture (đang bán) cho mọi test: không đụng tồn kho thật, nhưng sách lạ hiện trên catalog công khai trong lúc test chạy.

9. **Hiển thị lỗi đặt hàng**
   - ★ Khối `role="alert"` ngay trên nút "Đặt hàng": câu lỗi (đã dịch ở server bằng `withMessage`) + **một** hành động sửa theo mã (bảng ở mục "Mã lỗi"). Focus chuyển vào khối lỗi để trình đọc màn hình đọc ngay.
   - Toast: phải thêm component, dễ biến mất trước khi người dùng đọc kịp.

## Route

| Internal | vi | en |
|---|---|---|
| `(shop)/checkout/page.tsx` | `/thanh-toan` | `/en/checkout` (pathname đã có) |
| `(shop)/checkout/success/[code]/page.tsx` | `/thanh-toan/thanh-cong/[code]` | `/en/checkout/success/[code]` |

- Proxy: thêm `/checkout` vào danh sách cần đăng nhập (`matchLocalized`, khớp cả trang con). Khách → `/dang-nhap?next=%2Fthanh-toan`. Page vẫn `requireUser` (không chỉ dựa vào proxy).
- Cả hai trang: `noindex`, `alternates` hreflang. Trang thành công không có `generateStaticParams`, nên `export const instant = false` như trang sửa địa chỉ ở Phase 4.

## Database (cần chọn 1 ★)

`supabase/migrations/<ngày>_place_order_idempotency.sql` + cập nhật `schema.sql`:
- `orders.idempotency_key uuid` (nullable) + `unique (user_id, idempotency_key)`.
- `place_order(p_address_id, p_payment_method, p_voucher_code, p_note, p_idempotency_key uuid default null, p_expected_total int default null)`. Đổi chữ ký nên phải `drop function` bản 4 tham số rồi tạo lại, cấp lại `grant execute … to authenticated` / `revoke … from public, anon`.
  - (a) Có key: `pg_advisory_xact_lock` theo (user, key), rồi tìm đơn theo key → có thì `return` đơn đó. Request song song cùng key chờ ở khóa này tới khi request đầu commit, rồi thấy đơn của nó. Thay cho "kiểm tra key lần nữa sau vòng khóa giỏ" của bản plan đầu: bản đó trượt khi giỏ có thêm dòng trong lúc chờ (dòng mới làm tổng lệch → `CART_CHANGED` / `OUT_OF_STOCK` thay vì trả đơn cũ).
  - (b) Khóa giỏ + sách, tính tiền (như cũ). Giỏ rỗng → `CART_EMPTY`.
  - (c) `p_expected_total` khác `subtotal + shipping - discount` → `CART_CHANGED` (detail `{"total": …}`), trước khi tăng `used_count` của voucher.
  - (d) `insert` có ghi key. `unique (user_id, idempotency_key)` là chốt cuối.
- Sinh lại `src/types/database.ts`.
- Không đổi RLS.

## Trang `/thanh-toan`

- Static shell: tiêu đề. Idempotency key (`crypto.randomUUID()`) sinh trong phần động, sau khi đọc phiên (xem "Sửa khi duyệt" 2). Phần đọc phiên trong `<Suspense>` với skeleton đúng kích thước. Dữ liệu: `getCart()`, `getCartQuote()`, `getAddresses()` chạy song song (`Promise.all`).
- Bố cục 2 cột như trang giỏ: trái là **Địa chỉ giao hàng** (radio gốc theo từng địa chỉ đã lưu, mặc định chọn sẵn địa chỉ `is_default` hoặc `?address=`, link "Thêm địa chỉ", cần chọn 4 ★), **Ghi chú** (textarea, tối đa 500, đếm ký tự), **Thanh toán** (chỉ "Thanh toán khi nhận hàng (COD)", server tự đặt `cod`, client không gửi). Phải là tóm tắt đơn: các dòng (bìa nhỏ `alt=""`, tên, số lượng, thành tiền), tạm tính / phí giao hàng / tổng từ `quote_order`, link "Sửa giỏ hàng", nút "Đặt hàng" (CTA duy nhất).
- Form là `<form action>` gọi Server Action. Chưa có JS vẫn đặt được (radio + textarea gốc). Có JS thì dùng `useFormAction` (Phase 4): giữ dữ liệu đã nhập khi lỗi, lỗi từng ô, `pending`.
- Client leaf duy nhất: form (nút + khối lỗi + bộ đếm ghi chú + khóa khi chờ gộp giỏ). Phần tóm tắt là Server Component.
- Giỏ có vấn đề / rỗng: theo cần chọn 7 ★.

## Server Action `placeOrder` (`features/checkout/actions.ts`)

`placeOrder(locale, prev, formData)`, locale bind sẵn:
1. Parse bằng zod (`features/checkout/schemas.ts`): `address_id` (số nguyên dương), `note` (trim, ≤ 500, rỗng → null), `idempotency_key` (uuid), `expected_total` (số nguyên ≥ 0, chỉ để so sánh).
2. `getCurrentUser()`; không có → `redirect` sang đăng nhập với `next=/thanh-toan`.
3. ~~`quote_order()` rồi so `expected_total`~~ (bỏ, xem "Sửa khi duyệt" 1).
4. `place_order({ p_address_id, p_note, p_idempotency_key, p_expected_total })`. `p_payment_method` để mặc định `cod`, `p_voucher_code` để null (Phase 9).
5. Thành công: lấy `book_id` của đơn (`order_items` theo `order_id`, một query), `updateTag('book:{id}')` cho từng sách, rồi `redirect` sang trang thành công theo `order_code`.
6. Lỗi: `toFailure` → `withMessage(locale, …)`. `OUT_OF_STOCK` / `BOOK_UNAVAILABLE` thì `updateTag('book:{book_id}')` (cần chọn 2). `INVALID_ADDRESS` / `CART_EMPTY` / `CART_CHANGED` thì `refresh()` để trang hiện trạng thái thật.

Client không gửi giá, phí ship hay tổng để tính tiền (đúng CLAUDE.md). `expected_total` chỉ dùng để so sánh.

## Mã lỗi → UI

| Mã | Khi nào | Câu hiển thị (VD vi) | Cách sửa đưa cho người dùng |
|---|---|---|---|
| `OUT_OF_STOCK` | tồn kho giảm sau khi thêm vào giỏ | Sách "{title}" chỉ còn {stock} cuốn. | Link "Về giỏ hàng để sửa số lượng" (trang giỏ đã có cảnh báo + nút "Giảm còn N") |
| `BOOK_UNAVAILABLE` | sách bị ẩn | Sách "{title}" hiện không còn bán. | Link "Về giỏ hàng để xóa sách này" |
| `INVALID_ADDRESS` | địa chỉ bị xóa / sửa ở tab khác | Địa chỉ này không còn. Hãy chọn địa chỉ khác. | `refresh()`: danh sách địa chỉ cập nhật, focus về nhóm radio; không còn địa chỉ nào thì hiện link "Thêm địa chỉ" |
| `CART_EMPTY` | giỏ trống (đã đặt ở tab khác với key khác, hoặc xóa hết ở tab khác) | Giỏ hàng đang trống. | `refresh()` → trang hiện `EmptyState` + link về trang chủ |
| `INVALID_INPUT` | ghi chú > 500, `address_id` / key hỏng | Lỗi tại ô ghi chú ("Ghi chú tối đa 500 ký tự") | Sửa tại chỗ, không mất nội dung đã nhập |
| `CART_CHANGED` (mới, từ `place_order`) | tổng tiền đổi giữa lúc xem và lúc bấm | Giỏ hàng vừa thay đổi. Kiểm tra lại tổng tiền rồi đặt hàng. | `refresh()` → tóm tắt hiện số mới, bấm lại |
| `AUTH_REQUIRED` | phiên hết hạn | (không hiện) | Chuyển sang đăng nhập, `next=/thanh-toan` |
| `UNKNOWN` | lỗi mạng / DB | Đã có lỗi xảy ra. Vui lòng thử lại. | Bấm lại (cùng idempotency key nên không tạo đơn thứ hai) |

`INVALID_VOUCHER` / `VOUCHER_MIN_ORDER` thuộc Phase 9. `CART_CHANGED` thêm vào danh sách mã lỗi cuối `schema.sql`, `ERROR_CODES` + `messages/*.json → errors` (có test khớp vi/en sẵn).

## Chống bấm 2 lần ở UI

- Có JS: nút disabled + `aria-disabled` + nhãn "Đang đặt hàng…" khi `pending`. `useFormAction` không dispatch khi đang chờ.
- Chưa có JS / gửi lại: cùng idempotency key → `place_order` trả lại đúng đơn → action chuyển sang trang thành công. Người dùng không bao giờ thấy `CART_EMPTY` vì bấm trùng.
- Key mới cho mỗi lần render trang: đặt xong, quay lại checkout (giỏ mới) là đơn mới.

## Trang thành công

- Biểu tượng thành công, "Đặt hàng thành công", mã đơn (to, chọn copy được), ngày đặt (formatter theo locale), "Thanh toán khi nhận hàng: {total}" (format giá theo locale), địa chỉ giao (bản sao trong đơn), danh sách sách (bản sao `title` / `unit_price` / `quantity` trong `order_items`), tạm tính / phí ship / tổng.
- CTA: "Tiếp tục mua sắm" (trang chủ). Phase 6 thêm "Xem đơn hàng".
- Badge giỏ về 0: action `redirect` nên header render lại theo request mới (đọc phiên, không cache chung).
- `metadata`: `noindex`, title "Đặt hàng thành công".

## Cache danh sách (cần chọn 2 ★)

- `features/books/queries.ts`: sau khi query xong, `cacheTag(...rows.map((b) => 'book:' + b.id))` trong `listBooks`, `getNewBooks`, `getRelatedBooks`, `searchBookHits` (giữ tag `books` cho admin Phase 7).
- `place_order` thành công → `updateTag('book:{id}')` cho từng sách trong đơn (`features/checkout/actions.ts`).
- Phase 6 (`cancel_order` hoàn kho) dùng cùng cách.

## Messages

Namespace `checkout` (tiêu đề, địa chỉ, thêm địa chỉ, ghi chú + bộ đếm, COD, tóm tắt, sửa giỏ, đặt hàng / đang đặt, chờ gộp giỏ, cảnh báo giỏ có vấn đề, link sửa theo mã lỗi) và `order` (trang thành công). `errors.CART_CHANGED`, `validation.note`. Cùng bộ key vi/en.

## JS

Ước tính trang checkout: `useFormAction` + form leaf ≈ +2KB so với trang giỏ. Trang sách không đổi (chỉ thêm tag ở server). Đo `measure:js -- vi/checkout` và `vi/books/<slug>`, báo cáo.

## Test

- Vitest: `checkoutSchema` (note trim / rỗng → null / > 500, `address_id`, uuid, `expected_total`); `errors.CART_CHANGED` có bản dịch (test sẵn có).
- e2e `e2e/checkout.spec.ts`, chạy trên `desktop-account` / `mobile-account` (`testMatch` của hai project thêm `checkout\.spec\.ts`, `desktop` / `mobile` bỏ qua file này). Chạy tuần tự trong file. `afterEach` hủy + xóa đơn của user e2e (cần chọn 8 ★).
  - **Luồng mua COD đầy đủ**: khách thêm sách ở trang sách → `/gio-hang` → "Thanh toán" → chuyển sang đăng nhập (`next=/thanh-toan`) → đăng nhập → về `/thanh-toan`, chờ gộp giỏ (nút mở lại) → giỏ có sách vừa thêm → địa chỉ mặc định được chọn sẵn → nhập ghi chú → "Đặt hàng" → trang thành công: mã đơn, tổng khớp `quote_order`, địa chỉ, sách → badge giỏ không còn số → DB: một đơn `pending` / `cod` / `unpaid`, ghi chú đúng, giỏ tài khoản rỗng, `stock` của sách giảm đúng số lượng → **mở lại trang sách thấy tồn kho mới** (sách tồn kho ≤ 5 để có nhãn "Chỉ còn N cuốn"; kiểm tra `updateTag`). Không lỗi console.
  - Chưa có địa chỉ → link "Thêm địa chỉ" → lưu → quay lại `/thanh-toan` với địa chỉ mới được chọn sẵn.
  - Bấm "Đặt hàng" 2 lần liên tiếp (double click) → đúng 1 đơn, tới trang thành công, không hiện lỗi.
  - Cùng idempotency key gửi 2 lần song song (gọi RPC bằng phiên của user e2e trong `scripts/e2e-user.ts`) → cùng một `order_id`.
  - Gửi lại cùng key + cùng `p_expected_total` **sau khi** đơn đã tạo (giỏ đã rỗng) → trả đúng đơn cũ, không `CART_CHANGED` / `CART_EMPTY`.
  - `OUT_OF_STOCK`: admin đặt số lượng trong giỏ = `stock + 1` → đặt hàng → thông báo đúng tên + tồn kho → link về giỏ → giỏ có cảnh báo "Chỉ còn N cuốn" + "Giảm còn N".
  - `BOOK_UNAVAILABLE`: sách ẩn tạo tạm, thêm vào giỏ bằng admin → checkout chặn sớm (cần chọn 7). Gọi thẳng action bằng form khi trang đã mở trước lúc ẩn sách (ẩn sau khi mở trang) → thông báo + link về giỏ.
  - `INVALID_ADDRESS`: mở checkout, admin xóa địa chỉ đang chọn → đặt hàng → thông báo, danh sách địa chỉ cập nhật.
  - `CART_EMPTY`: mở checkout ở 2 tab, đặt ở tab A → tab B đặt → "Giỏ hàng đang trống", trang chuyển về trạng thái rỗng.
  - `CART_CHANGED`: mở checkout, đổi số lượng ở tab khác → đặt hàng → thông báo, tổng mới hiện ra, bấm lại thì đặt được.
  - Ghi chú 501 ký tự → lỗi tại ô, không mất nội dung.
  - Khách vào `/thanh-toan` → `/dang-nhap?next=%2Fthanh-toan`. `/en/checkout` hiện giá `₫…`.
- `scripts/e2e-user.ts` (đã được duyệt đọc env) thêm: `seedAddress`, `setCartItem`, `cancelAndDeleteOrders`, `createHiddenBook` / `deleteBook`, `stockOf`. `cleanupE2eUsers` gọi `cancelAndDeleteOrders` trước khi xóa user.

## Việc của chủ dự án

Migration: `supabase/migrations/20261015120000_place_order_idempotency.sql` (chờ kiểm tra trước khi chạy). Trong lúc chờ, tôi làm phần không phụ thuộc chữ ký `place_order` mới.

1. Supabase Dashboard → SQL Editor → dán toàn bộ file migration → Run. File tự bọc `begin … commit`, chạy lại vẫn an toàn.
2. Kiểm tra: `select pg_get_function_identity_arguments('public.place_order'::regproc);` ra 6 tham số (`…, p_idempotency_key uuid, p_expected_total integer`), và `\d public.orders` (hoặc Table Editor) có cột `idempotency_key`.
3. Sinh lại types: `npx supabase gen types typescript --project-id <ID> > src/types/database.ts` → `Functions.place_order.Args` có `p_idempotency_key?`, `p_expected_total?`; `orders.Row` có `idempotency_key`.
4. Báo tôi để nối action vào RPC mới và chạy e2e.

## Tiến độ

- [x] Migration `place_order` idempotency + `p_expected_total` + `schema.sql` (viết xong; chờ bạn kiểm tra, chạy SQL, sinh types)
- [ ] Proxy `/checkout`, routing `/checkout/success/[code]`
- [ ] Tag `book:{id}` cho cache danh sách
- [ ] `features/checkout/{schemas,actions}.ts` + Vitest
- [ ] Trang `/thanh-toan`: địa chỉ, ghi chú, tóm tắt, form + lỗi, chờ gộp giỏ, chặn sớm
- [ ] `createAddress` nhận `next`
- [ ] Trang thành công
- [ ] Messages `checkout`, `order`, `errors.CART_CHANGED`
- [ ] e2e `checkout.spec.ts` + helper `scripts/e2e-user.ts`, dọn đơn trong teardown
- [ ] typecheck / lint / build / test / e2e sạch; `measure:js`; báo cáo
