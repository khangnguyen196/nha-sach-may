# Đợt "no-js": khi tắt JavaScript (plan, chưa code)

Trạng thái (2026-10-20): **plan, chờ duyệt**. Nhánh `no-js` (từ `main` `2cefa0a`), chỉ có file này. Chẩn đoán chạy trên nhánh nháp `no-js-diag` (đã xóa local + remote; spec + kết quả thô giữ ngoài repo: `D:/Bán sách-backup/2026-10-20-nojs-diag.spec.ts`, `…-nojs-diag-run3.txt`). Nguồn: `docs/plans/sau-ux.md` mục 5, dòng "Tắt JS" trong `docs/progress.md`.

## Mục tiêu

Biết chính xác cửa hàng làm được gì khi trình duyệt tắt JavaScript, rồi chọn mức hỗ trợ hợp lý: không để khách gặp **trang trắng** hay **form không phản hồi** mà không có lời giải thích. Không đổi trải nghiệm khi có JS, không tăng JS client.

## Kết quả chẩn đoán (2026-10-20, CI Supabase local, Chromium `javaScriptEnabled: false`)

Spec nháp `e2e/no-js-diag.spec.ts` (run cuối 39363355630): mỗi form mở trang bằng GET, ghi form có hiện không (`isVisible`) và có nằm trong phần stream bị ẩn không (`closest('[hidden]')`). Sau đó gán giá trị và `requestSubmit()` qua `evaluate` (làm được cả khi form bị ẩn, để đo phản hồi server), ghi status, thân phản hồi, số ký tự hiện trên trang sau đó (`innerText`) và dữ liệu trong DB trước / sau.

### GET (chưa gửi form)

| Trang | Ký tự hiện | Boundary stream bị ẩn | Ghi chú |
|---|---:|---:|---|
| `/` | 3173 | 5 | Kệ sách nằm trong khung tĩnh: 24 / 24 link sách hiện |
| `/sach` | 450 | 42 | Lưới sách stream theo `searchParams`: **0 / 24** link sách hiện (24 link có trong DOM nhưng trong `<div hidden>`) |
| `/sach/<slug>` | 438 | 19 | Thông tin sách, nút thêm giỏ, đánh giá, kệ liên quan trong phần stream |
| `/dang-nhap` | 304 | 5 | Form nằm trong khung tĩnh: hiện |

### Từng form

| Form (trang) | Form hiện khi GET? | POST | Trang sau khi gửi | Action chạy? |
|---|---|---|---|---|
| Đăng nhập sai mật khẩu (`/dang-nhap`) | Có (khung tĩnh) | 200 `text/html`, thân bắt đầu bằng `<script>…__next_f…` + `<div hidden id="S:…">`, không có `<html>` | **Trắng** (0 ký tự) | Có (trả `INVALID_CREDENTIALS`) |
| Đăng nhập đúng | Có | **303** → `/tai-khoan` | `/tai-khoan`: 448 ký tự (header / footer); nội dung tài khoản trong stream ẩn | Có |
| Đăng ký (`/dang-ky`) | Có | 200, chỉ phần động | **Trắng** | Có (user được tạo) |
| Quên mật khẩu (`/quen-mat-khau`) | Có | 200, chỉ phần động | **Trắng** | Không đo (chỉ gửi thư) |
| Đặt lại mật khẩu (`/dat-lai-mat-khau`, phiên thường) | **Không** (trong stream) | 200, chỉ phần động | **Trắng** | Có (mật khẩu mới đăng nhập được) |
| Gửi lại email xác nhận | **Không tới được**: chỉ hiện sau lỗi `EMAIL_NOT_CONFIRMED` của form đăng nhập (state ở client) | — | — | Không thử |
| Thêm địa chỉ (`/tai-khoan/dia-chi/moi`) | **Không**; ô phường nạp bằng `fetch` khi chọn tỉnh → không JS không có phường | 200 (option phường chèn tay để thử) | **Trắng** | Không (dữ liệu không đổi: action trả lỗi, chưa rõ mã) |
| Sửa địa chỉ (`/tai-khoan/dia-chi/<id>`) | **Không** | **303** → `/tai-khoan/dia-chi` | Danh sách địa chỉ: 493 ký tự (nội dung trong stream ẩn) | Có |
| Đặt địa chỉ mặc định (`/tai-khoan/dia-chi`) | **Không** | 200, chỉ phần động (`refresh()`) | **Trắng** | Có |
| Xóa địa chỉ (`/tai-khoan/dia-chi`, form trong `<details>`) | Chưa đo (spec không chọn được form) | Theo code: như đặt mặc định (`refresh()`, không redirect) → dự đoán 200 trắng | — | — |
| Ngôn ngữ email (`/tai-khoan`) | **Không** | 200, chỉ phần động | **Trắng** | Có (`vi` → `en`) |
| Viết đánh giá (`/sach/<slug>`) | **Không** | 200, chỉ phần động | **Trắng** | Có (0 → 1 đánh giá) |
| Thêm vào giỏ (form không JS, `/sach/<slug>`) | **Không** | **303** → `/gio-hang` | Giỏ: 447 ký tự (dòng giỏ trong stream ẩn) | Có |
| Áp mã giảm giá (form GET, `/thanh-toan`) | **Không** | GET 200, **HTML đầy đủ** (có `<html>`) | 449 ký tự: nội dung thanh toán vẫn trong stream ẩn | — (GET) |
| Đặt hàng (`/thanh-toan`) | **Không** | **303** → `/thanh-toan/thanh-cong/<mã>` | Trang thành công: 438 ký tự (chi tiết đơn trong stream ẩn) | Có (đơn mới) |
| Hủy đơn (`/tai-khoan/don-hang/<mã>`) | **Không** | 200, chỉ phần động | **Trắng** | Có (`pending` → `cancelled`) |
| Đăng xuất (`/tai-khoan`) | **Không** | **303** → `/` | Trang chủ đầy đủ | Có |

Tóm lại:
1. **GET**: mọi phần nằm trong `<Suspense>` stream (phụ thuộc phiên hoặc `searchParams`) đều **không hiện** khi tắt JS. Ảnh hưởng: lưới `/sach`, danh mục, tìm kiếm, gần hết trang sách, toàn bộ tài khoản, giỏ, thanh toán, trang đơn. Chỉ khung tĩnh (header, footer, kệ trang chủ, form đăng nhập / đăng ký / quên mật khẩu) là hiện. Đây là vấn đề lớn hơn "trang trắng sau POST": khách không JS **không thấy** phần lớn form.
2. **POST không redirect** (trả `Result`, `refresh()`): **trang trắng**, dù action **đã chạy** (dữ liệu đổi). Khách không biết kết quả, dễ gửi lại.
3. **POST kết thúc bằng `redirect()`** (đăng nhập đúng, sửa địa chỉ, thêm giỏ, đặt hàng, đăng xuất): 303, chạy đúng; trang đích lại rơi vào (1).

## Nguyên nhân

**(1) GET**: React stream nội dung của boundary đã xong dưới dạng `<div hidden id="S:n">…</div>` rồi dùng script inline (`$RC`) đổi chỗ với fallback. Tắt JS thì script không chạy: nội dung giữ `hidden`, fallback (skeleton) giữ nguyên. Đây là cách streaming của React / Next (Cache Components + PPR), không phải lỗi của app. Next chỉ gửi HTML chặn (không stream) cho bot theo user agent (`htmlLimitedBots`), không áp dụng cho trình duyệt người dùng tắt JS.

**(2) POST không redirect** (đọc mã nguồn `node_modules/next/dist/`, Next 16.4.0):
- POST `multipart/form-data` không có header `next-action` vẫn là Server Action (`server/lib/server-action-request-meta.js:38-40`).
- Với route PPR + `cacheComponents`, runtime lấy **postponed state của shell đã prerender** từ incremental cache cho cả POST action (`build/templates/app-page-runtime.js:864-893`, `supportsRDCForNavigations` ở dòng 350), rồi render với state đó (dòng 1002-1010).
- Action chạy xong trả `formState` để "render a full HTML version of the page" (`server/app-render/action-handler.js:587-594`), nhưng `renderToStream` nhận chính postponed state (`server/app-render/app-render.js:1808-1825`) và **resume**: chỉ phát các boundary bị hoãn (`app-render.js:2295-2335`).
- Kết quả resume không ghép với shell trong cache như ở GET (`app-page-runtime.js:1506-1516` so với `resumeRender` ở dòng 1559) → gửi đi một mình → trang trắng.
- `redirect()` trả 303 với thân rỗng (`action-handler.js:871-878`) nên không bị.
- Tài liệu Next (`dist/docs/01-app/01-getting-started/07-mutating-data.md:132`) nói form Server Action vẫn gửi được khi tắt JS, không ghi giới hạn với PPR → gần như chắc là **lỗi upstream** của Next 16.4 (comment ở `action-handler.js:591` ngược với runtime). Chưa kiểm: trên Vercel (minimal mode), nền tảng có tự ghép shell trước phần resume của POST không; spec chạy với `next start`.

## Phương án

| | Phương án | Giải quyết | Rủi ro / chi phí | JS client |
|---|---|---|---|---|
| A | **Thông báo `<noscript>`** ở layout cửa hàng: một dải ngắn "Trang này cần bật JavaScript để hiện sách, giỏ hàng và tài khoản" (vi / en, messages), hiện ở mọi trang khi tắt JS | Khách hiểu vì sao trang thiếu nội dung; không còn "trang trắng không lời giải thích" cho GET | Rất thấp; 0 JS. ~0,5 ngày (chuỗi + e2e `javaScriptEnabled: false`) | 0 |
| B | **PRG khi không JS** cho form nằm trong khung tĩnh (đăng nhập sai, đăng ký, quên mật khẩu): action thấy không có header `next-action` (`(await headers()).has('next-action')`) → `redirect()` về chính trang kèm mã trên URL (`?error=INVALID_CREDENTIALS`, `?sent=1`); trang đọc tham số trong `UrlNotices` (đã có cho `?error=` / `?confirmed=1`) | Hết trang trắng sau POST ở 3 form khách không JS dùng được | Trung bình: mất chữ đã gõ khi không JS (form tải lại); mã lỗi trên URL. **Không** đưa email / dữ liệu cá nhân lên URL (đăng ký / quên mật khẩu chỉ `?sent=1`; câu "Kiểm tra hộp thư" không nhắc email). Giữ đúng quy tắc chống lộ email: đăng ký / quên mật khẩu chỉ có `?sent=1` hoặc lỗi kiểm trước lookup. ~1 ngày + e2e | 0 |
| C | Hiện nội dung stream khi không JS bằng CSS trong `<noscript>` (`div[hidden][id^="S:"] { display: contents }`) | Nội dung xuất hiện (cuối `<body>`, sau footer, sai vị trí); fallback / skeleton vẫn còn | Cao: bố cục vỡ, trùng lặp, phụ thuộc chi tiết nội bộ của React (`S:` / `B:`); không đề xuất | 0 |
| D | Trang "blocking" (`export const instant = false` + đọc dữ liệu động ngoài Suspense) cho các trang form | Có thể ra HTML đầy đủ cho cả GET và POST | Cao: mất khung tĩnh ở GET (TTFB như SSR) cho **mọi** khách, ngược hướng đã chọn (Cache Components, perf); chưa kiểm được (layout `(shop)` có Suspense của header) | 0 |
| E | Form không JS gửi tới Route Handler riêng (xử lý rồi 303) | Hết trắng sau POST | Nhân đôi logic action, dễ lệch; không giải quyết (1) | 0 |
| F | Báo lỗi upstream cho Next (POST action không JS trên route PPR chỉ trả phần resume) | Có thể sửa (2) ở bản Next sau | Không chắc thời gian; cần repro tối giản | 0 |

**Đề xuất**: **A + B**, kèm **F** (repro tối giản, chủ dự án quyết có gửi không). Mức hỗ trợ không JS sau đợt:
- Đọc được trang chủ (kệ tĩnh), đăng nhập / đăng ký / quên mật khẩu chạy đủ (có thông báo kết quả);
- mọi trang khác hiện dải `<noscript>` giải thích cần JS;
- không làm giả "chạy được không JS" cho tài khoản / giỏ / thanh toán (form nằm trong stream, không hiện được nếu không đổi kiến trúc).

Phương án B áp cho form nào:
- Áp: đăng nhập (lỗi), đăng ký, quên mật khẩu (form trong khung tĩnh, khách không JS thấy được).
- Không áp (form không hiện khi không JS, A đã giải thích): đặt lại mật khẩu, địa chỉ, ngôn ngữ email, đánh giá, đặt hàng, hủy đơn, gửi lại email xác nhận.
- Đã chạy được (303): đăng nhập đúng, sửa địa chỉ, thêm giỏ, đặt hàng, đăng xuất. Không đổi.

## Đợt nhỏ "tải chunk lỗi khi bấm" (mục 4.3 của prompt)

**Hiện trạng**: nút mở sheet bộ lọc (`filter-sheet.tsx`), gợi ý mã (`voucher-picker.tsx`), khung chat (`chat-bubble.tsx`), palette (`search-trigger.tsx`) tải nội dung bằng `next/dynamic`. `Loadable` của Next (`node_modules/next/dist/shared/lib/lazy-dynamic/loadable.js`) tạo **một** `React.lazy` ở cấp module: chunk tải lỗi (mạng chập chờn) → promise bị từ chối được giữ lại → lỗi ném lên error boundary gần nhất (`error.tsx` của route: cả trang thành trang lỗi), và mọi lần bấm sau vẫn lỗi tới khi tải lại trang. Option `loading` của `next/dynamic` luôn nhận `error: null`, không dùng để báo lỗi được.

Phát hiện thêm (đọc code, chưa kiểm bằng mắt): `filter-sheet.tsx` và `voucher-picker.tsx` gọi `dynamic()` **không** có `{ ssr: false }` và không có `loading` → `Loadable` không tự bọc `Suspense` (`hasSuspenseBoundary` false). Lần bấm đầu khi chunk chưa về, nội dung treo lên `Suspense` gần nhất phía trên (VD boundary của lưới / trang thanh toán), có thể làm fallback của cả vùng đó nháy. `search-trigger.tsx`, `chat-bubble.tsx` có `ssr: false` nên không bị.

**Thiết kế**:
- Một client component nhỏ `LazyBoundary` (class component, error boundary của React, không dependency), bọc phần nội dung tải lười ở 4 chỗ, kèm `Suspense fallback={null}` riêng.
- Lỗi → khối báo lỗi tại chỗ theo quy ước câu lỗi của ux-messages: mã mới `CHUNK_LOAD_FAILED` ("Không tải được phần này. Kiểm tra kết nối mạng rồi thử lại.", en tương ứng) + nút "Tải lại trang" (`location.reload()`). Nút "Thử lại" không tải lại trang thì `React.lazy` đã giữ lỗi, phải tự viết loader mới cho mỗi lần thử: phức tạp hơn, đề xuất "Tải lại trang".
- Chuỗi truyền qua props từ server (client leaf không `useTranslations`).
- Sửa luôn `{ ssr: false }` cho `filter-sheet.tsx`, `voucher-picker.tsx`.

**Test**:
- e2e: tải trang, chờ `networkidle`, `page.route('**/_next/static/**/*.js', (route) => route.abort())`, bấm nút → thấy khối lỗi + nút "Tải lại trang", trang không thành trang lỗi; `unroute` + bấm "Tải lại trang" → mở được. Desktop + mobile, cho sheet bộ lọc, palette, gợi ý mã (khung chat chỉ khi có env chat).
- Vitest: boundary hiện khối lỗi khi con ném lỗi.

**Ước lượng**: 0,5–1 ngày; JS tải ngay +0,3–0,5KB (boundary dùng chung).

**Đề xuất**: **tách** thành đợt nhỏ riêng, làm **trước** no-js: độc lập, ảnh hưởng mọi khách có JS (mạng chập chờn), không cần quyết gì lớn.

## Thứ tự (sau khi duyệt)

1. (Đợt nhỏ riêng, nếu ★2 đồng ý) Tải chunk lỗi.
2. A: dải `<noscript>` (layout `(shop)` + `(auth)`), chuỗi `common.noScript` vi / en, e2e `no-js.spec.ts` (`javaScriptEnabled: false`): `/sach`, `/tai-khoan` hiện dải; khi có JS thì không hiện.
3. B: PRG cho 3 form auth.
   - Helper `isNativeFormPost()` trong `lib/` (đọc `headers()`); action gọi `redirect` có điều kiện; giữ `Result` khi có JS (không đổi trải nghiệm hiện tại).
   - `UrlNotices` đọc `?error=` / `?sent=1` của 3 trang.
   - e2e không JS cho từng form: đăng nhập sai → trang đăng nhập có câu lỗi; đăng ký → "Kiểm tra hộp thư"; quên mật khẩu → "đã gửi".
   - Kiểm URL không có email.
4. F: repro tối giản (app Next trống + `cacheComponents` + 1 form action trả state) trong `D:/Bán sách-backup/`, ghi kết quả; chủ dự án quyết gửi issue.
5. Docs: CLAUDE.md (quy ước: form trong khung tĩnh dùng PRG khi không JS; trang cần JS có dải noscript), `progress.md`.

## Test sẽ thêm

- `e2e/no-js.spec.ts` (desktop + mobile, `test.use({ javaScriptEnabled: false })`):
  - dải noscript ở `/`, `/sach`, `/tai-khoan` (đã đăng nhập không JS qua form);
  - đăng nhập sai → câu lỗi hiện, URL không có email;
  - đăng ký (email mới, xóa ở `finally`) → "Kiểm tra hộp thư", URL chỉ `?sent=1`;
  - quên mật khẩu → câu "đã gửi";
  - đăng nhập đúng → `/tai-khoan`.
- Vitest `isNativeFormPost` (có / không header `next-action`).
- e2e có JS hiện có (`auth-email.spec.ts`, `account.spec.ts`) giữ nguyên: chứng minh trải nghiệm có JS không đổi.

## Ước lượng

- A: 0,5 ngày.
- B: 1 ngày (3 action + `UrlNotices` + e2e).
- F: 0,5 ngày.
- Đợt nhỏ chunk lỗi: 0,5–1 ngày.

Tổng no-js (A + B + F) ~2 ngày. JS client: 0 (noscript là HTML; PRG ở server).

## ★ Cần quyết

- ★1 Mức hỗ trợ không JS: (a) **A + B** như đề xuất (đọc trang chủ + auth chạy đủ, còn lại có dải giải thích); (b) chỉ A (0,5 ngày, auth vẫn trắng sau POST); (c) đầu tư kiến trúc để mọi trang chạy không JS (D / C, không đề xuất: đổi hướng Cache Components, tốn nhiều ngày, rủi ro perf). **Đề xuất (a).**
- ★2 Đợt "tải chunk lỗi": tách và làm trước no-js (đề xuất) hay gộp vào no-js?
- ★3 Nút trong khối lỗi chunk: "Tải lại trang" (đề xuất, đơn giản, chắc chắn) hay "Thử lại" không tải lại trang (tự viết loader thay `next/dynamic`, phức tạp hơn)?
- ★4 Gửi issue upstream cho Next (F) sau khi có repro tối giản? Đề xuất: làm repro, chủ dự án tự gửi (tài khoản GitHub của chủ dự án).
- ★5 Mã lỗi trên URL khi không JS (`?error=INVALID_CREDENTIALS`): chấp nhận (đề xuất; mã không chứa dữ liệu cá nhân, `UrlNotices` đã làm vậy với `?error=`) hay chỉ `?error=1` chung chung?
- ★6 Đặt lại mật khẩu: form nằm trong stream (đọc phiên recovery) nên không hiện khi tắt JS. Giữ (dải noscript giải thích, đề xuất) hay đưa form ra khung tĩnh + kiểm phiên trong action (đổi luồng đã ổn định)?
