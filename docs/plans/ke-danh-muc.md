# Đợt ke-danh-muc: kệ cho mỗi danh mục cha ở trang chủ

## Yêu cầu (chủ dự án, 2026-11-21)

- Bỏ lưới danh mục cuối trang chủ (section `categories-title`), thay bằng **mỗi danh mục cha đang hiện một kệ ngang** (dùng lại `Shelf` / `ShelfNav`), trừ Sách ngoại văn (đã có kệ riêng).
- Tiêu đề = tên danh mục (localize), "Xem tất cả" → trang danh mục, ngay dưới tiêu đề là hàng chip danh mục con (cuộn ngang trên điện thoại). Kệ Sách ngoại văn cũng có chip.
- Sách: từ các danh mục lá của danh mục cha, ≤ 12 cuốn, bán chạy → mới nhất, hết hàng xếp sau, chặn theo sở thích như kệ khác; < 4 cuốn thì ẩn kệ.
- Được trùng sách với Nổi bật / Bán chạy / Mới về / hàng thẻ khuyến mãi; giữa các kệ danh mục không trùng.
- Thứ tự theo `sort_order` của danh mục. Ảnh kệ danh mục lazy, LCP không chậm hơn, CLS 0, JS client trang chủ tăng ≤ 0,5KB.
- Không đổi DB, không thêm thư viện. Không lên main trong đợt này: dừng ở Preview.

## Quyết định

- **Một cache mỗi kệ** (`getCategoryShelf(leafIds)`, `'use cache'` + `cacheTag('books')` + `cacheLife('hours')`): `cacheTag` nhận tối đa 128 tag / lần gọi, gộp ~10 kệ × 12 sách sẽ vượt; mỗi kệ = `books` + ≤ 12 tag `book:{id}`. Không sửa `getHomeShelves`. Mọi kệ gọi trong cùng một `Promise.all` với `getHomeShelves`.
- Query lấy 36 ứng viên (bán chạy → mới nhất → id), `categoryShelfBooks` (hàm thuần, Vitest) đưa sách còn hàng lên trước (sắp xếp ổn định), cắt 12, < 4 → rỗng.
- `leafIds` giữ cách tính cũ của `page.tsx`, chỉ dùng id trong `visibleCategoryIds`.
- **Chip dùng lại `Chip`** của trang danh mục (tách ra `features/books/components/chip.tsx`, trang danh mục không đổi giao diện). `Shelf` nhận prop `chips` (Server Component, không thêm JS client).
- **Tên nav riêng từng kệ**: "Danh mục con của {category}" / "Subcategories of {category}" (`catalog.shelfSubcategories`): trang có nhiều nav chip.
- **Neo `#categories`** (khung bọc các kệ danh mục, không thêm heading) thay `#categories-title` cho link "Xem danh mục" ở trang 404.
- **Không ưu tiên bìa nét** ở kệ danh mục (giữ đúng thứ tự bán chạy / mới nhất).
- Bỏ `home.categoriesTitle`, `home.categoriesEmpty`.

## Số đo (build ở thư mục chính, main `5208252` → nhánh `eede827`)

`measure:js` (KB gzip ngoài baseline 131.4KB):

| Route | Trước | Sau |
|---|---|---|
| vi | 44.6 | 44.6 |
| vi/books | 43.7 | 43.7 |
| vi/categories/van-hoc | 43.7 | 43.7 |
| vi/books/sapiens | 46.3 | 46.3 |
| vi/cart | 47.6 | 47.6 |
| vi/checkout | 46.7 | 46.7 |
| vi/login | 38.1 | 38.1 |
| vi/account | 39.6 | 39.6 |

`.next/server/app/vi.html` (dữ liệu production lúc build):

| | Trước | Sau |
|---|---|---|
| Byte | 276 437 | 456 688 |
| Gzip (level 9) | 18 614 | 26 974 |
| `<img>` | 52 | 94 |
| `loading="lazy"` | 44 | 86 |
| Không lazy | 8 | 8 |

Kệ danh mục render lúc build (production): Văn học, Tâm lý - Kỹ năng sống, Thiếu nhi, Sách học ngoại ngữ, Lịch sử - Địa lý (Kinh tế < 4 cuốn → ẩn). Mọi ảnh thêm vào đều lazy; số ảnh tải ngay không đổi.

## Còn chờ chủ dự án

1. Neo `#categories` của link "Xem danh mục" (trang 404) chỉ chứa các kệ ≥ 4 cuốn: Kinh tế đang ẩn kệ, danh mục con của nó chỉ vào được qua footer → trang Kinh tế.
2. HTML trang chủ +65% (gzip 18,6 → 27,0KB): đề xuất giữ 12 cuốn / kệ nếu tốc độ tải trên Preview không tệ hơn production.

## Vòng 2

- `getCategoryShelfOrEmpty` (ngoài 'use cache', mẫu `getShippingTermsOrNull`): một kệ lỗi → kệ đó rỗng (ẩn), trang chủ vẫn hiện; lỗi nội bộ của Next ném tiếp. Vitest `src/features/books/queries.test.ts`.
- `scroll-mt-24` cho neo `#categories`; key chip theo slug; e2e chặn theo sở thích ở kệ Văn học (`prefs-blocks-account.spec.ts` (g)).

## Để sau

- HTML trang chủ tăng ~8KB gzip (thêm ~42 thẻ sách): theo dõi LCP / TTFB trên Preview; cần thì giảm số sách mỗi kệ hoặc stream kệ danh mục.
- Ảnh sau (Preview, 1440 + 390, sáng + tối): chụp khi có link Preview.
