# Đợt "no-js": khi tắt JavaScript (plan, chưa code)

Trạng thái (2026-10-20): **plan, chờ duyệt** (bản 2: sau code-reviewer + lượt chẩn đoán thứ 4). Nhánh `no-js` (từ `main` `2cefa0a`), chỉ có file này. Chẩn đoán chạy trên nhánh nháp `no-js-diag` (4 lượt; nhánh đã xóa local + remote). Spec + kết quả thô giữ ngoài repo: `D:/Bán sách-backup/2026-10-20-nojs-diag.spec.ts`, `…-nojs-diag-run3.txt`, `…-nojs-diag-run4.txt`. Nguồn: `docs/plans/sau-ux.md` mục 5, dòng "Tắt JS" trong `docs/progress.md`.

## Mục tiêu

Biết chính xác cửa hàng làm được gì khi trình duyệt tắt JavaScript, rồi chọn mức hỗ trợ hợp lý. Tối thiểu: khách không gặp **trang trắng / trang thiếu nội dung mà không có lời giải thích**. Không đổi trải nghiệm khi có JS, không tăng JS client.

## Kết quả chẩn đoán (2026-10-20, CI Supabase local, `next start`, project `desktop` (Desktop Chrome), `javaScriptEnabled: false`)

Spec nháp, run 39363355630 (lượt 3) và 39364607716 (lượt 4):
- Mỗi form mở trang bằng GET, ghi form có hiện không (`isVisible`) và có nằm trong phần stream bị ẩn không (`closest('[hidden]')`).
- Gán giá trị rồi `requestSubmit()` qua `evaluate`. Cách này gửi được cả form bị ẩn (khách thật không làm được), mục đích là đo phản hồi của server.
- Sau đó ghi status, thân phản hồi, số ký tự hiện trên trang (`innerText`) và dữ liệu trong DB trước / sau.

### GET (chưa gửi form)

| Trang | Ký tự hiện | Boundary stream ẩn | Ghi chú |
|---|---:|---:|---|
| `/` | 3173 | 5 | Kệ sách trong khung tĩnh: 24 / 24 link sách hiện |
| `/sach` | 450 | 42 | Chỉ h1 "Tất cả sách" + header / footer; lưới, bộ lọc, sắp xếp ẩn (24 link sách có trong DOM, 0 hiện) |
| `/sach/sapiens` (sách thật, **đã prerender** lúc build) | 438 | 7 | h1, giá, form thêm giỏ, đánh giá **đều ẩn** (5 link sách trong DOM, 0 hiện) |
| `/sach/<slug tạo sau build>` | 438 | 19 | Như trên |
| `/danh-muc/van-hoc` (đã prerender) | 438 | 21 | h1 + lưới ẩn |
| `/tac-gia/yuval-noah-harari` (đã prerender) | 438 | 14 | h1 + sách ẩn |
| `/tim-kiem?q=sapiens` | 468 | 18 | Ô tìm kiếm (form GET) hiện; kết quả ẩn |
| `/dang-nhap`, `/dang-ky`, `/quen-mat-khau` | 304 / 338 / 312 | 4–5 | h1 + form trong khung tĩnh: hiện |

Trang đã prerender cũng không hiện nội dung: phần đọc `params` nằm trong `<Suspense>` (CLAUDE.md), nên HTML tĩnh vẫn là shell + boundary hoàn tất dạng `<div hidden id="S:…">` cần script `$RC` để đổi chỗ.

### Từng form

| Form (trang) | Loại | Form hiện khi GET? | POST | Trang sau khi gửi | Action chạy? |
|---|---|---|---|---|---|
| Đăng nhập sai mật khẩu (`/dang-nhap`) | Server Action | Có (khung tĩnh) | 200 `text/html`, thân bắt đầu `<script>…__next_f…` + `<div hidden id="S:…">`, không có `<html>` | **Trắng** (0 ký tự) | Có (`INVALID_CREDENTIALS` trong payload) |
| Đăng nhập đúng | Server Action | Có | **303** → `/tai-khoan` | 448 ký tự (header / footer), nội dung tài khoản ẩn | Có |
| Đăng ký (`/dang-ky`) | Server Action | Có | 200, chỉ phần động | **Trắng** | Có (user được tạo) |
| Quên mật khẩu (`/quen-mat-khau`) | Server Action | Có | 200, chỉ phần động | **Trắng** | Không đo (chỉ gửi thư) |
| Đặt lại mật khẩu (`/dat-lai-mat-khau`, phiên thường) | Server Action | **Không** (trong stream) | 200, chỉ phần động | **Trắng** | Có (mật khẩu mới đăng nhập được) |
| Gửi lại email xác nhận | Server Action | **Không tới được**: chỉ hiện sau lỗi `EMAIL_NOT_CONFIRMED` của form đăng nhập (state ở client) | — | — | Không thử |
| **Xác nhận email / đặt lại mật khẩu từ link** (`/xac-nhan`, POST tới Route Handler `/api/auth/confirm`) | Route Handler | **Không** theo code: form trong `<Suspense>` vì đọc `token_hash` từ `searchParams` (`(auth)/confirm/page.tsx:31-33`, `:81`); comment `:24` "(không cần JS)" không còn đúng | Chưa đo | — | — |
| Thêm địa chỉ (`/tai-khoan/dia-chi/moi`) | Server Action | **Không**; ô phường nạp bằng `fetch` khi chọn tỉnh → không JS không có phường | 200 (option phường chèn tay để thử, lượt 4 dùng mã tỉnh / phường thật) | **Trắng** | Không: `INVALID_INPUT` (chưa rõ ô nào) |
| Sửa địa chỉ (`/tai-khoan/dia-chi/<id>`) | Server Action | **Không** | **303** → `/tai-khoan/dia-chi` | 493 ký tự (danh sách ẩn) | Có |
| Đặt địa chỉ mặc định (`/tai-khoan/dia-chi`) | Server Action (`void` + `refresh()`) | **Không** | 200, chỉ phần động | **Trắng** | Có |
| Xóa địa chỉ (form trong `<details>`, `address-card.tsx:45-60`) | Server Action (`void` + `refresh()`) | Không đo được: spec không chọn được form ở cả 2 lượt (lỗi selector chưa giải thích được) | Theo code: như đặt mặc định → dự đoán 200 trắng | — | — |
| Ngôn ngữ email (`/tai-khoan`) | Server Action | **Không** | 200, chỉ phần động | **Trắng** | Có (`vi` → `en`) |
| Viết đánh giá (`/sach/<slug>`) | Server Action | **Không** | 200, chỉ phần động | **Trắng** | Có (0 → 1) |
| Xóa đánh giá (`review-form.tsx:137`) | Server Action | **Không** (trong stream) | Theo code: như viết đánh giá → dự đoán 200 trắng | — | Không thử |
| Thêm vào giỏ, form không JS (`/sach/sapiens`, `books/[slug]/page.tsx:344`) | Server Action | **Không** | **303** → `/gio-hang` | 447 ký tự (dòng giỏ ẩn) | Có |
| Áp mã giảm giá (form GET `#checkout-voucher`) | GET | Không đo được: form có thuộc tính `hidden` theo thiết kế (`checkout/page.tsx:120`), ô + nút gắn bằng `form=` | GET 200, HTML đầy đủ (có `<html>`) | 449 ký tự: nội dung thanh toán ẩn | — |
| Đặt hàng (`/thanh-toan`) | Server Action | **Không** | **303** → `/thanh-toan/thanh-cong/<mã>` | 438 ký tự (chi tiết đơn ẩn) | Có (đơn mới) |
| Hủy đơn (`/tai-khoan/don-hang/<mã>`) | Server Action | **Không** | 200, chỉ phần động | **Trắng** | Có (`pending` → `cancelled`) |
| Đăng xuất (`/tai-khoan`) | Server Action | **Không** | **303** → `/` | Trang chủ đầy đủ | Có |
| Tìm kiếm (`/tim-kiem`) | GET | Có | GET | Kết quả ẩn | — |

**Nút client, không có đường không JS** (bấm không có tác dụng):
- sửa số lượng / xóa dòng giỏ (`cart-view.tsx`, giỏ khách ở localStorage);
- đổi sáng / tối;
- mở palette ⌘K;
- mở sheet bộ lọc;
- chatbot (chỉ ở client, `ssr: false`).

Tóm lại:
1. **GET**: mọi phần trong `<Suspense>` (phụ thuộc phiên, `params` hay `searchParams`) đều **không hiện** khi tắt JS, kể cả trang đã prerender. Chỉ còn khung tĩnh: header, footer, kệ trang chủ, h1 của vài trang, form đăng nhập / đăng ký / quên mật khẩu, ô tìm kiếm. Khách không JS không xem được sách, giỏ, tài khoản, thanh toán, không thấy phần lớn form.
2. **POST không redirect** (trả `Result` hoặc `refresh()`): **trang trắng** dù action **đã chạy**. Khách không biết kết quả, dễ gửi lại.
3. **POST kết thúc bằng `redirect()`**: 303, chạy đúng, nhưng trang đích lại rơi vào (1).

## Nguyên nhân

**(1) GET**:
- React stream boundary đã xong dưới dạng `<div hidden id="S:n">…</div>` rồi dùng script inline (`$RC`) đổi chỗ với fallback. Tắt JS thì script không chạy, nội dung giữ `hidden`.
- Đây là cách streaming của React / Next (Cache Components + PPR), không phải lỗi của app.
- Next chỉ gửi HTML chặn (không stream) cho bot theo user agent (`htmlLimitedBots`), không áp dụng cho trình duyệt người dùng.

**(2) POST không redirect**. Đọc mã nguồn `node_modules/next/dist/` (Next 16.4.0), các đoạn trích khớp mã:
- POST `multipart/form-data` không có header `next-action` vẫn được coi là Server Action (`server/lib/server-action-request-meta.js:38-40`).
- Với route PPR + `cacheComponents`, runtime lấy **postponed state của shell đã prerender** từ incremental cache cho cả POST action (`build/templates/app-page-runtime.js:864-893`, `supportsRDCForNavigations` dòng 350), rồi render với state đó (dòng 1002-1010).
- Action chạy xong trả `formState` để "render a full HTML version" (`server/app-render/action-handler.js:587-594`), nhưng `renderToStream` lại **resume** trên postponed state: chỉ phát các boundary bị hoãn (`app-render.js:1808-1825`, `2295-2335`).
- Ở `next start`, kết quả resume được gửi đi một mình, không ghép với shell trong cache như ở GET (`app-page-runtime.js:1506-1516` so với `resumeRender` dòng 1559).
- `redirect()` trả 303 thân rỗng (`action-handler.js:871-878`).

**Chưa kiểm trên Vercel (production)**:
- `app-page-runtime.js:219-260` có nhánh minimal mode riêng cho Server Action: Vercel gửi postponed state kèm body (`NEXT_RESUME_STATE_LENGTH_HEADER`).
- Comment `:1514-1516` ghi "the static part would have already been streamed first". Nghĩa là trên Vercel, hạ tầng **có thể** tự ghép shell trước phần resume, và trang trắng sau POST chỉ xảy ra khi self-host (`next start`, CI).
- Kết luận "lỗi upstream" vì vậy mới chắc cho self-host. Tài liệu Next (`dist/docs/01-app/01-getting-started/07-mutating-data.md:132`) nói form Server Action chạy khi tắt JS, không ghi giới hạn với PPR.
- (1) không phụ thuộc Vercel: GET đã đo đúng bản build `next start`, và Vercel cũng stream (đợt perf-js, fetch HTML `/sach` của Preview Vercel: nút "Bộ lọc" không nằm trong `<main>` mà trong khối stream cuối `<body>`).

## Phương án

| | Phương án | Giải quyết | Rủi ro / chi phí | JS client |
|---|---|---|---|---|
| A | **Dải `<noscript>`** một lần ở `src/app/[locale]/layout.tsx` (đã có `getTranslations`): "Trang này cần bật JavaScript để hiện đầy đủ sách, giỏ hàng và tài khoản." (vi / en, `common.noScript`, màu token). Phủ cả `[...rest]`, not-found, `(auth)` | Khách hiểu vì sao trang thiếu nội dung; không còn trang thiếu nội dung "không lời giải thích" | Rất thấp. `global-error` / `ErrorView` không ảnh hưởng. ~0,5 ngày | 0 (vài byte HTML) |
| B | **PRG khi không JS** cho 3 form trong khung tĩnh (đăng nhập lỗi, đăng ký, quên mật khẩu): khi gọi không JS, action `redirect()` tới trang **hiện được không JS** kèm kết quả | Hết trang trắng sau POST ở 3 form khách không JS thấy được | Xem "Chi tiết B". 1,5–2 ngày (theo review). Giá trị thấp: sau đăng nhập, khách không JS vẫn không dùng được phần còn lại | 0 |
| C | Hiện nội dung stream bằng CSS trong `<noscript>` (`div[hidden][id^="S:"] { display: contents }`) | Nội dung xuất hiện cuối `<body>` (sau footer, sai vị trí), skeleton vẫn còn | Cao: bố cục vỡ, phụ thuộc chi tiết nội bộ React. Không đề xuất | 0 |
| D | Trang chặn (`export const instant = false` + đọc dữ liệu động ngoài Suspense), hoặc `await connection()`, cho cả site | HTML đầy đủ cho GET + POST | Cao: mất khung tĩnh ở GET cho **mọi** khách, ngược hướng Cache Components / perf. Chỉ đáng cân nhắc cho nhóm `(auth)` (ít lượt xem), làm nền cho B | 0 |
| E | Form không JS gửi tới Route Handler riêng (xử lý rồi 303) | Hết trắng sau POST | Nhân đôi logic action; không giải quyết (1) | 0 |
| F | Repro tối giản + báo lỗi upstream cho Next (sau bước 0) | Có thể sửa (2) ở bản Next sau (nếu Vercel cũng bị) | Không chắc thời gian | 0 |

### Chi tiết B (nếu làm)

**Kết quả phải hiện được khi không JS**:
- `UrlNotices` hiện nằm trong `<Suspense>` vì đọc `searchParams` (`login/page.tsx:62-64`, `forgot-password/page.tsx:42-44`). Không JS thì nó bị ẩn, nên PRG về `?error=…` / `?sent=1` **không hiện câu báo nào**. Hệ quả phụ: `?error=LINK_EXPIRED`, `?confirmed=1` hiện có cũng đang ẩn khi tắt JS.
- Chọn một trong hai:
  - (B1) route tĩnh riêng cho từng kết quả, prerender, không đọc `searchParams` (VD `/dang-ky/da-gui`, `/quen-mat-khau/da-gui`, `/dang-nhap/loi/[code]` với `generateStaticParams` theo danh sách mã được phép; pathnames vi / en, `noindex`, ngoài sitemap);
  - (B2) chỉ nhóm `(auth)` thành trang chặn (D thu hẹp), đọc `searchParams` ngoài Suspense.
- e2e kiểm câu báo **hiện thật** (`toBeVisible`).

**Tín hiệu "không JS"**:
- Không dựa vào header `next-action`: ở 16.4 `headers()` vẫn thấy header này, nhưng `server/async-storage/request-store.js:38-47` coi việc header nội bộ lọt ra userland là sơ suất. Bản Next sau có thể lọc đi, khi đó **mọi khách có JS** bị PRG mà không có cảnh báo.
- Dùng tín hiệu app tự kiểm soát: `<noscript><input type="hidden" name="no_js" value="1" /></noscript>` trong form (chỉ khi tắt JS trình duyệt mới coi là ô của form), hoặc `useFormAction` gắn cờ khi có JS.

**Nhánh của `signIn`** (`features/auth/actions.ts:43-62`):
- giữ `next` sau PRG (qua `safeNextPath`, giá trị từ Referer kiểm trước khi ghép URL);
- `EMAIL_NOT_CONFIRMED`: nút gửi lại cần email mà không được đưa email lên URL → khi không JS hiện câu + link "Đăng ký lại cùng email" (như `confirm/page.tsx:46`);
- `RATE_LIMITED` (có số giây), `INVALID_INPUT`;
- `NETWORK_ERROR` trùng nghĩa với `?error=NETWORK_ERROR` của `UrlNotices` (câu lỗi xác nhận email, `url-notices.tsx:21`) → dùng tham số / route khác, chỉ nhận mã trong danh sách được phép.

**Không lộ dữ liệu**:
- URL chỉ có mã hoặc trạng thái "đã gửi". Không email, tên, số điện thoại, nội dung.
- Đăng ký / quên mật khẩu chỉ báo mã kiểm trước lookup (`PRE_LOOKUP_SIGNUP_CODES`, zod, `NETWORK_ERROR`) như quy tắc CLAUDE.md, nên không lộ email nào có tài khoản.
- e2e kiểm URL (kể cả `?next=`) không có email.

### Đề xuất

1. **Bước 0** (★0, làm trước mọi việc khác): kiểm trên Vercel Preview xem POST không JS có trắng không. Chủ dự án làm: DevTools → tắt JavaScript → đăng nhập sai mật khẩu bằng một email test → xem trang. Claude không gõ mật khẩu trong Chrome.
2. **A**: làm, bất kể kết quả bước 0.
3. **B**: chỉ khi bước 0 cho thấy production cũng trắng **và** chủ dự án muốn 3 form auth chạy đủ không JS (★1). Khi đó dùng B1 + tín hiệu `<noscript><input>`.
4. **F**: chỉ khi bước 0 cho thấy production cũng trắng.
5. Không đầu tư C / D cho cả site.

**Mức hỗ trợ không JS sau đợt (đề xuất)**: mọi trang có dải giải thích cần JS; trang chủ đọc được (kệ tĩnh); đăng nhập đúng / đăng xuất / các action có redirect vẫn chạy như hiện tại. Không làm giả "chạy được không JS" cho sách, giỏ, tài khoản, thanh toán: các phần đó nằm trong stream, không hiện được nếu không đổi kiến trúc.

`/xac-nhan` (★5): khách mở link email thường có JS; đề xuất chỉ sửa comment sai (`confirm/page.tsx:24`), dải A giải thích khi tắt JS. Muốn chạy không JS thì cho Route Handler trả thẳng một trang HTML tối thiểu có form, hoặc trang chặn.

## Đợt nhỏ "tải chunk lỗi khi bấm"

**Hiện trạng**:
- Sheet bộ lọc (`filter-sheet.tsx`), gợi ý mã (`voucher-picker.tsx`), khung chat (`chat-bubble.tsx`), palette (`search-trigger.tsx`) tải nội dung bằng `next/dynamic`.
- `Loadable` của Next (`node_modules/next/dist/shared/lib/lazy-dynamic/loadable.js:40`) tạo **một** `React.lazy` ở cấp module. Chunk tải lỗi → promise bị từ chối được giữ lại → lỗi ném lên error boundary, và mọi lần bấm sau vẫn lỗi tới khi tải lại trang.
- Option `loading` luôn nhận `error: null`.
- Nơi lỗi tới (theo review):
  - palette (trong `Header` của `[locale]/layout.tsx:54`) → **`global-error.tsx`**: mất cả layout;
  - chat → `[locale]/error.tsx`;
  - sheet bộ lọc, gợi ý mã → `(shop)/error.tsx`.

**Phát hiện thêm** (review xác nhận theo `loadable.js:49`):
- `filter-sheet.tsx:9` và `voucher-picker.tsx:8` gọi `dynamic()` không `ssr: false`, không `loading` → không có Suspense riêng.
- Lần bấm đầu khi chunk chưa về: `setState` đồng bộ, nội dung treo lên Suspense gần nhất phía trên → fallback của cả vùng đó có thể nháy. Chưa kiểm bằng mắt.

**Thiết kế**:
- Client component nhỏ `LazyBoundary`: class component, error boundary của React, không dependency, kèm `Suspense fallback={null}` riêng (nên không cần thêm `ssr: false`, ghi lý do trong comment). Bọc phần nội dung tải lười ở 4 chỗ.
- Lỗi → khối báo tại chỗ theo quy ước câu lỗi của ux-messages: mã mới `CHUNK_LOAD_FAILED` ("Không tải được phần này. Kiểm tra kết nối mạng rồi tải lại trang.", en tương ứng) + nút "Tải lại trang" (`location.reload()`).
- Chuỗi truyền qua props từ server.
- "Thử lại" không tải lại trang phải tự viết loader thay `next/dynamic` (vì `React.lazy` đã giữ lỗi): phức tạp hơn.

**Test**:
- e2e: tải trang, chờ `networkidle`, `page.route('**/_next/static/**/*.js', (route) => route.abort())`, bấm nút → thấy khối lỗi + nút; trang **không** thành trang lỗi / `global-error`. `unroute` + "Tải lại trang" → mở được.
  - Cho palette, sheet bộ lọc (mobile), gợi ý mã (cần voucher `is_public`: `createE2eVoucher`, thiếu dữ liệu thì throw, không skip).
  - Khung chat chỉ khi có env chat (e2e có `CHAT_AI_MOCK`).
- Vitest: boundary hiện khối lỗi khi con ném lỗi.

**Ước lượng**: 0,5–1 ngày; JS tải ngay +0,3–0,5KB.

**Đề xuất**: **tách** đợt nhỏ riêng, làm **trước** no-js (★2): độc lập, ảnh hưởng mọi khách có JS (mạng chập chờn), còn lỗi palette làm mất cả layout.

## Thứ tự (sau khi duyệt)

1. (Đợt nhỏ riêng, nếu ★2 đồng ý) Tải chunk lỗi.
2. Bước 0 (chủ dự án, ★0).
3. A: dải `<noscript>` ở `[locale]/layout.tsx`, `common.noScript` vi / en.
   - e2e `no-js.spec.ts` (`javaScriptEnabled: false`, desktop + mobile): dải hiện ở `/`, `/sach`, `/dang-nhap`;
   - e2e có JS: dải không hiện, `collectErrors` không có cảnh báo hydrate.
   - Sửa comment `confirm/page.tsx:24`.
4. B (nếu ★1 = có và bước 0 cho thấy production trắng): B1 + tín hiệu `<noscript><input>` + các nhánh `signIn`.
   - e2e không JS: câu báo hiện thật, URL không có email.
   - e2e có JS: 3 form vẫn trả `Result` tại chỗ (URL không đổi).
5. F (nếu bước 0 cho thấy production trắng): repro tối giản trong `D:/Bán sách-backup/`; chủ dự án quyết gửi issue.
6. Docs: CLAUDE.md (quy ước: trang cần JS có dải noscript; form khung tĩnh dùng PRG khi không JS nếu làm B), `progress.md`.

## Test sẽ thêm

- `e2e/no-js.spec.ts` (desktop + mobile, `test.use({ javaScriptEnabled: false })`): dải noscript; (nếu làm B) đăng nhập sai / đăng ký / quên mật khẩu → câu báo `toBeVisible`, URL không có email; đăng nhập đúng → `/tai-khoan`.
- e2e có JS hiện có (`auth-email.spec.ts`, `account.spec.ts`) giữ nguyên.
- (Đợt nhỏ) e2e chunk lỗi + Vitest `LazyBoundary`.

## Ước lượng

- A: 0,5 ngày.
- B: 1,5–2 ngày (nếu làm).
- F: 0,5 ngày (nếu làm).
- Đợt nhỏ chunk lỗi: 0,5–1 ngày.
- Bước 0: vài phút (chủ dự án).

JS client: 0 cho A / B / F.

## ★ Cần quyết

- ★0 Bước 0: chủ dự án kiểm POST không JS trên Vercel Preview / production (đăng nhập sai mật khẩu bằng email test, JS tắt trong DevTools). Kết quả quyết B và F.
- ★1 Mức hỗ trợ không JS:
  - (a) **chỉ A**: dải giải thích ở mọi trang. Đề xuất nếu bước 0 cho thấy production không trắng; cũng đề xuất nếu trắng, vì sau đăng nhập khách không JS vẫn không dùng được phần còn lại.
  - (b) A + B: 3 form auth chạy đủ không JS.
  - (c) đầu tư kiến trúc (C / D) cho cả site: không đề xuất.
- ★2 Đợt "tải chunk lỗi": tách và làm trước (đề xuất) hay gộp vào no-js?
- ★3 Nút trong khối lỗi chunk: "Tải lại trang" (đề xuất) hay "Thử lại" không tải lại trang (tự viết loader)?
- ★4 Nếu làm B: hiện kết quả bằng route tĩnh riêng (B1, đề xuất) hay nhóm `(auth)` thành trang chặn (B2)? Tín hiệu không JS: `<noscript><input>` (đề xuất) hay header `next-action`?
- ★5 `/xac-nhan` khi tắt JS: chỉ sửa comment + dải A (đề xuất) hay làm trang HTML tối thiểu / trang chặn để xác nhận được không JS?
- ★6 Nếu làm B: `EMAIL_NOT_CONFIRMED` khi không JS hiện câu + link "Đăng ký lại cùng email" (đề xuất; không đưa email lên URL)?
- ★7 Gửi issue upstream (F): chỉ khi bước 0 cho thấy production cũng trắng; chủ dự án gửi bằng tài khoản GitHub của mình.
