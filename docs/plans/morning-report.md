# Báo cáo sáng 2026-10-16: Phase 8 → 9 → 10

Làm liền một mạch theo `night.md`, không dừng chờ trả lời. Ba nhánh xếp chồng, **chưa merge, chưa push `main`**:
`main` ← `phase-8` ← `phase-9` ← `phase-10` (`phase-10` chứa toàn bộ). Không chạy SQL lên Supabase, không mở `.env.local`, không deploy, không force push.

## 1. Trạng thái từng phase

| Phase | Nhánh | Trạng thái | Chờ migration | Bị chặn |
|---|---|---|---|---|
| 8 — Trang chủ, kệ, bìa Open Library, Tất cả sách | `phase-8` | **Đã xong** | kệ ưu tiên bìa nét (`cover_width`, trước migration chạy theo thứ tự thường), admin upload bìa (lỗi tới khi có cột) | không |
| 9 — Đánh giá, voucher ở checkout, VietQR, email, trang xác nhận | `phase-9` | **Đã xong** | khách không tự hủy đơn đã trả (DB), quyền cột `vouchers`, email khi admin đổi trạng thái (`order_contact`, trước đó chỉ log lỗi) | không |
| 10 — SEO, 404 thật, ISR fallback, e2e mua hàng, Lighthouse, chuẩn bị deploy | `phase-10` | **Đã xong** (deploy: chỉ cấu hình + hướng dẫn) | không thêm | không. LCP mô phỏng chưa đạt 2.5 s (xem mục 5) |

Báo cáo chi tiết: `phase-8.md`, `phase-9.md`, `phase-10.md` (mục "Báo cáo" đầu file).

## 2. Migration cần chạy (theo thứ tự)

Supabase Dashboard → SQL Editor → dán **toàn bộ** file → Run. Cả hai idempotent, không đổi dữ liệu có sẵn, giữ hành vi cũ.

**① `supabase/migrations/20261016010000_cover_width.sql`** (nhánh `phase-8`): cột `books.cover_width` + quyền cột update cho admin.
```sql
-- kỳ vọng: smallint
select data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'books' and column_name = 'cover_width';
-- kỳ vọng: 1 dòng UPDATE
select privilege_type from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'books' and column_name = 'cover_width' and grantee = 'authenticated';
```

**② `supabase/migrations/20261016020000_payments_email.sql`** (nhánh `phase-9`): `cancel_order` chặn đơn `paid`, quyền cột `vouchers` (bỏ `used_count`, `created_at`), RPC `order_contact`.
```sql
-- (a) kỳ vọng: true
select pg_get_functiondef('public.cancel_order(bigint, text)'::regprocedure) like '%payment_status <> ''paid''%';
-- (b) kỳ vọng: 0 dòng
select 1 from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'vouchers' and column_name = 'used_count'
   and grantee = 'authenticated' and privilege_type = 'UPDATE';
-- (c) kỳ vọng: true, false
select has_function_privilege('authenticated', 'public.order_contact(bigint)', 'execute'),
       has_function_privilege('anon', 'public.order_contact(bigint)', 'execute');
```

**Sau khi chạy**
1. `npx supabase gen types typescript --project-id ylfgwcxddxvfxwldmwtf > src/types/database.ts` (types đã sửa tay cho khớp; `git diff` nên gần như rỗng). (cũ, đã thay ở sau-ux mục 3: types lấy từ artifact `database-types` của CI e2e, xem CLAUDE.md → Database).
2. `npm run covers -- --measure` (ghi `cover_width` cho 189 bìa, không gọi API ngoài) → kệ trang chủ ưu tiên bìa nét.
3. Xóa nhánh dự phòng `42703` trong `sharpRows` (`src/features/books/queries.ts`) — hoặc nhờ Claude.
4. `npm run test:e2e` trên `phase-10`: các test "chờ migration" ở mục 5 phải qua.

## 3. Quyết định tự chọn — duyệt cuối (gom từ 3 phase)

Bảng đầy đủ (lý do + phương án khác) ở cuối `phase-9.md`, `phase-10.md` và mục báo cáo của `phase-8.md`. Tóm tắt:

**Phase 8**
1. Chọn hết ★ của plan. Open Library: chạy một lần (76 request, giãn 3.5 s), ghi nguồn ở footer, điều khoản trong `data.md`.
2. Tự duyệt bìa: chỉ nhận bìa **cùng thiết kế** với bìa cũ (11) + 1 ngoại lệ (bìa cũ là ảnh hộp sản phẩm). Bỏ 6 bìa nghi ngờ (khác thiết kế / không khớp tên).
3. `--apply` chỉ đổi `cover_url`; `cover_width` ghi sau bằng `--measure`.
4. Kệ Bán chạy giữ thứ tự số bán (không xếp bìa nét trước).
5. Kệ "Sách ngoại văn" lọc theo cây danh mục `sach-ngoai-van` (khớp link "Xem tất cả").
6. "Xem tất cả" của Bán chạy là `/sach` (sort mặc định đã là bán chạy); Nổi bật không có link.
7. Nút kệ trước / sau dùng cho mọi kệ (cả trang sách, +0.5KB).
8. Trang Tất cả sách có lọc danh mục cha như trang tìm kiếm.

**Phase 9**
1. Voucher trên URL (`?voucher=`), form GET riêng, ô + nút gắn bằng thuộc tính `form` (không lồng form); áp mã giữ `?address=`.
2. Regex mã voucher dùng chung `features/checkout/voucher.ts`.
3. **Dependency mới `uqr` 0.1.3** (MIT, 0 dependency, ~79KB unpacked, chỉ server, 0KB client) để vẽ QR; payload VietQR tự dựng + CRC16.
4. Tài khoản VietQR demo (Vietcombank, STK `0000000000`) + cảnh báo luôn hiện; đủ 4 biến `VIETQR_*` mới dùng thông tin thật.
5. Admin "Đã nhận tiền" bằng update có điều kiện; hủy đơn đã trả → `refunded` (2 câu update).
6. Email: Resend REST qua `fetch`, thiếu khóa thì chỉ log; gửi trong `after()`; người nhận lấy từ phiên (khách tự đặt / hủy) hoặc RPC `order_contact` (admin). Gửi lại cùng idempotency key có thể gửi email "đã nhận đơn" hai lần.
7. Màu email là hằng `EMAIL_COLORS` (ngoại lệ "không hard-code màu").
8. `POST /api/auth/confirm` kiểm `Origin`; `GET` chỉ chuyển sang `/xac-nhan` → template email cũ vẫn chạy.
9. Template email auth song ngữ (`supabase/templates/`); ô "Ngôn ngữ email" ghi thêm `user_metadata.locale`.
10. Đánh giá: 20 mới nhất, form ở trang sách, 5 radio sao (sao chọn tô màu, không tô dần); kiểm duyệt `/admin/danh-gia`.
11. Token màu mới `qr`, `qr-background`.

**Phase 10**
1. Ảnh OG mặc định là PNG tĩnh sinh bằng `scripts/og-image.ts` (font Windows có dấu), URL `/-/opengraph-image.png`.
2. Proxy 404: danh sách slug cache 60 giây + hỏi thẳng khi không có; rewrite sang `/<locale>/__not-found`.
3. Sitemap một file (URL tiếng Việt + hreflang), bỏ cây danh mục ẩn; robots không chặn `/tim-kiem`.
4. JSON-LD `["Book", "Product"]`.
5. ISR fallback: đọc `params` trong Suspense; `LocaleSwitcher` thêm lớp Suspense.
6. Sách e2e riêng mỗi project (setup), `created_at` năm 2000 cho mọi sách e2e.
7. Không CSP; CI e2e chỉ khi `RUN_E2E = true`; không làm captcha.
8. Không đổi font để kéo LCP (thử một lần, kết quả không ổn định).

## 4. Việc của bạn (`owner-todo.md`)

1. Chạy 2 migration (mục 2 ở trên) → sinh types → `covers --measure` → `test:e2e`.
2. Dán 2 template email auth (`supabase/templates/*.html`) vào Supabase Dashboard.
3. (Tùy chọn) Resend: `RESEND_API_KEY`, `EMAIL_FROM` → email đơn hàng gửi thật.
4. (Tùy chọn, nên giữ demo) VietQR thật: 4 biến `VIETQR_*`.
5. Duyệt + merge `phase-8` → `phase-9` → `phase-10` vào `main`.
6. Deploy Vercel theo hướng dẫn từng bước (env, region, Supabase URL Configuration, SMTP, GitHub Actions secrets, kiểm tra sau deploy).
7. (Tùy chọn) Captcha Turnstile; chọn ~12 sách nổi bật trong admin (kệ Nổi bật đang ẩn); xem 6 bìa bỏ qua (`data.md`); 5 bìa cần thay từ trước (`data.md`).

## 5. Kết quả kiểm tra

**typecheck / lint / build**: sạch ở cả ba nhánh. **Vitest**: phase-8 319 test, phase-9 355, phase-10 **370** (47 file), đều qua.

**e2e** (`npx playwright test`, 1 worker, build production):

| Nhánh | Kết quả | Fail còn lại (đều **chờ migration**) |
|---|---|---|
| `phase-8` | 179 / 182 qua | `admin-books` "upload bìa" (ghi `cover_width`); 2 test sau nó không chạy (serial) → chạy riêng: qua |
| `phase-9` | lượt 1: 150 qua, 8 fail, 40 không chạy → sửa locator test → lượt 2 + 3 qua hết trừ test chờ migration | `checkout` "khách không tự hủy đơn đã trả" (desktop + mobile), `admin-vouchers` "used_count", `admin-books` "upload bìa" |
| `phase-10` | lượt 1: 209 qua, 7 fail, 2 không chạy → sửa 2 lỗi thật của test / dữ liệu test → lượt 2 qua | như `phase-9` |

Không test nào bị xóa / skip / nới timeout. Test mới: `home` (6 × 2), `reviews` (3 × 2), `purchase` (1 × 2), `seo` (9 × 2), `admin-reviews`, thêm vào `checkout`, `admin-orders`, `admin-vouchers`, `account`.

**JS client** (`measure:js`, gzip, ngoài baseline 170KB; ngân sách trang sách ≤ 50KB):

| Trang | `main` (trước đêm) | `phase-8` | `phase-9` | `phase-10` |
|---|---:|---:|---:|---:|
| Trang chủ `vi` | 38.5 | 39.1 | 39.1 | 39.1 |
| Trang sách `vi/books/sapiens` | 39.2 | 39.7 | 41.8 | 41.9 |
| Danh mục `vi/categories/van-hoc` | — | — | 51.9 | 52.0 |

+0.6KB: nút kệ. +2.1KB trang sách: form đánh giá (client leaf trong Suspense theo phiên, Next vẫn liệt kê chunk trong HTML). Trang danh mục vượt 50KB đã có từ trước (bộ lọc), ngân sách chỉ áp cho trang sách.

**Lighthouse** (mobile, mô phỏng 4G chậm, local):

| Trang | Perf | LCP | CLS | TBT | A11y | BP | SEO |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 83 | 4.6 s | 0 | 100 ms | 100 | 100 | 100 |
| `/sach/sapiens` | 88 | 3.6 s | 0 | 100 ms | 100 | 100 | 92* |
| `/danh-muc/van-hoc` | 77 | 5.1 s | 0 | 220 ms | 100 | 100 | 92* |

\* canonical trỏ `localhost:3000` khi đo ở cổng 3200 (chưa có `SITE_URL`), hết khi deploy. LCP chưa đạt 2.5 s trong mô phỏng (font + JS trên băng thông 1.6 Mbps); đề xuất trong `phase-10.md`.

**Bìa trước / sau** (Open Library, chi tiết `data.md`, lưới so sánh `docs/plans/img/phase-8-covers-{1,2}.jpg`):

| | Sách | ≥ 300px trước | < 300px trước | ≥ 300px sau | < 300px sau |
|---|---:|---:|---:|---:|---:|
| Tiếng Việt | 72 | 42 | 30 | 42 | 30 |
| Tiếng Anh | 117 | 70 | 47 | 82 | 35 |
| **Tổng** | **189** | **112** | **77** | **124** | **65** |

76 request → 48 không có bìa (toàn bộ 29 sách Việt), 10 loại tự động, 18 nhận → **12 áp dụng**, 6 bỏ qua (danh sách + lý do trong `data.md`).

## 6. Commit trên từng nhánh (mới nhất trước, so với `main`)

**`phase-8`**
- `5aee804` docs(phase-8): report, CLAUDE.md conventions for shelves, covers script, all-books page
- `e717168` feat(home): shelves (featured, bestselling, Vietnamese new arrivals, foreign), all-books page, shelf nav; covers script + Open Library covers
- `012c221` docs(phase-9,10): plans; feat(db): cover_width migration (not yet run)
- `8de4a5f` docs: overnight process and checklist for phases 8-10

**`phase-9`** (= `phase-8` +)
- `f466541` test(e2e): fix locators for the voucher button and star radios; docs(phase-9): report, CLAUDE.md conventions; share voucher code regex
- `2c70378` test(e2e): voucher + VietQR checkout, admin mark paid / refund, reviews, admin review moderation, confirm page
- `d61e6eb` feat(reviews): book page reviews (cached list, session form), write/edit/delete own review, admin moderation page
- `4e69f5d` feat(auth): intermediate confirm page (POST) for email links; bilingual auth email templates; email locale also in user_metadata
- `2cfba60` feat(checkout): voucher via URL, bank transfer with server-rendered VietQR, admin mark-paid, order emails (log-only without Resend)
- `312797b` Merge branch 'phase-8' into phase-9
- `4f8d91a` feat(db): phase 9 migration: cancel_order blocks paid orders, voucher column grants, order_contact RPC (not yet run)

**`phase-10`** (= `phase-9` +)
- commit báo cáo sáng (file này)
- `37ba515` docs(phase-10): report, decisions, Lighthouse numbers; CLAUDE.md conventions (404 proxy, SEO, e2e shop books); owner deploy guide
- `d76e3cf` test(e2e): purchase journey visibility filter; e2e books dated 2000 so they never reach the home shelves
- `be3f44f` chore(deploy): security headers, GitHub Actions CI (e2e opt-in via RUN_E2E)
- `51433ff` test(e2e): per-project e2e shop books for checkout/orders (no stock changes on real books), full purchase journey, SEO checks
- `c0219ef` feat(catalog): read slug params inside Suspense, locale switcher safe in App Shell; drop instant = false on book, category, author pages
- `d485e2e` feat(seo): sitemap, robots, metadataBase, default OG image, book OG cover, JSON-LD (Book/Offer/Breadcrumb, WebSite); proxy returns real 404 for unknown slugs

## 7. Rủi ro / ghi chú

- Dữ liệu thật đã đổi trong đêm: **12 bìa** (Open Library, qua script đã duyệt; bìa cũ xóa khỏi Storage khi không đơn nào trỏ tới). e2e tạo / xóa user, đơn, sách test như trước; từ Phase 10 không còn đổi tồn kho sách thật.
- Kệ Nổi bật và Bán chạy đang **ẩn** (chưa chọn sách nổi bật, chưa có đơn thật).
- Header `Link` hreflang của trang prerender mang host lúc build (vô hại khi chỉ có một domain; xem `phase-10.md`).
- `MaxListenersExceededWarning` trong log server khi chạy e2e có từ trước đêm nay.

## 8. Sau migration (2026-10-16, chủ dự án đã chạy 2 migration)

- Types sinh lại (`npx supabase gen types …`): **trùng khớp** bản sửa tay, không diff.
- `npm run covers -- --measure`: đo 189 bìa → ≥ 600px **104**, 300–599px **20**, < 300px **65**.
- Đã xóa nhánh dự phòng `42703` trong `getHomeShelves`; `typecheck`, `lint` sạch.
- `test:e2e` đầy đủ trên `phase-10`: **212 qua**, 2 fail không liên quan migration (`purchase` desktop: ô email bị xóa trước khi bấm đăng nhập — race lúc hydrate; `cart-account` mobile: locator `cart-subtotal` trùng bản sao ẩn của Suspense), 4 không chạy (serial). Chạy lại 2 spec đó: **14 / 14 qua**. **Cả 5 test chờ migration đều qua**: `checkout` "khách không tự hủy đơn đã thanh toán" (desktop + mobile), `admin-vouchers` "không sửa được used_count", `admin-books` "upload bìa" + 2 test sau nó.
- Bìa < 300px trước / sau Open Library:

  | | Sách | < 300px trước | < 300px sau | ≥ 300px sau |
  |---|---:|---:|---:|---:|
  | Tiếng Việt | 72 | 30 | 30 | 42 |
  | Tiếng Anh | 117 | 47 | 35 | 82 |
  | **Tổng** | **189** | **77** | **65** | **124** (104 ≥ 600px + 20 cỡ 300–599px) |

  Tổng sau đo bằng `--measure`; tách theo ngôn ngữ từ dry-run (12 bìa thay đều là sách tiếng Anh, Open Library không có bìa nào cho 29 sách Việt).
- `owner-todo.md` mục 6.5: tạo project Supabase thứ hai riêng cho e2e / CI sau khi deploy (sách e2e đang bán lộ qua tìm kiếm khi test chạy trên DB thật).
