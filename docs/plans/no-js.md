# Đợt "no-js": khi tắt JavaScript

Trạng thái (2026-10-20): **plan bản 3 + phần A đã duyệt merge** (chủ dự án 2026-10-20): merge `origin/main` (`355f257`, có chunk-loi) vào `no-js` (`967a009`), rồi ff `main` lên `no-js`. ★8 = (a1+), làm trên nhánh `khoa-nut`; ★9 / ★10: chờ đo (chỉ đọc); ★7: tìm issue có sẵn / soạn bài báo lỗi, không gửi. Bản 3 = bản 2 (`1816d8b`) + số liệu production (II.1) + số liệu CI mới (II.2) + sửa theo review bản 2 + quyết định ★ của chủ dự án. B **hoãn**. Đợt nhỏ "tải chunk lỗi" đã tách ra nhánh `chunk-loi` (★2).

Chẩn đoán chạy trên nhánh nháp (`no-js-diag`: 4 lượt; `no-js-diag2`: 2 lượt; đều đã xóa local + remote). Spec + kết quả thô giữ ngoài repo, trong `D:/Bán sách-backup/`: `2026-10-20-nojs-diag.spec.ts`, `…-nojs-diag-run3.txt`, `…-nojs-diag-run4.txt` (bản 2); `2026-10-20-nojs-production.txt` (II.1); `2026-10-20-nojs-diag2.spec.ts`, `…-nojs-diag2-run1.log`, `…-nojs-diag2-run2.log` (II.2). Nguồn: `docs/plans/sau-ux.md` mục 5, dòng "Tắt JS" trong `docs/progress.md`.

## Quyết định của chủ dự án (2026-10-20)

- ★0: Claude Code tự đo trên production (II.1, fetch không cookie, không gõ mật khẩu). **Đã đo: production cũng trắng** (dưới).
- ★1: **chỉ A** (dải noscript ở layout) + noscript ngay trong 3 form auth vì production POST cũng trắng. B (PRG) **hoãn**; ★4 (cách hiện kết quả của B: route tĩnh B1 hay trang chặn B2, tín hiệu không JS) và ★6 (`EMAIL_NOT_CONFIRMED` khi không JS) hoãn theo B.
- ★2: tách đợt "tải chunk lỗi", làm trước → nhánh `chunk-loi`.
- ★3: nút trong khối lỗi chunk là "Tải lại trang" (không tự viết loader để "Thử lại"): đã làm ở nhánh `chunk-loi`.
- ★5: `/xac-nhan` chỉ sửa comment + dải A.
- ★7: quyết sau khi có số liệu production → đề xuất ở mục ★ (dưới).
- Ca "khách CÓ JS gửi form trước khi hydrate": đo (II.2a) rồi đề xuất thành ★8, **chưa sửa code**.
- ★8 (quyết lượt sau, 2026-10-20): **(a1+)** = đề xuất ở mục ★8 ((a1) khóa trong `useFormAction` + khóa 2 form địa chỉ `void` + `refresh()` bằng prop của `SubmitButton`), **giữ nguyên chữ trên nút** (không "Đang tải…"), chỉ `disabled` + `aria-disabled` tới khi hydrate; thêm giỏ không JS, đăng xuất, `/xac-nhan` giữ nguyên. Làm trên nhánh `khoa-nut`.
- ★9, ★10: chỉ đo. ★7: tìm issue có sẵn, soạn repro + bài báo lỗi, không gửi.

## Mục tiêu

Biết chính xác cửa hàng làm được gì khi trình duyệt tắt JavaScript, rồi chọn mức hỗ trợ hợp lý. Tối thiểu: khách không gặp **trang trắng / trang thiếu nội dung mà không có lời giải thích**. Phần A không đổi giao diện khi có JS, không tăng JS client.

Lưu ý (review bản 2, NGHIÊM TRỌNG 2): câu "không đổi trải nghiệm khi có JS" của bản 2 thiếu một ca có JS: khách bấm gửi **trước khi React hydrate** (4G chậm) cũng đi đường POST thường và gặp trang trắng như khi tắt JS (II.2a). Ca này là ★8, không thuộc A.

## Kết quả chẩn đoán

### Production (II.1, 2026-10-20 ~04:20Z, https://nha-sach-may.vercel.app)

Claude in Chrome, `fetch` cùng origin, `credentials: 'omit'`, `redirect: 'manual'`, `cache: 'no-store'`. "Ký tự hiện" = chữ của `<body>` sau khi bỏ `[hidden]`, `script`, `style`, `template`, `noscript` (DOMParser).

**(a) GET**

| Trang | Status | `x-vercel-cache` | `x-nextjs-prerender` | `age` | `cache-control` | `div[hidden][id^="S:"]` | Ký tự hiện | h1 / câu báo |
|---|---|---|---|---:|---|---:|---:|---|
| `/` | 200 | HIT | (không có) | 12 | `public, max-age=0, must-revalidate` | 5 | 3573 | không có h1 (hero là trích dẫn) |
| `/sach/sapiens` | 200 | HIT | (không có) | 11 | như trên | 7 | 451 | "Sapiens" **trong** `<div hidden id="S:…">` |
| `/danh-muc/van-hoc` | 200 | HIT | 1 | 12 | như trên | 36 | 451 | "Văn học" **trong** `S:` |
| `/tac-gia/yuval-noah-harari` | 200 | HIT | (không có) | 10 | như trên | 14 | 451 | "Yuval Noah Harari" **trong** `S:` |
| `/dang-nhap?error=LINK_EXPIRED` | 200 | HIT | 1 | 10 | như trên | 5 | 320 | h1 "Đăng nhập" hiện; câu "Liên kết đã hết hạn…" chỉ ở `<p>` **trong** `S:` (+ trong payload `<script>`) |

→ Vercel trả HTML đã cache (HIT) nhưng nội dung chính của trang sách / danh mục / tác giả và câu báo của `UrlNotices` vẫn nằm trong khối ẩn chờ `$RC`. Thay câu "Vercel cũng stream" của bản 2 (chỉ dựa vào `/sach`) bằng số liệu này.

**(b) POST không JS, quên mật khẩu (đúng 1 lần)**: GET `/quen-mat-khau` → form `action=""`, `method="POST"`, `enctype="multipart/form-data"`, ô `$ACTION_REF_1`, `$ACTION_1:0`, `$ACTION_1:1`, `$ACTION_KEY`, `email`; `new FormData(form)`, email `khong-ton-tai-nojs@example.com`; POST `/quen-mat-khau`, không header `next-action`.

| Status | `content-type` | `x-vercel-cache` | Độ dài | Có `<html` | Có `<div hidden id="S:` | Ký tự hiện | Action chạy? |
|---|---|---|---:|---|---|---:|---|
| 200 | `text/html; charset=utf-8` | BYPASS | 68 269 | **Không** (bắt đầu bằng `<script`) | Có | **0** | Có (payload `"ok":true`; câu "Kiểm tra hộp thư" chỉ có trong `<script>`) |

→ **Production cũng trắng**, giống `next start` trên CI. Trên Vercel, shell không được ghép trước phần resume cho POST action (kết luận từ số liệu II.1b; cơ chế là suy luận, `app-page-runtime.js:219-260` chỉ là đoạn tách postponed state khỏi body POST). Câu "chỉ chắc cho self-host" của bản 2 bỏ.

### CI, tắt JS (bản 2: `no-js-diag` lượt 3 run 39363355630, lượt 4 run 39364607716; `next start`, project `desktop`, `javaScriptEnabled: false`)

Cách đo: mở trang bằng GET, ghi form có hiện không và có nằm trong phần stream bị ẩn không; gán giá trị rồi `requestSubmit()` qua `evaluate` (gửi được cả form bị ẩn, để đo phản hồi của server); ghi status, thân phản hồi, số ký tự hiện (`innerText`), dữ liệu trong DB trước / sau.

**GET (chưa gửi form)**

| Trang | Ký tự hiện | Boundary stream ẩn | Ghi chú |
|---|---:|---:|---|
| `/` | 3173 | 5 | Kệ sách trong khung tĩnh: 24 / 24 link sách hiện |
| `/sach` | 450 | 42 | Chỉ h1 "Tất cả sách" + header / footer; lưới, bộ lọc (cả hàng lọc desktop), sắp xếp ẩn |
| `/sach/sapiens` (đã prerender) | 438 | 7 | h1, giá, form thêm giỏ, đánh giá **đều ẩn** |
| `/sach/<slug tạo sau build>` | 438 | 19 | Như trên |
| `/danh-muc/van-hoc` (đã prerender) | 438 | 21 | h1 + lưới ẩn |
| `/tac-gia/yuval-noah-harari` (đã prerender) | 438 | 14 | h1 + sách ẩn |
| `/tim-kiem?q=sapiens` | 468 | 18 | Ô tìm kiếm (form GET) hiện; kết quả ẩn |
| `/dang-nhap`, `/dang-ky`, `/quen-mat-khau` | 304 / 338 / 312 | 4–5 | h1 + form trong khung tĩnh: hiện |

**HTML prerender sau `next build` (II.2b, `no-js-diag2` run 39369388789 + 39369867281, giống nhau)**: mở file `.next/server/app/vi/…html` bằng `setContent` (JS tắt).

| File | Byte | `.meta` có `postponed` | h1 | `div[hidden][id^="S:"]` | Ký tự hiện |
|---|---:|---|---|---:|---:|
| `vi/books/sapiens.html` | 50 166 | Có | "Sapiens": **trong `S:`** | 3 | 471 |
| `vi/categories/van-hoc.html` | 35 024 | Có | "Văn học": **trong `S:`** | 3 | 471 |
| `vi/authors/yuval-noah-harari.html` | 34 757 | Có | "Yuval Noah Harari": **trong `S:`** | 3 | 471 |
| `vi/books.html` (`/sach`) | 26 003 | Có | "Tất cả sách": khung tĩnh | 2 | 483 |
| `vi/login.html` | 17 983 | Có | "Đăng nhập": khung tĩnh | 1 | 336 |

→ Thay giả thuyết của bản 2 bằng số liệu: HTML prerender của trang sách / danh mục / tác giả **có** nội dung (h1…) nhưng nằm trong boundary đã xong dạng `<div hidden id="S:…">`, cần script inline `$RC` đổi chỗ. Comment "slug đã prerender vẫn là HTML tĩnh đầy đủ" (`books/[slug]/page.tsx:42`, `categories/[slug]/page.tsx:19`, `authors/[slug]/page.tsx:19`, CLAUDE.md "HTML tĩnh") chỉ đúng theo nghĩa "có trong HTML cache", không đúng với "hiện được không cần JS". Ảnh hưởng: ★9.

**Từng form (tắt JS)**

| Form (trang) | Loại | Form hiện khi GET? | POST | Trang sau khi gửi | Action chạy? |
|---|---|---|---|---|---|
| Đăng nhập sai mật khẩu (`/dang-nhap`) | Server Action | Có (khung tĩnh) | 200 `text/html`, thân bắt đầu `<script>…__next_f…` + `<div hidden id="S:…">`, không có `<html>` | **Trắng** (0 ký tự) | Có (`INVALID_CREDENTIALS` trong payload) |
| Đăng nhập đúng | Server Action | Có | **303** → `/tai-khoan` | 448 ký tự (header / footer), nội dung tài khoản ẩn | Có |
| Đăng ký (`/dang-ky`) | Server Action | Có | 200, chỉ phần động | **Trắng** | Có (user được tạo) |
| Quên mật khẩu (`/quen-mat-khau`) | Server Action | Có | 200, chỉ phần động | **Trắng** | Có (payload ok; production: `"ok":true`) |
| Đặt lại mật khẩu (`/dat-lai-mat-khau`, phiên thường) | Server Action | **Không** (trong stream) | 200, chỉ phần động | **Trắng** | Có (mật khẩu mới đăng nhập được) |
| Gửi lại email xác nhận | Server Action | **Không tới được**: chỉ hiện sau lỗi `EMAIL_NOT_CONFIRMED` của form đăng nhập (state ở client) | — | — | Không thử |
| Xác nhận email / đặt lại mật khẩu từ link (`/xac-nhan`, POST tới Route Handler `/api/auth/confirm`) | Route Handler | **Không** theo code: form trong `<Suspense>` vì đọc `token_hash` từ `searchParams` (`(auth)/confirm/page.tsx:32-34`, `:82`, số dòng sau khi sửa comment) | Chưa đo | — | — |
| Thêm địa chỉ (`/tai-khoan/dia-chi/moi`) | Server Action | **Không** | 200 (lượt 4 chèn tay option phường) | **Trắng** | Không: `INVALID_INPUT` vì ô phường render `disabled` (`address-form.tsx:164`: `disabled={!provinceCode …}`, `provinceCode` ban đầu rỗng) → ô `disabled` không được gửi. Hệ quả: **khách không JS không thêm được địa chỉ** kể cả khi thấy form |
| Sửa địa chỉ (`/tai-khoan/dia-chi/<id>`) | Server Action | **Không** | **303** → `/tai-khoan/dia-chi` | 493 ký tự (danh sách ẩn) | Có |
| Đặt địa chỉ mặc định (`/tai-khoan/dia-chi`) | Server Action (`void` + `refresh()`) | **Không** | 200, chỉ phần động | **Trắng** | Có |
| Xóa địa chỉ (`address-card.tsx`, form trong `<details>`) | Server Action (`void` + `refresh()`) | **Không, và không nằm trong `<details>`** (II.2c): mỗi form xóa là một segment stream riêng: trong `<details>` chỉ có `<template id="P:b">`, form thật nằm ở `<div hidden id="S:b">` cuối `<body>` (cần script `$RS` chuyển vào). Vì vậy selector `details form` của spec cũ ra 0 | Không đo (theo code: như đặt mặc định → 200 trắng) | — | — |
| Ngôn ngữ email (`/tai-khoan`) | Server Action | **Không** | 200, chỉ phần động | **Trắng** | Có (`vi` → `en`) |
| Viết đánh giá (`/sach/<slug>`) | Server Action | **Không** | 200, chỉ phần động | **Trắng** | Có (0 → 1) |
| Đánh giá ở trang đơn đã giao (`order-item-review.tsx:22`, `<details>` + cùng `ReviewForm`) | Server Action | **Không** (trang đơn trong stream) | Theo code: như viết đánh giá → 200 trắng | — | Không thử |
| Xóa đánh giá (`review-form.tsx:137`) | Server Action | **Không** | Theo code: 200 trắng | — | Không thử |
| Thêm vào giỏ, form không JS (`/sach/sapiens`) | Server Action | **Không** | **303** → `/gio-hang` | 447 ký tự (dòng giỏ ẩn) | Có |
| Áp mã giảm giá (form GET `#checkout-voucher`) | GET | Không đo được: form `hidden` theo thiết kế (`checkout/page.tsx:120`), ô + nút gắn bằng `form=` | GET 200, HTML đầy đủ (có `<html>`) | 449 ký tự: nội dung thanh toán ẩn | — |
| Đặt hàng (`/thanh-toan`) | Server Action | **Không** | **303** → `/thanh-toan/thanh-cong/<mã>` | 438 ký tự (chi tiết đơn ẩn) | Có |
| Hủy đơn (`/tai-khoan/don-hang/<mã>`) | Server Action | **Không** | 200, chỉ phần động | **Trắng** | Có (`pending` → `cancelled`) |
| Đăng xuất (`/tai-khoan`) | Server Action | **Không** | **303** → `/` | Trang chủ đầy đủ | Có |
| Tìm kiếm (`/tim-kiem`) | GET | Có | GET | Kết quả ẩn | — |

**Nút client, không có đường không JS**: sửa số lượng / xóa dòng giỏ (`cart-view.tsx`), đổi sáng / tối, palette ⌘K, sheet bộ lọc, chatbot (`ssr: false`).

### CI, khách CÓ JS gửi form trước khi hydrate (II.2a, `no-js-diag2` lượt 2 run 39369867281)

JS bật, `context.route` chặn mọi `/_next/static/chunks/*.js` **trước** khi vào trang (React không hydrate; script inline `$RC` / `$RS` vẫn chạy; CSS không chặn vì CSS trong `<head>` chặn hiển thị, mạng chậm thật vẫn có CSS trước khi khách bấm được). Gõ bằng `fill`, bấm nút gửi thật. Lượt 1 (run 39369388789) chặn cả CSS → form đánh giá còn ẩn (React chờ stylesheet trước khi lộ boundary), nên lấy lượt 2.

| Form | Hydrate? | Form hiện? | POST | Header `next-action` | Thân phản hồi | Trang sau khi gửi | Action chạy? |
|---|---|---|---|---|---|---|---|
| Đăng nhập sai mật khẩu | Không | Có | 200 `text/html` | không | 67 782 byte, không `<html>`, có `S:` | **Trắng** (0 ký tự) | Có (`INVALID_CREDENTIALS`) |
| Đăng ký | Không | Có | 200 | không | 68 108 byte, không `<html>` | **Trắng** | Có (user được tạo) |
| Quên mật khẩu | Không | Có | 200 | không | 67 796 byte, không `<html>` | **Trắng** | Có (`"ok":true`) |
| Đăng nhập đúng | Không | Có | **303** → `/tai-khoan` | không | rỗng | 733 ký tự (nội dung tài khoản lộ nhờ `$RC`) | Có |
| Viết đánh giá (form trong stream, lộ nhờ `$RC`) | Không | **Có** | 200 | không | 113 971 byte, không `<html>` | **Trắng** | Có (0 → 1) |
| Hủy đơn | Không | Có (mở `<details>` bằng summary) | 200 | không | 100 286 byte, không `<html>` | **Trắng** | Có (`pending` → `cancelled`) |

→ **Xác nhận**: khách có JS bấm gửi trước khi hydrate xong gặp đúng trang trắng như khi tắt JS, với **mọi** form trả `Result` / `refresh()` (cả form trong stream, vì `$RC` cho form hiện trước khi React hydrate). Action **đã chạy** nên khách không biết kết quả, dễ gửi lại (đăng ký / quên mật khẩu gửi thêm thư, hủy đơn đã hủy → bấm lại báo lỗi). Hệ quả:
- Quy ước CLAUDE.md "`useFormAction` giữ progressive enhancement" **không đúng** với action trả `Result` (chỉ đúng với action kết thúc bằng `redirect()`).
- Tín hiệu `<noscript><input name="no_js">` (đề xuất của B) **không bắt được** ca này (JS bật). Cờ do JS gắn sau hydrate (VD `useFormAction` thêm ô ẩn `js=1` khi đã hydrate; thiếu cờ = gửi trước hydrate hoặc tắt JS) bắt được cả hai ca.
- Dải noscript / câu noscript của A **không hiện** với ca này.

### Tóm lại

1. **GET**: mọi phần trong `<Suspense>` (phụ thuộc phiên, `params` hay `searchParams`) **không hiện** khi tắt JS, kể cả trang đã prerender và trên production. Chỉ còn khung tĩnh: header, footer, kệ trang chủ, h1 của vài trang, form đăng nhập / đăng ký / quên mật khẩu, ô tìm kiếm.
2. **POST không redirect** (trả `Result` hoặc `refresh()`): **trang trắng** dù action **đã chạy**, cả trên production, cả khi có JS mà gửi trước hydrate.
3. **POST kết thúc bằng `redirect()`**: 303, chạy đúng, nhưng trang đích lại rơi vào (1).

## Nguyên nhân

**(1) GET**:
- React stream boundary đã xong dưới dạng `<div hidden id="S:n">…</div>` rồi dùng script inline (`$RC`, `$RS` cho segment) đổi chỗ với fallback / placeholder. Tắt JS thì script không chạy, nội dung giữ `hidden`.
- Đây là cách streaming của React / Next (Cache Components + PPR), không phải lỗi của app. Production (Vercel) giống `next start` (II.1a, II.2b).
- Next chỉ gửi HTML chặn (không stream) cho bot theo user agent (`htmlLimitedBots`), không áp dụng cho trình duyệt người dùng. **Chưa kiểm** `htmlLimitedBots` có còn tác dụng với route PPR không (gợi ý review bản 2).

**(2) POST không redirect** (đọc `node_modules/next/dist/`, Next 16.4.0):
- POST `multipart/form-data` không có header `next-action` vẫn được coi là Server Action (`server/lib/server-action-request-meta.js:38-40`).
- Với route PPR + `cacheComponents`, runtime lấy **postponed state của shell đã prerender** từ incremental cache cho cả POST action (`build/templates/app-page-runtime.js:864-893`, `supportsRDCForNavigations` dòng 350), rồi render với state đó (dòng 1002-1010).
- Action chạy xong trả `formState` để "render a full HTML version" (`server/app-render/action-handler.js:587-594`), nhưng `renderToStream` lại **resume** trên postponed state: chỉ phát các boundary bị hoãn (`app-render.js:1808-1825`, `2295-2335`).
- Ở `next start`, kết quả resume được gửi đi một mình, không ghép với shell trong cache như ở GET (`app-page-runtime.js:1506-1516` so với `resumeRender` dòng 1559). `app-page-runtime.js:1514-1516` là comment trong nhánh `__NEXT_TEST_MODE`, ghi shell "có thể" đã được stream trước; **production cho thấy không** (II.1b).
- `redirect()` trả 303 thân rỗng (`action-handler.js:871-878`).
- Tài liệu Next (`dist/docs/01-app/01-getting-started/07-mutating-data.md:132`) nói form Server Action chạy khi tắt JS, không ghi giới hạn với PPR → đáng báo upstream (★7).

## Phương án

| | Phương án | Giải quyết | Rủi ro / chi phí | JS client |
|---|---|---|---|---|
| A | **Dải `<noscript>`** một lần ở `[locale]/layout.tsx` + **câu `<noscript>` ngay trên nút gửi** của 3 form auth (đăng nhập, đăng ký, quên mật khẩu) | Khách tắt JS hiểu vì sao trang thiếu nội dung, biết trước sẽ không thấy kết quả sau khi gửi | Rất thấp. **Đã code** (dưới) | 0 |
| B | **PRG khi không JS** cho 3 form khung tĩnh | Hết trang trắng sau POST ở 3 form auth | **Hoãn** (★1). Xem "Chi tiết B" | 0 |
| C | Hiện nội dung stream bằng CSS trong `<noscript>` | Nội dung xuất hiện cuối `<body>` (sai vị trí), skeleton vẫn còn | Cao, phụ thuộc chi tiết nội bộ React. Không đề xuất | 0 |
| D | Trang chặn (`instant = false` + đọc dữ liệu động ngoài Suspense) / `await connection()` | **Cần đo trước** (review bản 2, NÊN SỬA 4): `account/orders/[code]/page.tsx:25` có `instant = false` mà POST hủy đơn vẫn chỉ trả phần động (bản 2 lượt 4); `addresses/[id]`, `checkout/success/[code]` có `instant = false` mà nội dung vẫn ẩn khi tắt JS. Chưa có số liệu cho thấy D cho HTML đầy đủ ở GET hay POST | Cao nếu cho cả site (mất khung tĩnh ở GET, ngược hướng perf) | 0 |
| E | Form không JS gửi tới Route Handler riêng (xử lý rồi 303) | Hết trắng sau POST | Nhân đôi logic action; không giải quyết (1) | 0 |
| F | Repro tối giản + báo lỗi upstream cho Next | Có thể sửa (2) ở bản Next sau | Không chắc thời gian; production đã xác nhận trắng → đáng làm (★7) | 0 |

### Phần A (đã code trên nhánh `no-js`)

- `common.noScript` (vi / en): "Trang này cần bật JavaScript để hiện đầy đủ sách, giỏ hàng và tài khoản. Hãy bật JavaScript rồi tải lại trang." `<noscript>` một lần ở `src/app/[locale]/layout.tsx`, ngay dưới `<Header />` (phủ `(shop)`, `(auth)`, not-found, `[...rest]`), `bg-surface-raised`, `border-b`, chữ 16px, nội dung bọc `<span>` `max-w-reading` (68ch) căn giữa. `global-error` / `ErrorView` không đổi. `/admin` ngoài phạm vi (root layout khác, chỉ admin dùng).
- `auth.noScriptSubmit` (vi / en): "Khi tắt JavaScript, sau khi gửi bạn sẽ không thấy kết quả. Hãy bật JavaScript." `<noscript>` ngay trên nút gửi trong `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx` (client component, chuỗi qua props từ page).
- Sửa comment "không cần JS" sai (số dòng trước khi sửa): `(auth)/confirm/page.tsx:24`, `address-card.tsx:11` (+ `:44`), `cancel-order-form.tsx:36` (+ comment "Không JS: trang render lại sau khi gửi"), `order-item-review.tsx:15`, `review-form.tsx:48`, `voucher-field.tsx:23`, `checkout-form.tsx:76` ("Không JS vẫn đặt được"), docstring `lib/use-form-action.ts:16-18` ("giữ progressive enhancement… server render lại kèm state"), và "slug đã prerender vẫn là HTML tĩnh đầy đủ" ở `books/[slug]/page.tsx:42`, `categories/[slug]/page.tsx:19`, `authors/[slug]/page.tsx:19` (sửa comment luôn; ★9 chỉ hoãn phần đo / kiến trúc). Các comment "link thật / radio gốc / form GET chạy không cần JS" còn lại nói về phần tử HTML gốc (link, radio, form GET tự chạy), giữ nguyên.
- CLAUDE.md: quy ước "Tắt JavaScript" (cửa hàng cần JS, dải noscript, câu trên nút 3 form auth, không viết "chạy không cần JS" cho form trả `Result`); câu `useFormAction` (Mutation) "giữ progressive enhancement" → chỉ action kết thúc bằng `redirect()` cho trang dùng được; câu "slug đã prerender vẫn là HTML tĩnh" (Cấu trúc) thêm "nằm trong boundary ẩn chờ `$RC`".
- `e2e/no-js.spec.ts` (desktop + mobile): tắt JS → dải hiện dưới header ở `/`, `/sach`, `/dang-nhap` (chữ ≥ 16px), tiếng Anh ở `/en`; câu báo nằm trên nút gửi ở 3 form auth. Bật JS → không có dải / câu (không thành phần tử), nhưng thẻ vẫn có trong DOM (`header + noscript` = 1 ở 6 trang `/`, `/sach`, 3 trang auth, `/en`; `main form noscript` = 1 ở 3 trang auth), `collectErrors` rỗng (không cảnh báo hydrate) ở `/`, `/sach`, 3 trang auth, `/en`.
- JS client không đổi: `measure:js` (build local, cùng cách đo perf-js ★8: không tính polyfill, baseline 131.4KB) `main` `2cefa0a` → `no-js` `32efcbf`: `vi` 41.5 → 41.5KB, `vi/login` 36.2 → 36.2KB ngoài baseline (ngân sách 50KB, ĐẠT; số trước khi merge chunk-loi). Sau `32efcbf` chỉ đổi comment / docs / e2e, chuỗi `common.noScript` (en) và markup trong `<noscript>` của layout (Server Component, không vào chunk JS client; `measure:js` chỉ đếm `<script src>`) → số JS ở SHA cuối như trên. Thay đổi chỉ là HTML trong `<noscript>` (không phải JS) nên các route khác cũng không đổi; chưa đo riêng `vi/books/<slug>`.
- CI: e2e `32efcbf` run 39370803906 và `d389e67` run 39371894904: 454 qua / 10 skip / 0 flaky (main `51bf49f`: 427 qua + 1 flaky / 10 skip → +26 = 13 test `no-js.spec` × desktop + mobile); CI check `32efcbf` run 39370803903, `d389e67` run 39371894903 xanh; e2e `8b2a69f` (code cuối trước merge) run 39373668503: 454 qua / 10 skip / 0 flaky; sau khi merge `main` (chunk-loi `355f257`) vào `no-js` (`967a009`, push cùng `485ad18`): e2e run 39379786667 (463 qua / 11 skip / 0 flaky; CI check 39379786722 xanh).

**Chỗ hở còn lại sau A** (chấp nhận theo ★1):
- Sau khi gửi form trả `Result` (3 form auth và mọi form trong tài khoản), khách tắt JS vẫn thấy **trang trắng không lời giải thích**: thân POST không có `<html>` / layout nên dải noscript không có trong đó (review bản 2, NGHIÊM TRỌNG 1). Câu noscript trên nút chỉ báo **trước** khi gửi, và chỉ ở 3 form khách thấy được (form khác nằm trong stream, không thấy khi tắt JS).
- Câu báo trên URL (`?error=LINK_EXPIRED`, `?confirmed=1`, `UrlNotices`) không hiện khi tắt JS (II.1a).
- Khách có JS gửi trước hydrate: không được A che (★8).

### Chi tiết B (hoãn, ghi lại để làm sau nếu cần)

**Kết quả phải hiện được khi không JS**:
- `UrlNotices` nằm trong `<Suspense>` vì đọc `searchParams` → PRG về `?error=…` / `?sent=1` không hiện câu báo nào (II.1a xác nhận trên production).
- (B1) **route tĩnh cố định từng kết quả**, prerender, không đọc `searchParams`, không dùng tham số động: VD `/dang-ky/da-gui`, `/quen-mat-khau/da-gui`, `/dang-nhap/sai-mat-khau`, `/dang-nhap/bi-khoa`… (pathnames vi / en, `noindex`, ngoài sitemap). **Không** dùng `/dang-nhap/loi/[code]` + `generateStaticParams` (review bản 2, NGHIÊM TRỌNG 3): trang đọc `params` phải đặt trong `<Suspense>` (quy ước CLAUDE.md) → câu báo lại vào khối ẩn, lặp đúng lỗi cần sửa.
- (B2) nhóm `(auth)` thành trang chặn: **cần đo trước** (như D).
- e2e kiểm câu báo **hiện thật** (`toBeVisible`).

**Tín hiệu "không JS"**:
- Không dựa vào header `next-action` (`server/async-storage/request-store.js:38-47` coi header nội bộ lọt ra userland là sơ suất; bản Next sau có thể lọc đi → mọi khách có JS bị PRG).
- `<noscript><input type="hidden" name="no_js" value="1" /></noscript>` chỉ bắt khách tắt JS; **cờ do JS gắn sau hydrate** bắt cả ca gửi trước hydrate (★8). Nếu làm cả B và ★8 thì dùng cờ JS.

**Nhánh của `signIn`** (`features/auth/actions.ts:43-62`, theo `authFailure`):
- `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `UNKNOWN`, `INVALID_INPUT`, `NETWORK_ERROR` (trùng nghĩa với `?error=NETWORK_ERROR` của `UrlNotices` → route riêng);
- `RATE_LIMITED`: route tĩnh không có số giây → câu không số ("thử lại sau ít phút");
- `EMAIL_NOT_CONFIRMED`: nút gửi lại cần email mà không được đưa email lên URL → câu + link "Đăng ký lại cùng email" (★6);
- giữ `next` sau PRG (qua `safeNextPath`).

**Không lộ dữ liệu**: URL chỉ có mã / trạng thái "đã gửi"; đăng ký / quên mật khẩu chỉ báo mã kiểm trước lookup (như CLAUDE.md); e2e kiểm URL (kể cả `?next=`) không có email.

### `/xac-nhan` (★5, đã quyết)

Khách mở link email thường có JS. Chỉ sửa comment sai (`confirm/page.tsx:24`, đã làm); dải A giải thích khi tắt JS. Form ở đây POST tới Route Handler (`confirm/page.tsx:82`), không phải Server Action, nên không dính ★8 (Route Handler trả 303 / trang lỗi như thường).

### Ngoài phạm vi

- `/admin` (root layout khác, chỉ admin dùng): không có dải noscript, không đo. Comment nói không JS gửi được ở `components/admin/action-button-form.tsx:19`, `features/admin/books/components/cover-form.tsx:19`, `features/admin/books/components/book-form.tsx:45` (Server Action trả `Result`) **chưa kiểm**, nhiều khả năng cũng ra trang trắng (admin dùng chung `cacheComponents`).
- Thêm địa chỉ không JS (`address-form.tsx:164` ô phường `disabled`, phường nạp bằng `fetch`): không sửa ở đợt này; ghi để biết "không JS không thêm được địa chỉ" kể cả khi sau này form hiện được.

## ★ Cần quyết

- ★7 **Gửi issue upstream (F)**: production đã xác nhận POST không JS trắng với PPR + `cacheComponents` (II.1b), trái tài liệu Next (`07-mutating-data.md:132`). Đề xuất: **có**. Claude viết repro tối giản (app Next 16.4 trống: 1 trang có `<Suspense>` + form Server Action trả state, `cacheComponents: true`) trong `D:/Bán sách-backup/`, kèm số liệu `next start`; chủ dự án gửi bằng tài khoản GitHub của mình. ~0,5 ngày.
  - **Kết quả (2026-10-20, chỉ đọc, KHÔNG gửi gì)**: đã có issue mở sẵn đúng lỗi này: [vercel/next.js#99756](https://github.com/vercel/next.js/issues/99756) "Cache Components: a form posted without JavaScript to a partially prerendered page gets a response with no HTML shell (blank page) unless its Server Action redirects", mở 2026-10-06, nhãn "Server Actions", **open**, 2 bình luận (2026-10-10: xác nhận với `next start` + repro tối giản; 2026-10-14: vẫn lỗi ở 16.4.1 và 16.5.0-canary.11, cả Turbopack lẫn webpack, chỉ cần một `<Suspense>` đọc `cookies()` ở root layout). Issue nêu cả ca bấm trước hydrate (★8). Vì vậy **không soạn repro / bài mới**. Đề xuất cho chủ dự án (tùy chọn, tài khoản GitHub của mình): bấm 👍 và / hoặc bình luận thêm 1 dữ kiện mới mà issue chưa có: **production Vercel cũng trắng** (II.1b: 200, `x-vercel-cache: BYPASS`, không `<html>`), Next 16.4.0 + React 19.3.0.
- ★8 **Khách có JS gửi form trước khi hydrate → trang trắng** (II.2a). **Đã quyết (a1+) và đã code trên nhánh `khoa-nut` (2026-10-20, chưa merge)**: `useHydrated` (`lib/use-hydrated.ts`, `useSyncExternalStore`: false ở server và lần render hydrate, true ngay sau đó; mount sau điều hướng phía client nhận true luôn, không nháy); `useFormAction` trả `ready`; `SubmitButton` nhận `ready` + `lockUntilHydrated`, gộp `disabled` truyền vào với pending / khóa, `aria-disabled` luôn khớp `disabled`; **giữ nguyên chữ trên nút** (quyết định của chủ dự án: không đổi chữ "Đang tải…" để khỏi nháy chữ mỗi lần tải trang; nút vẫn đổi độ mờ theo style `disabled` của `Button`). Khóa: 16 component dùng hook (3 form auth, đặt lại mật khẩu, gửi lại email, đặt hàng, thêm / sửa địa chỉ, ngôn ngữ email, hủy đơn, đánh giá (lưu + xóa), 7 component admin) + 2 form `address-card` (`lockUntilHydrated`). Giữ nguyên: thêm giỏ không JS, đăng xuất, `/xac-nhan`. `checkout-form.tsx` / `resend-confirmation.tsx` bỏ `aria-disabled` / `pending` tường minh (SubmitButton gộp; hết lệch `aria-disabled` lúc đếm 60 giây). `auth.noScriptSubmit` → "Cần bật JavaScript để gửi biểu mẫu này." e2e: `prehydrate.spec.ts` (3 form auth + thời gian khóa), `prehydrate-account.spec.ts` (đánh giá, hủy đơn, 2 form sổ địa chỉ, đặt hàng), `no-js.spec.ts` (nút khóa khi tắt JS). Phương án (để tra):
  - (a) **Khóa nút gửi tới khi hydrate**: nút render `disabled` + `aria-disabled` ở server, bật trong `useEffect`. JS client ~0. Hai phạm vi:
    - (a1) chỉ form dùng `useFormAction` (khóa trong hook). Hook có ở: 3 form auth + đặt lại mật khẩu + gửi lại email xác nhận, **đặt hàng** (`checkout-form.tsx:95`), **thêm / sửa địa chỉ** (`address-form.tsx:75`), ngôn ngữ email, hủy đơn, đánh giá, và **7 component admin** (`action-button-form` (dùng ở 4 trang), `cover-form`, `book-form`, `author-form`, `category-form`, `advance-order-form`, `voucher-form`). Vậy (a1) khóa cả đặt hàng và sửa / thêm địa chỉ trước hydrate (chấp nhận được nhưng phải nói ra). Đặt hàng có cả hai kết quả như đăng nhập: thành công 303, lỗi (`OUT_OF_STOCK`, `CART_CHANGED`…) trả `Result` → gửi trước hydrate ra trang trắng (ca lỗi này II.2a chưa đo). **Còn hở**: chỉ có 2 form `<form action>` thường trả `void` + `refresh()` không qua hook: đặt mặc định / xóa địa chỉ (`address-card.tsx:41`, `:57`, `SubmitButton` trần) → gửi sớm vẫn trắng. Chỉ **thêm giỏ không JS** (`add-to-cart-button.tsx:88`) và **đăng xuất** (`sign-out-form.tsx:12`) thật sự nằm ngoài hook và kết thúc bằng 303 (cộng form `/xac-nhan`, POST tới Route Handler).
    - (a2) khóa ở `SubmitButton` (dùng chung): ngoài các form có hook, `SubmitButton` chỉ có ở nút đăng xuất (`account/page.tsx:89`) và 2 form của `address-card.tsx` (form ở dòng 41, 57); thêm giỏ không JS dùng `Button` trần (`add-to-cart-button.tsx:89`) nên không bị đụng. Vậy (a2) khác (a1) ở chỗ khóa thêm 2 form địa chỉ `void` + `refresh()` (đúng chỗ hở của (a1)) và nút đăng xuất (đang chạy được trước hydrate / khi tắt JS); muốn giữ đăng xuất thì thêm prop ngoại lệ.
    - Khách tắt JS: không gửi được form bị khóa (3 form auth trong khung tĩnh: mất cả đăng nhập đúng, đang chạy được nhờ 303). Khi đó phải sửa câu của A: `auth.noScriptSubmit` ("sau khi gửi bạn sẽ không thấy kết quả") thành "cần bật JavaScript để gửi", và câu CLAUDE.md (Mutation) "form vẫn gửi được khi chưa có JS".
    - ~0,5 ngày (a1) / ~1 ngày (a2, rà form redirect) + rà e2e bấm sớm.
  - (b) **Cờ do JS gắn + PRG**: `useFormAction` thêm ô ẩn `js=1` sau hydrate; action thiếu cờ thì `redirect()` sang trang kết quả hiện được (route tĩnh như B1). Che cả tắt JS lẫn gửi sớm, không chặn ai. Cần B1 cho mọi form trả `Result` khách thấy được (3 form auth; form trong stream chỉ thấy khi có JS → trang kết quả cũng phải hiện không cần `$RC`); form `void` + `refresh()` cần cờ riêng. JS client ~0. 2–3 ngày.
  - (c) **Chấp nhận**, chỉ ghi lại: khoảng hở **ước đoán** < 1–2 giây trên 4G (chưa đo; lấy thời điểm hydrate từ lượt Lighthouse của ★9 nếu cần); action vẫn chạy đúng; e2e đã chờ hydrate.
  - Ghi chú khi làm (a): (1) nếu khóa bằng cách để hook trả `pending = true` trước hydrate thì `SubmitButton` hiện `pendingLabel` ("Đang xử lý…"), không phải "Đang tải…" → hook trả cờ riêng (`ready`); (2) `checkout-form.tsx:177-178` (`disabled` + `aria-disabled`) và `resend-confirmation.tsx:64` (`disabled`; lúc đếm 60 giây `aria-disabled` vẫn là `pending`, lệch nhỏ có sẵn) truyền tường minh, đè giá trị của `SubmitButton` → sửa cả hai; (3) đăng xuất bấm trước hydrate vẫn 303 nhưng `onSubmit={() => clearNoteDrafts()}` (`sign-out-form.tsx:12`) không chạy → nháp ghi chú còn trong sessionStorage của tab (rủi ro thấp: mở trang thanh toán xóa khóa nháp của tài khoản khác); (4) sửa comment nói không JS gửi được ở `action-button-form.tsx:19` ("chạy được không cần JS"), `cover-form.tsx:19` ("Không JS: React tự đặt form multipart…"), `book-form.tsx:45` ("không JS vẫn thêm được một tác giả") và `submit-button.tsx:8` ("Không JS thì là nút submit thường"); (5) chuỗi "Đang tải…" là key mới (vi / en) truyền qua props; 2 form `address-card` không có hook nên `SubmitButton` tự biết đã hydrate (prop + `useEffect` trong nút): 2 nguồn cờ; (6) e2e: `SUBMIT_NOTE` (`e2e/no-js.spec.ts:11`) và test "câu báo ngay trên nút gửi" đổi theo câu mới, thêm kiểm nút `disabled` khi tắt JS; `login-typing.spec.ts:81-101` (đăng nhập không JS) đổi thành kiểm nút khóa.
  - Đề xuất: **(a1) + khóa thêm 2 form địa chỉ `void` + `refresh()`** (đặt mặc định, xóa) bằng prop của `SubmitButton`, nút hiện "Đang tải…" khi chưa hydrate. Giữ nguyên chỉ **thêm giỏ không JS** và **đăng xuất** (ngoài hook, luôn 303). Đăng nhập và đặt hàng có cả hai kết quả (lỗi → `Result`, thành công → 303) nên cũng bị khóa; thêm / sửa địa chỉ cũng bị khóa (qua hook). Admin: 7 component admin dùng hook cũng bị khóa trước hydrate (chỉ admin dùng, chấp nhận). Ảnh hưởng người tắt JS: không gửi được form dùng `useFormAction` (mất cả đăng nhập đúng; phần còn lại của site vốn không dùng được khi tắt JS và dải A đã bảo bật JS) → mất ít; sửa câu `auth.noScriptSubmit` + CLAUDE.md cùng lúc. Muốn giữ đăng nhập / đăng ký không JS thì chọn (b).
- ★9 **Trang sách / danh mục / tác giả đã prerender không có nội dung hiện được trong HTML tĩnh** (II.2b, production II.1a): h1, bìa, giá nằm trong `<div hidden id="S:…">` chờ `$RC`. Ảnh hưởng: (1) comment "slug đã prerender vẫn là HTML tĩnh đầy đủ" (3 file `[slug]/page.tsx`, CLAUDE.md) gây hiểu sai; (2) LCP: bìa sách chỉ vẽ được sau khi trình duyệt chạy script inline ngay sau khối ẩn (thường rất nhanh vì cùng tài liệu, nhưng chưa đo); (3) SEO: bot không chạy JS (không thuộc `htmlLimitedBots`) không thấy nội dung. Đề xuất: **đo trước** (Lighthouse / WebPageTest trang sách trên production: LCP element, thời điểm `$RC` chạy; Googlebot render có JS nên SEO chính không ảnh hưởng); comment (1) đã sửa ở đợt này (`d389e67`); chỉ đổi kiến trúc (đưa phần đọc `params` ra khung tĩnh của slug đã prerender) nếu số đo xấu. Không làm ở đợt này.
  - **Kết quả đo (2026-10-20, production, chỉ đọc)**: script tạm ngoài repo `D:/Bán sách-backup/perf-star9/measure-star9.cjs` (Playwright, Pixel 7, mạng 150 ms / 1.6 Mbps / 750 kbps, CPU ×4 như `scripts/perf/measure.ts` mobile; `scripts/perf/measure.ts` không đo được lúc `$RC` lộ nội dung nên viết script riêng), 3 lượt lạnh / trang, trung vị; "h1 hiện" = lúc `main h1` không còn nằm trong `[hidden]` (script `$RC` đổi chỗ). Kết quả thô: `…/perf-star9/result-2026-10-20.json`.

    | Trang | TTFB | FCP | h1 hiện | h1 − FCP | LCP | Phần tử LCP | TBT |
    |---|---:|---:|---:|---:|---:|---|---:|
    | `/sach/sapiens` (h1 trong khối ẩn) | 652 | 2056 | 2318 | +262 | 2544 | `img[alt]` (bìa) | 386 |
    | `/danh-muc/van-hoc` (h1 trong khối ẩn) | 1071 | 2436 | 2680 | +229 | 2892 | `img` (bìa trong lưới) | 366 |
    | `/sach` (đối chứng: h1 ở khung tĩnh) | 493 | 2528 | 2311 | −386 | 3536 | `img` (bìa trong lưới) | 381 |

    (ms. Lượt 1 `/sach/sapiens` là `x-vercel-cache: STALE`, FCP 5712 / LCP 6212: vẫn tính trong trung vị.) Nhận xét: nội dung trong khối ẩn lộ ra ~230–260 ms **sau** FCP (FCP là header / khung tĩnh); LCP là ảnh bìa, tới ~230 ms sau khi h1 hiện. Trang đối chứng `/sach` có h1 tĩnh nhưng LCP còn chậm hơn (lưới stream theo `searchParams`, đã biết ở handoff).
  - **Đề xuất (không làm)**: chưa cần đưa nội dung trang sách ra khung tĩnh. Phần lợi tối đa ước ~0,2–0,3 s LCP trên mobile 4G mô phỏng (trang sách đang 2,5 s, sát mục tiêu < 2,5 s); đổi kiến trúc (đọc `params` ngoài Suspense cho slug đã prerender) đụng quy ước App Shell / 404. Xem lại khi có số liệu thật của khách (Vercel Speed Insights / CrUX) cho thấy LCP trang sách > 2,5 s. SEO: Googlebot nhận HTML như Chrome (★10) và có render JS.
- ★10 **`htmlLimitedBots` với PPR**: chưa kiểm bot có nhận HTML chặn (đầy đủ) ở route PPR không. Đề xuất: kiểm cùng ★9 bằng `curl -A "Twitterbot"` trên production (chỉ đọc).
  - **Kết quả (2026-10-20, production, `curl` GET công khai, chỉ đọc)**: `/` và `/sach/sapiens` với 5 user agent: Chrome 141 (Windows), Googlebot (smartphone), `Twitterbot/1.0`, `facebookexternalhit/1.1`, Zalo (**chưa tìm được user agent thật** của trình xem trước link Zalo: tìm web không ra; dùng chuỗi giả định `Mozilla/5.0 (compatible; Zalobot/1.0; +https://zalo.me)`, kết quả của dòng này chỉ cho biết UA lạ được đối xử như trình duyệt). Phân tích bằng DOM (JS tắt). Thô: `D:/Bán sách-backup/star10/`.

    | UA | `x-vercel-cache` | `title` / `description` / `og:title` / `og:image` | h1 `/sach/sapiens` | `div[hidden][id^="S:"]` (`/` / sapiens) |
    |---|---|---|---|---|
    | Chrome | HIT | đều trong `<head>` | trong `S:` (ẩn) | 5 / 7 |
    | Googlebot | HIT | đều trong `<head>` | trong `S:` | 5 / 7 |
    | Twitterbot | BYPASS | đều trong `<head>` | trong `S:` | 4 / 27 |
    | facebookexternalhit | BYPASS | đều trong `<head>` | trong `S:` | 4 / 27 |
    | Zalo (UA giả định) | HIT | đều trong `<head>` | trong `S:` | 5 / 7 |

    `og:title` của trang sách = tên sách, `og:image` = bìa (Supabase Storage). Twitterbot / facebookexternalhit khớp `htmlLimitedBots` → render động (BYPASS, metadata chờ xong rồi mới gửi `<head>`), nhưng thân trang **vẫn** là các khối `S:` ẩn (htmlLimitedBots không cho HTML phẳng với PPR). Googlebot nhận đúng HTML cache như Chrome.
  - **Kết luận**: bot mạng xã hội **thấy đủ** `og:*` / `title` / `description` trong `<head>` → không cần ★ mới. Còn mở: user agent thật của Zalo (thử bằng cách chia sẻ link trong Zalo rồi xem log Vercel; chủ dự án quyết).

## Thứ tự

1. (Đợt nhỏ riêng, ★2) Tải chunk lỗi: nhánh `chunk-loi`.
2. II.1 đo production: **xong** (Claude, fetch không cookie).
3. A: **xong** trên nhánh `no-js` (dải noscript + câu trên nút 3 form auth + sửa comment + CLAUDE.md + e2e).
4. ★8: đang làm (nhánh `khoa-nut`); ★9 / ★10: chờ đo (chỉ đọc); ★7: chờ (tìm issue / soạn, không gửi).
5. B: hoãn.

## Test

- `e2e/no-js.spec.ts` (desktop + mobile): như "Phần A".
- e2e có JS hiện có (`auth-email.spec.ts`, `account.spec.ts`) giữ nguyên. `login-typing.spec.ts:81-101` (`javaScriptEnabled: false`, đăng nhập không JS rồi về `/gio-hang`) **phải đổi khi làm ★8** (nút đăng nhập khóa khi tắt JS): kiểm nút `disabled`.
- (Đợt nhỏ) e2e chunk lỗi + Vitest `LazyBoundary`: nhánh `chunk-loi`.

## Ước lượng

- A: đã làm (~0,5 ngày).
- B: 1,5–2 ngày (hoãn).
- F / ★7: 0,5 ngày.
- ★8: (a) ~0,5 ngày; (b) 2–3 ngày.
- ★9 / ★10 đo: ~0,5 ngày.

JS client: 0 cho A / B / F; ★8 (a) / (b) ~0.
