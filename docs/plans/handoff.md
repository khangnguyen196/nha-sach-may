# Bàn giao cho phiên Claude Code mới (2026-10-16)

Đọc file này khi bắt đầu phiên ở thư mục dự án, sau `CLAUDE.md` (được nạp tự động).

## Trạng thái

- Phase 1–10 trong Lộ trình (`CLAUDE.md`) **đã xong và đã merge vào `main`**, cùng bản sửa email auth (`fix-auth-default-email`). Không còn nhánh tính năng nào đang mở.
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

## Việc mở (chưa ai làm)

- Chủ dự án đang test tay theo checklist (`final-report.md` mục 2) trên bản deploy; lỗi sẽ gửi thành **một đợt**, sửa chung một nhánh.
- Lỗi đã biết, sửa cùng đợt đó: với template mặc định, link đặt lại mật khẩu lỗi (hết hạn / đã dùng) thì `/xac-nhan` hiện "Về trang đăng nhập" thay vì "Yêu cầu liên kết mới", vì Supabase gắn lỗi sau dấu `#` nên server không đọc được.
- Đề xuất, chưa duyệt: tạo project Supabase riêng cho e2e / CI (`owner-todo.md` mục 6.5); kéo LCP mobile xuống < 2.5 s (đo trên domain thật trước; ý tưởng ở báo cáo `phase-10.md`); captcha (mục 7).

Mở đầu phiên mới: tóm tắt trạng thái trong vài dòng rồi chờ giao việc.
