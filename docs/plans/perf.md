# Tốc độ: đo trước / sau (đợt fix-manual-test)

Đo bằng `scripts/perf/measure.ts` (Playwright) trên `https://nha-sach-may.vercel.app`, từ máy dev ở Việt Nam (Vercel `sin1` + Supabase Singapore). Mỗi phép đo 3 lượt, lấy trung vị.
- **desktop**: Desktop Chrome, mạng thật.
- **mobile**: Pixel 7 + mô phỏng 4G chậm (RTT 150 ms, 1,6 Mbps / 750 Kbps) + CPU chậm 4x như Lighthouse mobile. Số mobile vì vậy chậm hơn máy thật có 4G tốt.
- "lạnh" = context mới (cache trình duyệt trống, có DNS / TLS); "ấm" = tải lại trong cùng context.
- TTFB gồm độ trễ mạng VN → Singapore (~90 ms khi đã có kết nối, ~300 ms khi phải bắt tay TLS).
- Thao tác: thời gian từ lúc bấm tới khi thấy kết quả; INP = event timing dài nhất của thao tác.

Thao tác ghi chỉ chạm dữ liệu e2e tạo tại chỗ (user / admin `e2e+…`, sách `e2e-shop-perf-…`, voucher `E2E-ADMIN-…`, đơn của user e2e). Mọi lượt đo kết thúc bằng dọn dữ liệu và đếm lại: **0 user, 0 sách, 0 danh mục, 0 tác giả, 0 voucher, 0 đơn e2e còn sót** (lượt đo 2026-10-17, cả 4 lần chạy).

## Trước (production = `main` @ `22b7739`, 2026-10-17)

### Trang (ms, CLS không đơn vị)

| Trang | Thiết bị | TTFB lạnh | LCP lạnh | CLS | TBT | TTFB ấm | LCP ấm |
|---|---|---:|---:|---:|---:|---:|---:|
| Trang chủ | desktop | 289 | 736 | 0.00 | 0 | 91 | 252 |
| Tất cả sách | desktop | 318 | 888 | 0.00 | 0 | 93 | 484 |
| Tất cả sách, lọc + trang 2 | desktop | 308 | 1024 | 0.00 | 0 | 93 | 416 |
| Danh mục | desktop | 266 | 820 | 0.00 | 0 | 99 | 388 |
| Trang sách | desktop | 289 | 908 | 0.00 | 0 | 103 | 268 |
| Tìm kiếm | desktop | 330 | 2212 | 0.00 | 14 | 93 | 384 |
| Giỏ hàng (khách) | desktop | 317 | 820 | 0.00 | 4 | 97 | 220 |
| Thanh toán | desktop | 282 | 892 | 0.00 | 0 | 94 | 264 |
| Đơn hàng của tôi | desktop | 337 | 1548 | 0.00 | 13 | 95 | 244 |
| Admin tổng quan | desktop | 351 | 1252 | 0.00 | 3 | 110 | 492 |
| Admin đơn hàng | desktop | 335 | 1360 | 0.00 | 8 | 100 | 368 |
| Trang chủ | mobile | 315 | 1808 | 0.00 | 448 | 94 | 388 |
| Tất cả sách | mobile | 291 | 2528 | 0.00 | 355 | 95 | 1068 |
| Tất cả sách, lọc + trang 2 | mobile | 308 | 2544 | 0.00 | 360 | 122 | 1204 |
| Danh mục | mobile | 293 | 5228 | 0.00 | 347 | 98 | 940 |
| Trang sách | mobile | 341 | 2184 | 0.00 | 386 | 94 | 788 |
| Tìm kiếm | mobile | 302 | 3088 | 0.15 | 341 | 105 | 740 |
| Giỏ hàng (khách) | mobile | 254 | 3124 | 0.15 | 350 | 108 | 708 |
| Thanh toán | mobile | 301 | 1912 | 0.00 | 326 | 100 | 684 |
| Đơn hàng của tôi | mobile | 278 | 1984 | 0.00 | 461 | 98 | 424 |
| Admin tổng quan | mobile | 294 | 1912 | 0.00 | 322 | 101 | 644 |
| Admin đơn hàng | mobile | 349 | 2236 | 0.00 | 408 | 109 | 720 |

Phần tử LCP (lượt bổ sung): trang chủ = câu trích dẫn (chữ); các trang catalog, trang sách, tìm kiếm = **ảnh bìa đầu tiên**. CLS của tìm kiếm và giỏ khách (mobile) đều do **footer** bị đẩy xuống khi nội dung stream xong.

### Thao tác

| Thao tác | Thiết bị | Trung vị (ms) | INP (ms) | 3 lượt |
|---|---|---:|---:|---|
| Chuyển trang: trang chủ → bấm sách đầu tiên | desktop | 1466 | 24 | 1428 / 2979 / 1466 |
| /sach: sắp xếp giá tăng dần | desktop | 355 | 0 | 1349 / 345 / 355 |
| /sach: lọc Tiếng Anh | desktop | 413 | 16 | 444 / 412 / 413 |
| /sach: sang trang 2 | desktop | 373 | 32 | 378 / 373 / 362 |
| Palette: mở (Ctrl K) | desktop | 871 | 0 | 871 / 909 / 372 |
| Palette: gõ "nguyen" → có gợi ý | desktop | 860 | 176 | 1912 / 860 / 854 |
| Thêm vào giỏ (đã đăng nhập): badge cập nhật | desktop | 96 | 24 | 1428 / 94 / 96 |
| Thêm vào giỏ (đã đăng nhập): server ghi xong | desktop | 917 | 32 | 917 / 942 / 413 |
| Thanh toán: áp dụng voucher | desktop | 543 | 0 | 543 / 558 / 491 |
| Admin: đổi trạng thái đơn (Xác nhận đơn) | desktop | 918 | 24 | 1449 / 912 / 918 |
| Chuyển trang: trang chủ → bấm sách đầu tiên | mobile | 575 | 56 | 553 / 1452 / 575 |
| /sach: sắp xếp giá tăng dần | mobile | 883 | 0 | 777 / 883 / 909 |
| /sach: lọc Tiếng Anh | mobile | 1500 | 256 | 1890 / 1422 / 1500 |
| /sach: sang trang 2 | mobile | 2026 | 88 | 2380 / 2026 / 1746 |
| Palette: mở (Ctrl K) | mobile | 1122 | 24 | 1122 / 1131 / 1100 |
| Palette: gõ "nguyen" → có gợi ý | mobile | 1035 | 72 | 1035 / 1031 / 1117 |
| Thêm vào giỏ (đã đăng nhập): badge cập nhật | mobile | 396 | 80 | 368 / 424 / — |
| Thêm vào giỏ (đã đăng nhập): server ghi xong | mobile | 1266 | 80 | 1266 / 1183 / 1306 |
| Thanh toán: áp dụng voucher | mobile | 1469 | 0 | 1469 / 1443 / 1493 |
| Admin: đổi trạng thái đơn (Xác nhận đơn) | mobile | 1396 | 104 | 1396 / 1320 / 1441 |

"Lọc Tiếng Anh" (desktop) và "Thêm vào giỏ" lấy từ lượt đo bổ sung (lượt chính lỗi selector / đo nhầm do lượt trước ghi giỏ muộn).

### Ảnh bìa

| | Trung vị | p90 | Lỗi | Kích thước trung vị | Cache |
|---|---:|---:|---:|---:|---|
| `/_next/image` (cỡ trình duyệt chọn: 256 / 640 / 1080px), lần đầu | 184 ms | 697 ms | 0 / 74 | 12,6 KB | HIT 74 |
| `/_next/image`, lần sau | 165 ms | 370 ms | 0 / 74 | 12,6 KB | HIT 74 |
| Tải thẳng WebP 600px từ Supabase Storage, lần đầu | 513 ms | 1 069 ms | 0 / 37 | 31,2 KB | HIT 37 |
| Tải thẳng, lần sau | 279 ms | 567 ms | 0 / 37 | 31,2 KB | HIT 37 |

Biến thể chưa có trong cache (MISS, đo với `w=3840`): trung vị 884 ms. Ảnh gốc có `Cache-Control: max-age=31536000` → Vercel cache mỗi biến thể 1 năm, mỗi biến thể chỉ biến đổi một lần. Ước tính 189 bìa × ~5 cỡ ≈ 1 000 lượt transformation (một lần), dưới hạn mức Hobby **5 000 / tháng** (vượt → ảnh mới trả 402, ảnh đã cache vẫn chạy). Không tái hiện được 504 của báo cáo #4.

### Query Supabase phía server (`next start` local + log fetch tạm, không commit)

- Trang thanh toán / đơn hàng: 5 query chạy **song song** (giỏ, địa chỉ, `quote_order`, badge, `is_admin`). Không thấy N+1 hay query tuần tự lẽ ra song song ở catalog.
- `/admin`, `/admin/don-hang`: **~19 lần `rpc/is_admin` mỗi lần mở trang**. Mỗi `AdminLink` trên màn hình được prefetch; mỗi request prefetch đi qua proxy (`is_admin`) + layout (`is_admin`).
- Thêm vào giỏ: action 3 nhịp tuần tự (đọc sách + giỏ → upsert) rồi `refresh()` render lại cả trang sách (đánh giá của tôi, đã mua chưa, badge, `is_admin`): ~10 query / lần bấm.
- Đổi trạng thái đơn (admin): 38 `is_admin` quanh một lần bấm (prefetch lại sau `refresh()`).
- Tìm kiếm: có index trigram `books_search_idx`; `search_books` lần đầu 2,4 s (kết nối lạnh), các lần sau ~190 ms.
- Trang có query (`/sach?…`, tìm kiếm) render theo request lần đầu, sau đó dữ liệu nằm trong `"use cache"`.
