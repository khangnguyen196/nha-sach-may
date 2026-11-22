# Đợt ke-danh-muc: kệ cho mỗi danh mục cha ở trang chủ

## Yêu cầu (chủ dự án, 2026-11-21)

- Bỏ lưới danh mục cuối trang chủ (section `categories-title`), thay bằng **mỗi danh mục cha đang hiện một kệ ngang** (dùng lại `Shelf` / `ShelfNav`), trừ Sách ngoại văn (đã có kệ riêng).
- Tiêu đề = tên danh mục (localize), "Xem tất cả" → trang danh mục, ngay dưới tiêu đề là hàng chip danh mục con (cuộn ngang trên điện thoại). Kệ Sách ngoại văn cũng có chip.
- Sách: từ các danh mục lá của danh mục cha, ≤ 12 cuốn, bán chạy → mới nhất, hết hàng xếp sau, chặn theo sở thích như kệ khác; không có cuốn nào thì ẩn kệ (đợt ke-danh-muc-nguong; ban đầu ẩn khi ít hơn 4 cuốn).
- Được trùng sách với Nổi bật / Bán chạy / Mới về / hàng thẻ khuyến mãi; giữa các kệ danh mục không trùng.
- Thứ tự theo `sort_order` của danh mục. Ảnh kệ danh mục lazy, LCP không chậm hơn, CLS 0, JS client trang chủ tăng ≤ 0,5KB.
- Không đổi DB, không thêm thư viện. Không lên main trong đợt này: dừng ở Preview.

## Quyết định

- **Một cache mỗi kệ** (`getCategoryShelf(leafIds)`, `'use cache'` + `cacheTag('books')` + `cacheLife('hours')`): `cacheTag` nhận tối đa 128 tag / lần gọi, gộp ~10 kệ × 12 sách sẽ vượt; mỗi kệ = `books` + ≤ 12 tag `book:{id}`. Không sửa `getHomeShelves`. Mọi kệ gọi trong cùng một `Promise.all` với `getHomeShelves`.
- Query lấy 36 ứng viên (bán chạy → mới nhất → id), `categoryShelfBooks` (hàm thuần, Vitest) đưa sách còn hàng lên trước (sắp xếp ổn định), cắt 12, không có cuốn nào → rỗng (đợt ke-danh-muc-nguong bỏ hằng ngưỡng 4 cuốn).
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

Kệ danh mục render lúc build (production): Văn học, Tâm lý - Kỹ năng sống, Thiếu nhi, Sách học ngoại ngữ, Lịch sử - Địa lý (Kinh tế ít hơn 4 cuốn → ẩn theo ngưỡng lúc đó; đợt ke-danh-muc-nguong bỏ ngưỡng). Mọi ảnh thêm vào đều lazy; số ảnh tải ngay không đổi.

## Còn chờ chủ dự án

1. [Đã giải quyết ở đợt ke-danh-muc-nguong] Neo `#categories` của link "Xem danh mục" (trang 404) chỉ chứa các kệ ≥ 4 cuốn: Kinh tế đang ẩn kệ, danh mục con của nó chỉ vào được qua footer → trang Kinh tế.
2. HTML trang chủ +65% (gzip 18,6 → 27,0KB): đề xuất giữ 12 cuốn / kệ nếu tốc độ tải trên Preview không tệ hơn production.

## Vòng 2

- `getCategoryShelfOrEmpty` (ngoài 'use cache', mẫu `getShippingTermsOrNull`): một kệ lỗi → kệ đó rỗng (ẩn), trang chủ vẫn hiện; lỗi nội bộ của Next ném tiếp. Vitest `src/features/books/queries.test.ts`.
- `scroll-mt-24` cho neo `#categories`; key chip theo slug; e2e chặn theo sở thích ở kệ Văn học (`prefs-blocks-account.spec.ts` (g)).

## Kết quả CI nhánh (@1a5abd2)

- CI check 44891960245, migration-check 44891960112, e2e 44891960163: xanh (864 qua / 24 skip / 0 fail / 0 flaky).
- Preview (deployment 7961769925) bị chặn bởi Vercel login → ảnh SAU chụp từ bản build local của nhánh (next start, đã tắt): `D:\Bán sách-backup\ke-danh-muc\sau\` (6 ảnh).
- Trên bản build: tràn ngang 0px ở 320 / 390 / 1440, không còn `#categories-title`, 5 nav chip (Sách ngoại văn, Văn học, Tâm lý - Kỹ năng sống, Thiếu nhi, Sách học ngoại ngữ), console không lỗi.
- Đã quyết (chủ dự án, 2026-11-21, sau khi xem Preview): lên main (`a068f03`, Vercel Production deployment 7962853901); giữ 12 cuốn / kệ; giữ neo 404 `#categories` chỉ chứa kệ ≥ 4 cuốn (Kinh tế ẩn). Chi tiết lên main + kiểm web thật + cách quay về: dòng [Xong 2026-11-21] ke-danh-muc ở `docs/progress.md`.

## Đợt ke-danh-muc-nguong (2026-11-21)

- Quyết định chủ dự án: kệ danh mục hiện khi có ≥ 1 cuốn (chỉ ẩn khi 0 cuốn), kệ ít sách canh trái như kệ thường, không giãn bìa (thẻ rộng cố định `w-36 sm:w-40`, `ShelfNav` ẩn khi kệ không tràn: không sửa `shelf.tsx`), giữ 12 cuốn / kệ + chip con; neo 404 `#categories` chứa mọi kệ có sách. Thay quyết định cũ "giữ neo chỉ chứa kệ ≥ 4 cuốn (Kinh tế ẩn)".
- Code: bỏ hằng ngưỡng 4 cuốn trong `categoryShelfBooks` (`features/books/utils.ts`); Vitest 0 / 1 / 2 / 3 cuốn (thử đỏ: đặt lại ngưỡng 4 → 3 test đỏ, bỏ → xanh). e2e `home-category-shelves.spec.ts`: mọi cha có sách có kệ, Kinh tế có kệ + chip con, ở 1440 thẻ đầu Kinh tế khớp Văn học và không có nút cuộn, neo `/#categories` đủ kệ.
- Không đổi DB, không thêm thư viện.
- Đã lên main (2026-11-22, chủ dự án bỏ bước Preview, đồng ý lên main nếu đủ điều kiện): main `0180410` (code `4d49136`), Vercel Production deployment 7974629736; kiểm web thật đạt (11 kệ h2, Kinh tế 3 cuốn + 3 chip, thẻ đầu khớp Văn học, không nút cuộn, 97 ảnh 0 lỗi, không tràn ngang). Chi tiết + cách quay về: dòng [Xong 2026-11-22] ke-danh-muc-nguong ở `docs/progress.md`.

Số đo (build ở thư mục chính, main `8117100` → nhánh `4d49136`, dữ liệu production lúc build):

<table>
  <thead>
    <tr><th></th><th>Trước</th><th>Sau</th></tr>
  </thead>
  <tbody>
    <tr><td><code>measure:js -- vi</code> (KB gzip ngoài baseline)</td><td>44.6</td><td>44.6</td></tr>
    <tr><td><code>vi.html</code> byte</td><td>456 701</td><td>471 039</td></tr>
    <tr><td><code>vi.html</code> gzip (level 9)</td><td>26 986</td><td>27 852</td></tr>
    <tr><td><code>&lt;img&gt;</code></td><td>94</td><td>97</td></tr>
    <tr><td><code>loading="lazy"</code></td><td>86</td><td>89</td></tr>
    <tr><td>Không lazy</td><td>8</td><td>8</td></tr>
    <tr><td>Kệ danh mục render lúc build</td><td>Văn học, Tâm lý - Kỹ năng sống, Thiếu nhi, Sách học ngoại ngữ, Lịch sử - Địa lý</td><td>Văn học, <b>Kinh tế</b>, Tâm lý - Kỹ năng sống, Thiếu nhi, Sách học ngoại ngữ, Lịch sử - Địa lý</td></tr>
  </tbody>
</table>

Kệ Kinh tế thêm 3 sách (3 ảnh, đều lazy); số ảnh tải ngay không đổi, JS client không đổi.

## Để sau

- HTML trang chủ tăng ~8KB gzip (thêm ~42 thẻ sách): theo dõi LCP / TTFB trên production; cần thì giảm số sách mỗi kệ hoặc stream kệ danh mục.
- [Xong 2026-11-22] Ảnh sau: bỏ bước Preview, chụp trên production sau đợt ke-danh-muc-nguong: D:\Bán sách-backup\ke-danh-muc-nguong\sau-production\.
