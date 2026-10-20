# Tiến độ

## Việc để sau

- [Chờ quyết lại ★4 / ★5] B: client component dùng clsx thay cn; chỉ giữ cn ở chỗ cần gộp class đè (VD Button nhận className). Ước tính −8 đến −10KB gzip mọi trang. Phải rà mọi chỗ className đè và kiểm giao diện bằng mắt.
- [Không làm] E: bỏ next-intl ở client (đụng quy ước Link / i18n/navigation).
- [Đang lập plan: docs/plans/no-js.md, nhánh no-js] Tắt JS: form Server Action trả kết quả hiện trang trắng (POST chỉ trả phần động, Cache Components). Ảnh hưởng: đăng nhập, gửi lại email, địa chỉ, đánh giá, thanh toán, hủy đơn; action kết thúc bằng redirect vẫn chạy. Hướng: xem issue / cấu hình Next 16, hoặc báo kết quả qua redirect + tham số URL. Hướng điều tra + ước lượng: docs/plans/sau-ux.md mục 5. Lúc điều tra: kiểm lại danh sách form (thêm đăng ký, quên mật khẩu, đặt lại mật khẩu cũng trả kết quả trong khung tĩnh); phương án redirect **không** đưa email lên URL (chỉ `?sent=1`).
- [Rủi ro chấp nhận] Dò email qua thời gian phản hồi (GoTrue gửi thư đồng bộ khi có tài khoản); app không chặn được.
- [Đã quyết 2026-10-19] Giữ TEST10 hiện trong gợi ý (demo); không còn việc gì.
- [Dọn 2026-10-26] xóa nhánh backup/main-local-06d5009 và stash eb9bb91.
- [Mức thấp] Thay 5 bìa sai + 6 bìa đáng ngờ (làm từ từ).
- [Mức thấp] sitemap còn trang tác giả chỉ có sách thuộc danh mục ẩn (gợi ý 2 review sau-ux).
- [Chấp nhận 2026-10-20] Lõi lucide Icon ('use client' trong lucide-react 1.57) vẫn tải ở mọi trang cửa hàng; mọi route đã dưới ngân sách.
- [Mức thấp] cart-view.tsx, checkout-form.tsx (client) còn import lucide (ngoài plan C).
- [Mức thấp] Chỗ lệch đã biết của LazyBoundary: (1) dialog modal đang mở mà palette lỗi → 'Đóng' đóng luôn dialog, bẫy focus kéo khỏi nút Tải lại; (2) hai boundary cùng lỗi → hai khối chồng một chỗ; (3) khối lỗi che nút 'Bộ lọc' trên mobile (Đóng / Esc được). (Chat lỗi rồi sang /thanh-toan: đã sửa, quay lại không tự hiện.)
- [Theo dõi] Lỗi #3 build ('use cache' took too long, getRelatedBooks) gặp lại 2 lần khi build local 2026-10-20; CI / Vercel xanh.
- [Mức thấp] scripts/analyze-diff.mjs:16-17 comment còn ghi 'polyfill noModule, measure:js cũng đếm' (sau ★8 measure:js in nhưng không cộng).
- [Tái diễn 2026-10-20, mở lại] Request RSC 404 `/dang-nhap?next=%2Ftai-khoan&_rsc=…` (cart-account.spec.ts:94, desktop-account): flaky 1 lần trên e2e `main` run 39360765659 sau merge perf-js, dù bản sửa `d60b369` đã qua 16 run liền. Chi tiết: docs/plans/sau-ux.md mục 4.

Chuyển từ `docs/plans/handoff.md` ("Đợt sau", chủ dự án ghi, chưa làm):

- [Đã quyết ★7b] Giữ tác giả 22 'Nhà xuất bản Kim Đồng' và 24 'Nhiều tác giả' (sau-ux.md mục 7).
