# Làm đêm 2026-10-16: Phase 8 → 9 → 10

Chủ dự án ngủ, sáng mới xem. Làm liền một mạch, **không dừng chờ trả lời**. Sau khi bị nén ngữ cảnh / hết hạn mức: đọc lại `CLAUDE.md` + file này, làm tiếp từ mục chưa tick (tick ngay khi xong từng mục, commit cùng nhóm việc).

## Quy trình

**Nhánh**: `phase-8` tách từ `main`; `phase-9` tách từ `phase-8`; `phase-10` tách từ `phase-9`. Không merge vào `main`, không push `main`, không force push. Commit + push nhánh sau mỗi nhóm việc. Phase sau cần commit mới của phase trước → `git merge phase-8` vào `phase-9` (merge thường, không rebase).

**Migration** (chủ dự án chưa chạy được trong đêm):
- Viết đủ migration cho cả đêm ngay đầu, mỗi phase một file (trên nhánh của phase đó), cập nhật `schema.sql`, sửa tay `src/types/database.ts` cho khớp (ghi: sinh lại sau khi chạy), push.
- Chạy lại được (idempotent) và giữ nguyên hành vi cũ. **Không chạy SQL lên Supabase.**
- Làm hết phần không phụ thuộc migration trước. Code phụ thuộc migration: viết xong, có Vitest; e2e cần cột / hàm mới thì để lại, ghi "chờ migration".
- Đường đọc ở trang prerender (trang chủ) phải chịu được khi cột chưa có, để `build` / e2e vẫn chạy trước migration.

**Phase 8**: chọn hết ★ của `phase-8.md`.
- Mục 1 chạy Open Library **một lần**, giãn cách, ghi nguồn ở footer + điều khoản vào `data.md`.
- Chưa có cột `cover_width`: script đo chiều rộng bìa hiện tại (tải từ Storage) để chọn sách. `--apply` chỉ đổi `cover_url`; `cover_width` ghi sau migration bằng `--measure`.
- Tự duyệt lưới "bìa cũ | bìa mới": chỉ apply bìa chắc chắn đúng sách và nét hơn. Bìa nghi ngờ: bỏ qua, liệt kê (tên + lý do) vào `data.md`.

**Phase 9, 10**: viết `phase-9.md`, `phase-10.md` theo Lộ trình CLAUDE.md, cùng định dạng các phase trước. Tự chọn ★, có mục "Quyết định tự chọn — duyệt cuối" (lựa chọn, lý do, phương án khác). Không chờ duyệt.
- Cần tài khoản / khóa ngoài (email, captcha, Vercel, ngân hàng VietQR, secrets CI): không dừng. Email chỉ ghi log; VietQR dùng thông tin demo trong config, ghi rõ "dự án học tập". Việc chủ dự án cần làm → `owner-todo.md`.
- Phase 10: chuẩn bị deploy (cấu hình + hướng dẫn từng bước trong `owner-todo.md`). Không tự deploy, không tạo tài khoản.

**Kiểm tra mỗi phase**: `typecheck`, `lint`, `build`, Vitest; e2e toàn bộ (fail vì mạng: chờ 3 phút, tối đa 3 lượt; không nới timeout, không xóa / skip test); `measure:js` trong ngân sách. Fail thật: sửa tối đa 3 lần, vẫn fail → ghi "Bị chặn", làm tiếp phần khác.

**Luôn cấm**: mở / sửa `.env.local` (chỉ `check:env`); chạy SQL lên Supabase; sửa / xóa dữ liệu thật ngoài script đã duyệt (`import:books`, `e2e-user`, `covers`); force push; push / merge vào `main`; deploy; thêm dependency khi chưa thật cần (cần thì ghi lý do + kích thước, ưu tiên gói chạy ở server).

**Sáng**: viết `morning-report.md` rồi push: mỗi phase đã xong / chờ migration / bị chặn; migration cần chạy theo thứ tự (đường dẫn + câu SQL kiểm tra); gom mọi "Quyết định tự chọn — duyệt cuối"; owner-todo; kết quả kiểm tra, số đo JS, bảng bìa trước / sau; danh sách commit từng nhánh.

## Checklist

### Đầu đêm
- [x] `night.md` (file này), nhánh `phase-8` từ `main`
- [x] Soát code / schema liên quan phase 9, 10 (reviews, voucher checkout, thanh toán, email, SEO, 404)
- [x] Viết `phase-9.md`, `phase-10.md` (plan + quyết định tự chọn), `owner-todo.md`
- [x] Migration phase 8 (`cover_width`) trên `phase-8` + `schema.sql` + types → push
- [x] Nhánh `phase-9` từ `phase-8`: migration phase 9 + `schema.sql` + types → push
- [x] Nhánh `phase-10` từ `phase-9`: không cần migration (nhánh đã tạo, push)

### Phase 8 (nhánh `phase-8`)
- [x] `scripts/covers.ts` (`--measure`, `--openlibrary --dry-run`, `--apply`) + Vitest
- [x] Chạy Open Library dry-run (một lần, giãn cách) → tự duyệt lưới → `--apply` bìa chắc chắn; ghi `data.md` (điều khoản, bảng trước / sau, bìa bỏ qua)
- [x] Footer ghi nguồn Open Library
- [x] Import / admin upload ghi `cover_width` (chờ migration)
- [x] `getHomeShelves` + kệ (nút trước / sau) + hero + trang Tất cả sách `/sach`
- [x] e2e `home.spec.ts`
- [x] Kiểm tra: typecheck / lint / build / Vitest / e2e toàn bộ / `measure:js`
- [x] Báo cáo trong `phase-8.md`, tick tiến độ, cập nhật CLAUDE.md → push

### Phase 9 (nhánh `phase-9`, merge `phase-8` trước)
- [x] Theo checklist trong `phase-9.md`
- [x] Kiểm tra đủ bộ → báo cáo → push

### Phase 10 (nhánh `phase-10`, merge `phase-9` trước)
- [ ] Theo checklist trong `phase-10.md`
- [ ] Kiểm tra đủ bộ → báo cáo → push

### Sáng
- [ ] `morning-report.md` → push (`phase-10`, kèm bản trên `phase-8`, `phase-9` nếu khác)
