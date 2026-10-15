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
