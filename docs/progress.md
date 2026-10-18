# Tiến độ

## Việc để sau

- [Đợt "giảm JS client" – làm D trước] D: search-palette import zod qua src/features/books/schemas.ts (~30KB khi mở ⌘K), trái quy ước "client không import zod". Thay bằng hàm kiểm tra tay + Vitest khớp schema. Có từ Phase 2.
- [Đợt "giảm JS client"] B: client component dùng clsx thay cn; chỉ giữ cn ở chỗ cần gộp class đè (VD Button nhận className). Ước tính −8 đến −10KB gzip mọi trang. Phải rà mọi chỗ className đè và kiểm giao diện bằng mắt.
- [Đợt "giảm JS client"] C: icon lucide của client component (theme-toggle, cart-badge, search-trigger, shelf-nav, review-form) render ở server, truyền qua children. Ước tính −2 đến −3KB.
- [Đo] measure:js đang cộng cả polyfill noModule 0cz1… (38.6KB gzip) dù trình duyệt hiện đại không tải; xem có nên loại khỏi số đo.
- [Không làm] E: bỏ next-intl ở client (đụng quy ước Link / i18n/navigation).

Chuyển từ `docs/plans/handoff.md` ("Đợt sau", chủ dự án ghi, chưa làm):

- `/sach`, tìm kiếm **và** catalog chatbot (`getChatCatalog`) chưa loại sách thuộc danh mục đang ẩn (ux-messages chỉ lọc kệ trang chủ) → cần quyết một quy tắc chung.
- Tác giả nước ngoài trùng: Peter Drucker (id 86 / 87 / 88), Stephen Hawking (113 / 114), Jim Collins (90 / 92), Jerry Porras (93 / 94).
- id 75 gộp hai người: "Trần Tuyết Nhung và Anthony Reid".
- Tổ chức ghi là tác giả: Nhà xuất bản Kim Đồng, Harvard Business Review, Ladybird.
- Tên sách lỗi: "Kien Chuot Va Ruoi" (không dấu), "Mười chín chân dùng nhà văn…" (sai chính tả), tên còn dính "(hardcover)" / "(soft cover…)".
- Xóa `INVALID_VOUCHER` sau khi migration B đã chạy.
