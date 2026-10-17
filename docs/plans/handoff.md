# Bàn giao cho phiên Claude Code mới (cập nhật 2026-10-17)

Đọc file này khi bắt đầu phiên ở thư mục dự án, sau `CLAUDE.md` (được nạp tự động).

## Trạng thái

- Phase 1–10 trong Lộ trình (`CLAUDE.md`) **đã xong và đã merge vào `main`**, cùng bản sửa email auth (`fix-auth-default-email`).
- **Nhánh đang mở**: `fix-manual-test` (đã push; chứa luôn `check-after-manual-test`). Chủ dự án đã duyệt merge **khi có một lượt e2e toàn bộ sạch**.
- CI (`.github/workflows/ci.yml`) xanh trên `main` (job `check`: typecheck, lint, Vitest, build). Job `e2e` tắt tới khi bật biến `RUN_E2E`.
- Migration trong `supabase/migrations/` **đã chạy hết** trên Supabase; `src/types/database.ts` khớp DB.
- **Đã deploy** `https://nha-sach-may.vercel.app` trên Vercel: tự deploy từ `main`, region `sin1`, env chỉ 2 biến `NEXT_PUBLIC_SUPABASE_*` (chưa đặt `SITE_URL`, app dùng `VERCEL_PROJECT_PRODUCTION_URL`). GitHub Secrets 2 biến đó đã có.
- Supabase Auth: Site URL = domain Vercel; Redirect URLs `…/api/auth/confirm**` cho production + localhost (thử bằng link giả về đúng `/xac-nhan`); SMTP riêng qua Gmail; 2 template song ngữ (`supabase/templates/`) đã dán.

## Đọc gì trước

1. `docs/plans/final-report.md`: tính năng đã có, checklist test tay, việc của chủ dự án theo thứ tự ưu tiên, rủi ro còn lại.
2. `docs/plans/owner-todo.md`: hướng dẫn từng bước (Redirect URLs, Vercel, CI, project Supabase riêng cho e2e).
3. Cần chi tiết một phần thì đọc `docs/plans/phase-<n>.md` (mục "Báo cáo" và "Quyết định tự chọn" ở đầu file) và `docs/plans/data.md` (dữ liệu sách, bìa).

## Cách làm việc chủ dự án đã quen

- Mọi việc làm trên **nhánh riêng**, kiểm tra đủ (`typecheck`, `lint`, `build`, Vitest, e2e liên quan), push nhánh rồi **báo trước khi merge**. Merge vào `main` bằng `--ff-only` khi đã được duyệt, xong thì xóa nhánh và xem CI.
- Không mở / đọc / sửa `.env.local`; chỉ chạy `npm run check:env`. Không chạy SQL lên Supabase: viết migration (idempotent) để chủ dự án chạy.
- Thêm dependency phải hỏi trước.
- e2e đang chạy trên **DB production**. Fail vì mạng / Supabase chậm (timeout, `fetch failed`) thì chờ 3 phút rồi chạy lại, tối đa 3 lượt. Không nới timeout, không xóa / skip test. Một test fail lặp lại thì dừng và báo.

## Đã xong trong đợt sửa sau test tay (nhánh `fix-manual-test`, chưa merge)

- Admin không còn thấy đơn của khách khác ở `/tai-khoan/don-hang`, chi tiết đơn, `/thanh-toan/thanh-cong/[code]` (query phía khách lọc `user_id`; RLS giữ nguyên cho `/admin`).
- Trang chi tiết đơn: tên / bìa sách dẫn tới trang sách; đơn đã giao có nút "Đánh giá" / "Sửa đánh giá" mở form ngay dưới dòng (cùng đánh giá với trang sách).
- `/xac-nhan` đọc lỗi sau `#` (template mặc định) → "Liên kết đã hết hạn" + "Yêu cầu liên kết mới".
- Link "Xem trên cửa hàng" của sách / danh mục đang ẩn: mờ, không bấm được, "Đang ẩn, khách không thấy".
- Client Supabase public: timeout + retry (build 10 s × 3 lần, chạy thật 5 s × 2 lần); hết lượt thì build fail rõ ràng.
- Mã `NETWORK_ERROR` ("Không kết nối được máy chủ, thử lại sau ít phút.") cho mọi form qua `useFormAction`, lỗi mạng của Supabase Auth và PostgREST.
- Font tự host (`src/assets/fonts`, OFL): build không cần mạng tới Google Fonts.
- `LocaleSwitcher`: giữ query khi bấm trước hydrate (inline script), bỏ `?` thừa.
- Tốc độ (`docs/plans/perf.md`): bìa đầu lưới ưu tiên cao; footer không gây CLS; `AdminLink` chỉ prefetch khi rê chuột / focus (is_admin mỗi lần mở trang admin ~19 → 2); trạng thái đang tải khi sắp xếp / lọc / sang trang và khi áp voucher.
- e2e mới: `admin-account-orders.spec` (đã chuyển từ fail sang qua), `crawl.spec` (dò lỗi chỉ đọc), đánh giá trên trang đơn, `/xac-nhan` lỗi sau `#`, prefetch admin, trạng thái đang tải. Script đo tốc độ: `npx tsx scripts/perf/measure.ts` (`--only`, `--devices`, `--cleanup-only`; dọn dữ liệu e2e và đếm phần sót).

## Việc mở

- **Việc tiếp theo (đã duyệt, làm theo thứ tự)**:
  1. Chạy `npm run test:e2e` toàn bộ trên `fix-manual-test` khi mạng ổn, theo quy ước ở trên (chờ 3 phút, tối đa 3 lượt chạy lại, không nới timeout, không skip). Không sạch thì KHÔNG merge, báo test nào fail.
  2. Có một lượt sạch: `git switch main && git merge --ff-only fix-manual-test`, push `main`, xóa nhánh `fix-manual-test` và `check-after-manual-test` (local + remote), xem CI trên `main`, chờ Vercel deploy production.
  3. Kiểm 3 điểm trên https://nha-sach-may.vercel.app bằng dữ liệu e2e tạm (`scripts/e2e-user.ts`: user khách + admin + sách e2e + đơn): admin mở `/tai-khoan/don-hang` chỉ thấy đơn của mình; admin mở `/thanh-toan/thanh-cong/<mã đơn của khách>` → 404; đơn đã giao của khách có nút "Đánh giá". Dọn xong chạy `npx tsx scripts/perf/measure.ts --check-leftovers` phải ra 0. Báo kết quả.
- Sau khi deploy (tùy chọn): đo lại production (`npx tsx scripts/perf/measure.ts --out perf-after.json`) và kiểm Fluid Compute trên Vercel (chuyển trang trang chủ → trang sách 1,4–3 s ở lượt đầu, nghi function khởi động lạnh).
- Bản Preview của Vercel đang bật Vercel Authentication → script đo không vào được bản Preview (muốn đo trước khi merge cần Protection Bypass for Automation, do chủ dự án quyết).
- **e2e chưa có lượt sạch** sau các sửa (mạng / Supabase chậm suốt 2026-10-17): lượt toàn bộ 252 qua / 3 fail (2 do cách viết test voucher, đã sửa; 1 lỗi mạng ở `afterAll`); 3 lượt chạy lại `checkout.spec` fail ở chỗ khác nhau mỗi lượt (đăng nhập / đặt hàng chờ > 20 s, lượt cuối hỏng ngay ở build). Các test sau chỗ fail trong `checkout.spec` (serial) chưa chạy được sau sửa: voucher sai / đủ tối thiểu, VietQR, RPC không tự hủy đơn đã trả. Chạy lại khi mạng ổn.
- **Lỗi #3 (build) chưa hết**: một lần build vẫn fail "`use cache` took too long" ở `getRelatedBooks` dù đã có timeout + retry (tối đa 33 s, dưới giới hạn 54 s của Next; `fetch` của Next có chuyển `signal`). Chưa tìm ra chỗ treo; hướng xem tiếp: giảm số trang prerender đồng thời, tăng `staticPageGenerationTimeout`, log thời gian từng lượt thử lúc build.
- Thêm vào giỏ khi bấm lúc header chưa biết phiên: `router.refresh()` dự phòng (`add-to-cart-button.tsx` dòng 66) render lại cả phần động của trang sách (+6 query). **Chủ dự án đã đồng ý giữ** (2026-10-17): bỏ đi thì header stream tới sau có thể ghi đè badge bằng số cũ (lệch đồng bộ). Muốn bỏ phải thiết kế lại cách header và nút đồng bộ số giỏ.
- LCP mobile trang lưới (danh mục ~3,5–5,2 s mô phỏng 4G chậm) chưa giảm: lưới stream theo `searchParams` nên preload không tới sớm hơn thẻ `<img>`. Hướng tiếp: đưa hàng đầu lưới vào phần prerender tĩnh (đổi cấu trúc trang, cần plan).
- Đề xuất, chưa duyệt: tạo project Supabase riêng cho e2e / CI (`owner-todo.md` mục 6.5); kéo LCP mobile xuống < 2.5 s (đo trên domain thật trước; ý tưởng ở báo cáo `phase-10.md`); captcha (mục 7).

Mở đầu phiên mới: tóm tắt trạng thái trong vài dòng rồi chờ giao việc.
