# Phase 6: Tài khoản: đơn hàng

Trạng thái: **chờ duyệt** (2026-10-15). Chỉ có plan, chưa code.

Phạm vi: danh sách đơn của tôi, chi tiết đơn, hủy đơn khi còn `pending` (RPC `cancel_order` có sẵn, trigger hoàn kho có sẵn), làm mới cache tồn kho khi hủy, link "Xem đơn hàng" từ trang đặt hàng thành công. **Không** có: đánh giá sách đã nhận (Phase 9), email báo hủy (Phase 9), admin đổi trạng thái đơn (Phase 7), mua lại đơn cũ.

Không cần migration: `cancel_order(p_order_id, p_reason)`, `handle_order_status_change` (hoàn `stock` / `sold_count` / `used_count`), RLS `orders_select_own_or_admin` / `order_items_select_own_or_admin` đã đủ.

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

- [ ] Routing `/account/orders`, `/account/orders/[code]`; thẻ "Đơn hàng của tôi" ở trang tài khoản
- [ ] `features/orders/{queries,params,schemas,actions,cache}.ts` + Vitest
- [ ] Trang danh sách (lọc, phân trang, rỗng, skeleton)
- [ ] Component `OrderDetails` dùng chung; trang chi tiết; link "Xem đơn hàng" ở trang thành công
- [ ] Hủy đơn + `updateTag`; checkout dùng chung `expireOrderBooks`
- [ ] Messages
- [ ] e2e `orders.spec.ts` + helper
- [ ] typecheck / lint / build / test / e2e sạch; `measure:js`; báo cáo
