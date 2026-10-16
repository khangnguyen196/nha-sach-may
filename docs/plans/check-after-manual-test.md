# Dò lỗi sau test tay (2026-10-16)

Nhánh `check-after-manual-test` (tạo từ `main` @ `d1ed0c3`). Chỉ dò và báo cáo: **không sửa code app**. Thay đổi trên nhánh:

- `e2e/admin-account-orders.spec.ts` (mới): chứng minh lỗi admin thấy đơn của người khác. **Đang fail, cố ý.**
- `e2e/crawl.spec.ts` (mới): dò lỗi chỉ đọc (khách, tài khoản e2e, admin e2e; desktop + mobile; vi + en).
- `playwright.config.ts`: thêm `crawl` vào `ACCOUNT_SPECS` (crawl cần phiên user + admin của `auth.setup.ts`), `CLAUDE.md` sửa regex tương ứng.

## 1. Toàn bộ e2e trên `main` (`npm run test:e2e`)

Theo quy ước `handoff.md`: lỗi mạng → chờ 3 phút, chạy lại tối đa 3 lượt. Đã dùng hết 3 lượt chạy lại, **chưa có lượt nào xanh**.

| Lượt | Kết quả | Ghi chú |
|---|---|---|
| 1 | Build fail, 0 test | Prerender `/vi/books/giang-the`: `"use cache"` của `getBookBySlugCached` quá thời gian (Supabase không trả lời) |
| 2 | 88 qua / 2 fail / 134 không chạy | `auth.setup` fail (đăng nhập treo "Đang xử lý…" 20 giây) → mọi project tài khoản / admin bị bỏ |
| 3 | 165 qua / 17 fail / 42 không chạy (27.8 phút) | 16 test fail kiểu mạng + teardown fail `fetch failed` (dữ liệu e2e sót lại, setup lượt sau đã dọn) |
| 4 | Build fail, 0 test | `next/font/google`: cache Turbopack trong `.next` hỏng sau một lần tải font lỗi (lỗi #5) |

Phân loại các test fail:

| Test | Lượt fail | Lỗi | Đánh giá |
|---|---|---|---|
| `[desktop] layout.spec` đổi ngôn ngữ giữ nguyên query | 2 (lượt 3 qua) | en → vi về `/` thay vì `/?x=1` | Chập chờn có nguyên nhân thật, nhẹ: lỗi #6 |
| `[setup] auth.setup` | 2 | Nút đăng nhập treo 20 giây | Mạng (Supabase Auth) |
| `[mobile] cart.spec` hết hàng → nút khóa | 3 | Timeout 30 giây | Mạng |
| `[teardown]` | 3 | `deleteShopBooks (categories): fetch failed` | Mạng |
| `[desktop/mobile-account] cart-account.spec` thêm / đổi / xóa | 3 | Nút đứng ở "Đang thêm…"; badge vẫn 1 sau khi xóa | Server Action chậm (mạng); fail cả 2 thiết bị trong cùng lượt mạng xấu |
| `orders.spec` chưa có đơn; `/en/account/orders` | 3 | `cancelAndDeleteOrders` / `clearCart`: `fetch failed` | Mạng (helper service role) |
| `reviews.spec` chưa nhận sách (cả 2 thiết bị) | 3 | Timeout 30 giây | Mạng |
| `[mobile-account] account.spec` next / sổ địa chỉ | 3 | `page.goto` timeout; nhãn "Mặc định" chưa hiện sau 5 giây | Mạng |
| `[mobile-account] checkout.spec` bấm 2 lần | 3 | Timeout ở `beforeEach` | Mạng |
| `[mobile-account] purchase.spec` | 3 | Đứng ở trang thêm địa chỉ | Mạng (lưu địa chỉ chậm) |
| `[desktop-admin] admin-books`, `admin-catalog`, `admin-orders`, `admin-smoke` (2) | 3 | Không thấy kết quả sau 15 giây / `page.goto` timeout / `ERR_ABORTED` | Mạng |

**Kết luận**: không có test nào fail lặp lại giữa các lượt. Nhưng test tài khoản / admin **chỉ chạy được một lượt** (lượt 3, lúc mạng xấu), nên chưa khẳng định được là xanh. Sau đó mạng ổn lại: setup, teardown và 14/16 test crawl qua ở 2 lượt chạy spec mới. → Nên chạy lại `npm run test:e2e` một lần khi mạng ổn, trước khi sửa lỗi.

## 2. Lỗi test tay (#1): admin xem `/tai-khoan/don-hang`

`e2e/admin-account-orders.spec.ts` (project `desktop-admin`). Đã chạy, **2/2 fail đúng chỗ cần chứng minh**:

| Test | Kết quả |
|---|---|
| Admin mở `/tai-khoan/don-hang` chỉ thấy đơn của mình; đơn của khách khác → 404 | Đơn của admin có (dòng 72 qua); **đơn của khách cũng hiện** (dòng 73: mong 0, nhận 1) |
| Admin mở `/thanh-toan/thanh-cong/<mã đơn khách>` → 404 | **Hiện đầy đủ đơn của khách**, không 404 |

Nguyên nhân (đọc code, chưa sửa): `getOrderByCode` và danh sách đơn (`features/orders/queries.ts`) chỉ dựa vào RLS, không lọc `user_id`. Policy `orders_select_own_or_admin` (`schema.sql:1016`, tương tự `order_items_select_own_or_admin`) cho admin đọc mọi đơn. Hệ quả kèm theo, theo code (không bấm thử vì là thao tác ghi): trang chi tiết đơn của khách khác vẫn hiện nút "Hủy đơn hàng" cho admin (`canCancel` chỉ xét trạng thái), bấm thì `cancel_order` từ chối vì kiểm `user_id = auth.uid()`.

Hướng sửa gợi ý: query phía khách thêm `.eq('user_id', <id phiên>)`. Không đổi RLS, vì admin cần policy này cho `/admin/don-hang`.

## 3. Crawl chỉ đọc (`e2e/crawl.spec.ts`)

Chạy ở `desktop-account` (Desktop Chrome) + `mobile-account` (Pixel 7):

```bash
npx playwright test e2e/crawl.spec.ts --project=desktop-account --project=mobile-account
```

Mỗi thiết bị mở **129 trang**, 258 lượt tổng:
- trang chủ, `/sach` (kèm bộ lọc + trang 2), tìm kiếm (có / không kết quả), giỏ, đăng nhập / đăng ký / quên mật khẩu, 4 trang 404 (vi + en), sitemap, robots;
- mọi danh mục trong sitemap (24 × vi + en);
- 10 sách và 5 tác giả ngẫu nhiên (vi + en);
- 6 trang tài khoản / giỏ / thanh toán của user e2e (vi + en);
- 17 trang admin (danh sách, form tạo, trang sửa đầu tiên của mỗi loại, lọc).

Ngoài ra GET mọi link nội bộ trên các trang đó. Không bấm nút nào. Kết quả ghi ra `test-results/crawl/<project>-<nhóm>.json`.

Kiểm cho từng trang: HTTP status, lỗi console / `pageerror`, hydration, request 4xx / 5xx / lỗi mạng, ảnh hỏng, cuộn ngang (mobile), key i18n thô, chữ tiếng Việt trên trang `/en`, link nội bộ hỏng.

Kết quả lượt cuối: 14/16 qua; 2 test admin fail vì lỗi #2. **Không có**: status sai, lỗi console, lỗi hydration, cuộn ngang trên mobile, key i18n thô. Chữ tiếng Việt trên `/en` đều là dữ liệu được phép (tên sách, tên tác giả, mô tả fallback, tên NXB, tên user). Không có chữ giao diện nào chưa dịch.

### Bảng lỗi

| # | Trang | Lỗi | Mức | Cách tái hiện |
|---|---|---|---|---|
| 1 | `/tai-khoan/don-hang`, `/tai-khoan/don-hang/[code]`, `/thanh-toan/thanh-cong/[code]` | Admin thấy đơn (tên, SĐT, địa chỉ, sách) của mọi khách trong khu tài khoản cá nhân; nút "Hủy đơn hàng" hiện với đơn người khác | **Nặng** | Đăng nhập admin → `/tai-khoan/don-hang`; hoặc `npx playwright test e2e/admin-account-orders.spec.ts --project=desktop-admin` |
| 2 | `/admin/danh-muc/[id]`, `/admin/sach/[id]` | Link "Xem trên cửa hàng" luôn hiện kể cả khi danh mục / sách **đang ẩn** → bấm ra 404 | Nhẹ | Admin mở một danh mục `is_active = false` (VD danh mục gốc `e2e-shop-…` lúc e2e chạy) → bấm "Xem trên cửa hàng" |
| 3 | Build (`next build`, mọi trang sách) | Prerender 711 trang, mỗi trang vài query Supabase không có timeout / retry: một request treo là cả build fail (`"use cache" … took too long`, gặp ở `getBookBySlugCached` và `getBookReviews`). 2/10 lần build trong phiên fail kiểu này | Vừa | `npm run build` lúc mạng tới Supabase chập chờn. Deploy Vercel cũng có thể fail ngẫu nhiên |
| 4 | Ảnh bìa ở lưới (`/_next/image`) | Bộ tối ưu ảnh trả **504** khi Storage chậm → ô bìa trống (lượt crawl 1, `/danh-muc/ngoai-van-ky-nang-song`; lượt 2 không lặp) | Nhẹ | Không tái hiện chắc chắn được; xuất hiện khi Supabase Storage chậm |
| 5 | Build local / CI có cache | Sau một lần tải Google Fonts lỗi, cache Turbopack trong `.next/cache` hỏng: mọi lần build sau fail `next/font/google queries have exactly one entry` dù mạng đã ổn, cho tới khi xóa `.next`. Vercel giữ build cache giữa các deploy nên có thể dính tương tự | Vừa | Build lúc mất mạng giữa chừng → build lại khi có mạng. Cách thoát: xóa `.next` (đã làm trong phiên) hoặc Redeploy không dùng cache trên Vercel |
| 6 | Mọi trang (`LocaleSwitcher`) | Trước khi hydrate, link đổi ngôn ngữ chưa có query (thiết kế có chủ đích, fallback trong Suspense) → bấm sớm mất `?x=1`, `?page=`, `?q=`… Href fallback còn dấu `?` thừa: `/en?`, `/en/login?` | Nhẹ | Mạng chậm / CPU chậm: mở `/sach?page=2`, bấm "EN" ngay khi trang hiện → `/en/books` (mất `page`; suy từ code `LocaleSwitcher` + lần fail của `layout.spec`, chưa bấm tay). Có thể làm `layout.spec` chập chờn |
| 7 | `/dang-nhap` | Supabase Auth lỗi mạng / 5xx → "Đã có lỗi xảy ra. Vui lòng thử lại." (`UNKNOWN`), không phân biệt với lỗi khác | Nhẹ | Gặp ở `auth.setup` lượt 2 và một lần chạy spec mới: đăng nhập lúc Supabase Auth chậm |
| 8 | `/sach?lang=en&sort=price-asc&page=2` | Lần mở đầu sau khi start: `networkidle` quá 15 giây (3/4 lần: 2 lượt crawl × 2 thiết bị). Mở lại trên trình duyệt: 30 request, không còn request nào sau 3 giây, ảnh chậm nhất 1.4 giây → render lần đầu (cache lạnh, trang có query không được prerender) | Nhẹ (theo dõi) | `next start` mới → mở URL này đầu tiên. Nên đo lại trên Vercel |

### Ghi chú về crawl spec

- Spec fail khi có lỗi "cứng". Mục chỉ để duyệt tay (không fail): `vi-on-en` (đã bỏ chữ trong link tới sách / tác giả) và `slow`.
- Không kiểm link thu từ trang 404 cố ý: link đổi ngôn ngữ ở đó trỏ tới chính slug không tồn tại.
- Đọc trang admin bằng phiên admin e2e: danh sách admin có cả dữ liệu e2e của spec khác (VD danh mục `e2e-shop-…`), nên lỗi #2 hiện ra qua danh mục test.
- 10 sách / 5 tác giả chọn ngẫu nhiên mỗi lần chạy: danh sách đã mở nằm trong `visited` của file JSON.

## 4. Việc tiếp theo đề xuất (chưa làm)

1. Chạy lại `npm run test:e2e` khi mạng ổn để có kết quả xanh làm mốc.
2. Sửa lỗi #1 (lọc `user_id` ở query đơn phía khách), rồi `admin-account-orders.spec` phải qua.
3. Ẩn / đổi "Xem trên cửa hàng" khi sách / danh mục đang ẩn (lỗi #2). Crawl admin sẽ qua.
4. Cân nhắc timeout + retry cho client Supabase lúc build (lỗi #3); ghi cách thoát lỗi cache font vào `owner-todo.md` (lỗi #5).
