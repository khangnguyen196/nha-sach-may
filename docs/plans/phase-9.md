# Phase 9: Đánh giá, voucher ở checkout, VietQR, email theo locale

Trạng thái: **xong trên nhánh `phase-9`, chờ migration + duyệt** (đêm 2026-10-16, chủ dự án vắng: plan tự duyệt, chọn hết ★; lựa chọn ngoài Lộ trình ở "Quyết định tự chọn — duyệt cuối").

## Báo cáo (2026-10-16)

**Đã xong**: voucher ở checkout (URL), chuyển khoản VietQR (QR vẽ ở server, thông tin demo + cảnh báo), admin "Đã nhận tiền" + hủy đơn đã trả → hoàn tiền, email đơn hàng theo `profiles.locale` (chỉ log khi chưa có Resend), trang trung gian `/xac-nhan` cho link email auth + 2 template song ngữ, ô "Ngôn ngữ email" ghi cả `user_metadata.locale`, đánh giá (danh sách, viết / sửa / xóa, điểm trung bình ở trang sách), kiểm duyệt `/admin/danh-gia`.

**Chờ migration** (`supabase/migrations/20261016020000_payments_email.sql`):
- e2e `checkout.spec` "RPC: khách không tự hủy được đơn đã thanh toán" (desktop + mobile) và `admin-vouchers.spec` "không sửa được used_count": **fail cho tới khi chạy migration** (đúng dự kiến). UI đã ẩn nút hủy đơn đã trả từ Phase 6.
- Email khi admin đổi trạng thái / xác nhận tiền: cần RPC `order_contact`; trước migration chỉ ghi log lỗi `[email] … order_contact`, không ảnh hưởng thao tác.
- (Từ Phase 8) admin upload bìa ghi `cover_width`.

**Kiểm tra**
- `typecheck`, `lint`, `build`: sạch. Vitest: 44 file / 355 test.
- e2e đầy đủ lượt 1: 150 qua, 8 fail, 40 không chạy (serial). Sửa: locator nút "Đặt hàng" trong test cũ (nút "Áp dụng" của ô mã giờ cũng nằm trong khối tóm tắt → `button[type="submit"]:not([form])`), test đánh giá bấm vào nhãn sao (radio ẩn), nhãn "Hủy đơn hàng". Lượt 2 (`desktop-account`, `mobile-account`): 92 qua; lượt 3 (`checkout` + `reviews`): 40 qua, 2 fail **chờ migration**. Admin (lượt 1): mọi test mới qua; 2 fail **chờ migration** (upload bìa `cover_width`, quyền cột `vouchers`).
- `measure:js`: trang chủ + 39.1KB (không đổi), trang sách + **41.8KB** (trước 39.7: +2.1KB do chunk form đánh giá được Next liệt kê trong HTML của trang dù form nằm trong Suspense theo phiên). Trong ngân sách 50KB.

**Việc của bạn**: `owner-todo.md` (migration, 2 template email, Resend / VietQR tùy chọn).

---


Phạm vi (Lộ trình CLAUDE.md): đánh giá sách đã nhận, voucher ở checkout, thanh toán chuyển khoản VietQR (khách không tự hủy đơn đã thanh toán; quyền cột `vouchers`), email theo locale, trang trung gian "Xác nhận" cho link trong email auth.

**Không** có: hoàn tiền tự động / đối soát ngân hàng (admin bấm "Đã nhận tiền" bằng tay), email marketing, ảnh trong đánh giá, lọc catalog theo điểm, captcha.

## Hiện trạng

- `reviews` đã có từ schema gốc: RLS chỉ cho insert khi user có đơn `delivered` chứa sách; quyền cột chỉ `rating`, `content`; trigger tính `avg_rating`, `review_count` vào `books`. App chưa có UI.
- `quote_order(p_voucher_code)` / `place_order(p_voucher_code)` đã nhận voucher; checkout chưa có ô nhập. Admin voucher xong từ 7b.
- `payment_method` có sẵn `cod`, `bank_transfer`; `payment_status` có `unpaid`, `paid`, `refunded`. Checkout chỉ COD; `canCancel` (Phase 6) đã ẩn nút hủy khi `paid`.
- Email: chỉ có email auth của Supabase (template trong `phase-4.md`, link GET `/api/auth/confirm` tiêu thụ token ngay). Chưa có email đơn hàng. `profiles.locale` có ô chọn ở trang tài khoản.

## Có cần migration không

**Có**, `supabase/migrations/20261016020000_payments_email.sql` (+ `schema.sql`, types):

1. `cancel_order`: thêm `and payment_status <> 'paid'` vào câu `update` (cùng mã `ORDER_NOT_CANCELLABLE`). Đơn COD luôn `unpaid` tới khi giao → hành vi cũ giữ nguyên.
2. Quyền cột `vouchers`: `revoke update` rồi `grant update (code, description, description_en, discount_type, discount_value, max_discount, min_order_value, usage_limit, starts_at, ends_at, is_active)`. Bỏ `used_count` (do `place_order` / trigger hủy đơn quản lý, đều `security definer`) và `created_at`. Insert giữ nguyên (form tạo không gửi `used_count`).
3. RPC `order_contact(p_order_id)` → `(email, locale)`: email người đặt (đọc `auth.users`, nên `security definer`) + `profiles.locale`; chỉ trả khi đơn của chính user **hoặc** người gọi là admin, ngược lại 0 dòng. Dùng để gửi email khi admin đổi trạng thái (app không có service role, `profiles` không có email). `revoke` khỏi `public, anon`, `grant` cho `authenticated`.

Idempotent (`create or replace`, `revoke` / `grant`), không đổi dữ liệu.

## Cần chọn (★ = đã chọn)

1. **Đánh giá: hiển thị**
   - ★ Trang sách: điểm trung bình + số đánh giá dưới tên sách (từ `books.avg_rating`, `review_count`, có sẵn trong cache `book:{id}`); khối "Đánh giá" dưới phần chi tiết, trong `<Suspense>` (skeleton đúng cỡ), 20 đánh giá mới nhất + tổng số. Query `getBookReviews(bookId)` `'use cache'` tag `book:{id}` → ghi / xóa đánh giá gọi `updateTag('book:{id}')` (cũng làm mới điểm ở BookCard nếu sau này hiện).
   - Phân trang đánh giá qua `?reviews=2`: catalog nhỏ, chưa có đánh giá nào → để sau.
2. **Đánh giá: viết / sửa / xóa**
   - ★ Phần theo phiên trong `<Suspense>` riêng (static shell của trang sách không đổi): chưa đăng nhập → link đăng nhập (`?next=` về trang sách); chưa nhận sách → câu giải thích; đủ điều kiện → form (5 radio sao, không JS vẫn gửi được; nội dung ≤ 2000); đã viết → hiện đánh giá của mình + sửa / xóa. Client leaf nhỏ (`useFormAction`), chỉ tải khi form được render (không vào HTML prerender → `measure:js` trang sách không đổi).
   - Server Action `saveReview`: zod (`rating` 1–5, `content` ≤ 2000, rỗng → null) → có đánh giá của mình thì `update`, chưa có thì `insert` (RLS chặn người chưa nhận sách: `42501` → mã `REVIEW_NOT_ALLOWED`). `deleteReview`. Cả hai `updateTag('book:{id}')` + `refresh()`.
   - Chỉ cho đánh giá từ trang tài khoản (đơn đã giao): ít người thấy.
3. **Đánh giá: kiểm duyệt**
   - ★ `/admin/danh-gia`: 25 đánh giá mới nhất / trang (sách, tên hiển thị, điểm, nội dung, ngày) + nút xóa (`assertAdmin`, policy `reviews_delete_own_or_admin` có sẵn). Lọc theo số sao qua URL.
   - Không có trang admin: xóa bằng SQL. Nội dung công khai do người dùng viết thì cần cách gỡ nhanh.
4. **Voucher ở checkout**
   - ★ Mã nằm trên URL: `/thanh-toan?voucher=ABC`. Form GET nhỏ "Mã giảm giá" ở cột tóm tắt (giữ `?address=`), không JS vẫn chạy. Server gọi `quote_order(voucher)`: hợp lệ → dòng "Giảm giá" trong tóm tắt + hidden `voucher_code` trong form đặt hàng; lỗi (`INVALID_VOUCHER`, `VOUCHER_MIN_ORDER` kèm số tiền tối thiểu) → thông báo dưới ô, tóm tắt tính không voucher. "Bỏ mã" là link không có `voucher`. Mã chỉ nhận `[A-Z0-9_-]{3,30}` (viết HOA), sai dạng coi như không có.
   - `place_order(p_voucher_code)`: lỗi voucher lúc đặt (vừa hết lượt) → `refresh()` + thông báo, như `CART_CHANGED`. Tổng dự kiến đã gồm giảm giá.
   - Ô nhập trong form đặt hàng + client gọi `quote_order`: cần thêm client state và một action; URL đã đủ.
5. **VietQR: tạo mã QR**
   - ★ Tự dựng payload EMVCo / NAPAS (VietQR) ở server (hàm thuần + CRC16-CCITT, Vitest với payload mẫu) và vẽ QR thành SVG ở server bằng **`uqr`** (0 dependency, MIT, ~79KB unpacked, chỉ chạy ở server → 0 KB JS client). Không gọi dịch vụ ngoài.
   - Ảnh từ `img.vietqr.io`: không cần thư viện, nhưng mỗi lượt xem gửi số tài khoản + số tiền + mã đơn sang bên thứ ba, phụ thuộc mạng ngoài (e2e), và là hotlink.
   - Viết tay bộ mã hóa QR: ~500 dòng (Reed–Solomon, mask) chỉ để tránh một dependency nhỏ chạy ở server.
6. **VietQR: thông tin tài khoản**
   - ★ `features/payments/bank.ts`: đọc `VIETQR_BANK_BIN`, `VIETQR_BANK_NAME`, `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME` (server-only, tùy chọn); thiếu thì dùng **thông tin demo** và luôn hiện khung cảnh báo "Dự án học tập — thông tin chuyển khoản là demo, đừng chuyển tiền thật". Nội dung chuyển khoản = mã đơn (`NS…`).
   - Bắt buộc có env: chặn `build` / checkout khi chủ dự án chưa có tài khoản ngân hàng.
7. **VietQR: xác nhận thanh toán**
   - ★ Admin bấm "Đã nhận tiền" ở chi tiết đơn (đơn `bank_transfer`, `unpaid`, chưa hủy): update có điều kiện `payment_status = 'unpaid'` (0 dòng → `ORDER_STATUS_CHANGED` + `refresh()`, như đổi trạng thái). Khách không tự hủy được nữa (migration mục 1).
   - Admin hủy đơn đã thanh toán: cùng câu update đặt `payment_status = 'refunded'` (ghi chú ở form: hoàn tiền ngoài hệ thống). Chặn hẳn hủy đơn đã thanh toán thì admin không có cách nào xử lý đơn không giao được.
   - Webhook ngân hàng (Casso, SePay…): cần tài khoản dịch vụ, ngoài phạm vi.
8. **Email: gửi bằng gì**
   - ★ `lib/email.ts` (`server-only`): có `RESEND_API_KEY` + `EMAIL_FROM` → gọi REST API của Resend bằng `fetch` (không SDK, 0 dependency); thiếu → **chỉ ghi log** (`[email] to=n***@… subject=…`, không in nội dung). Gửi trong `after()` (sau khi trả phản hồi): email lỗi không làm hỏng đặt hàng, chỉ log.
   - SMTP qua nodemailer: thêm dependency, cần nhiều biến hơn.
9. **Email đơn hàng: khi nào, ngôn ngữ nào**
   - ★ Gửi khi: đặt hàng thành công, khách tự hủy, admin chuyển `confirmed` / `shipping` / `delivered` / `cancelled`, admin xác nhận đã nhận tiền. Ngôn ngữ = `profiles.locale` của người đặt (CLAUDE.md). Nội dung: mã đơn, trạng thái, danh sách sách, tổng tiền, link chi tiết đơn đúng locale; đơn chuyển khoản chưa trả thì kèm thông tin chuyển khoản (không kèm ảnh QR: nhiều trình đọc thư chặn ảnh inline / data URI).
   - Chuỗi trong `messages/*.json → email` (cả hai file, cùng bộ key). HTML tối giản, style inline (trình đọc thư không hiểu CSS variables): bảng màu email đặt ở **một** hằng trong `features/orders/emails.ts` (ngoại lệ "không hard-code màu", ghi CLAUDE.md).
   - Link tuyệt đối cần URL gốc: `siteUrl()` (`lib/site-url.ts`) = `SITE_URL` → `https://$VERCEL_PROJECT_PRODUCTION_URL` → `http://localhost:3000`. Phase 10 dùng lại cho sitemap / metadataBase.
10. **Email auth: trang trung gian "Xác nhận"**
    - ★ Trang `/xac-nhan` (`/en/confirm`, group `(auth)`): đọc `token_hash`, `type`, `next` từ URL, chỉ hiện nút "Xác nhận" (form POST tới `/api/auth/confirm`). `POST /api/auth/confirm` mới là chỗ gọi `verifyOtp` rồi chuyển hướng 303. `GET /api/auth/confirm` (link trong email cũ) **không tiêu thụ token** nữa: chuyển 307 sang trang trung gian đúng locale, giữ nguyên tham số → template email hiện tại vẫn chạy, trình quét link không dùng mất token.
    - Template email auth song ngữ theo `{{ .Data.locale }}` (Go template `if eq`) trong `supabase/templates/*.html`; chủ dự án dán vào Dashboard (owner-todo).
    - Ô "Ngôn ngữ email" ở trang tài khoản ghi thêm `user_metadata.locale` (`auth.updateUser`) để email auth đổi theo, không chỉ email đơn hàng.

## Thiết kế

- Mã lỗi mới (vi + en, `ERROR_CODES`): `REVIEW_NOT_ALLOWED`. "Đã nhận tiền" bấm trên dữ liệu cũ dùng lại `ORDER_STATUS_CHANGED`.
- `checkoutSchema` thêm `payment_method` (`cod` | `bank_transfer`, mặc định `cod`) và `voucher_code` (tùy chọn, cùng regex với admin; regex chuyển sang `features/checkout/voucher.ts` dùng chung).
- Trang thành công / chi tiết đơn: đơn `bank_transfer` + `unpaid` + chưa hủy → thẻ VietQR (QR SVG, ngân hàng, số tài khoản, chủ tài khoản, số tiền, nội dung = mã đơn, cảnh báo demo). Phương thức thanh toán hiện đúng (bỏ "luôn COD").
- `getCartQuote(voucher?)` trả thêm `discount` và lỗi voucher (không throw).

## File sẽ tạo / sửa

- `supabase/migrations/20261016020000_payments_email.sql`, `supabase/schema.sql`, `src/types/database.ts`, `supabase/templates/{confirm-signup,reset-password}.html`
- `src/features/reviews/{queries,actions,schemas,schemas.test}.ts`, `components/{review-list,review-form,rating-stars}.tsx`; trang sách
- `src/app/admin/danh-gia/page.tsx`, `src/features/admin/reviews/*`, `admin-nav`
- `src/features/checkout/*` (schema, action, `payment-method.tsx` → radio, `voucher-form.tsx`, `voucher.ts`), `src/features/cart/queries.ts` (`getCartQuote(voucher)`)
- `src/features/payments/{vietqr,vietqr.test,bank}.ts`, `components/vietqr-card.tsx`
- `src/lib/{email,site-url}.ts` (+ test), `src/features/orders/emails.ts` (+ test), gọi từ `checkout/actions`, `orders/actions`, `admin/orders/actions`
- `src/app/[locale]/(auth)/confirm/page.tsx`, `src/app/api/auth/confirm/route.ts`, `src/i18n/routing.ts`, `features/account/actions.ts`
- `messages/{vi,en}.json` (`review`, `email`, `checkout`, `payment`, `errors`, `admin`), `scripts/check-env.mjs` (biến tùy chọn mới), `.env.example`
- e2e: `reviews.spec.ts`, `checkout.spec.ts` (voucher, chuyển khoản), `admin-orders.spec.ts` (đã nhận tiền), `admin-reviews.spec.ts`, `account.spec.ts` (link xác nhận qua trang trung gian)

## Test

- Vitest: payload VietQR (CRC, độ dài trường, mã đơn, số tiền), schema review / checkout (voucher, payment_method), `maskEmail`, nội dung email (vi / en, đủ key), `siteUrl`, test tĩnh `assertAdmin` phủ action mới (có sẵn).
- e2e: đặt hàng chuyển khoản → thẻ VietQR ở trang thành công + chi tiết đơn; admin "Đã nhận tiền" → khách không còn nút hủy; voucher hợp lệ / sai / chưa đủ tối thiểu ở checkout; viết / sửa / xóa đánh giá (user có đơn `delivered` qua service role); user chưa nhận sách không thấy form; admin xóa đánh giá; link xác nhận qua trang trung gian.
- Phần chờ migration (ghi rõ trong báo cáo): khách tự hủy đơn `paid` bị DB chặn; admin không sửa được `used_count` bằng PostgREST; email khi admin đổi trạng thái lấy địa chỉ qua `order_contact`.

## Việc của chủ dự án

Xem `owner-todo.md`: chạy migration, dán 2 template email auth, (tùy chọn) tài khoản Resend + domain, (tùy chọn) thông tin VietQR thật.

## Giới hạn / rủi ro đã biết

- Không có đối soát: admin phải tự kiểm tra sao kê trước khi bấm "Đã nhận tiền". Đơn chuyển khoản chưa trả giữ tồn kho tới khi admin hủy.
- Email gửi trong `after()`: lỗi gửi chỉ có trong log, không thử lại.
- Template email auth của Supabase là một bản cho mọi user (chọn ngôn ngữ bằng `if` trong template), không dùng `messages/*.json`.

## Quyết định tự chọn — duyệt cuối

| # | Lựa chọn | Lý do | Phương án khác |
|---|---|---|---|
| 1 | Chọn hết ★ (1–10) ở trên | theo `night.md` | |
| 2 | Voucher qua URL `?voucher=` + form GET riêng; ô và nút nằm trong cột tóm tắt (bên trong form đặt hàng) và gắn vào form GET bằng thuộc tính `form="checkout-voucher"` | form lồng nhau không hợp lệ; giữ bố cục (ô mã ngay trên nút đặt hàng) mà vẫn chạy không cần JS | đặt form mã ở ngoài cột tóm tắt (dưới cùng trang); hoặc Server Action + client state |
| 3 | Áp mã giữ `?address=` (địa chỉ server đang chọn), không giữ radio vừa đổi mà chưa đặt hàng | form GET không đọc được radio của form khác khi không có JS | JS đồng bộ radio vào form GET |
| 4 | Regex mã voucher dùng chung `features/checkout/voucher.ts` (admin import lại) | một nguồn cho cùng một ràng buộc DB | để hai bản |
| 5 | **Dependency mới `uqr` 0.1.3** (MIT, 0 dependency, ~79KB unpacked) chỉ ở server; QR vẽ bằng JSX từ ma trận `encode()` (không `dangerouslySetInnerHTML`) | 0KB JS client; không gửi số tài khoản / số tiền sang dịch vụ ngoài | `img.vietqr.io` (hotlink, lộ dữ liệu đơn), tự viết bộ mã hóa QR |
| 6 | Tài khoản demo: Vietcombank (BIN 970436), STK `0000000000`, tên `NHA SACH MAY DEMO`, luôn có khung cảnh báo; đủ 4 biến `VIETQR_*` mới dùng thông tin thật (thiếu một biến → demo cả nhóm) | số tài khoản toàn số 0 không tồn tại → quét nhầm cũng không chuyển được tiền | số tài khoản ngẫu nhiên (có thể là tài khoản thật của người khác) |
| 7 | Admin "Đã nhận tiền" dùng lại `AdvanceOrderForm` (luôn render, nhãn `null` khi không còn bấm được) | thông báo kết quả còn sau `refresh()` | component riêng |
| 8 | Admin hủy đơn đã thanh toán → hai câu update (hủy có điều kiện, rồi `paid → refunded`); câu thứ hai lỗi chỉ log | PostgREST không đặt cột theo điều kiện trong một câu; hiếm khi lỗi | RPC `cancel_order_admin` (thêm migration) |
| 9 | Email: Resend REST qua `fetch` (không SDK), thiếu env → chỉ log; gửi trong `after()` | 0 dependency; dự án chạy được không cần dịch vụ | nodemailer + SMTP; Supabase Edge Function |
| 10 | Người nhận email: khách tự đặt / tự hủy → email trong phiên + `profiles.locale` (chạy được trước migration); admin đổi trạng thái → RPC `order_contact` (**chờ migration**, trước đó chỉ log lỗi) | không cần service role trong app | cột `orders.email` chụp lúc đặt (phải viết lại `place_order`) |
| 11 | Gửi lại cùng idempotency key (đơn đã có) vẫn gửi email "đã nhận đơn" lần nữa | `place_order` không báo đơn mới hay cũ; hiếm (bấm hai lần đã bị chặn ở client) | so `created_at` với thời điểm gọi |
| 12 | Màu email là hằng `EMAIL_COLORS` trong `email-template.ts` (theo bảng light) | trình đọc thư không hiểu CSS variables | |
| 13 | Email đơn chuyển khoản kèm thông tin chuyển khoản dạng chữ, không kèm ảnh QR | nhiều trình đọc thư chặn ảnh inline / data URI | ảnh QR PNG đính kèm (cần thư viện vẽ PNG) |
| 14 | `POST /api/auth/confirm` kiểm header `Origin` (khác origin → coi như link hỏng) | chặn trang khác tự POST token của kẻ tấn công (login CSRF) | token CSRF trong form |
| 15 | Template email auth song ngữ (Go template `if eq .Data.locale "en"`), vẫn trỏ `/api/auth/confirm` | template cũ đang dán vẫn chạy (GET giờ chỉ chuyển trang) | trỏ thẳng `/xac-nhan` (phải chọn đường dẫn theo locale trong template) |
| 16 | Đánh giá: 20 mới nhất, không phân trang; form ngay ở trang sách; chọn sao bằng 5 radio (sao + số, sao được chọn tô màu) | 0 JS cho phần chọn sao; catalog chưa có đánh giá | trang "viết đánh giá" riêng từ đơn đã giao; tô dần các sao (cần JS / CSS phức tạp) |
| 17 | Không thêm cột / bảng cho đánh giá; `display_name` vẫn chỉ điền lúc tạo (đổi tên sau không cập nhật) | trigger có sẵn | trigger update theo profile |
| 18 | Token màu mới `qr`, `qr-background` (giống nhau ở hai theme) | QR phải tối trên nền sáng để quét được | |
| 19 | Đổi tên migration theo ngày thật (`20261016020000_payments_email.sql`) | | |

## Tiến độ

- [x] Migration + `schema.sql` + types (sửa tay; **chưa chạy**)
- [x] Voucher ở checkout
- [x] VietQR: chọn phương thức, payload + QR, thẻ ở trang thành công / chi tiết, admin "Đã nhận tiền"
- [x] Email: `lib/email.ts`, email đơn hàng, `order_contact` (chờ migration)
- [x] Trang trung gian xác nhận + template email auth + `user_metadata.locale`
- [x] Đánh giá: hiển thị, viết / sửa / xóa, admin
- [x] e2e; typecheck / lint / build / test / e2e (trừ 4 test chờ migration); `measure:js`; báo cáo
