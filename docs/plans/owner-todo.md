# Việc của chủ dự án (sau đêm 2026-10-16)

Claude không làm được các việc dưới đây (cần tài khoản, khóa bí mật, hoặc chạy SQL lên Supabase). Theo thứ tự nên làm.

## 1. Chạy migration (bắt buộc, theo đúng thứ tự)

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
