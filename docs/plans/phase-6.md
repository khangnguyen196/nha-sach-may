# Phase 6: Tài khoản: đơn hàng

Trạng thái: **đã xong, đã merge vào `main`** (2026-10-15). Sau duyệt: `fault-injection` luôn tắt khi `VERCEL_ENV=production` (có Vitest); rủi ro trùng sách e2e ghi vào lộ trình Phase 10; 3 đề xuất CLAUDE.md đã áp dụng. Plan đã duyệt: chọn hết các ★, bổ sung 2 điểm (xem "Bổ sung khi duyệt").

## Báo cáo (2026-10-15)

**Đã xong**: toàn bộ Phase 6 + 2 điểm bổ sung.
- `/tai-khoan/don-hang` (`/en/account/orders`): lọc theo trạng thái bằng link (`?status=pending|processing|delivered|cancelled`), phân trang 10 đơn (`?page=`, vượt quá → 404), rỗng theo từng bộ lọc, mỗi dòng là một link (mã, nhãn trạng thái, tối đa 3 bìa, tên sách đầu + "và N sách khác", ngày, tổng).
- `/tai-khoan/don-hang/[code]`: nhãn + câu giải thích theo trạng thái, lý do hủy, `OrderDetails` dùng chung với trang thành công; khối hủy `<details>` + lý do (≤ 500, bộ đếm) chạy được không cần JS. Hủy xong `updateTag('book:{id}')` từng sách + `refresh()`. Cửa hàng xác nhận trong lúc đang mở trang → "Đơn hàng này không thể hủy.", trang hiện trạng thái mới.
- Trang thành công có thêm "Xem đơn hàng"; trang tài khoản có thẻ "Đơn hàng của tôi"; checkout dùng chung `expireOrderBooks`.
- Nút hủy chỉ hiện khi `canCancel` (`pending` và chưa `paid`); lộ trình Phase 9 trong CLAUDE.md ghi migration `cancel_order`.
- Trang lỗi song ngữ: `[locale]/error.tsx`, `(shop)/error.tsx` (giữ header + footer), `global-error.tsx`, `admin/error.tsx`. Nút "Thử lại" (`retry()`), link về trang chủ, focus vào tiêu đề, không lộ chi tiết lỗi; Next log ở server (`⨯ Error: listOrders: … digest: '…'`).

**Việc của bạn**: không có migration. Chỉ lưu ý: **không đặt `E2E_FAULT_INJECTION` trên Vercel** (xem rủi ro 2).

**Quyết định tự chọn / lệch plan**:
1. e2e có **user thứ ba** mỗi project (`orders`, phiên ở `e2e/.auth/<project>-orders.json`) thay vì dùng user checkout: `checkout.spec` hủy + xóa mọi đơn của user checkout sau mỗi test, chạy song song trên CI sẽ xóa đơn của `orders.spec`.
2. `cancelOrder(locale, orderId, code, …)`: bind thêm mã đơn để phiên hết hạn thì chuyển đăng nhập với `next` là đúng trang chi tiết (mã sai định dạng → danh sách).
3. `CancelOrderForm` luôn render ở cùng vị trí trong cây (kể cả khi `cancellable = false`): sau `refresh()` component không bị gỡ nên thông báo kết quả ("Đã hủy đơn hàng." / "Đơn hàng này không thể hủy.") vẫn hiện.
4. Tiêu đề (metadata) trang chi tiết lấy mã từ URL, không query → bỏ `React.cache` cho `getOrderByCode` (không còn lời gọi thứ hai).
5. `optionalMultilineText` (`lib/text-schema.ts`: CRLF → LF, trim, ≤ max, rỗng → null) dùng chung ghi chú checkout và lý do hủy (2 chỗ dùng thật).
6. Phương thức thanh toán ở trang chi tiết luôn là COD (chỉ có COD tới Phase 9).
7. Breadcrumb trang chi tiết dừng ở "Đơn hàng của tôi" (mã đơn đã nằm ở h1, đọc mã ở shell sẽ phải chờ params).
8. **Bundle (phát hiện khi đo)**: Turbopack tải `global-error` ở mọi trang dưới dạng một nhóm chunk riêng và **chép lại** mọi module nó import thay vì dùng chung với layout. Bản đầu (import `hasLocale` của next-intl, `Button` → radix Slot, `ThemeProvider` → next-themes, routing, lucide) đưa trang chủ từ +35.4KB lên **+56.7KB** (vượt ngân sách 50KB). Sửa: `ErrorView` chỉ dùng thẻ thường + SVG inline (cùng path lucide), `global-error` tự đọc `localStorage.theme` thay vì `ThemeProvider`, đường dẫn trang chủ chép cạnh chuỗi (Vitest khớp với `localizedPath`). Còn +38.0KB.

**Giới hạn / rủi ro đã biết**:
1. Test hủy đơn đưa tồn kho một cuốn (6–98) xuống 3 trong vài giây; trên CI chạy song song, nếu `checkout.spec` chọn sách tồn kho 2–5 đúng lúc đó thì có thể trùng sách. Local (1 worker) không bị.
2. Tiêm lỗi e2e nằm trong `src/` (`lib/supabase/fault-injection.ts`), chỉ bật khi `E2E_FAULT_INJECTION=1`. Đặt biến này ở production thì ai cũng tự làm hỏng trang của chính mình bằng cookie (không ảnh hưởng người khác, nhưng không nên).
3. Trang lỗi trả HTTP 200 (Cache Components stream trước khi lỗi), cùng vấn đề với 404 ghi ở Phase 10.
4. `global-error` áp theme sáng sau khi hydrate (`useLayoutEffect`): lỗi root layout lúc SSR ở light mode có thể nháy nền tối một khung. Lỗi root layout gần như không xảy ra (header đã nuốt lỗi của giỏ / phiên).

**Kết quả kiểm tra**:
- `typecheck`, `lint`, `build`: sạch.
- `test` (Vitest): 209/209 (thêm tham số `?status=` / `?page=`, `canCancel`, `cancelOrderSchema` trim / rỗng / 500 / 501 / CRLF, `orderIdSchema`, chuỗi `global-error` khớp `errorPage` + `homeHref` khớp `localizedPath`).
- `test:e2e` toàn bộ lần 1: 143/144, fail `layout.spec` palette "từ khóa vô nghĩa" (dừng ở "Searching…" quá 5s: `/api/search` → Supabase chậm, không liên quan Phase 6). Lần 2 (sau ~15 phút, trên code cuối): **144/144**.
- e2e mới: `orders.spec.ts` 8 test × 2 project, `error-page.spec.ts` 3 test × 2 project.
- Xem tay (spec Playwright tạm, không commit; bản build production; desktop + mobile, dark + light): danh sách (sửa dòng đơn trên mobile cho gọn, cột chữ thẳng hàng, skeleton theo số đo 138 / 116px), chi tiết đang chờ (mở khối hủy), đơn đã hủy kèm lý do, `/en` lọc "In progress", trang tài khoản, trang lỗi `(shop)`, `global-error` vi / en (ép lỗi tạm ở header) + "Try again" tải lại được.

**Số đo JS** (`measure:js`, gzip, baseline 170KB):

| Route | Tổng | Ngoài baseline | 5b |
|---|---|---|---|
| `vi` | 208.0KB | 38.0KB | 35.4KB |
| `en` | 208.0KB | 38.0KB | |
| `vi/books/<slug>` | 208.7KB | 38.7KB | 36.1KB |
| `vi/cart` | 212.2KB | 42.2KB | 39.6KB |
| `vi/checkout` | 210.2KB | 40.2KB | 37.5KB |

+2.6KB đều trên mọi trang = chunk `global-error` + context chuỗi lỗi + `LocaleError`. Trang đơn hàng không prerender theo user nên không đo.

**Đề xuất cập nhật CLAUDE.md** (đã duyệt, đã áp dụng):
- Trang lỗi: chuỗi `errorPage` đi qua `ErrorMessagesProvider` (layout) → `error.tsx`; `global-error` dùng bản chép `i18n/global-error-messages.ts` (có test khớp).
- `global-error.tsx` và `ErrorView` không import thư viện dùng chung (next-intl, radix, next-themes, lucide): Turbopack chép lại cho nhóm chunk của `global-error`. Đổi file đặc biệt của Next (`error`, `global-error`, `not-found`…) thì chạy `measure:js`.
- e2e: mỗi project 3 user (chính / checkout / orders); `ACCOUNT_SPECS` = `(account|checkout|orders|error-page)\.spec\.ts`. Ép lỗi Supabase bằng cookie `e2e-fault=rest` (server e2e chạy với `E2E_FAULT_INJECTION=1`); không đặt biến này ngoài e2e.

Phạm vi: danh sách đơn của tôi, chi tiết đơn, hủy đơn khi còn `pending` (RPC `cancel_order` có sẵn, trigger hoàn kho có sẵn), làm mới cache tồn kho khi hủy, link "Xem đơn hàng" từ trang đặt hàng thành công. **Không** có: đánh giá sách đã nhận (Phase 9), email báo hủy (Phase 9), admin đổi trạng thái đơn (Phase 7), mua lại đơn cũ.

Không cần migration: `cancel_order(p_order_id, p_reason)`, `handle_order_status_change` (hoàn `stock` / `sold_count` / `used_count`), RLS `orders_select_own_or_admin` / `order_items_select_own_or_admin` đã đủ.

## Bổ sung khi duyệt

1. **Hủy đơn đã thanh toán (Phase 9, VietQR).** Khách **không** được tự hủy đơn `payment_status = 'paid'`: chưa có quy trình hoàn tiền.
   - Phase 9: migration cho `cancel_order` kiểm tra thêm `payment_status <> 'paid'` (cùng câu `update`, lỗi `ORDER_NOT_CANCELLABLE`). Ghi vào lộ trình Phase 9 trong CLAUDE.md.
   - Phase 6 làm luôn phần UI (rẻ, không đổi hành vi với COD vì đơn COD luôn `unpaid`): khối hủy chỉ hiện khi `status = 'pending'` **và** `payment_status <> 'paid'`; điều kiện đặt trong một hàm thuần `canCancel(order)` (Vitest), để Phase 9 chỉ còn việc ở DB.
2. **Trang lỗi.** Chưa có `error.tsx` nào: Supabase chập chờn → trang lỗi mặc định tiếng Anh của Next (e2e 5b gặp ở `/gio-hang`).
   - `app/[locale]/error.tsx`: bắt lỗi của layout nhóm `(shop)` / `(auth)` và mọi trang không có boundary gần hơn; tự dựng `<main id="main">` (như `not-found.tsx`), không có footer (footer đọc danh mục từ Supabase, có thể chính nó là chỗ lỗi).
   - `app/[locale]/(shop)/error.tsx`: nằm trong `<main>` + footer của layout `(shop)`, nên trang lỗi giữ nguyên khung trang. Cả hai dùng chung một component `ErrorView`: biểu tượng, tiêu đề (Lora), một câu giải thích, nút "Thử lại" (`retry()` của Next 16.3: tải lại dữ liệu server của segment rồi render lại; `reset()` chỉ render lại nên lỗi server vẫn còn), link "Về trang chủ". Token màu, focus ring, `prefers-reduced-motion` như phần còn lại. Focus chuyển vào tiêu đề khi trang lỗi hiện (trình đọc màn hình biết trang đã đổi).
   - **Chuỗi dịch**: `error.tsx` bắt buộc là client component và Next không truyền props từ server vào. Không dùng `useTranslations` (kéo runtime dịch của next-intl vào bundle đầu mọi trang; hiện chỉ palette tải lười dùng). Cách chọn: `[locale]/layout.tsx` dịch sẵn namespace `errorPage` (4 chuỗi thuần, không tham số ICU) rồi truyền xuống một context client nhỏ (`ErrorPageMessages`) bọc `children`; `error.tsx` đọc context. Đúng quy ước "client leaf nhận chuỗi đã dịch từ server", chỉ khác là qua context thay vì props vì boundary không nhận props. Chi phí ≈ vài trăm byte.
   - `app/global-error.tsx` (lỗi ở root layout `[locale]/layout.tsx` hoặc `admin/layout.tsx`): thay cả `<html>`, không còn layout nên không còn chuỗi từ server. Chuỗi lấy từ `src/i18n/global-error-messages.ts` (`Record<Locale, …>`, type bắt đủ 2 ngôn ngữ), Vitest so khớp với `errorPage` trong `messages/*.json` để chỉ có một bản nội dung. Không import `messages/*.json` vào đây: `global-error` nằm trong bundle đầu của mọi trang, import file messages là thêm ~30KB. Locale lấy từ `useParams().locale` (không có → `vi`, VD `/admin`). Link về trang chủ là `<a>` thường (không còn provider của next-intl; tải lại cả trang là đúng ý sau lỗi root layout). Tự import `globals.css`, font, `ThemeProvider`.
   - `app/admin/error.tsx`: chỉ tiếng Việt, cùng `ErrorView`; `admin/layout.tsx` cấp context với chuỗi `vi`. Phase 7 admin có nhiều query, nên làm luôn.
   - **Không lộ chi tiết lỗi**: UI không hiện `error.message` / `digest`. Lỗi Server Component Next đã tự log ở server (kèm digest); production gửi xuống client một thông báo chung. Kiểm tra lại log khi chạy e2e.
   - **e2e**: Playwright không chặn được request từ server Next tới Supabase. Cách làm: tiêm lỗi chỉ khi server chạy với `E2E_FAULT_INJECTION=1` (đặt trong `webServer.env` của `playwright.config.ts`, production không bao giờ đặt): client Supabase theo phiên (`lib/supabase/server.ts`) dùng `fetch` bọc lại, request REST (`/rest/v1/`) ném `TypeError('fetch failed')` khi request có cookie `e2e-fault=rest`. Auth (`/auth/v1/`) không bị chặn để phiên vẫn đọc được (giống sự cố 5b: đã đăng nhập, query hỏng). Spec `error-page.spec.ts` (user chính của project, thêm vào `ACCOUNT_SPECS`): đặt cookie → `/tai-khoan/don-hang` hiện trang lỗi tiếng Việt (tiêu đề, nút, link), không có chi tiết lỗi, header vẫn còn → xóa cookie → "Thử lại" → danh sách đơn hiện ra; tương tự `/en/account/orders` bằng tiếng Anh. `global-error` không có đường tự nhiên để ép lỗi (header đã nuốt lỗi của giỏ / phiên) → xem tay bằng thay đổi tạm, không commit.

## Cần chọn

★ = đề xuất.

1. **URL đơn hàng**
   - ★ Theo mã đơn: `/tai-khoan/don-hang/[code]` ↔ `/en/account/orders/[code]`, danh sách `/tai-khoan/don-hang` ↔ `/en/account/orders`. Cùng định danh với trang thành công (`getOrderByCode` có sẵn), người dùng đọc / đọc qua điện thoại được.
   - Theo `id`: ngắn hơn nhưng lộ số thứ tự đơn toàn hệ thống, và khác định danh với trang thành công.

2. **Trang thành công và trang chi tiết**
   - ★ Giữ trang thành công (lời cảm ơn, CTA "Tiếp tục mua sắm") + thêm CTA "Xem đơn hàng". Phần thông tin đơn (mã, ngày, địa chỉ, sách, tiền) tách thành component `OrderDetails` dùng chung cho cả hai trang (giờ đã có 2 chỗ dùng thật).
   - Bỏ trang thành công, `placeOrder` chuyển thẳng sang trang chi tiết kèm thông báo "Đặt hàng thành công": ít trang hơn nhưng mất trang cảm ơn riêng và đổi URL e2e Phase 5b.

3. **Danh sách đơn: lọc và phân trang**
   - ★ Phân trang `.range()` + `count: 'exact'` (đơn của một người ít, đếm chính xác rẻ), 10 đơn / trang, mới nhất trước, `?page=` trên URL. Lọc theo trạng thái bằng `?status=` (Tất cả / Chờ xác nhận / Đang xử lý (`confirmed` + `shipping`) / Đã giao / Đã hủy), dạng link (không JS). Tham số sai → bỏ qua, như `catalog-params`.
   - Chỉ phân trang, không lọc: đơn giản hơn; thêm lọc sau khi có nhiều đơn.

4. **Dòng trong danh sách**
   - ★ Mã đơn, ngày đặt, nhãn trạng thái, tối đa 3 bìa nhỏ (`alt=""`, có tên sách đầu tiên + "và N sách khác"), tổng tiền; cả dòng là một link tới chi tiết. Một query: `orders` + `order_items(title, cover_url, quantity)` (không dùng `order_items(count)` vì aggregate của PostgREST đang tắt trên Supabase).
   - Bảng (mã / ngày / trạng thái / tổng): gọn trên desktop nhưng phải làm riêng bản mobile.

5. **Hủy đơn: xác nhận**
   - ★ `<details>` "Hủy đơn" → khối xác nhận có ô lý do (không bắt buộc, ≤ 500, `TextAreaField`) + nút "Xác nhận hủy" (`variant="destructive"`). Form + Server Action `cancelOrder` qua `useFormAction`: chạy được không cần JS, lỗi hiện trong khối lỗi (đã bắt cả lỗi mạng). Cùng kiểu xác nhận xóa địa chỉ ở Phase 4, không thêm dialog vào bundle.
   - Dialog (radix, đã có cho palette nhưng tải lười): đẹp hơn nhưng thêm JS ở trang chi tiết, và cần JS mới hủy được.

6. **Làm mới cache khi hủy** (đơn hủy = tồn kho tăng lại)
   - ★ `cancelOrder` sau khi RPC thành công: lấy `book_id` của đơn (`order_items`, một query) → `updateTag('book:{id}')` cho từng sách, giống `placeOrder` (tag theo sách đã gắn vào các danh sách ở 5b). Rồi `refresh()` để trang chi tiết hiện "Đã hủy". Tách `expireOrderBooks` sang `features/orders/cache.ts` (dùng chung với checkout).
   - Không làm mới: trang sách hiện tồn kho thấp hơn thật tới khi hết `hours` (lỗi đã ghi trong báo cáo 5b).

7. **Hủy trùng lúc admin xác nhận đơn** (Phase 7 có admin đổi trạng thái)
   - ★ Dựa vào `cancel_order` (chỉ cập nhật khi `status = 'pending'` trong cùng câu `update`): admin xác nhận trước thì người dùng nhận `ORDER_NOT_CANCELLABLE` + `refresh()` (trang hiện trạng thái mới, nút hủy biến mất). Không cần khóa thêm.

8. **Trạng thái hiển thị**
   - ★ Nhãn trạng thái (màu: `pending` / `confirmed` / `shipping` → `primary` nhạt, `delivered` → `success`, `cancelled` → `muted`) + một câu giải thích theo trạng thái ở trang chi tiết ("Cửa hàng đang xác nhận đơn. Bạn có thể hủy trong lúc này."…). Đơn đã hủy hiện lý do nếu có.
   - Dòng thời gian từng bước: cần bảng lịch sử trạng thái (migration + trigger), để sau.

9. **Dữ liệu e2e**
   - ★ Đơn tạo bằng RPC `place_order` với phiên của user checkout (`signedInClient`, có sẵn), không đi qua UI checkout: nhanh và không phụ thuộc trang khác. Admin đặt trạng thái `confirmed` / `delivered` khi cần (helper `setOrderStatus`). Dọn bằng `cancelAndDeleteOrders` như 5b. Dùng user checkout và spec mới `orders.spec.ts` (thuộc `ACCOUNT_SPECS` → regex thêm `orders`).

## Route

| Internal | vi | en |
|---|---|---|
| `(shop)/account/orders/page.tsx` | `/tai-khoan/don-hang` | `/en/account/orders` |
| `(shop)/account/orders/[code]/page.tsx` | `/tai-khoan/don-hang/[code]` | `/en/account/orders/[code]` |

- Proxy đã chặn `/account/*` khi chưa đăng nhập; page vẫn `requireUser`.
- Cả hai trang `noindex`. Trang chi tiết `export const instant = false` (như trang sửa địa chỉ, trang thành công).
- Trang tài khoản thêm thẻ "Đơn hàng của tôi" (cùng kiểu thẻ "Sổ địa chỉ").
- `LocaleSwitcher` đã xử lý param `code` (5b).

## Dữ liệu (`features/orders/queries.ts`)

- `listOrders({ status, page })`: client theo phiên, `select('id, order_code, status, total, created_at, order_items(title, cover_url, quantity)', { count: 'exact' })`, lọc `status` (nhóm "Đang xử lý" = `in('status', ['confirmed', 'shipping'])`), `order('created_at', desc).order('id', desc)`, `.range()`. Offset vượt quá → trang rỗng (`PGRST103` như `listBooks`), page gọi `notFound()`.
- `getOrderByCode` (có sẵn) thêm `status`, `payment_status`, `cancelled_reason` vào select; `React.cache` để `generateMetadata` + page dùng chung.
- `features/orders/params.ts`: parse `?status=` / `?page=` (thuần, có Vitest), không zod ở client.

## Server Action `cancelOrder` (`features/orders/actions.ts`)

`cancelOrder(locale, orderId, prev, formData)`, locale + id bind sẵn ở page:
1. Parse: `orderId` (số nguyên dương), `reason` (CRLF → LF, trim, ≤ 500, rỗng → null), zod ở `features/orders/schemas.ts`.
2. `getCurrentUser()`; không có → đăng nhập với `next` là trang chi tiết.
3. `rpc('cancel_order', { p_order_id, p_reason })`.
4. Thành công: `expireOrderBooks(orderId)` → `refresh()` → trả `ok` (trang hiện "Đã hủy", khối hủy biến mất).
5. Lỗi: `ORDER_NOT_CANCELLABLE` → `refresh()` + thông báo; `INVALID_INPUT` (reason) → lỗi tại ô; khác → `withMessage`.

## Messages

Namespace `orders` (tiêu đề danh sách, bộ lọc, rỗng theo từng bộ lọc, "và N sách khác", hủy đơn / lý do / xác nhận / đang hủy, giải thích theo trạng thái, lý do hủy), `order.status.*` (5 nhãn), `order.viewOrder`, `account.orders` / `account.ordersDescription`, `validation.reason`. Cùng bộ key vi/en.

## JS

Trang danh sách: 0 JS thêm (Server Component + link). Trang chi tiết: form hủy (`useFormAction` + `TextAreaField`) ≈ như form địa chỉ không có ô tỉnh. Đo `measure:js` các route mới không có nghĩa (không prerender theo user), chỉ đo lại trang chủ / trang sách để chắc không đổi.

## Test

- Vitest: tham số `?status=` / `?page=`; `cancelOrderSchema` (lý do trim / rỗng / 500 / 501 / CRLF).
- e2e `orders.spec.ts` (`desktop-account` / `mobile-account`, tuần tự trong file):
  - Chưa có đơn → trạng thái rỗng + link "Khám phá sách".
  - 12 đơn (RPC) → trang 1 có 10, trang 2 có 2; lọc "Đã hủy" chỉ ra đơn đã hủy; `?page=99` → 404.
  - Chi tiết: mã, ngày, địa chỉ, sách, tiền đúng với DB; đơn của user khác → 404.
  - Hủy kèm lý do → "Đã hủy" + lý do, khối hủy biến mất, DB: `cancelled`, `stock` hoàn lại, **trang sách hiện tồn kho đã hoàn** (kiểm tra `updateTag`).
  - Admin chuyển `confirmed` sau khi trang đã mở → bấm hủy → "Đơn hàng này không thể hủy.", trang hiện "Đã xác nhận", không còn nút hủy.
  - Lý do 501 ký tự → lỗi tại ô, không mất nội dung.
  - Trang thành công có link "Xem đơn hàng" → đúng trang chi tiết.
  - `/en/account/orders` hiện giá `₫…` và nhãn trạng thái tiếng Anh.
- `scripts/e2e-user.ts` thêm `setOrderStatus(orderId, status)`.

## Tiến độ

- [x] Routing `/account/orders`, `/account/orders/[code]`; thẻ "Đơn hàng của tôi" ở trang tài khoản
- [x] `features/orders/{queries,params,schemas,actions,cache,utils}.ts` + Vitest
- [x] Trang danh sách (lọc, phân trang, rỗng, skeleton)
- [x] Component `OrderDetails` dùng chung; trang chi tiết; link "Xem đơn hàng" ở trang thành công
- [x] Hủy đơn + `updateTag`; checkout dùng chung `expireOrderBooks`
- [x] Messages
- [x] e2e `orders.spec.ts` + helper
- [x] Trang lỗi: `ErrorView` + context chuỗi, `[locale]/error.tsx`, `(shop)/error.tsx`, `global-error.tsx`, `admin/error.tsx`; tiêm lỗi e2e; `error-page.spec.ts`
- [x] CLAUDE.md: lộ trình Phase 9 (không tự hủy đơn đã thanh toán)
- [x] typecheck / lint / build / test / e2e sạch; `measure:js`; báo cáo
