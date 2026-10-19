# Bàn giao cho phiên Claude Code mới (cập nhật 2026-10-19, ux-messages đã lên production)

Đọc file này khi bắt đầu phiên ở thư mục dự án, sau `CLAUDE.md` (được nạp tự động).

## Trạng thái

- **Hiện tại**: `main` mới nhất là trạng thái đang chạy trên production (https://nha-sach-may.vercel.app). **Không còn migration nào chờ chạy.**
- **Việc tiếp theo**: đợt **`sau-ux`** (trạng thái + kết quả ở đầu `docs/plans/sau-ux.md` trên nhánh `sau-ux`, **chưa merge**): mục 1–4 + 6 code xong, CI xanh; chờ chủ dự án test Preview (đăng ký), duyệt mục 6 + kết quả H1–H3, chạy `supabase/checks/catalog-fix.sql` (mục 7). Sau đó đợt **perf-js** (`docs/plans/perf-js.md`: bước 0 `scripts/analyze-diff.mjs` đã xong → D → sheet lazy → C). Việc để sau: `docs/progress.md`.
- **Đợt `ux-messages` (thông báo cho khách hiểu chuyện gì đang xảy ra)**: **đã lên production 2026-10-19**. Plan + báo cáo: `docs/plans/ux-messages.md` (mục "Sáng 2026-10-19").
  - **Lên production 2026-10-19**: migration B chạy trên production (chủ dự án, sớm hơn deploy vài phút; KB1–KB3 khớp). Merge fast-forward lên `main`: `fa78aab..a723621` rồi `a723621..c3e2131` (`git push origin ux-messages:main`, không force). CI + e2e trên `main` xanh (a723621: e2e 411 qua / 9 skip / 0 fail / 0 flaky, run 39212964358; c3e2131: CI check run 39214787681, e2e cùng SHA run 39213724077). Vercel Production: a723621 07:00:03Z, c3e2131 07:17:21Z, cả hai success.
  - Migration **A** (`20261018120000_voucher_suggestions.sql`) và **B** (`20261018130000_error_reasons.sql`) đều đã chạy; `INVALID_VOUCHER` đã xóa ở đợt `sau-ux`.
  - Mục 16 (tên tác giả): `supabase/checks/authors-fix.sql` đã chạy sáng 2026-10-19, K1–K5 khớp; production hiện tên mới.
  - **Test production bằng Claude in Chrome (https://nha-sach-may.vercel.app)**: footer vi / en, 404 sách + trang lạ, tên tác giả mới (Nguyễn Huy Thiệp, Dương Thụy, Quan Thế Dân; `lap-nguyen`, `quang-lap-nguyen` → 404; `nguyen-quang-lap` có "Bạn Văn" + "Kien Chuot Va Ruoi" 1 lần; tìm "nguyen huy thiep" ra "Vong bướm"), quên mật khẩu (email không có tài khoản và email có tài khoản gửi 2 lần → cùng câu "đã gửi"), đổi ngôn ngữ giữ `?page=2`, không tìm thấy đơn vi / en (HTTP 404), thanh toán sau B ("AB" → "Không có mã giảm giá này. Bạn kiểm tra lại từng ký tự nhé."; "CHAOBAN10" với tạm tính 77.000 ₫ → "Mua thêm 73.000 ₫ để dùng mã này (đơn từ 150.000 ₫)."; gợi ý TEST10 → giảm 7.700 ₫ → Bỏ mã), giỏ trả về như cũ: **tất cả ĐẠT**.
  - Test tay trên Preview trước merge (8 bước) ĐẠT.
- **Phase 11 (chatbot gợi ý sách "Mây")**: **đã merge vào `main`** (ff, 2026-10-18) sau khi chủ dự án test tay OK trên bản Preview (máy tính + iPhone Safari). Nhánh `phase-11` đã xóa (local + remote). Chi tiết: `docs/plans/phase-11.md` → "Báo cáo Phase 11".
  - Migration `chat_quota` + `chat_quota_defaults` đã chạy trên Supabase.
  - `GEMINI_API_KEY` + `CHAT_QUOTA_TOKEN` đặt ở Vercel **Production** (đã bỏ khỏi Preview).
  - Số đường dây nóng Ngày Mai trong `chat.crisis` đã được chủ dự án kiểm.
  - `measure:js` (2026-10-18): trang chủ + 41.1KB, trang sách + 43.9KB. Bong bóng + 1.5KB; khung chat 9.0KB gzip, chỉ tải khi bấm.
  - CI trước merge (`aec9a37`): check xanh; e2e 345 qua, 1 flaky (`cart-account.spec:94`, request 404 ở mục dưới).
- **Việc còn lại cho đợt sửa lỗi sau Phase 11**: đã làm ở nhánh `ux-messages` (mục 14, 15, 16 của `docs/plans/ux-messages.md`); ghi chú cũ giữ dưới đây để tra:
  1. **Trang đăng nhập mất chữ đã gõ**: `login/page.tsx` bọc form trong `<Suspense fallback={<Form …/>}>`, fallback là cùng form nhưng chưa có `?next=`. Sau điều hướng phía client, fallback hiện và hydrate trước, rồi bị thay bằng form thật khoảng 60 ms sau, nên chữ đã gõ bị mất. Tái hiện ở cả `/en`. e2e đã né bằng `fillLogin` chờ form thật; lỗi UX vẫn còn.
  2. **Request 404 làm e2e đăng nhập / đăng xuất chập chờn**: `account.spec.ts:71`, `cart-account.spec.ts:94`. Console có "Failed to load resource: 404", chưa rõ URL nào; qua ở lần retry; có từ trước Phase 11.
  3. **Tên tác giả ngược thứ tự**: dữ liệu Google Books, VD "Huy Thiệp Nguyễn". Chatbot và trang sách hiện đúng như trong DB.
- Phase 1–10 trong Lộ trình (`CLAUDE.md`) **đã xong và đã merge vào `main`**, cùng bản sửa email auth (`fix-auth-default-email`).
- Đợt sửa sau test tay (`fix-manual-test`, gồm `check-after-manual-test`) **đã merge vào `main`** (ff, `f4899ab`, 2026-10-17) sau lượt e2e toàn bộ sạch; hai nhánh đã xóa (local + remote).
- CI (`.github/workflows/ci.yml`) xanh trên `main` (job `check`: typecheck, lint, Vitest, build).
- **e2e chạy trên Supabase local ở GitHub Actions** (`e2e-project`, **đã merge `main`** ff `df891fb`, 2026-10-17; nhánh đã xóa local + remote): `.github/workflows/e2e.yml` chạy `supabase start` (DB trống dựng từ `schema.sql` + seed, `supabase/config.toml`), `scripts/e2e-seed.ts` nạp 58 sách test (`e2e/fixtures/books.json`, bìa giả), rồi `npx playwright test`. Mọi push (trừ `docs/**`, `*.md`) + chạy tay; không secret. Guard `scripts/e2e-env.ts` từ chối production / host cloud; `ci.yml` không còn job e2e. Không còn chạy e2e trên DB production.
  - Kết quả: 2 lượt liền trên nhánh + 1 lượt trên `main` đều **265/265, 0 flaky** (~5,9–6,4 phút Playwright; cả job ~8,5 phút: npm ci 14 s, `supabase start` ~75 s, Chromium 13–21 s, seed 3 s).
  - `next.config.ts`: cấu hình ảnh qua `coverImagesConfig` (`src/lib/cover-images-config.ts`): pattern http / IP local chỉ khi URL Supabase là local; build Vercel (`VERCEL=1`) với URL local → build fail (chống SSRF qua `/_next/image`, Vitest). Đã kiểm production sau deploy (chỉ đọc): bìa hiện ở trang chủ, `/danh-muc/van-hoc`, `/sach/sapiens`, 0 ảnh lỗi.
  - Theo dõi: `public.ecr.aws` đôi lúc trả `toomanyrequests` khi kéo image (CLI tự thử lại, +~13 s); nếu làm fail job thì thêm cache image Docker.
- Migration trong `supabase/migrations/` **đã chạy hết** trên Supabase (kể cả B, 2026-10-19). `src/types/database.ts` sửa tay theo migration A; kiểm tự động bằng `supabase gen types --local` trên CI là mục 3 của đợt `sau-ux`.
- **Đã deploy** `https://nha-sach-may.vercel.app` trên Vercel: tự deploy từ `main`, region `sin1`, env chỉ 2 biến `NEXT_PUBLIC_SUPABASE_*` (chưa đặt `SITE_URL`, app dùng `VERCEL_PROJECT_PRODUCTION_URL`). GitHub Secrets 2 biến đó đã có.
- Supabase Auth: Site URL = domain Vercel; Redirect URLs `…/api/auth/confirm**` cho production + localhost (thử bằng link giả về đúng `/xac-nhan`); SMTP riêng qua Gmail; 2 template song ngữ (`supabase/templates/`) đã dán.

## Đọc gì trước

1. `docs/plans/final-report.md`: tính năng đã có, checklist test tay, việc của chủ dự án theo thứ tự ưu tiên, rủi ro còn lại.
2. `docs/plans/owner-todo.md`: hướng dẫn từng bước (Redirect URLs, Vercel, CI, e2e trên Supabase local).
3. Cần chi tiết một phần thì đọc `docs/plans/phase-<n>.md` (mục "Báo cáo" và "Quyết định tự chọn" ở đầu file) và `docs/plans/data.md` (dữ liệu sách, bìa).

## Vận hành (production)

- **Mã tra cứu ở trang lỗi** (`error.digest`): tra trong Vercel → project → Logs, lọc theo mã. Gói **Hobby chỉ giữ runtime log 1 giờ** → phải tra trong 1 giờ sau khi khách gặp lỗi; không có cách xem lại log cũ (không đặt lịch "xem log hằng tuần").
- **Lượt dùng chatbot Mây**: chạy `supabase/checks/chat-usage.sql` (chỉ đọc) trong SQL Editor: Q1 lượt gọi Gemini mỗi ngày (trần 400), Q2 số khách / câu hỏi mỗi ngày (mỗi khách tối đa 30), Q3 10 phút đông nhất (trần 10 / phút). Bảng `private.chat_quota` chỉ giữ ~3 ngày.

## Cách làm việc chủ dự án đã quen

- Mọi việc làm trên **nhánh riêng**, kiểm tra đủ (`typecheck`, `lint`, `build`, Vitest, e2e liên quan), push nhánh rồi **báo trước khi merge**. Merge vào `main` bằng `--ff-only` khi đã được duyệt, xong thì xóa nhánh và xem CI.
- Không mở / đọc / sửa `.env.local`; chỉ chạy `npm run check:env`. Không chạy SQL lên Supabase: viết migration (idempotent) để chủ dự án chạy.
- Thêm dependency phải hỏi trước.
- e2e chạy trên **Supabase local ở CI** (máy dev không có Docker): push nhánh → `gh run list --workflow e2e.yml --branch <nhánh>` / `gh run view <id> --log-failed`; chạy lại tay `gh workflow run e2e.yml --ref <nhánh>`. Không nới timeout, không xóa / skip test. Một test fail lặp lại thì dừng và báo. Không chạy `npx playwright test` khi chưa có Supabase local (`scripts/e2e-env.ts` sẽ báo lỗi, không bao giờ rơi về production).

## Đã xong trong đợt sửa sau test tay (đã merge `main`, deploy production 2026-10-17)

- Admin không còn thấy đơn của khách khác ở `/tai-khoan/don-hang`, chi tiết đơn, `/thanh-toan/thanh-cong/[code]` (query phía khách lọc `user_id`; RLS giữ nguyên cho `/admin`).
- Trang chi tiết đơn: tên / bìa sách dẫn tới trang sách; đơn đã giao có nút "Đánh giá" / "Sửa đánh giá" mở form ngay dưới dòng (cùng đánh giá với trang sách).
- `/xac-nhan` đọc lỗi sau `#` (template mặc định) → "Liên kết đã hết hạn" + "Yêu cầu liên kết mới".
- Link "Xem trên cửa hàng" của sách / danh mục đang ẩn: mờ, không bấm được, "Đang ẩn, khách không thấy".
- Client Supabase public: timeout + retry (build 10 s × 3 lần, chạy thật 5 s × 2 lần); hết lượt thì build fail rõ ràng.
- Mã `NETWORK_ERROR` ("Không kết nối được máy chủ, thử lại sau ít phút.") cho mọi form qua `useFormAction`, lỗi mạng của Supabase Auth và PostgREST.
- Font tự host (`src/assets/fonts`, OFL): build không cần mạng tới Google Fonts.
- `LocaleSwitcher`: giữ query khi bấm trước hydrate (inline script), bỏ `?` thừa.
- Tốc độ (`docs/plans/perf.md`): bìa đầu lưới ưu tiên cao; footer không gây CLS; `AdminLink` chỉ prefetch khi rê chuột / focus (is_admin mỗi lần mở trang admin ~19 → 2); trạng thái đang tải khi sắp xếp / lọc / sang trang và khi áp voucher.
- e2e mới: `admin-account-orders.spec` (đã chuyển từ fail sang qua), `crawl.spec` (dò lỗi chỉ đọc), đánh giá trên trang đơn, `/xac-nhan` lỗi sau `#`, prefetch admin, trạng thái đang tải. Script đo tốc độ: `npx tsx scripts/perf/measure.ts` (`--only`, `--devices`). Trên production chỉ đo phần công khai (không tạo dữ liệu); luồng cần phiên + `--cleanup-only` / `--check-leftovers` chỉ với `--base http://localhost:<port>` trỏ Supabase local.

## Việc mở

- Trang lưới có `?page=` vượt quá số trang (soft 404 + `noindex`, VD `/sach?lang=en&page=2` khi chỉ có ≤ 24 sách tiếng Anh) làm trình duyệt báo **React error #419** trong console (`notFound()` trong Suspense sau khi đã stream). **Đã sửa** (2026-10-18): trang hiện `InlineNotFound` (UI 404 + `noindex`, không throw → hết #419), vẫn **HTTP 200** (soft 404) **có chủ đích**. Bản `fix-soft-404` từng cho proxy hỏi `/api/catalog/page-exists` để trả 404 thật, nhưng mọi trang > 1 chậm thêm ~100 ms trên production (`/sach` 112–120 ms, `/sach?page=2` 211–229 ms) → `perf-grid-404` bỏ kiểm ở proxy + xóa route. Đo lại production sau deploy `a6b1d96` (curl giữ kết nối, trung vị 10 lượt sau 3 lượt làm ấm, 2 lượt): `/sach` 146 / 127 ms, `/sach?page=2` 120 / 120 ms. `<meta robots>` của soft 404 nằm ở `<head>` hoặc `<body>` tùy boundary xong trước / sau shell (như streaming metadata của Next).
- **Kết quả bàn giao lần trước (2026-10-17)**:
  - Mạng: đường tới Supabase chập chờn (health trung bình 1,4–2,2 s, có lần timeout 10 s, bắt tay TLS tới 5,9 s) dù vercel.com ~0,25 s. Bật **Cloudflare WARP** thì health trung bình 298 ms, bắt tay ≤ 0,23 s. (Trước đây cần đo health trước khi chạy e2e trên production; nay e2e chạy trên Supabase local ở CI, chỉ còn liên quan khi dev / build / đo tốc độ từ máy dev.)
  - `npm run test:e2e` toàn bộ (gồm `crawl.spec`): **261/261 qua ngay lượt đầu** (20,9 phút), kể cả các test `checkout.spec` trước đây chưa chạy được (voucher sai / đủ tối thiểu, VietQR, RPC không tự hủy đơn đã trả). Log `fetch failed (e2e fault injection)` là của `error-page.spec`, có chủ đích.
  - CI trên `main` xanh; Vercel Production `f4899ab` deploy xong.
  - Kiểm 3 điểm trên https://nha-sach-may.vercel.app bằng dữ liệu e2e tạm (user khách + admin, danh mục / sách `e2e-admin-…`, 1 đơn đã giao của khách + 1 đơn của admin; script tạm đã xóa): admin ở `/tai-khoan/don-hang` chỉ thấy đơn của mình ✔; admin mở `/thanh-toan/thanh-cong/<mã đơn khách>` → UI "Không tìm thấy trang" ✔ nhưng **HTTP 200** (soft 404: Cache Components stream trước khi `notFound()` chạy; trang cần đăng nhập nên không ảnh hưởng SEO, không lộ dữ liệu). **Đã sửa** (`fix-soft-404`, merge `main` 2026-10-18): proxy đếm đơn theo mã + `user_id` bằng client theo phiên → HTTP 404; đơn đã giao của khách có nút "Đánh giá" ✔. Dọn xong `measure.ts --check-leftovers`: 0 sót mọi loại.
- Còn lại sau `fix-soft-404` / `perf-grid-404` — đã xử lý ở nhánh `ux-messages`:
  - `/tai-khoan/don-hang?page=99`: **đã quyết giữ soft 404** (HTTP 200 + `noindex`), có link "Về trang đầu" giữ bộ lọc. Lý do: trang riêng tư, không index, 404 thật không có lợi mà thêm một query ở proxy. **Đóng.**
  - `/tai-khoan/dia-chi/[id]`: proxy trả 404 thật (id sai / không có / của người khác), trang không còn gọi `notFound()` trong Suspense.
  - Trang đặt hàng thành công: tiêu đề "Đặt hàng thành công" nằm trong boundary, đơn không có thì chỉ hiện UI 404 của đơn.
  - `layout.spec.ts:66`: lỗi thật của `LocaleSwitcher` (fallback Suspense ngoài nằm trong HTML tĩnh, thiếu query) → đã sửa.
  - `account.spec.ts:71` (đăng nhập → đăng xuất) flaky 1 lần trên CI (run 39051786575, qua ở lần retry): console có một "Failed to load resource: 404" chưa rõ request nào. **Chưa sửa, đang theo dõi**: ux-messages có commit chẩn đoán (`collectErrors` kèm URL, `6b5d566`) và bản sửa theo giả thuyết (kệ trang chủ bỏ sách thuộc danh mục ẩn, `4cd5430`). Run 39148697724 (2026-10-19) bắt được URL ở `cart-account.spec.ts:94`: `404 /dang-nhap?next=%2Ftai-khoan&_rsc=…` (request RSC tới trang đăng nhập), khác giả thuyết. Quyết định 2026-10-19: có từ trước, không chặn merge, điều tra ở nhánh riêng sau merge (`docs/progress.md`).
- Việc để sau: xem docs/progress.md
- Sau khi deploy (tùy chọn): đo lại production (`npx tsx scripts/perf/measure.ts --out perf-after.json`) và kiểm Fluid Compute trên Vercel (chuyển trang trang chủ → trang sách 1,4–3 s ở lượt đầu, nghi function khởi động lạnh).
- Bản Preview của Vercel đang bật Vercel Authentication → script đo không vào được bản Preview (muốn đo trước khi merge cần Protection Bypass for Automation, do chủ dự án quyết).
- **Lỗi #3 (build) chưa hết**: một lần build vẫn fail "`use cache` took too long" ở `getRelatedBooks` dù đã có timeout + retry (tối đa 33 s, dưới giới hạn 54 s của Next; `fetch` của Next có chuyển `signal`). Chưa tìm ra chỗ treo; hướng xem tiếp: giảm số trang prerender đồng thời, tăng `staticPageGenerationTimeout`, log thời gian từng lượt thử lúc build.
- Thêm vào giỏ khi bấm lúc header chưa biết phiên: `router.refresh()` dự phòng (`add-to-cart-button.tsx` dòng 66) render lại cả phần động của trang sách (+6 query). **Chủ dự án đã đồng ý giữ** (2026-10-17): bỏ đi thì header stream tới sau có thể ghi đè badge bằng số cũ (lệch đồng bộ). Muốn bỏ phải thiết kế lại cách header và nút đồng bộ số giỏ.
- LCP mobile trang lưới (danh mục ~3,5–5,2 s mô phỏng 4G chậm) chưa giảm: lưới stream theo `searchParams` nên preload không tới sớm hơn thẻ `<img>`. Hướng tiếp: đưa hàng đầu lưới vào phần prerender tĩnh (đổi cấu trúc trang, cần plan).
- Đề xuất, chưa duyệt: kéo LCP mobile xuống < 2.5 s (đo trên domain thật trước; ý tưởng ở báo cáo `phase-10.md`); captcha (mục 7).

Mở đầu phiên mới: tóm tắt trạng thái trong vài dòng rồi chờ giao việc.
