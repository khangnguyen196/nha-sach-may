# Tiến độ

## Việc để sau

- [Chờ quyết lại ★4 / ★5] B: client component dùng clsx thay cn; chỉ giữ cn ở chỗ cần gộp class đè (VD Button nhận className). Ước tính −8 đến −10KB gzip mọi trang. Phải rà mọi chỗ className đè và kiểm giao diện bằng mắt.
- [Không làm] E: bỏ next-intl ở client (đụng quy ước Link / i18n/navigation).
- [Đã làm A 2026-10-20: dải noscript + câu trong 3 form auth; B hoãn; ★9 / ★10 chờ đo (chỉ đọc); ★7 chờ (tìm issue / soạn, không gửi)] docs/plans/no-js.md
- [Đã code trên khoa-nut, chờ duyệt] Khách có JS gửi form trước khi hydrate → trang trắng (★8 (a1+): nút gửi khóa tới khi hydrate; no-js.md).
- [Chờ quyết] Trang sách / danh mục / tác giả đã prerender không có nội dung trong HTML tĩnh (no-js.md, ★9).
- [Rủi ro chấp nhận] Dò email qua thời gian phản hồi (GoTrue gửi thư đồng bộ khi có tài khoản); app không chặn được.
- [Đã quyết 2026-10-19] Giữ TEST10 hiện trong gợi ý (demo); không còn việc gì.
- [Dọn 2026-10-26] xóa nhánh backup/main-local-06d5009 và stash eb9bb91.
- [Mức thấp] Thay 5 bìa sai + 6 bìa đáng ngờ (làm từ từ).
- [Mức thấp] sitemap còn trang tác giả chỉ có sách thuộc danh mục ẩn (gợi ý 2 review sau-ux).
- [Chấp nhận 2026-10-20] Lõi lucide Icon ('use client' trong lucide-react 1.57) vẫn tải ở mọi trang cửa hàng; mọi route đã dưới ngân sách.
- [Mức thấp] cart-view.tsx, checkout-form.tsx (client) còn import lucide (ngoài plan C).
- [Mức thấp] Chỗ lệch đã biết của LazyBoundary: (1) dialog modal đang mở mà palette lỗi → 'Đóng' đóng luôn dialog, bẫy focus kéo khỏi nút Tải lại; (2) hai boundary cùng lỗi → hai khối chồng một chỗ; (3) khối lỗi che nút 'Bộ lọc' trên mobile (Đóng / Esc được). (Chat lỗi rồi sang /thanh-toan: đã sửa, quay lại không tự hiện.)
- [Mức thấp] Khung chat đang mở (desktop, không modal) khi sang /thanh-toan vẫn giữ `open = true`; quay về trang khác thì khung tự mở lại và kéo focus (có từ Phase 11; review chunk-loi). Hướng sửa: ở nhánh trang ẩn chat của `ChatBubbleInner` đặt `open = false` (giữ `entries`).
- [Theo dõi] Lỗi #3 build ('use cache' took too long, getRelatedBooks) gặp lại 2 lần khi build local 2026-10-20; CI / Vercel xanh.
- [Mức thấp] scripts/analyze-diff.mjs:16-17 comment còn ghi 'polyfill noModule, measure:js cũng đếm' (sau ★8 measure:js in nhưng không cộng).
- [Thử bản sửa eeb81b9 2026-10-20, theo dõi: đủ 15 lượt e2e đầy đủ liền không tái diễn thì đóng] Request RSC 404 `/dang-nhap?next=%2Ftai-khoan…&_rsc=…` sau đăng xuất (cart-account.spec.ts "gộp giỏ…"): prefetch={false} cho link /account khi đã đăng nhập + 2 thẻ trang tài khoản; e2e logout-prefetch-account.spec.ts. Chi tiết: docs/plans/sau-ux.md mục 4.

Chuyển từ `docs/plans/handoff.md` ("Đợt sau", chủ dự án ghi, chưa làm):

- [Đã quyết ★7b] Giữ tác giả 22 'Nhà xuất bản Kim Đồng' và 24 'Nhiều tác giả' (sau-ux.md mục 7).
