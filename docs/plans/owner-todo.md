# Việc của chủ dự án (sau đêm 2026-10-16)

Claude không làm được các việc dưới đây (cần tài khoản, khóa bí mật, hoặc chạy SQL lên Supabase). Theo thứ tự nên làm.

## 1. Chạy migration (bắt buộc, theo đúng thứ tự) — ✅ đã chạy 2026-10-16, types sinh lại khớp, `covers --measure` đã chạy

Supabase Dashboard → SQL Editor → dán toàn bộ file → Run. Mỗi file chạy lại được (idempotent). Cuối mỗi file có câu SQL kiểm tra.

| # | File | Nhánh | Dùng cho |
|---|---|---|---|
| 1 | `supabase/migrations/20261016010000_cover_width.sql` | `phase-8` | kệ trang chủ ưu tiên bìa nét, admin / import ghi chiều rộng bìa |
| 2 | `supabase/migrations/20261016020000_payments_email.sql` | `phase-9` | khách không tự hủy đơn đã thanh toán, quyền cột `vouchers`, RPC `order_contact` (email khi admin đổi trạng thái) |

Sau khi chạy:

```bash
npx supabase gen types typescript --project-id ylfgwcxddxvfxwldmwtf > src/types/database.ts
```

(Types đã sửa tay cho khớp migration; sinh lại để chắc chắn, `git diff` nên gần như rỗng.)

Rồi đo chiều rộng bìa (ghi `cover_width` cho mọi sách, không gọi API ngoài):

```bash
npm run covers -- --measure
```

Cuối cùng chạy lại `npm run test:e2e` (các test ghi "chờ migration" trong `morning-report.md`).

## 2. Email auth: Redirect URLs (bắt buộc) + template riêng (tùy chọn, cần custom SMTP)

**2.0 Redirect URLs — bắt buộc, kể cả khi giữ template mặc định của Supabase** — ✅ đã thêm `…/api/auth/confirm**` cho production + localhost; thử bằng link giả về đúng `/xac-nhan`

Template mặc định (`{{ .ConfirmationURL }}`): Supabase xác thực link ở `/auth/v1/verify` rồi chuyển về `redirectTo` mà app gửi lúc đăng ký / quên mật khẩu (`<domain>/api/auth/confirm?locale=…&type=signup|recovery&next=…`) kèm `?code=`; app đổi code lấy phiên (xác nhận đăng ký → `/tai-khoan` đã đăng nhập, quên mật khẩu → trang đặt mật khẩu mới). Supabase **chỉ** chuyển về URL nằm trong Redirect URLs; thiếu thì về Site URL (trang chủ) và link không dùng được.

Supabase Dashboard → Authentication → URL Configuration:
1. **Site URL**: `https://nha-sach-may.vercel.app` (đang đặt; đổi theo domain thật nếu có).
2. **Redirect URLs** → Add URL, mỗi dòng một mục:
   - `https://nha-sach-may.vercel.app/api/auth/confirm**` (production)
   - `http://localhost:3000/api/auth/confirm**` (dev, `npm run dev` / `npm start`)
   - (Tùy chọn, preview Vercel) `https://nha-sach-may-*.vercel.app/api/auth/confirm**`
   Đã có `…/**` của cùng domain thì cũng khớp, không cần thêm. e2e (cổng 3100) không gửi email nên không cần.
3. Save.

Giới hạn của template mặc định: link phải mở **trên cùng trình duyệt** đã bấm đăng ký / quên mật khẩu (PKCE: code verifier nằm trong cookie của trình duyệt đó). Mở ở trình duyệt khác: xác nhận đăng ký vẫn thành công (trang đăng nhập báo "Email đã được xác nhận", đăng nhập bằng tay); đặt lại mật khẩu báo link hết hạn → yêu cầu lại. Trình quét link trong hộp thư (Outlook Safe Links…) có thể dùng mất link vì Supabase tiêu thụ token ngay ở `/auth/v1/verify` — chỉ template riêng (2.1) tránh được.

Kiểm tra: `/dang-ky` bằng email thành viên organization Supabase (SMTP mặc định chỉ gửi cho họ) → thư → bấm link → `/tai-khoan` đã đăng nhập. Đăng xuất → `/quen-mat-khau` → thư → link → `/dat-lai-mat-khau` → đặt mật khẩu mới.

**2.1 Template riêng (song ngữ, chống trình quét link) — chỉ khi đã có custom SMTP** (Supabase bắt buộc custom SMTP mới cho sửa template; xem 6.2 mục 3) — ✅ đã dán cả 2 template (SMTP Gmail, 6.2)

Supabase Dashboard → Authentication → Emails:
1. Tab **Confirm signup** → ô Message body: dán toàn bộ `supabase/templates/confirm-signup.html`. Subject: dòng "Subject gợi ý" ở đầu file.
2. Tab **Reset password** → dán `supabase/templates/reset-password.html`, subject tương tự.
3. Save. Link vẫn trỏ `/api/auth/confirm` nên template cũ (Phase 4) cũng chạy; template mới thêm song ngữ.

Kiểm tra: đăng ký bằng email của bạn → thư → bấm link → trang "Xác nhận email" → bấm nút → `/tai-khoan`.

## 3. (Tùy chọn) Gửi email đơn hàng thật

Chưa làm thì email chỉ ghi log ở server (`[email] … chỉ ghi log`), app vẫn chạy.
1. Tạo tài khoản resend.com → Domains → thêm domain của bạn, làm theo hướng dẫn DNS (SPF / DKIM). Chưa có domain: Resend chỉ cho gửi tới email của chính bạn từ `onboarding@resend.dev`.
2. API Keys → Create (quyền "Sending access").
3. Thêm vào `.env.local` (và Vercel → Settings → Environment Variables khi deploy):
   ```
   RESEND_API_KEY=re_...
   EMAIL_FROM=Nhà Sách Mây <no-reply@ten-mien-cua-ban>
   ```
4. `npm run check:env` → hai dòng ✔.

## 4. (Tùy chọn) Tài khoản nhận VietQR thật

Mặc định là tài khoản **demo** (STK toàn số 0) kèm cảnh báo "đừng chuyển tiền". Dự án học tập: nên giữ demo. Nếu muốn nhận thật, đặt đủ 4 biến (thiếu một biến → vẫn demo):
```
VIETQR_BANK_BIN=970436          # mã BIN 6 số của ngân hàng (NAPAS)
VIETQR_BANK_NAME=Vietcombank
VIETQR_ACCOUNT_NO=...
VIETQR_ACCOUNT_NAME=NGUYEN VAN A   # viết HOA không dấu, đúng tên chủ tài khoản
```
Đối soát vẫn bằng tay: admin xem sao kê rồi bấm "Đã nhận tiền" ở chi tiết đơn.

## 5. Duyệt và merge (theo thứ tự) — ✅ `phase-8` → `phase-10` đã merge vào `main`

Ba nhánh xếp chồng: `phase-8` ← `phase-9` ← `phase-10` (mỗi nhánh chứa nhánh trước). Claude không merge / push `main`.
1. Đọc `docs/plans/morning-report.md`, chạy migration (mục 1), chạy lại `npm run test:e2e` trên `phase-10`.
2. Duyệt từng nhánh (hoặc chỉ `phase-10` nếu đồng ý cả ba), merge vào `main` theo thứ tự 8 → 9 → 10.
3. ✅ Đã xóa nhánh dự phòng `42703` (khi chưa có `cover_width`) trong `getHomeShelves`.

## 6. Deploy lên Vercel (Phase 10)

Claude đã chuẩn bị cấu hình (header bảo mật trong `next.config.ts`, CI `.github/workflows/ci.yml`, `.env.example`), **không** tự deploy, không tạo tài khoản.

**6.1 Vercel** — ✅ đã deploy `https://nha-sach-may.vercel.app`, tự deploy từ `main`, region `sin1`, env 2 biến `NEXT_PUBLIC_SUPABASE_*`; **chưa** đặt `SITE_URL` (app dùng `VERCEL_PROJECT_PRODUCTION_URL` = domain Vercel)
1. vercel.com → đăng nhập bằng GitHub → **Add New… → Project** → chọn repo `nha-sach-may` → Framework: Next.js (tự nhận), Root: `./`, Build / Install command: để mặc định.
2. **Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: như `.env.local`.
   - `SITE_URL`: domain thật (VD `https://nha-sach-may.vercel.app`). Bỏ trống thì app dùng `VERCEL_PROJECT_PRODUCTION_URL` (Vercel tự đặt).
   - (Tùy chọn) `RESEND_API_KEY`, `EMAIL_FROM`, `VIETQR_*` (mục 3, 4).
   - **Không** thêm `SUPABASE_SERVICE_ROLE_KEY` (chỉ dùng cho script local / CI e2e), **không** thêm `E2E_FAULT_INJECTION`.
3. **Settings → Functions → Region**: chọn gần project Supabase (Supabase Dashboard → Project Settings → General → Region; VD Singapore `sin1`).
4. **Deploy**. Build prerender catalog từ Supabase nên chạy `npm run covers -- --measure` (sau migration) **trước** khi deploy để kệ trang chủ dùng đúng bìa.

**6.2 Supabase sau khi có domain** — ✅ Site URL + Redirect URLs (2.0), SMTP riêng qua Gmail
1. Authentication → URL Configuration → **Site URL** = domain Vercel; **Redirect URLs** thêm `https://<domain>/**` (giữ `http://localhost:3000/**` để dev). `…/api/auth/confirm**` (2.0) là đủ.
2. Template email (mục 2) dùng `{{ .SiteURL }}` → tự trỏ domain mới.
3. (Khuyên dùng) SMTP riêng (Authentication → Emails → SMTP Settings, VD SMTP của Resend): SMTP mặc định của Supabase chỉ gửi tới thành viên organization.

**6.3 GitHub Actions (CI)** — ✅ (2 secret `NEXT_PUBLIC_SUPABASE_*`, CI xanh)
1. Repo → Settings → Secrets and variables → Actions → **Secrets**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (job `check`: typecheck, lint, Vitest, build).
2. e2e: workflow riêng `.github/workflows/e2e.yml`, **không cần secret nào** (Supabase local, mục 6.5). Chạy ở mọi push (trừ `docs/**`, `*.md`) và chạy tay (Actions → e2e → Run workflow). Tắt tạm: **Variables** `RUN_E2E = false`. **Không** thêm `SUPABASE_SERVICE_ROLE_KEY` lên GitHub.

**6.5 e2e trên Supabase local (thay cho project Supabase thứ hai)** — ✅ đã merge `main` (2026-10-17), e2e trên CI xanh
- Lý do tách khỏi production: sách e2e (`e2e-shop-…`, `e2e-admin-…`) là sách **đang bán** trong lúc test chạy, lộ qua tìm kiếm / `/sach` / link trực tiếp; e2e còn tạo user, đơn, voucher thật (sót lại nếu lượt chạy bị ngắt). Project cloud thứ hai không làm được (tài khoản đã dùng hết 2 project free).
- Cách làm: job CI chạy Supabase CLI (`supabase start`, Docker trên runner) → DB trống dựng từ `schema.sql` + `seed.sql` + `seed-foreign-books.sql` (`supabase/config.toml`, migration tắt vì đã nằm trong `schema.sql`) → `scripts/e2e-seed.ts` nạp 58 sách test + bìa giả → Playwright. Auth local: xác nhận email bật, template song ngữ như production, thư vào hộp thư giả Mailpit. Không đụng project production.
- Việc của bạn: không có gì bắt buộc. Dữ liệu e2e cũ trên production: lần kiểm gần nhất (2026-10-17, `measure.ts --check-leftovers`) 0 sót; sau khi merge script không còn chạm production, muốn kiểm lại thì chạy trong SQL Editor production `select count(*) from auth.users where email like 'e2e+%@example.com'` và `select count(*) from public.books where slug like 'e2e-%'` (kỳ vọng 0).
- (Tùy chọn) Chạy e2e trên máy dev: cài Docker Desktop (WSL2, ~4GB RAM cho Supabase + Chromium + next start; máy 8GB sẽ chật) → `npx supabase start` → `npx tsx scripts/e2e-seed.ts` → `npx playwright test`. `npx supabase stop` khi xong.
- Không chạy `npm run test:e2e` trên DB production nữa: `scripts/e2e-env.ts` từ chối URL production và mọi host không phải `127.0.0.1` / `localhost`.

**6.4 Kiểm tra sau deploy** — đang làm (theo checklist `final-report.md` mục 2, lỗi gửi thành một đợt)
- `https://<domain>/`, `/en`, `/sach/sapiens`, `/sitemap.xml`, `/robots.txt`; slug lạ `/sach/khong-co` → 404.
- Đăng ký → email xác nhận → trang "Xác nhận email" → bấm nút.
- Đặt một đơn COD + một đơn chuyển khoản (thông tin demo), hủy cả hai.
- Google Search Console (tùy chọn): thêm domain, gửi `sitemap.xml`.

## 7. (Tùy chọn) Captcha cho đăng ký / quên mật khẩu

Chưa làm (Supabase đã giới hạn tần suất). Muốn bật: Cloudflare Turnstile → lấy site key + secret → Supabase Authentication → Attack Protection → bật CAPTCHA (Turnstile, dán secret) → nhờ Claude thêm widget vào form đăng ký / đăng nhập / quên mật khẩu (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, gửi `captchaToken` khi gọi Supabase Auth).
