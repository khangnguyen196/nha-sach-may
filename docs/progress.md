# Tiến độ

## Việc để sau

- [Chờ quyết lại ★4 / ★5] B: client component dùng clsx thay cn; chỉ giữ cn ở chỗ cần gộp class đè (VD Button nhận className). Ước tính −8 đến −10KB gzip mọi trang. Phải rà mọi chỗ className đè và kiểm giao diện bằng mắt.
- [Không làm] E: bỏ next-intl ở client (đụng quy ước Link / i18n/navigation).
- [Đã làm A 2026-10-20 (production 7e30f6c); ★8 lên production 005c550; B hoãn; ★9 / ★10 đã đo; ★7 đã có issue vercel/next.js#99756] docs/plans/no-js.md
- [Xong 2026-10-20, main 005c550] Khách có JS gửi form trước khi hydrate → trang trắng: nút gửi khóa tới khi hydrate (★8 a1+; 17 component + 2 form sổ địa chỉ; đăng xuất / thêm giỏ không khóa; autocomplete="off"). Chủ dự án test điện thoại ĐẠT. no-js.md.
- [Đã quyết 2026-10-20] Nút khóa trước hydrate giữ độ mờ của Button (disabled:opacity-50): mạng chậm thì đây là dấu hiệu duy nhất nút chưa bấm được.
- [Không làm, quyết 2026-10-20] Câu giải thích khi nút khóa lâu (một câu chung ở layout sau ~4 s): khóa thường ~0,2 s, đồ án học tập. Chấp nhận cả ca xấu nhất: chunk JS chính tải lỗi → nút khóa mãi, không có câu giải thích.
- [Đã đo 2026-10-20, đề xuất chưa làm] Trang sách / danh mục / tác giả đã prerender không có nội dung trong HTML tĩnh (★9): nội dung lộ ~0,25 s sau FCP, LCP trang sách 2,5 s (mobile 4G mô phỏng); xem lại khi có số liệu thật của khách (no-js.md).
- [Đã đo 2026-10-20] ★10: bot mạng xã hội thấy đủ og:* trong <head>, không cần sửa; còn thiếu user agent thật của Zalo. ★7: đã có issue vercel/next.js#99756 (open), không gửi bài mới; chủ dự án tùy chọn 👍 / bình luận thêm dữ kiện Vercel.
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
- [Mức thấp] scripts/analyze-diff.mjs:16-17 comment còn ghi 'polyfill noModule, measure:js cũng đếm' (sau perf-js ★8 measure:js in nhưng không cộng).
- [Theo dõi] Request RSC 404 sau đăng xuất (sửa ở bc1718b): cần 15 lượt e2e đầy đủ liên tiếp không tái diễn; hiện 13/15 (main bc1718b run 39391179766, khoa-nut 178b092 run 39392430246, 9c1d5a9 run 39418804347, ab0459b run 39433888961, f834438 run 39435810853, 005c550 run 39444893876 (chạy tay), main 005c550 run 39446771250, ron-test 8f8b57e run 39454503338 (1 flaky KHÁC: inputs.spec /tim-kiem, không phải RSC 404) + run 39456585704 (chạy tay), main 8f8b57e run 39458379651, on-dinh-input 234eb1d run 39465453374 + run 39467346057 (chạy tay), main 234eb1d run 39469439078; còn lại đều 0 flaky / 0 fail). Request `/dang-nhap?next=%2Ftai-khoan…&_rsc=…` (cart-account.spec.ts "gộp giỏ…"); bản sửa: prefetch={false} cho link /account khi đã đăng nhập + 2 thẻ trang tài khoản; e2e logout-prefetch-account.spec.ts. Chi tiết: docs/plans/sau-ux.md mục 4.
- [Xong 2026-10-20, main 8f8b57e] Kiểm tĩnh form: nút <Button>/<button> trong form POST phải ghi type="button" / "reset"; bất biến e2e seed tồn ≥ 20; đóng context trong finally; test đăng nhập không JS (cần user) sang login-nojs-account.spec.ts, chạy sau setup (ron-test).
- [Xong 2026-10-21, main 234eb1d] inputs.spec: expectReadableInputs đo lại tới khi ô ổn định (ô bị $RC thay giữa lúc đo ra NaN, flaky run 39454503338), vẫn kiểm ≥ 16px và số ô > 0; lượt có ô bị tách thì đo lại cả lượt (on-dinh-input).

Chuyển từ `docs/plans/handoff.md` ("Đợt sau", chủ dự án ghi, chưa làm):

- [Đã quyết ★7b] Giữ tác giả 22 'Nhà xuất bản Kim Đồng' và 24 'Nhiều tác giả' (sau-ux.md mục 7).
