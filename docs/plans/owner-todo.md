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

## 2. Template email auth (Phase 9)

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

## 5. Duyệt và merge (theo thứ tự)

Ba nhánh xếp chồng: `phase-8` ← `phase-9` ← `phase-10` (mỗi nhánh chứa nhánh trước). Claude không merge / push `main`.
1. Đọc `docs/plans/morning-report.md`, chạy migration (mục 1), chạy lại `npm run test:e2e` trên `phase-10`.
2. Duyệt từng nhánh (hoặc chỉ `phase-10` nếu đồng ý cả ba), merge vào `main` theo thứ tự 8 → 9 → 10.
3. ✅ Đã xóa nhánh dự phòng `42703` (khi chưa có `cover_width`) trong `getHomeShelves`.

## 6. Deploy lên Vercel (Phase 10)

Claude đã chuẩn bị cấu hình (header bảo mật trong `next.config.ts`, CI `.github/workflows/ci.yml`, `.env.example`), **không** tự deploy, không tạo tài khoản.

**6.1 Vercel**
1. vercel.com → đăng nhập bằng GitHub → **Add New… → Project** → chọn repo `nha-sach-may` → Framework: Next.js (tự nhận), Root: `./`, Build / Install command: để mặc định.
2. **Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: như `.env.local`.
   - `SITE_URL`: domain thật (VD `https://nha-sach-may.vercel.app`). Bỏ trống thì app dùng `VERCEL_PROJECT_PRODUCTION_URL` (Vercel tự đặt).
   - (Tùy chọn) `RESEND_API_KEY`, `EMAIL_FROM`, `VIETQR_*` (mục 3, 4).
   - **Không** thêm `SUPABASE_SERVICE_ROLE_KEY` (chỉ dùng cho script local / CI e2e), **không** thêm `E2E_FAULT_INJECTION`.
3. **Settings → Functions → Region**: chọn gần project Supabase (Supabase Dashboard → Project Settings → General → Region; VD Singapore `sin1`).
4. **Deploy**. Build prerender catalog từ Supabase nên chạy `npm run covers -- --measure` (sau migration) **trước** khi deploy để kệ trang chủ dùng đúng bìa.

**6.2 Supabase sau khi có domain**
1. Authentication → URL Configuration → **Site URL** = domain Vercel; **Redirect URLs** thêm `https://<domain>/**` (giữ `http://localhost:3000/**` để dev).
2. Template email (mục 2) dùng `{{ .SiteURL }}` → tự trỏ domain mới.
3. (Khuyên dùng) SMTP riêng (Authentication → Emails → SMTP Settings, VD SMTP của Resend): SMTP mặc định của Supabase chỉ gửi tới thành viên organization.

**6.3 GitHub Actions (CI)**
1. Repo → Settings → Secrets and variables → Actions → **Secrets**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (job `check`: typecheck, lint, Vitest, build).
2. e2e trên CI (tùy chọn): thêm secret `SUPABASE_SERVICE_ROLE_KEY` + **Variables** `RUN_E2E = true`. e2e tạo / xóa user, đơn, sách test thật → **nên dùng một project Supabase riêng cho CI** (chạy `schema.sql`, `seed.sql`, migration, import sách), không dùng chung DB production.

**6.5 Sau khi deploy: tạo project Supabase thứ hai riêng cho e2e / CI** (nên làm trước khi chạy e2e lần nữa)
- Lý do: sách e2e (`e2e-shop-…`, `e2e-admin-…`) là sách **đang bán** (danh mục gốc ẩn nhưng sách `is_active`) trên chính DB production trong lúc test chạy. Chúng không lên menu, sitemap hay kệ "Mới về", nhưng **vẫn lộ qua tìm kiếm** (`search_books`, ô ⌘K, `/tim-kiem`), trang Tất cả sách `/sach` và link trực tiếp; khách thật có thể thêm vào giỏ / đặt hàng. e2e cũng tạo user, đơn, voucher `E2E-ADMIN-…` thật (dọn khi xong, sót lại nếu lần chạy bị ngắt).
- Cách làm: Supabase → New project (free tier, cùng region) → SQL Editor chạy `schema.sql`, `seed.sql`, `seed-foreign-books.sql`, toàn bộ `supabase/migrations/` theo thứ tự → `import:books -- --from-preview` các file đã duyệt (hoặc một tập nhỏ) với env trỏ project mới.
- Trỏ e2e vào project mới: `.env.local` máy dev giữ project production; chạy e2e bằng file env riêng (VD `.env.e2e.local`, do bạn tạo và nạp trước khi chạy) hoặc chỉ chạy e2e trên CI với secret của project mới (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Muốn Claude hỗ trợ chọn file env khi chạy e2e thì nói, đó là thay đổi cấu hình cần duyệt (quy tắc "chỉ `check:env` đọc env").
- Sau khi tách: không chạy `npm run test:e2e` trên DB production nữa.

**6.4 Kiểm tra sau deploy**
- `https://<domain>/`, `/en`, `/sach/sapiens`, `/sitemap.xml`, `/robots.txt`; slug lạ `/sach/khong-co` → 404.
- Đăng ký → email xác nhận → trang "Xác nhận email" → bấm nút.
- Đặt một đơn COD + một đơn chuyển khoản (thông tin demo), hủy cả hai.
- Google Search Console (tùy chọn): thêm domain, gửi `sitemap.xml`.

## 7. (Tùy chọn) Captcha cho đăng ký / quên mật khẩu

Chưa làm (Supabase đã giới hạn tần suất). Muốn bật: Cloudflare Turnstile → lấy site key + secret → Supabase Authentication → Attack Protection → bật CAPTCHA (Turnstile, dán secret) → nhờ Claude thêm widget vào form đăng ký / đăng nhập / quên mật khẩu (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, gửi `captchaToken` khi gọi Supabase Auth).
