# Tiến độ

## Việc để sau

- [Đợt "giảm JS client" – làm D trước] D: search-palette import zod qua src/features/books/schemas.ts (~30KB khi mở ⌘K), trái quy ước "client không import zod". Thay bằng hàm kiểm tra tay + Vitest khớp schema. Có từ Phase 2.
- [Đợt "giảm JS client"] B: client component dùng clsx thay cn; chỉ giữ cn ở chỗ cần gộp class đè (VD Button nhận className). Ước tính −8 đến −10KB gzip mọi trang. Phải rà mọi chỗ className đè và kiểm giao diện bằng mắt.
- [Đợt "giảm JS client"] C: icon lucide của client component (theme-toggle, cart-badge, search-trigger, shelf-nav, review-form) render ở server, truyền qua children. Ước tính −2 đến −3KB.
- [Đo] measure:js đang cộng cả polyfill noModule 0cz1… (38.6KB gzip) dù trình duyệt hiện đại không tải; xem có nên loại khỏi số đo.
- [Không làm] E: bỏ next-intl ở client (đụng quy ước Link / i18n/navigation).
- [Đợt "giảm JS client"] lazy-load sheet bộ lọc ở /sach và trang danh mục (next/dynamic), ước −8KB; sau đó đặt ngân sách cho 2 route này.
- [Đo] scripts/measure-js.mjs thêm cột ngân sách theo route.
- [Đợt riêng sau perf-js] Tắt JS: form Server Action trả kết quả hiện trang trắng (POST chỉ trả phần động, Cache Components). Ảnh hưởng: đăng nhập, gửi lại email, địa chỉ, đánh giá, thanh toán, hủy đơn; action kết thúc bằng redirect vẫn chạy. Hướng: xem issue / cấu hình Next 16, hoặc báo kết quả qua redirect + tham số URL. Hướng điều tra + ước lượng: docs/plans/sau-ux.md mục 5. Lúc điều tra: kiểm lại danh sách form (thêm đăng ký, quên mật khẩu, đặt lại mật khẩu cũng trả kết quả trong khung tĩnh); phương án redirect **không** đưa email lên URL (chỉ `?sent=1`).
- [Điều tra – nhánh riêng sau merge] Request RSC 404 `/dang-nhap?next=%2Ftai-khoan&_rsc=…` (cart-account.spec.ts:94, desktop-account, chập chờn 2/5 lượt đêm 18→19/10). Giả thuyết: prefetch / điều hướng /tai-khoan khi chưa đăng nhập → proxy 307 → request RSC nhận 404. Có từ trước ux-messages.
- [Đã quyết 2026-10-19] ★ perf-js: xem docs/plans/perf-js.md; đợt sau làm D → sheet lazy → C.
- [Rủi ro chấp nhận] Dò email qua thời gian phản hồi (GoTrue gửi thư đồng bộ khi có tài khoản); app không chặn được.
- [Đã quyết 2026-10-19] Giữ TEST10 hiện trong gợi ý (demo); không còn việc gì.
- [Dọn 2026-10-26] xóa nhánh backup/main-local-06d5009 và stash eb9bb91.
- [Mức thấp] Thay 5 bìa sai + 6 bìa đáng ngờ (làm từ từ).

Chuyển từ `docs/plans/handoff.md` ("Đợt sau", chủ dự án ghi, chưa làm):

- `/sach`, tìm kiếm **và** catalog chatbot (`getChatCatalog`) chưa loại sách thuộc danh mục đang ẩn (ux-messages chỉ lọc kệ trang chủ) → cần quyết một quy tắc chung. Đã quyết hướng A; plan + SQL chỉ đọc: docs/plans/sau-ux.md mục 6 (chờ duyệt ★6).
- Dữ liệu tác giả / tên sách (4 dòng dưới): plan + `supabase/checks/catalog-data-r.sql` (chỉ đọc) ở docs/plans/sau-ux.md mục 7, chờ chủ dự án chạy + duyệt ★7.
- Tác giả nước ngoài trùng: Peter Drucker (id 86 / 87 / 88), Stephen Hawking (113 / 114), Jim Collins (90 / 92), Jerry Porras (93 / 94).
- id 75 gộp hai người: "Trần Tuyết Nhung và Anthony Reid".
- Tổ chức ghi là tác giả: Nhà xuất bản Kim Đồng, Harvard Business Review, Ladybird.
- Tên sách lỗi: "Kien Chuot Va Ruoi" (không dấu), "Mười chín chân dùng nhà văn…" (sai chính tả), tên còn dính "(hardcover)" / "(soft cover…)".
