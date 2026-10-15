# Dữ liệu sách: trạng thái và việc còn lại

## Đã có (2026-10-14)

- 49 sách đã import (lượt C, từ `scripts/out/preview-approved.json`).
- 22 bìa chỉ rộng 128px (12 fallback ảnh nhỏ + 10 "ảnh lớn" mà Google chỉ có 128px); 27 bìa WebP 600px.

## Việc tiếp theo

- [ ] **Tôi (chủ dự án)**: chạy `supabase/seed-foreign-books.sql` trên Supabase TRƯỚC lượt A + D.
- [ ] Lượt A + D: chạy sau ~15h ngày 2026-10-15 (quota Books API reset 0h giờ Pacific):
  `npm run import:books -- --dry-run --hires-covers --max-requests 950` → rà sách lạc chủ đề → duyệt → `--from-preview`.
- [x] Phase 7: thay bìa trang lót của "100 câu hỏi về lịch sử chữ Quốc ngữ" (ảnh JPEG nên bộ lọc PNG < 40KB không bắt được).
- [x] Lọc tên summary / workbook / study guide / analysis of cho danh mục `en` (`isDerivativeTitle`, commit D).
