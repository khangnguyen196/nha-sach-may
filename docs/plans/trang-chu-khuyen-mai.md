# Trang chủ khuyến mãi (đợt trang-chu-khuyen-mai)

Khu khuyến mãi kiểu "hàng thẻ" ở đầu trang chủ, bỏ câu trích dẫn hero, giao diện sáng nền trắng là mặc định. Không thêm
thư viện, không đổi DB, ảnh chỉ là bìa sách.

## Quyết định của chủ dự án (2026-11-20, trả lời vòng 0)

- Phương án **A**: hàng thẻ khuyến mãi ở đầu trang, dưới là dải đồng hồ giờ VN + nút "Xem tất cả sách" (ảnh mẫu:
  `D:\Bán sách-backup\trang-chu-khuyen-mai\mau-vong-0\a-*.png`).
- **Bỏ thẻ Mã giảm giá** ở đợt này (giữ "không đổi DB": anon không đọc được `vouchers`). Không nút Chép.
- Thẻ: Đang giảm giá, Miễn phí giao hàng, Bán chạy (2×2), Sách ngoại văn (2×2). Chợ sách cũ: không làm (0 tin
  `approved` ở production).
- Thẻ **được trùng sách** với kệ bên dưới (ngoại lệ, ghi ở CLAUDE.md → Design system → Trang chủ); thẻ ưu tiên bìa
  `cover_width ≥ SHARP_COVER_WIDTH` (300px).
- Link thẻ Đang giảm giá: "Xem tất cả sách" → `/sach`, không ghi số sách.
- Màu `sale` sáng đổi `#c2410c` → `#b83c0b`.
- Đợt này **không tự lên main**: push nhánh + CI xanh → đưa link Preview + ảnh trước / sau → chờ chủ dự án đồng ý.

## Làm (vòng 1)

- **P1 token + theme**: `globals.css` `:root` = bộ sáng (nền `#ffffff`, surface `#f8f6f1`, surface-raised `#f3eee6`,
  viền 0.12 / 0.22, sale `#b83c0b`), bộ tối ở `.dark` (giữ giá trị cũ); token mới `promo-from` / `promo-to` /
  `promo-foreground` / `promo-accent` / `promo-muted`, `sale-foreground` (giá trị: `mau-vong-0/tokens.html`,
  `tuong-phan.json`). `ThemeProvider` `defaultTheme="light"`. Vitest `globals.test.ts` đọc `:root` sáng / `.dark` tối,
  kiểm tương phản `sale`, `sale-foreground`, chữ `promo-*` và vòng focus `promo-accent` trên nền promo.
- **P2 hàng thẻ**: `features/home/components/` (`promo-row.tsx`, `book-tiles-card.tsx`, `book-tile.tsx`,
  `ship-card.tsx`), `features/home/queries.ts` (`getShippingTerms`: mốc + phí giao từ RPC `quote_items` với giỏ một
  cuốn rẻ nhất; giỏ rỗng luôn trả phí 0 nên không đọc được phí từ `quote_items('[]')`). `getHomeShelves().promo`:
  - Đang giảm giá: 2 query (bìa nét / mọi bìa), mỗi query ≤ 48 sách có `original_price`, còn hàng, danh mục đang hiện,
    mới nhất trước; lọc `original_price > price` + xếp % giảm trong bộ nhớ (`saleCardBooks`; PostgREST không so được
    hai cột). Production 2026-11-20: 125 sách đang giảm còn hàng, 84 bìa nét → % giảm cao nhất chỉ tính trong 48 cuốn
    mới nhất mỗi nhóm.
  - Bán chạy / Ngoại văn: dùng lại ứng viên của kệ + một query bìa nét cho Bán chạy (`promoCardBooks`).
  - Thẻ dưới 4 cuốn thì ẩn. Ô sách: khung `[data-book-slot]` + `BlockedVeil`, không nghiêng bìa.
  - `page.tsx`: bỏ blockquote, h1 `sr-only`; dải đồng hồ (mặt 48px; dưới sm dòng giờ một hàng riêng đủ bề rộng để vẫn
    một dòng ở 320px) + nút "Xem tất cả sách" (`data-testid="home-strip"`). Bìa đầu của thẻ đầu `preload`, ảnh 3 thẻ đầu
    tải ngay, còn lại lazy.
- **P3 e2e + tài liệu**: spec mới `e2e/promo-row.spec.ts`; sửa `smoke`, `layout`, `home`, `book-tilt`,
  `prefs-blocks-account`, `store-clock` theo hành vi mới; bất biến dữ liệu ở `scripts/e2e-seed.test.ts`; CLAUDE.md
  (Design system).

## Làm (vòng 2, sửa theo code-reviewer vòng 1)

- Thẻ "Miễn phí giao hàng": `getShippingTermsOrNull` (`features/home/queries.ts`) bọc ngoài `'use cache'`, đầu catch
  là `unstable_rethrow` → lỗi query sách / RPC `quote_items` chỉ ẩn thẻ, trang chủ vẫn hiện (lỗi lúc build: HTML tĩnh
  thiếu thẻ tới lần dựng lại kế tiếp). `getShippingTerms` vẫn throw (bắt bên trong thì null bị cache cả ngày).
- Khung nút trước / sau `hidden md:block md:-inset-x-5` (dưới md khung thò ra ngoài màn hình).
- `global-error.tsx`: thêm class `dark` khi `theme = 'dark'` (sáng là mặc định của token).
- `StoreClock` nhận `faceClassName` / `lineClassName` thay selector con trong `page.tsx` (giao diện như cũ).
- Ngưỡng Bán chạy cố ý khác nhau: **thẻ** Bán chạy hiện khi ≥ 4 cuốn (`PROMO_CARD_SIZE`), **kệ** Bán chạy khi ≥ 6
  (`SHELF_MIN.bestselling`).
- Thứ tự Tab (ghi nhận, không đổi): Tab đi qua mọi ô sách + link "Xem…" của từng thẻ (16 link khi đủ 4 thẻ) rồi
  mới tới dải đồng hồ và kệ; trình duyệt tự cuộn hàng thẻ tới link đang focus.
- e2e thêm: bìa đầu thẻ đầu `fetchpriority=high`, bìa còn lại của 3 thẻ đầu `loading=eager` (thẻ thứ 4 tải lười chỉ
  kiểm được khi có thẻ Bán chạy; trên CI không có, đã xem tay trên bản build với dữ liệu thật); Tab tới ô đầu thẻ đầu ở
  giao diện tối, vòng focus hiện và không bị cắt.

## Để sau

1. **Thẻ Mã giảm giá**: đợt riêng thêm hàm `home_vouchers()` (anon đọc mã `is_public` đang dùng được, không lộ cột
   khác) → SQL qua migration-check xanh rồi chủ dự án chạy; kèm tag cache `vouchers` + `updateTag` ở action admin
   voucher, cache ngắn, nút Chép. Lưu ý mã `MCKKKKKKK` (giảm 50%, tối đa 5.000.000 ₫) đang `is_public` ở production.
2. Bìa "Sự Trả Thù Của Địa Lý" chỉ rộng 128px: chủ dự án thay bìa rõ hơn trong admin (thẻ Bán chạy đang ưu tiên bìa
   nét nên cuốn này xuống sau).
3. Thẻ Chợ sách cũ khi có tin `approved` (không đổi DB, không dùng ảnh người bán).
4. Bộ lọc "đang giảm giá" ở `/sach`: cần đổi DB (cột / chỉ mục so `original_price > price`), link thẻ Đang giảm giá
   khi đó trỏ thẳng vào bộ lọc.
5. Bìa ô 2×2 tỉ lệ 3:4 cắt ~5% trên dưới bìa 2:3; chủ dự án quyết khi xem Preview (giữ theo mẫu A đã duyệt).
6. e2e cho `global-error` ở giao diện tối (người đã chọn tối thấy trang lỗi gốc tối): hiện chỉ kiểm bằng tay.
7. Log của `getShippingTermsOrNull` ở production: Next có thể làm mờ `message` của lỗi từ trong `'use cache'` → thử ép
   lỗi trên Preview rồi xem Vercel Logs, thêm `digest` vào dòng log nếu cần. Lỗi hết giờ khi điền cache lúc build cũng
   thành null: HTML tĩnh trang chủ thiếu thẻ ship mà build không báo (tới lần dựng lại kế tiếp).
8. `StoreClock`: hai prop `faceClassName` / `lineClassName` có giá trị mặc định nhưng hiện chưa chỗ nào truyền khác;
   giữ (reviewer vòng 2 gợi ý, chưa cần dọn).
