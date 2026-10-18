# Tiến độ

## Việc để sau

- [Đợt "giảm JS client" – làm D trước] D: search-palette import zod qua src/features/books/schemas.ts (~30KB khi mở ⌘K), trái quy ước "client không import zod". Thay bằng hàm kiểm tra tay + Vitest khớp schema. Có từ Phase 2.
- [Đợt "giảm JS client"] B: client component dùng clsx thay cn; chỉ giữ cn ở chỗ cần gộp class đè (VD Button nhận className). Ước tính −8 đến −10KB gzip mọi trang. Phải rà mọi chỗ className đè và kiểm giao diện bằng mắt.
- [Đợt "giảm JS client"] C: icon lucide của client component (theme-toggle, cart-badge, search-trigger, shelf-nav, review-form) render ở server, truyền qua children. Ước tính −2 đến −3KB.
- [Đo] measure:js đang cộng cả polyfill noModule 0cz1… (38.6KB gzip) dù trình duyệt hiện đại không tải; xem có nên loại khỏi số đo.
- [Không làm] E: bỏ next-intl ở client (đụng quy ước Link / i18n/navigation).
- [Rủi ro chấp nhận] resendConfirmation / requestPasswordReset: giới hạn ~60 giây mỗi email có thể cho biết email đã đăng ký (RATE_LIMITED kèm số giây). Có từ trước đợt ux-messages.
- [Sau migration B] chạy lại `supabase gen types`, so với src/types/database.ts đang sửa tay; xóa INVALID_VOUCHER.
- [Đợt "giảm JS client"] lazy-load sheet bộ lọc ở /sach và trang danh mục (next/dynamic), ước −8KB; sau đó đặt ngân sách cho 2 route này.
- [Đo] scripts/measure-js.mjs thêm cột ngân sách theo route.
- [Để sau – Việc 6 đêm 2026-10-18] Không có JavaScript: Server Action trả kết quả (lỗi / "đã gửi") trên trang có khung tĩnh prerender (Cache Components) thì response POST chỉ có phần động (`<div hidden id="S:…">`), KHÔNG có khung tĩnh → trang trắng (không `<main>`, không form). State đã tính đúng (`EMAIL_NOT_CONFIRMED` nằm trong `__next_f`), chỉ không có chỗ hiện. Ảnh hưởng mọi form khi tắt JS mà action trả kết quả (đăng nhập, gửi lại email xác nhận, địa chỉ, đánh giá, thanh toán, hủy đơn); action kết thúc bằng redirect vẫn chạy. Bằng chứng: e2e tạm (đã gỡ) trong run 39148697724, artifact `playwright-report` có `no-js-after-login.html`. Không sửa trong ux-messages: không phải lỗi của login-form (> 40 dòng, đụng cách bố trí form của mục 14). Hướng xem: hành vi của Next 16 với form POST không JS trên trang PPR (issue / cấu hình), hoặc đổi cách báo kết quả khi không JS (redirect kèm tham số URL).
- [Theo dõi – mục 15 ux-messages] Request 404 chập chờn đã có URL nhờ commit chẩn đoán: `cart-account.spec.ts:94` (desktop-account, run 39148697724, qua ở lần retry) log `404 http://localhost:3100/dang-nhap?next=%2Ftai-khoan&_rsc=…` (request RSC tới trang đăng nhập), KHÔNG phải link sách trên kệ trang chủ như giả thuyết. Theo ★ đã duyệt ("log URL ra request khác thì dừng, báo trước khi sửa"): chưa sửa, chờ chủ dự án.

Chuyển từ `docs/plans/handoff.md` ("Đợt sau", chủ dự án ghi, chưa làm):

- `/sach`, tìm kiếm **và** catalog chatbot (`getChatCatalog`) chưa loại sách thuộc danh mục đang ẩn (ux-messages chỉ lọc kệ trang chủ) → cần quyết một quy tắc chung.
- Tác giả nước ngoài trùng: Peter Drucker (id 86 / 87 / 88), Stephen Hawking (113 / 114), Jim Collins (90 / 92), Jerry Porras (93 / 94).
- id 75 gộp hai người: "Trần Tuyết Nhung và Anthony Reid".
- Tổ chức ghi là tác giả: Nhà xuất bản Kim Đồng, Harvard Business Review, Ladybird.
- Tên sách lỗi: "Kien Chuot Va Ruoi" (không dấu), "Mười chín chân dùng nhà văn…" (sai chính tả), tên còn dính "(hardcover)" / "(soft cover…)".
- Xóa `INVALID_VOUCHER` sau khi migration B đã chạy.
