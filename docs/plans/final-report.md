# Báo cáo cuối: Nhà Sách Mây sau Phase 1 → 11

Trạng thái: Phase 1–10 đã merge vào `main` (2026-10-16). Đã deploy `https://nha-sach-may.vercel.app` (tự deploy từ `main`). Dự án học tập, phi thương mại.

## 1. Tính năng đã có

**Cửa hàng (song ngữ vi / en, dark mặc định + light)**
- Trang chủ: hero trích dẫn + CTA "Xem tất cả sách", kệ Nổi bật (ẩn khi < 4 sách nổi bật), Bán chạy (ẩn khi < 6 sách đã bán), Mới về (sách tiếng Việt, bìa nét trước), Sách ngoại văn, lưới danh mục. Kệ cuộn ngang, nút trước / sau trên desktop.
- Catalog: Tất cả sách `/sach`, danh mục (chip danh mục con), tác giả, tìm kiếm (trang `/tim-kiem` + palette ⌘K / Ctrl K, gõ không dấu). Lọc giá / ngôn ngữ / còn hàng, sắp xếp, phân trang đều trên URL.
- Trang sách: bìa lớn, giá / giảm giá / tồn kho, mô tả (fallback tiếng Việt), thông tin chi tiết, kệ "Cùng danh mục", đánh giá (điểm trung bình + danh sách), thêm vào giỏ.
- Đổi ngôn ngữ giữ nguyên trang; URL dịch theo ngôn ngữ (`/sach/x` ↔ `/en/books/x`).

**Tài khoản**
- Đăng ký (xác nhận email), đăng nhập / đăng xuất, quên + đặt lại mật khẩu (thu hồi phiên khác). Link trong email mở trang trung gian có nút "Xác nhận" (trình quét link không dùng mất token).
- Sổ địa chỉ 2 cấp (Tỉnh/Thành → Phường/Xã, 34 tỉnh), địa chỉ mặc định; ngôn ngữ email.
- Giỏ hàng: khách vãng lai (localStorage) và tài khoản (optimistic), gộp khi đăng nhập, mốc freeship.
- Thanh toán: chọn địa chỉ, ghi chú, mã giảm giá, COD hoặc chuyển khoản VietQR (thông tin **demo** + cảnh báo), chống đặt trùng, báo lỗi từng trường hợp (hết hàng, ngừng bán, giỏ đổi, địa chỉ mất…).
- Đơn hàng: danh sách lọc trạng thái, chi tiết, thẻ VietQR khi chưa trả, tự hủy khi còn chờ xác nhận và chưa thanh toán.
- Đánh giá: chỉ người đã nhận sách; viết / sửa / xóa.
- Email đơn hàng theo ngôn ngữ của khách (đặt, xác nhận, giao, đã giao, hủy, đã nhận tiền): chỉ ghi log tới khi cấu hình Resend.

**Quản trị (`/admin`, chỉ tiếng Việt, chỉ `role = admin`)**
- Tổng quan; sách (sửa thông tin, `*_en`, giá, tồn kho, ẩn / hiện, nổi bật, upload bìa); danh mục; tác giả; đơn hàng (đổi trạng thái theo luồng, hủy kèm lý do, "Đã nhận tiền", hủy đơn đã trả → hoàn tiền); voucher; kiểm duyệt đánh giá.

**Nền tảng**
- SEO: sitemap, robots, hreflang, canonical, ảnh OG, JSON-LD (Book / Offer / Breadcrumb, WebSite), **HTTP 404 thật** cho slug không tồn tại.
- Bảo mật: RLS mọi bảng, quyền cột (`books`, `orders`, `vouchers`, `reviews`), luồng trạng thái đơn chặn ở DB, mỗi Server Action admin tự kiểm quyền, header bảo mật, không có service role trong app.
- Dữ liệu: 189 sách thật (Google Books), 124 bìa ≥ 300px (12 bìa lấy từ Open Library).
- Kiểm thử: Vitest 370 test; Playwright 218 test (desktop + mobile, khách / tài khoản / admin, luồng mua trọn vẹn, SEO); GitHub Actions CI (typecheck, lint, Vitest, build; e2e bật bằng biến).
- Hiệu năng: JS ngoài framework trang chủ +39.1KB, trang sách +41.9KB (ngân sách 50KB). Đo lại 2026-10-18 (Phase 11): trang chủ +39.6KB → **+41.1KB**, trang sách +42.4KB → **+43.9KB** (bong bóng chat +1.5KB; khung chat 9.0KB gzip chỉ tải khi bấm). Lighthouse mobile (mô phỏng): A11y / Best practices 100, Performance 77–88, LCP 3.6–5.1 s (chưa đạt 2.5 s).

## 2. Checklist test tay

Chạy `npm run build && npm start` (hoặc bản deploy). Mỗi dòng: **làm gì** → **kết quả đúng**. Đánh dấu ✗ và ghi lại nếu sai.

### A. Khách vãng lai (chưa đăng nhập)

| # | Làm gì | Kết quả đúng |
|---|---|---|
| A1 | Mở `/` | Nền tối, hero trích dẫn tiếng Việt + nút "Xem tất cả sách"; kệ "Mới về" toàn sách tiếng Việt; kệ "Sách ngoại văn"; lưới danh mục; footer ghi nguồn Google Books + Open Library |
| A2 | Desktop: bấm nút ">" của kệ "Mới về" | Kệ cuộn sang phải; nút "<" hết mờ |
| A3 | Bấm "Xem tất cả sách" | `/sach`, tiêu đề "Tất cả sách", lưới sách + "N cuốn sách" |
| A4 | Ở `/sach`: lọc "Tiếng Anh", sắp "Giá tăng dần", sang trang 2 | URL có `lang=en`, `sort=price-asc`, `page=2`; Back quay lại đúng trạng thái trước |
| A5 | Bấm ô tìm kiếm ở header (hoặc Ctrl K), gõ `nguyen nhat anh` (không dấu) | Palette hiện gợi ý sách có tác giả Nguyễn Nhật Ánh; Enter → `/tim-kiem?q=…` |
| A6 | Mở một sách bất kỳ | Bìa lớn, giá màu nhấn, tồn kho, mô tả, "Thông tin chi tiết", khối "Đánh giá", kệ "Cùng danh mục" |
| A7 | Ở trang sách, khối "Đánh giá" | "Chưa có đánh giá nào." (hoặc danh sách) + câu "Đã mua cuốn này? Đăng nhập để viết đánh giá." |
| A8 | Bấm "EN" ở header | `/en/books/<cùng slug>`, giao diện tiếng Anh, giá dạng `₫98,000` |
| A9 | Mở `/sach/khong-ton-tai` | Trang "Không tìm thấy trang" (DevTools → Network: status **404**) |
| A10 | Bấm "Thêm vào giỏ" 2 lần ở một sách, mở giỏ | Badge giỏ = 2; trang giỏ có dòng sách, tạm tính, phí ship / mốc freeship |
| A11 | Tải lại trang giỏ | Giỏ vẫn còn (localStorage) |
| A12 | Ở giỏ bấm "Thanh toán" | Chuyển sang đăng nhập với `?next=%2Fthanh-toan` |
| A13 | Đổi theme (icon mặt trời), tải lại | Giao diện sáng, giữ sau khi tải lại |
| A14 | Mở `/admin` khi chưa đăng nhập | Về trang chủ |
| A15 | Mở `/sitemap.xml`, `/robots.txt` | Sitemap có `/sach/…` kèm `hreflang="en"`; robots chặn `/admin`, `/tai-khoan`… |

### B. Thành viên

Dùng **tài khoản thường** (không phải admin) cho cả phần B. Tài khoản admin thấy thêm link "Quản trị" và các trang admin; chỗ nào cần admin (giao đơn, xem tồn kho) thì mở ở trình duyệt / cửa sổ ẩn danh khác bằng tài khoản admin.

| # | Làm gì | Kết quả đúng |
|---|---|---|
| B1 | `/dang-ky` bằng email bất kỳ (SMTP Gmail gửi được mọi địa chỉ); làm lại một lần ở `/en/register` bằng email khác | "Kiểm tra hộp thư"; email "Xác nhận email" bằng tiếng Việt (đăng ký ở `/en`: "Confirm your email", tiếng Anh) — ngôn ngữ theo `user_metadata.locale` ghi lúc đăng ký. Link trong email trỏ `{{ .SiteURL }}` (domain Vercel) kể cả khi đăng ký từ localhost |
| B2 | Bấm link trong email | Trang trung gian "Xác nhận email" có nút "Xác nhận email" (chưa đăng nhập, link chưa bị dùng); bấm nút → `/tai-khoan` đã đăng nhập |
| B2b | Mở link xác nhận (chưa dùng) ở trình duyệt khác / cửa sổ ẩn danh → bấm nút; rồi mở lại cùng link và bấm nút lần nữa | Lần đầu: `/tai-khoan` đã đăng nhập **ở trình duyệt đó** (template riêng dùng `token_hash` + `verifyOtp`, không cần PKCE nên không phụ thuộc trình duyệt lúc đăng ký). Lần hai: `/dang-nhap` báo "Liên kết đã hết hạn hoặc đã được dùng…" |
| B3 | Đăng nhập khi đang có giỏ khách (A10) | Giỏ khách gộp vào giỏ tài khoản; badge đúng tổng |
| B4 | `/tai-khoan/dia-chi` → thêm địa chỉ (Hà Nội → Phường Ba Đình), đặt mặc định | Địa chỉ hiện trong sổ, nhãn "Mặc định"; SĐT sai (`123`) báo lỗi tại ô |
| B5 | `/thanh-toan` | Địa chỉ mặc định được chọn; tóm tắt đơn có tạm tính, phí ship, tổng |
| B6 | Nhập mã voucher sai, bấm "Áp dụng" | Dòng lỗi "Mã giảm giá không hợp lệ hoặc đã hết hạn."; tổng không đổi |
| B7 | Nhập mã voucher đúng (tạo ở admin, D6) bằng chữ thường | "Đã áp dụng mã …"; dòng "Giảm giá"; tổng giảm đúng |
| B8 | Chọn COD → "Đặt hàng" | Trang "Đặt hàng thành công", mã `NS…`, "Thanh toán khi nhận hàng: …"; badge giỏ về 0 |
| B9 | (Tài khoản admin) `/admin/sach` → tìm sách vừa đặt | Cột tồn kho giảm đúng số đã đặt. Trang sách công khai chỉ hiện số khi tồn ≤ 5 ("Chỉ còn N cuốn"), nên kiểm ở admin |
| B10 | Đặt đơn thứ hai, chọn "Chuyển khoản ngân hàng (VietQR)" | Trang thành công có thẻ VietQR: mã QR, ngân hàng, STK `0000000000`, số tiền = tổng, nội dung = mã đơn, khung cảnh báo demo |
| B11 | (Tùy chọn) Quét QR bằng app ngân hàng | App đọc được ngân hàng + số tiền + nội dung; báo tài khoản không tồn tại (demo). **Không chuyển tiền** |
| B12 | `/tai-khoan/don-hang` | Hai đơn mới nhất trước; lọc "Chờ xác nhận" chỉ còn đơn chờ |
| B13 | Mở đơn COD → "Hủy đơn hàng" → nhập lý do → xác nhận | Trạng thái "Đã hủy", lý do hiện ra; tồn kho sách hoàn lại (xem ở `/admin/sach` như B9) |
| B14 | Đơn chuyển khoản sau khi admin bấm "Đã nhận tiền" (D4) | "Đã thanh toán"; không còn thẻ QR; **không** còn nút hủy |
| B15 | Tài khoản **người mua**, sau khi admin giao đơn (D3): `/tai-khoan/don-hang/<mã đơn>` → bấm tên hoặc bìa sách | Mở đúng trang sách (sách đã xóa / đang ẩn thì tên là chữ thường, không có link). Khối đánh giá ở trang sách có form |
| B15b | Quay lại trang đơn đã giao → nút "Đánh giá" dưới dòng sách → chọn sao + nhận xét → "Gửi đánh giá" | Form mở ngay dưới dòng, không chuyển trang; "Đã lưu đánh giá."; nút đổi thành số sao + "Sửa đánh giá". Trang sách hiện đánh giá trong danh sách và điểm trung bình dưới tên sách; form ở trang sách là cùng đánh giá đó (sửa ở đâu cũng được). Đơn chưa giao / đã hủy: không có nút "Đánh giá" |
| B16 | Sửa đánh giá (đổi số sao) rồi "Xóa đánh giá" | Điểm cập nhật; xóa xong về "Chưa có đánh giá nào." |
| B17 | Mở trang một sách chưa mua | "Bạn có thể đánh giá sau khi đã nhận cuốn sách này." (không có form) |
| B18 | Trang tài khoản → đổi "Ngôn ngữ email" sang English | Lưu thành công; email sau đó (đơn hàng, đặt lại mật khẩu) bằng tiếng Anh |
| B19 | Đăng xuất → `/quen-mat-khau` → email "Đặt lại mật khẩu" → bấm link → nút "Tiếp tục" → nhập mật khẩu mới | Email theo "Ngôn ngữ email" (B18); trang trung gian "Đặt lại mật khẩu" có nút "Tiếp tục" → `/dat-lai-mat-khau` → đổi được; đăng nhập bằng mật khẩu cũ thất bại; phiên ở trình duyệt khác bị thu hồi (`signOut({ scope: 'others' })`, trình duyệt đó chỉ thoát khi access token hết hạn, tối đa ~1 giờ). Mở được ở trình duyệt khác với lúc yêu cầu. Bấm lại link đã dùng → `/quen-mat-khau` báo "Liên kết đã hết hạn hoặc đã được dùng…" |
| B20 | Thử ở `/en` (thanh toán, đơn hàng) | Toàn bộ chữ tiếng Anh, URL `/en/checkout`, `/en/account/orders` |

### C. Admin (tài khoản `role = 'admin'`, đặt bằng SQL)

| # | Làm gì | Kết quả đúng |
|---|---|---|
| D1 | `/admin` | Tổng quan: đơn chờ xác nhận, sách sắp hết / hết / đang ẩn; menu trái có "Đánh giá" |
| D2 | `/admin/sach` → tìm không dấu → mở một sách → sửa giá, tick "Nổi bật", lưu | "Đã lưu."; trang sách công khai đổi giá ngay; chọn ≥ 4 sách nổi bật thì trang chủ hiện kệ "Nổi bật" |
| D3 | `/admin/don-hang` → mở đơn COD của B8 → "Xác nhận đơn" → "Chuyển sang đang giao" → "Đánh dấu đã giao" | Mỗi bước "Đã cập nhật trạng thái đơn."; cuối cùng "Đã giao" + "Đã thanh toán"; không còn nút |
| D4 | Mở đơn chuyển khoản của B10 → "Đã nhận tiền" | "Đã ghi nhận thanh toán."; trạng thái thanh toán "Đã thanh toán"; hiện ghi chú hoàn tiền khi hủy |
| D5 | (Đơn chuyển khoản đã trả) "Hủy đơn" + lý do | "Đã hủy" + "Đã hoàn tiền"; tồn kho hoàn lại: `/admin/sach` → tìm sách trong đơn → cột tồn kho tăng lại đúng số (trang sách chỉ hiện số khi tồn ≤ 5) |
| D6 | `/admin/voucher` → "Tạo" mã `test10` giảm 10% | Lưu thành `TEST10`; dùng được ở B7 |
| D7 | Xóa voucher đã có đơn dùng | Báo chỉ tắt được, không xóa |
| D8 | `/admin/danh-gia` → lọc 1 sao → "Gỡ đánh giá" | Đánh giá biến mất ở admin và ở trang sách |
| D9 | Upload bìa JPEG cho một sách | "Đã cập nhật ảnh bìa."; trang sách hiện bìa mới |
| D10 | Đăng nhập tài khoản thường → `/admin` | Bị chuyển về trang chủ |
| D11 | Log server khi admin đổi trạng thái đơn (chưa có Resend) | Dòng `[email] … chỉ ghi log: to=n***@… subject="…"` (không lỗi) |

## 3. Việc của bạn (theo thứ tự ưu tiên)

**Bắt buộc trước khi deploy**
1. ✅ Chạy 2 migration (`cover_width`, `payments_email`), sinh lại types, `covers --measure` — đã xong 2026-10-16.
2. ✅ Supabase → URL Configuration → Redirect URLs: thêm `https://nha-sach-may.vercel.app/api/auth/confirm**` và `http://localhost:3000/api/auth/confirm**` (`owner-todo.md` mục 2.0). Template riêng (`supabase/templates/`) chỉ dán được khi đã có custom SMTP (mục 2.1, tùy chọn). — Đã thêm cả hai, thử bằng link giả về đúng `/xac-nhan`; 2 template song ngữ đã dán.
3. ✅ Tạo project Vercel, đặt env `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SITE_URL`; **không** đặt `SUPABASE_SERVICE_ROLE_KEY`, `E2E_FAULT_INJECTION`; chọn region gần Supabase (mục 6.1). — Đã deploy `nha-sach-may.vercel.app`, tự deploy từ `main`, region `sin1`; chưa đặt `SITE_URL` (dùng domain Vercel).
4. ✅ Supabase → URL Configuration: Site URL + Redirect URLs của domain Vercel (mục 6.2).
5. ✅ GitHub → Secrets `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` để job CI `check` build được (mục 6.3). — CI xanh.

**Nên làm ngay sau deploy**
6. Tạo project Supabase thứ hai cho e2e / CI, không chạy e2e trên DB production nữa (mục 6.5).
7. ✅ SMTP riêng cho Supabase Auth (SMTP mặc định chỉ gửi tới thành viên organization) (mục 6.2). — SMTP Gmail.
8. Chạy checklist test tay ở mục 2 trên bản deploy. — Đang làm; lỗi gửi thành một đợt.
9. Chọn ~12 sách nổi bật trong admin (kệ "Nổi bật" đang ẩn).

**Tùy chọn**
10. Resend (`RESEND_API_KEY`, `EMAIL_FROM`) để gửi email đơn hàng thật (mục 3).
11. Thay bìa còn mờ / sai trong admin: 5 bìa cũ + 6 bìa Open Library bỏ qua (`data.md`), 65 bìa < 300px.
12. Captcha Turnstile (mục 7); VietQR thật (mục 4, nên giữ demo).
13. Google Search Console: gửi `sitemap.xml`.

## Phase 11: chatbot gợi ý sách "Mây" (đã merge `main` 2026-10-18)

Chủ dự án đã test tay OK trên bản Preview (máy tính + iPhone Safari) rồi merge cùng ngày. `GEMINI_API_KEY` + `CHAT_QUOTA_TOKEN` ở Vercel Production. Chi tiết: `docs/plans/phase-11.md` → "Báo cáo Phase 11"; cấu hình: `owner-todo.md` mục 8.

- Bong bóng chat ở góc phải dưới, chỉ trang cửa hàng tiếng Việt (không có ở `/en`, đăng nhập / đăng ký, `/admin`, thanh toán). Bấm thì tải khung chat: desktop khung nổi 360px, mobile tấm toàn màn hình. Có bước xác nhận 18+ và dòng nhắc về dữ liệu ở gói miễn phí.
- Gemini `gemini-3.5-flash-lite` (free tier, không billing), một lượt gọi mỗi câu hỏi, tối đa 3 thẻ sách lấy từ DB.
- Giới hạn: khách 10 / giờ, 30 / ngày; IP 60 / 200; trần chung 10 lượt gọi / phút, 400 / ngày (ngày theo giờ Los Angeles).
- Câu tự hại trả câu hỗ trợ cố định, không gọi AI. Chặn EEA / Anh / Thụy Sĩ.
- Thử thật 10 lượt: tối đa 4.035 token vào, không `MAX_TOKENS`.
- JS lúc tải trang: **+1.5KB gzip** (trang chủ + 41.1KB, trang sách + 43.9KB, ngân sách 50KB).
- Sửa sau test tay: chip / câu hỏi gợi ý chỉ hiện ở lượt mới nhất của Mây; ô nhập trên mobile ≥ 16px (iOS không tự phóng to).

**Việc còn lại cho đợt sửa lỗi sau Phase 11** (đã làm ở nhánh `ux-messages`, xem mục dưới)
1. Trang đăng nhập mất chữ đã gõ → đã sửa (một form ngay từ đầu, mục 14).
2. Request 404 làm e2e đăng nhập / đăng xuất chập chờn (`account.spec:71`, `cart-account.spec:94`) → **chưa xong**: commit chẩn đoán đã bắt được URL (`/dang-nhap?next=%2Ftai-khoan&_rsc=…`, run 39148697724), khác giả thuyết; có từ trước, điều tra ở nhánh riêng sau merge (`docs/progress.md`).
3. Tên tác giả ngược thứ tự → SQL `supabase/checks/authors-fix.sql` chờ duyệt (chưa chạy).

## Đợt ux-messages: thông báo cho khách (nhánh `ux-messages`, CHƯA merge)

Plan + báo cáo: `docs/plans/ux-messages.md`. Việc để sau: `docs/progress.md`. Plan đợt giảm JS: `docs/plans/perf-js.md`.

- Mã giảm giá / hủy đơn báo đúng lý do, gợi ý mã ở trang thanh toán, lỗi đăng ký / đăng nhập theo ô, gửi lại email xác nhận, 404 nói rõ thiếu gì (vẫn HTTP 404 thật), link "Đăng nhập lại", form giữ chữ khi mất mạng, trang lỗi có mã tra cứu + email liên hệ.
- Migration A đã chạy; **migration B chạy sau khi merge + deploy** (app hiểu cả mã cũ lẫn mới, có Vitest cho đường mã cũ).
- JS (measure:js, gzip ngoài baseline 170KB): trang sách 43.9 → **45.3KB** (ngân sách 50), trang chủ 41.2 → 42.2, `/sach` + danh mục 54.3 → 55.3 (chưa có ngân sách).
- Bổ sung đêm 2026-10-18: quên mật khẩu / gửi lại email xác nhận không còn lộ email nào có tài khoản (chỉ báo lỗi khi không tới được máy chủ, còn lại "đã gửi", 2026-10-19); proxy bỏ header `x-not-found` do khách gửi (request đi qua proxy); nháp ghi chú thanh toán theo tài khoản, xóa khi đăng xuất; thêm test plan đã hứa.

## 4. Rủi ro còn lại

- **LCP chưa đạt 2.5 s** trên mobile mô phỏng (3.6–5.1 s): font (12 file woff2) + JS tranh băng thông. Cần đo lại trên domain thật (Vercel Speed Insights) rồi mới quyết định bớt độ đậm font / preload ảnh lưới.
- **Thanh toán không đối soát**: admin tự xem sao kê; đơn chuyển khoản chưa trả giữ tồn kho tới khi admin hủy. VietQR đang là thông tin demo.
- **Email chỉ ghi log** tới khi cấu hình Resend; lỗi gửi chỉ có trong log, không thử lại.
- `/sach` + trang danh mục 55.3KB JS (chưa có ngân sách; trên mức 50KB của trang sách; do sheet bộ lọc tải ngay). Plan giảm: `docs/plans/perf-js.md`.
- **Tắt JavaScript**: form gửi Server Action mà action trả kết quả (lỗi, "đã gửi") hiện ra trang trắng trên trang có khung tĩnh prerender (response chỉ có phần động). Action kết thúc bằng redirect vẫn chạy. Chi tiết: `docs/progress.md`.
- `?page=` vượt quá vẫn là soft 404 (UI 404 + `noindex`, HTTP 200).
- Dữ liệu Google Books: 65 bìa < 300px (30 sách Việt không có bìa trên Open Library), mô tả tiếng Anh trống (fallback tiếng Việt), giá / tồn kho sinh giả theo ISBN.
- `experimental.messages.precompile` của next-intl là API thử nghiệm: mỗi lần nâng next-intl phải build + `measure:js` + e2e.
- e2e có thể chập chờn khi Supabase phản hồi chậm (hook / action quá thời gian chờ); quy ước: chờ 3 phút, chạy lại tối đa 3 lượt.
