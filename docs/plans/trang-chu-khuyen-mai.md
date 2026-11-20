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

## Để sau

1. **Thẻ Mã giảm giá**: đợt riêng thêm hàm `home_vouchers()` (anon đọc mã `is_public` đang dùng được, không lộ cột
   khác) → SQL qua migration-check xanh rồi chủ dự án chạy; kèm tag cache `vouchers` + `updateTag` ở action admin
   voucher, cache ngắn, nút Chép. Lưu ý mã `MCKKKKKKK` (giảm 50%, tối đa 5.000.000 ₫) đang `is_public` ở production.
2. Bìa "Sự Trả Thù Của Địa Lý" chỉ rộng 128px: chủ dự án thay bìa rõ hơn trong admin (thẻ Bán chạy đang ưu tiên bìa
   nét nên cuốn này xuống sau).
3. Thẻ Chợ sách cũ khi có tin `approved` (không đổi DB, không dùng ảnh người bán).
4. Bộ lọc "đang giảm giá" ở `/sach`: cần đổi DB (cột / chỉ mục so `original_price > price`), link thẻ Đang giảm giá
   khi đó trỏ thẳng vào bộ lọc.
5. `src/app/global-error.tsx` (ngoài phạm vi vòng 1): vẫn chỉ thêm class `light` khi `theme = 'light'`; nay sáng là mặc
   định nên người đã chọn tối thấy trang lỗi gốc màu sáng. Sửa: thêm class `dark` khi `theme = 'dark'`.
