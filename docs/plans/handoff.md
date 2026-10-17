# Bàn giao cho phiên Claude Code mới (cập nhật 2026-10-17, sau merge e2e Supabase local)

Đọc file này khi bắt đầu phiên ở thư mục dự án, sau `CLAUDE.md` (được nạp tự động).

## Trạng thái

- Phase 1–10 trong Lộ trình (`CLAUDE.md`) **đã xong và đã merge vào `main`**, cùng bản sửa email auth (`fix-auth-default-email`).
- Đợt sửa sau test tay (`fix-manual-test`, gồm `check-after-manual-test`) **đã merge vào `main`** (ff, `f4899ab`, 2026-10-17) sau lượt e2e toàn bộ sạch; hai nhánh đã xóa (local + remote). Không còn nhánh mở.
- CI (`.github/workflows/ci.yml`) xanh trên `main` (job `check`: typecheck, lint, Vitest, build).
- **e2e chạy trên Supabase local ở GitHub Actions** (`e2e-project`, **đã merge `main`** ff `df891fb`, 2026-10-17; nhánh đã xóa local + remote): `.github/workflows/e2e.yml` chạy `supabase start` (DB trống dựng từ `schema.sql` + seed, `supabase/config.toml`), `scripts/e2e-seed.ts` nạp 58 sách test (`e2e/fixtures/books.json`, bìa giả), rồi `npx playwright test`. Mọi push (trừ `docs/**`, `*.md`) + chạy tay; không secret. Guard `scripts/e2e-env.ts` từ chối production / host cloud; `ci.yml` không còn job e2e. Không còn chạy e2e trên DB production.
  - Kết quả: 2 lượt liền trên nhánh + 1 lượt trên `main` đều **265/265, 0 flaky** (~5,9–6,4 phút Playwright; cả job ~8,5 phút: npm ci 14 s, `supabase start` ~75 s, Chromium 13–21 s, seed 3 s).
  - `next.config.ts`: cấu hình ảnh qua `coverImagesConfig` (`src/lib/cover-images-config.ts`): pattern http / IP local chỉ khi URL Supabase là local; build Vercel (`VERCEL=1`) với URL local → build fail (chống SSRF qua `/_next/image`, Vitest). Đã kiểm production sau deploy (chỉ đọc): bìa hiện ở trang chủ, `/danh-muc/van-hoc`, `/sach/sapiens`, 0 ảnh lỗi.
  - Theo dõi: `public.ecr.aws` đôi lúc trả `toomanyrequests` khi kéo image (CLI tự thử lại, +~13 s); nếu làm fail job thì thêm cache image Docker.
- Migration trong `supabase/migrations/` **đã chạy hết** trên Supabase; `src/types/database.ts` khớp DB.
- **Đã deploy** `https://nha-sach-may.vercel.app` trên Vercel: tự deploy từ `main`, region `sin1`, env chỉ 2 biến `NEXT_PUBLIC_SUPABASE_*` (chưa đặt `SITE_URL`, app dùng `VERCEL_PROJECT_PRODUCTION_URL`). GitHub Secrets 2 biến đó đã có.
- Supabase Auth: Site URL = domain Vercel; Redirect URLs `…/api/auth/confirm**` cho production + localhost (thử bằng link giả về đúng `/xac-nhan`); SMTP riêng qua Gmail; 2 template song ngữ (`supabase/templates/`) đã dán.

## Đọc gì trước

1. `docs/plans/final-report.md`: tính năng đã có, checklist test tay, việc của chủ dự án theo thứ tự ưu tiên, rủi ro còn lại.
2. `docs/plans/owner-todo.md`: hướng dẫn từng bước (Redirect URLs, Vercel, CI, e2e trên Supabase local).
3. Cần chi tiết một phần thì đọc `docs/plans/phase-<n>.md` (mục "Báo cáo" và "Quyết định tự chọn" ở đầu file) và `docs/plans/data.md` (dữ liệu sách, bìa).

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

- Trang lưới có `?page=` vượt quá số trang (soft 404 + `noindex`, VD `/sach?lang=en&page=2` khi chỉ có ≤ 24 sách tiếng Anh) làm trình duyệt báo **React error #419** trong console (`notFound()` trong Suspense sau khi đã stream). **Đã sửa** (nhánh `fix-soft-404`): proxy trả HTTP 404 thật (hỏi `/api/catalog/page-exists` khi page > 1), dự phòng `InlineNotFound` không throw.
- **Kết quả bàn giao lần trước (2026-10-17)**:
  - Mạng: đường tới Supabase chập chờn (health trung bình 1,4–2,2 s, có lần timeout 10 s, bắt tay TLS tới 5,9 s) dù vercel.com ~0,25 s. Bật **Cloudflare WARP** thì health trung bình 298 ms, bắt tay ≤ 0,23 s. (Trước đây cần đo health trước khi chạy e2e trên production; nay e2e chạy trên Supabase local ở CI, chỉ còn liên quan khi dev / build / đo tốc độ từ máy dev.)
  - `npm run test:e2e` toàn bộ (gồm `crawl.spec`): **261/261 qua ngay lượt đầu** (20,9 phút), kể cả các test `checkout.spec` trước đây chưa chạy được (voucher sai / đủ tối thiểu, VietQR, RPC không tự hủy đơn đã trả). Log `fetch failed (e2e fault injection)` là của `error-page.spec`, có chủ đích.
  - CI trên `main` xanh; Vercel Production `f4899ab` deploy xong.
  - Kiểm 3 điểm trên https://nha-sach-may.vercel.app bằng dữ liệu e2e tạm (user khách + admin, danh mục / sách `e2e-admin-…`, 1 đơn đã giao của khách + 1 đơn của admin; script tạm đã xóa): admin ở `/tai-khoan/don-hang` chỉ thấy đơn của mình ✔; admin mở `/thanh-toan/thanh-cong/<mã đơn khách>` → UI "Không tìm thấy trang" ✔ nhưng **HTTP 200** (soft 404: Cache Components stream trước khi `notFound()` chạy; trang cần đăng nhập nên không ảnh hưởng SEO, không lộ dữ liệu). **Đã sửa** (nhánh `fix-soft-404`): proxy đếm đơn theo mã + `user_id` bằng client theo phiên → HTTP 404; đơn đã giao của khách có nút "Đánh giá" ✔. Dọn xong `measure.ts --check-leftovers`: 0 sót mọi loại.
- Sau khi deploy (tùy chọn): đo lại production (`npx tsx scripts/perf/measure.ts --out perf-after.json`) và kiểm Fluid Compute trên Vercel (chuyển trang trang chủ → trang sách 1,4–3 s ở lượt đầu, nghi function khởi động lạnh).
- Bản Preview của Vercel đang bật Vercel Authentication → script đo không vào được bản Preview (muốn đo trước khi merge cần Protection Bypass for Automation, do chủ dự án quyết).
- **Lỗi #3 (build) chưa hết**: một lần build vẫn fail "`use cache` took too long" ở `getRelatedBooks` dù đã có timeout + retry (tối đa 33 s, dưới giới hạn 54 s của Next; `fetch` của Next có chuyển `signal`). Chưa tìm ra chỗ treo; hướng xem tiếp: giảm số trang prerender đồng thời, tăng `staticPageGenerationTimeout`, log thời gian từng lượt thử lúc build.
- Thêm vào giỏ khi bấm lúc header chưa biết phiên: `router.refresh()` dự phòng (`add-to-cart-button.tsx` dòng 66) render lại cả phần động của trang sách (+6 query). **Chủ dự án đã đồng ý giữ** (2026-10-17): bỏ đi thì header stream tới sau có thể ghi đè badge bằng số cũ (lệch đồng bộ). Muốn bỏ phải thiết kế lại cách header và nút đồng bộ số giỏ.
- LCP mobile trang lưới (danh mục ~3,5–5,2 s mô phỏng 4G chậm) chưa giảm: lưới stream theo `searchParams` nên preload không tới sớm hơn thẻ `<img>`. Hướng tiếp: đưa hàng đầu lưới vào phần prerender tĩnh (đổi cấu trúc trang, cần plan).
- Đề xuất, chưa duyệt: kéo LCP mobile xuống < 2.5 s (đo trên domain thật trước; ý tưởng ở báo cáo `phase-10.md`); captcha (mục 7).

Mở đầu phiên mới: tóm tắt trạng thái trong vài dòng rồi chờ giao việc.
