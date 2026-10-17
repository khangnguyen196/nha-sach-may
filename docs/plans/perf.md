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
- Thêm vào giỏ: xem mục 4 ở phần "Sửa" (đo lại riêng một lần bấm).
- Đổi trạng thái đơn (admin): 38 `is_admin` quanh một lần bấm (prefetch lại sau `refresh()`).
- Tìm kiếm: có index trigram `books_search_idx`; `search_books` lần đầu 2,4 s (kết nối lạnh), các lần sau ~190 ms.
- Trang có query (`/sach?…`, tìm kiếm) render theo request lần đầu, sau đó dữ liệu nằm trong `"use cache"`.

## Sửa (nhánh `fix-manual-test`, 2026-10-17)

Chủ dự án chọn mục 1–7 của báo cáo. Mỗi mục một commit:

| # | Mục | Đã làm |
|---|---|---|
| 1 | LCP ảnh bìa đầu lưới (mobile) | 2 bìa đầu `BookGrid` (danh mục, `/sach`, tìm kiếm, tác giả): `preload` + `fetchPriority="high"`; bìa trang sách thêm `fetchPriority="high"` (đã có `preload`) |
| 2 | CLS footer (tìm kiếm, giỏ khách) | `<main>` của layout cửa hàng cao tối thiểu một màn hình trừ header → footer luôn dưới màn hình đầu |
| 3 | Prefetch ở admin | `AdminLink` không prefetch khi hiện trên màn hình; chỉ prefetch khi rê chuột / focus / chạm (Next 16 `prefetch={false}` tắt cả hover nên tự gọi `router.prefetch`) |
| 6 | Sắp xếp / lọc / sang trang | `CatalogPending`: bấm link cùng trang khác query hoặc đổi ô sắp xếp → lưới mờ, `aria-busy`, "Đang tải kết quả…" (sr-only) tới khi trang mới tới |
| 7 | Áp dụng voucher | `VoucherPending`: submit form GET → khối tổng tiền mờ + "Đang tính lại tổng tiền…" tới khi trang mới hiện (Back từ bfcache thì bỏ) |
| 5 | Palette | **Không đổi**, đã có sẵn (xem "Bằng chứng mục 4, 5") |
| 4 | Thêm vào giỏ | **Không đổi**: action đã trả số lượng giỏ mới, không `refresh()`; còn một `router.refresh()` dự phòng ở client khi bấm lúc chưa biết phiên — bỏ đi có rủi ro lệch badge nên dừng, không sửa (xem "Bằng chứng mục 4, 5") |

`measure:js` sau sửa: trang chủ +39,6 KB, trang sách +42,4 KB (ngân sách 50 KB), danh mục +52,7 KB (vượt từ trước, ngân sách chỉ áp cho trang sách).

## Sau

Bản Preview của Vercel cho nhánh bị **Vercel Authentication** chặn (302 → đăng nhập Vercel) nên chưa đo được trên hạ tầng thật. Đo **A/B local**: `next build` + `next start` của `main` rồi của `fix-manual-test`, cùng máy, cùng DB, cùng kịch bản (3 lượt, trung vị). Số tuyệt đối khác production (không có CDN; mọi query Supabase đi từ VN, 150–400 ms và dao động mạnh). Sau khi merge, đo lại production bằng:

```bash
npx tsx scripts/perf/measure.ts --out perf-after.json
```

### Trang (ms)

| Trang | Thiết bị | LCP lạnh trước → sau | CLS trước → sau | TBT trước → sau |
|---|---|---|---|---|
| Trang chủ | desktop | 224 → 192 | 0.00 → 0.00 | 0 → 0 |
| Tất cả sách | desktop | 268 → 220 | 0.00 → 0.00 | 0 → 0 |
| Tất cả sách, lọc + trang 2 | desktop | 292 → 252 | 0.00 → 0.00 | 0 → 0 |
| Danh mục | desktop | 236 → 232 | 0.00 → 0.00 | 0 → 0 |
| Trang sách | desktop | 204 → 200 | 0.00 → 0.00 | 0 → 0 |
| Tìm kiếm | desktop | 212 → 220 | 0.00 → 0.00 | 0 → 0 |
| Giỏ hàng (khách) | desktop | 172 → 156 | 0.00 → 0.00 | 0 → 0 |
| Thanh toán | desktop | 156 → 244 | 0.00 → 0.00 | 0 → 0 |
| Đơn hàng của tôi | desktop | 156 → 148 | 0.00 → 0.00 | 0 → 0 |
| Admin tổng quan | desktop | 1708 → 1372 | 0.00 → 0.00 | 0 → 0 |
| Admin đơn hàng | desktop | 488 → 784 | 0.00 → 0.00 | 0 → 0 |
| Trang chủ | mobile | 1404 → 1456 | 0.00 → 0.00 | 372 → 447 |
| Tất cả sách | mobile | 1760 → 1768 | 0.00 → 0.00 | 384 → 421 |
| Tất cả sách, lọc + trang 2 | mobile | 1628 → 1676 | 0.00 → 0.00 | 469 → 436 |
| Danh mục | mobile | 3424 → 3500 | 0.00 → 0.00 | 353 → 399 |
| Trang sách | mobile | 1584 → 1580 | 0.00 → 0.00 | 380 → 505 |
| Tìm kiếm | mobile | 3040 → 3008 | 0.00 → 0.00 | 409 → 405 |
| Giỏ hàng (khách) | mobile | 3168 → 3052 | 0.15 → 0.00 | 483 → 401 |
| Thanh toán | mobile | 2264 → 1960 | 0.00 → 0.00 | 742 → 375 |
| Đơn hàng của tôi | mobile | 1276 → 1232 | 0.00 → 0.00 | 385 → 327 |
| Admin tổng quan | mobile | 1280 → 2008 | 0.00 → 0.00 | 346 → 320 |
| Admin đơn hàng | mobile | 1440 → 3372 | 0.00 → 0.00 | 385 → 63 |

### Thao tác (ms)

| Thao tác | Thiết bị | Trung vị trước → sau (ms) | 3 lượt trước | 3 lượt sau |
|---|---|---|---|---|
| Chuyển trang: trang chủ → bấm sách đầu tiên | desktop | 185 → 249 | 397 / 170 / 185 | 1121 / 249 / 232 |
| /sach: sắp xếp giá tăng dần | desktop | 187 → 535 | 302 / 173 / 187 | 535 / 632 / 267 |
| /sach: lọc Tiếng Anh | desktop | 286 → 384 | 331 / 286 / 217 | 875 / 384 / 292 |
| /sach: sang trang 2 | desktop | 433 → 197 | 433 / 440 / 286 | 402 / 182 / 197 |
| Palette: mở (Ctrl K) | desktop | 391 → 395 | 391 / 389 / 396 | 395 / 433 / 370 |
| Palette: gõ "nguyen" → có gợi ý | desktop | 365 → 364 | 854 / 365 / 325 | 4491 / 364 / 360 |
| Thêm vào giỏ (đã đăng nhập): badge cập nhật | desktop | 86 → 96 | 81 / 90 / 86 | 96 / 104 / 95 |
| Thêm vào giỏ (đã đăng nhập): server ghi xong | desktop | 907 → 1392 | 907 / 920 / 899 | 1882 / 1392 / 1392 |
| Thanh toán: áp dụng voucher | desktop | 1005 → 454 | 944 / 4525 / 1005 | 961 / 454 / 379 |
| Admin: đổi trạng thái đơn (Xác nhận đơn) | desktop | 2971 → 1434 | 9110 / 2971 / 1933 | 1434 / 1389 / 2385 |
| Chuyển trang: trang chủ → bấm sách đầu tiên | mobile | 830 → 914 | 1167 / 830 / 796 | 871 / 1240 / 914 |
| /sach: sắp xếp giá tăng dần | mobile | 1022 → 835 | 1022 / 923 / 1319 | 1281 / 835 / 831 |
| /sach: lọc Tiếng Anh | mobile | 1413 → 1614 | 1775 / 1413 / 1358 | 1668 / 1614 / 1590 |
| /sach: sang trang 2 | mobile | 1259 → 2299 | 1259 / 2118 / 959 | 2299 / 2322 / 2248 |
| Palette: mở (Ctrl K) | mobile | 1094 → 1097 | 1136 / 1094 / 1066 | 1097 / 1122 / 1091 |
| Palette: gõ "nguyen" → có gợi ý | mobile | 1025 → 1086 | 1004 / 1025 / 1049 | 1075 / 1086 / 1098 |
| Thêm vào giỏ (đã đăng nhập): badge cập nhật | mobile | 508 → 580 | 508 / 508 / 487 | 657 / 500 / 580 |
| Thêm vào giỏ (đã đăng nhập): server ghi xong | mobile | 1401 → 1469 | 1401 / 1440 / 1384 | 1439 / 1482 / 1469 |
| Thanh toán: áp dụng voucher | mobile | 1105 → 1258 | 1035 / 1105 / 1171 | 1258 / 1072 / 1440 |
| Admin: đổi trạng thái đơn (Xác nhận đơn) | mobile | 1808 → 1780 | 2862 / 1808 / 1784 | 1779 / 1780 / 2336 |

### Admin: số lần `rpc/is_admin` (log fetch local, cùng số lượt tải)

| | Trước | Sau |
|---|---:|---:|
| Mỗi lần mở `/admin` | ~15 | 2 (proxy + layout) |
| Mỗi lần mở `/admin/don-hang` | ~19 | 2 |
| Mỗi lần đổi trạng thái đơn | ~19 | 5 |

### Bằng chứng mục 4, 5 (không sửa code)

**Mục 4, thêm vào giỏ**
- `src/features/cart/actions.ts` dòng 60–77 (`addToCart`): không `refresh()` (hai lời gọi `refresh()` ở dòng 101, 114 thuộc `setCartQuantity`, `removeFromCart`). Query: dòng 68 `loadBookAndLine` (2 request song song), dòng 75 upsert, dòng 57 `getCartCount`.
- `src/features/cart/components/add-to-cart-button.tsx`: đã biết phiên (`mode === 'user'`, header đã gọi `setCartSession`) → dòng 60–62 (badge optimistic, chốt bằng số server trả). Chưa biết phiên (header phần theo phiên chưa stream xong) → dòng 66 `router.refresh()` ("Header có thể stream tới sau với số render trước lúc thêm") → render lại phần động của trang sách.
- Log fetch phía server (`next start` local), một lần bấm:
  - đã biết phiên (kịch bản chờ link tài khoản ở header): **4 request**, 3 nhịp tuần tự (`books` + `cart_items` song song 141–150 ms → upsert 568 ms → đếm giỏ 146 ms), 2,5 s sau không có request nào;
  - bấm ngay khi nút hydrate (như kịch bản đo ban đầu): 4 request của action **+ 6 request** của `router.refresh()` (đếm giỏ, `is_admin`, kệ cùng danh mục, đánh giá của tôi, "đã mua chưa", danh sách đánh giá). Thời gian "server ghi xong" ở bảng trên đo theo cách này, nên gồm cả lượt render lại. Báo cáo đầu (bản ở phần "Trước") đúng về con số ~10 query nhưng sai nguyên nhân (không phải `refresh()` trong action).
- Không sửa: bỏ `router.refresh()` dự phòng thì header stream tới sau có thể ghi đè badge bằng số cũ → rủi ro lệch đồng bộ (điều kiện "dừng và báo").

**Mục 5, palette + `/api/search`**
- `src/features/books/components/search-trigger.tsx` dòng 8 `loadPalette = () => import('./search-palette')`, dòng 44–45 `onPointerEnter` / `onFocus` gọi `loadPalette()`; không tải lúc rảnh.
- `src/app/api/search/route.ts` dòng 6 `CACHE_HIT = 'public, s-maxage=300, stale-while-revalidate=3600'`, dòng 16 gắn vào response (lỗi: `no-store`, dòng 19).
- Header app gửi (`next start` local): `cache-control: public, s-maxage=300, stale-while-revalidate=3600`.
- Production (2026-10-17, `/api/search?q=sapiens`): trình duyệt nhận `Cache-Control: public` (Vercel dùng `s-maxage` / `stale-while-revalidate` cho CDN rồi bỏ khỏi response); lần 1 `X-Vercel-Cache: MISS` 3,2 s (0,69 s là TLS), lần 2 `HIT` 0,87 s (0,47 s là TLS).
- Vì không đổi code, chênh lệch A/B của hai mục này là nhiễu (và cách bấm sớm ở mục 4).

### Kiểm thử trạng thái "Đang tính lại…" (voucher)

Test e2e đầu tiên dùng `click()` + `expect(locator)`: cả hai **chờ điều hướng do cú bấm xong** mới kiểm, lúc đó trang cũ đã bị thay → test fail cả khi có lẫn không có `VoucherPending` (không phân biệt được). Đã viết lại: bấm và đọc chữ ngay trong trang cũ bằng một `evaluate` (thăm dò tối đa 1 s; phản hồi bị làm chậm 1,5 s). Thí nghiệm (không commit bản gỡ):

| | desktop | mobile |
|---|---|---|
| Gỡ `VoucherPending` | **fail** đúng chỗ (nhận `null`) | **fail** đúng chỗ |
| Có `VoucherPending` | kiểm "Đang tính lại…" **qua**; bước sau (lỗi voucher ở trang mới trong 5 s) fail vì trang mới tới chậm (setup lượt đó 58 s) | **qua** |

### Đọc kết quả

- **Rõ**: CLS giỏ khách (mobile) 0,154 → 0 (tìm kiếm cũng là 0 ở local; lỗi CLS tìm kiếm chỉ thấy trên production). Admin: request phía server ~10 lần ít hơn mỗi lần mở trang. Trạng thái đang tải (sắp xếp / lọc / sang trang, voucher) hiện ngay khi bấm (e2e kiểm < 1 s với phản hồi bị làm chậm 1,5 s).
- **Không thấy cải thiện ở local**: LCP mobile của các trang lưới (danh mục 3,4 → 3,5 s). Lưới nằm trong phần stream theo `searchParams`, nên preload tới cùng lúc với thẻ `<img>`, không sớm hơn; ảnh qua bộ tối ưu ảnh local (không có CDN) chiếm phần lớn thời gian. Cần đo production sau merge mới kết luận; muốn LCP danh mục giảm thật thì phải đưa hàng đầu lưới vào phần prerender tĩnh (thay đổi cấu trúc trang, chưa làm).
- **Nhiễu**: sắp xếp / sang trang / admin dao động lớn giữa các lượt ở cả trước lẫn sau. Đã thử giả thuyết "React chờ ảnh preload trước khi commit điều hướng" (làm chậm mọi ảnh 3 s): lưới vẫn đổi sau 0,22 s → không phải do preload.
- Dọn dữ liệu e2e: 0 sót sau cả hai lượt A/B và lượt đếm `is_admin`.
