# Phase 8: Trang chủ

Trạng thái: **xong trên nhánh `phase-8`, chờ migration + duyệt** (đêm 2026-10-16, chủ dự án vắng: chọn hết ★ theo `night.md`).

## Báo cáo (2026-10-16)

**Đã xong**
- Trang chủ: hero (trích dẫn + CTA "Xem tất cả sách") → Nổi bật (ẩn khi < 4) → Bán chạy (ẩn khi < 6) → Mới về (chỉ sách tiếng Việt) → Sách ngoại văn (tên từ danh mục, "Xem tất cả" → `/danh-muc/sach-ngoai-van`) → Danh mục. `getHomeShelves`: 7 query song song, một `'use cache'` (tag `books` + `book:{id}`), mỗi kệ bìa nét trước rồi lấp đủ 12 (`fillShelf`, Vitest). Bán chạy giữ thứ tự số bán (không xếp bìa nét trước). `/` vẫn prerender.
- Trang **Tất cả sách** `/sach` (`/en/books`): `CatalogView` với lọc danh mục cha / giá / ngôn ngữ / còn hàng, sắp xếp, phân trang qua URL.
- Nút kệ trước / sau (`ShelfNav`, client leaf, từ `md`, chỉ khi kệ tràn, tôn trọng `prefers-reduced-motion`); áp dụng cho mọi kệ (cả "Cùng danh mục" ở trang sách).
- `scripts/covers.ts` (`--measure`, `--openlibrary --dry-run`, `--apply`) + Vitest. Open Library chạy **một lần**: 76 request, 18 nhận tự động, tự duyệt lưới → **12 bìa thay** (128px → 308–400px), 6 bỏ qua (khác thiết kế / không khớp tên). Chi tiết, điều khoản, bảng trước / sau: `data.md` → "Bìa từ Open Library"; lưới: `docs/plans/img/phase-8-covers-{1,2}.jpg`. Footer ghi nguồn Open Library.
- `toCoverWebp` trả kèm chiều rộng; admin upload bìa + import ghi `cover_width`.

**Chờ migration** (`supabase/migrations/20261016010000_cover_width.sql`)
- Trước migration: kệ không biết bìa nào nét → `sharpRows` coi lỗi `42703` (cột không tồn tại) là "chưa đo", kệ theo thứ tự thường (để `build` / e2e chạy được). **Sau migration: xóa nhánh `42703` trong `getHomeShelves`.**
- Admin upload bìa ghi `cover_width` → **lỗi trước migration** (e2e `admin-books` "bìa: JPEG lớn → WebP 600px…" fail đúng chỗ này; 2 test sau nó trong cùng file `serial` chạy riêng thì qua). Import cũng ghi cột này: chạy migration trước khi import tiếp.
- Sau migration: `npm run covers -- --measure` (đo 189 bìa), rồi chạy lại e2e.

**Quyết định tự chọn — duyệt cuối**
1. Chọn hết ★ (1–9). Mục 1 (Open Library): đã chạy theo yêu cầu đêm; điều khoản ghi ở `data.md`.
2. Tự duyệt bìa: chỉ nhận bìa **cùng thiết kế** với bìa hiện tại (chắc chắn đúng ấn bản), trừ And the Mountains Echoed (bìa cũ là ảnh hộp sản phẩm, bìa mới khớp tên + tác giả + NXB). Bìa khác thiết kế dù đúng tên → bỏ qua (có thể là ấn bản khác). Phương án khác: nhận mọi bìa đúng tên / tác giả (+5 bìa).
3. `--apply` chỉ đổi `cover_url` (chưa có cột `cover_width`), chiều rộng ghi sau bằng `--measure`.
4. Kệ Bán chạy **không** xếp bìa nét trước (plan mục 2 ghi "mỗi kệ"): xếp lại làm sai nghĩa "bán chạy". Phương án khác: bìa nét trước như các kệ khác.
5. Kệ "Sách ngoại văn" lọc theo **cây danh mục** `sach-ngoai-van` (khớp link "Xem tất cả"), không theo `language = 'en'`.
6. Link "Xem tất cả" của Bán chạy là `/sach` (mặc định đã là bán chạy; `toQuery` bỏ sort mặc định nên URL canonical không có `?sort=bestselling`). Nổi bật không có "Xem tất cả" (không có trang lọc nổi bật).
7. Nút kệ dùng cho mọi kệ, không riêng trang chủ (trang sách +0.5KB).
8. Trang Tất cả sách có lọc danh mục cha (như trang tìm kiếm), sort mặc định bán chạy (ngữ cảnh `browse`).
9. Đổi tên migration theo ngày thật (`20261016010000_cover_width.sql`).

**Kiểm tra**
- `typecheck`, `lint`, `build`: sạch. Vitest: 36 file / 319 test (mới: `covers`, `fillShelf`, `toCoverWebp` trả chiều rộng).
- `test:e2e` đầy đủ: **179 / 182 qua**; 1 fail **chờ migration** (admin upload bìa), 2 không chạy do `serial` → chạy riêng: qua. `home.spec.ts` mới (6 test × desktop / mobile) qua.
- `measure:js`: trang chủ = baseline + **39.1KB** (trước 38.5, +0.6KB nút kệ), trang sách (`sapiens`, `lam-ban-voi-bau-troi`) + **39.7KB** (trước 39.2). Trong ngân sách nút kệ ≤ 1.5KB.
- Soát giao diện bằng ảnh chụp (desktop 1280px, Pixel 7, dark): hero, kệ, nút kệ, lưới danh mục, footer.

**Giới hạn / rủi ro**: như mục cuối plan; thêm: kệ Nổi bật đang ẩn (chưa chọn sách nổi bật), Bán chạy đang ẩn (chưa có đơn thật).

**Việc của bạn**: chạy migration → sinh lại types → `npm run covers -- --measure`; chọn ~12 sách nổi bật trong admin; (tùy chọn) xem 6 bìa bỏ qua trong `data.md`.

---

Plan gốc (đã chọn hết ★):


Mục tiêu (CLAUDE.md → Design system): hero tối giản (trích dẫn bằng Lora + 1 CTA) → các kệ Nổi bật, Bán chạy, Mới về → lưới danh mục. Ảnh bìa là nguồn màu chính của giao diện, nên bìa mờ và kệ lệch về sách ngoại văn là hai vấn đề phải xử lý trước khi dựng kệ.

## Hiện trạng (đo 2026-10-15/16)

- Trang chủ tạm: trích dẫn, lưới 12 sách mới nhất (`getNewBooks`), lưới danh mục. Prerender được (mọi query qua `'use cache'` + client anon). JS: baseline + 38.5KB gzip.
- Catalog 189 sách: 72 tiếng Việt, 117 tiếng Anh. Lượt A + D import sau cùng nên **12 sách mới nhất đều là sách ngoại văn**: trang chủ hiện tại toàn sách tiếng Anh.
- Bìa < 300px: **76/189** (đều rộng 128px).

  | | Bìa ≥ 300px | Bìa 128px |
  |---|---:|---:|
  | Tiếng Việt (72) | 43 | 29 |
  | Tiếng Anh (117) | 70 | 47 |

  Thẻ sách trên kệ rộng 144–160px CSS → màn 2x cần ~320px, nên bìa 128px bị phóng to ~2.5 lần và trông nhòe.
- `sold_count` gần như toàn 0 (chưa có đơn thật), số sách `is_featured` chưa đo (admin chưa chọn): kệ Bán chạy / Nổi bật có thể rỗng.
- Kệ (`Shelf`) đã có từ Phase 3 (trang sách dùng cho "Sách liên quan"): server component, scroll-snap, 0 JS.

## Có cần migration không

**Có (nếu chọn ★ mục 2)**, một file `supabase/migrations/<ngày>_cover_width.sql` (+ `schema.sql`, sinh lại types):

```sql
alter table public.books
  add column cover_width smallint check (cover_width between 1 and 10000);
-- admin upload bìa ghi cột này bằng client theo phiên → thêm vào danh sách quyền cột của admin
revoke update on public.books from anon, authenticated;
grant  update (
  title, slug, subtitle, description, description_en, category_id, publisher_id, isbn,
  price, original_price, stock, cover_url, cover_width, page_count, format, language, published_year,
  weight_grams, dimensions, is_active, is_featured
) on public.books to authenticated;
```

`cover_width` = chiều rộng thật (px) của file WebP đang nằm ở `cover_url`; `null` = chưa đo / không có bìa. Ai ghi: script import, upload bìa ở admin, script bìa (bên dưới). Không phải cột do DB quản lý.

## Cần chọn

★ = đề xuất.

1. **Bìa mờ: lấy bìa lớn hơn từ Open Library**
   - ★ Script `scripts/covers.ts` theo đúng quy trình import (xem trước → duyệt → ghi):
     - `--measure`: đo `cover_width` cho mọi sách có `cover_url` trong bucket mà cột còn `null` (tải public URL của Storage, `sharp().metadata()`). Không gọi API ngoài. Chạy một lần sau migration.
     - `--openlibrary --dry-run`: chọn sách có `cover_width < 300`, có ISBN, và `cover_url` **đúng tên file của import** (`<isbn>.webp`). Bìa admin đã tự thay có tên `<book_id>-<8 hex>.webp` → không đụng tới. Mỗi sách một request `https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false` (404 = không có bìa). Nhận ảnh khi: định dạng ảnh hợp lệ, rộng ≥ 300px **và** ≥ 2 lần bìa hiện tại, tỉ lệ cao / rộng 1.2–1.8 (loại ảnh hỏng / không phải bìa). Ghi `scripts/out/covers-preview.json` + ảnh gốc vào `scripts/out/ol-covers/` + một ảnh lưới "bìa cũ | bìa mới" để duyệt bằng mắt (như lượt A + D phát hiện 5 bìa sai).
     - `--openlibrary --apply <file>`: chỉ dùng ảnh đã tải ở dry-run (mỗi ISBN đúng một request Open Library cho cả quy trình). `toCoverWebp` (600px, như import / admin) → upload `book-covers/ol-<isbn>-<8 hex>.webp` (tên mới: ảnh cũ đang bị CDN cache 1 năm) → `update books set cover_url, cover_width … where id = … and cover_url = <url cũ>` (admin vừa thay bìa trong lúc chạy thì 0 dòng, không đè) → xóa object cũ khi không `order_items` nào trỏ tới (cùng quy tắc với admin).
     - Tốc độ: Open Library giới hạn ảnh tra theo ISBN ở **100 request / IP / 5 phút**, vượt thì trả 403. Script giãn ≥ 3.5 giây / request (~85 / 5 phút), gặp 403 hoặc 429 thì dừng hẳn và ghi lại sách chưa chạy. 76 sách ≈ 4.5 phút. Gửi `User-Agent` nêu tên dự án + URL repo.
     - Ước lượng: sách tiếng Anh (47) nhiều khả năng có bìa trên Open Library; sách Việt (29) ít. Số thật báo sau dry-run.
   - Không lấy thêm bìa: chỉ dựa vào mục 2 để giấu bìa mờ khỏi trang chủ (trang danh mục / tìm kiếm vẫn mờ).
   - ✗ Hotlink thẳng Open Library: trái quy tắc "không hotlink" của CLAUDE.md, và `next/image` tải ảnh từ server → mọi lượt xem đi chung một IP, dễ chạm giới hạn 100 / 5 phút.

   **Điều khoản (ghi vào `data.md` khi chạy)**: trang tài liệu Covers API (openlibrary.org/dev/docs/api/covers) không nêu giấy phép riêng cho ảnh bìa; ghi rõ API dành cho **hiển thị** bìa trên website công khai, **không dành cho tải hàng loạt** (tải hàng loạt thì dùng bản dump trên archive.org), đề nghị không crawl, và "a courtesy link back to Open Library is appreciated". Bản quyền ảnh bìa thuộc nhà xuất bản (giống bìa từ Google Books hiện nay). Cách làm ★ là một lần duy nhất, ~76 request, có giãn cách, dự án phi thương mại; vẫn là tải về rồi lưu lại, nên **bạn quyết định** có chạy không. Nếu chạy: thêm link ghi nguồn Open Library vào footer (cạnh dòng ghi nguồn Google Books hiện có).

2. **Kệ trang chủ ưu tiên bìa nét**
   - ★ Migration `cover_width` (ở trên). Mỗi kệ query `cover_width >= 300` trước; thiếu sách thì lấy thêm sách bìa mờ cho đủ (query thứ hai, loại id đã có), để kệ không ngắn đi khi dữ liệu ít. Import và upload bìa ở admin ghi `cover_width` từ đây về sau (`toCoverWebp` trả kèm chiều rộng).
   - Cột boolean `cover_is_sharp`: cũng cần migration, nhưng ngưỡng "nét" bị đóng cứng vào dữ liệu; đổi ngưỡng phải tính lại.
   - Không migration: kệ không biết bìa nào mờ → chỉ còn cách xử lý ở mục 1.

3. **Cân đối sách Việt / ngoại văn**
   - ★ Kệ theo ngôn ngữ: Nổi bật (admin chọn, không lọc ngôn ngữ), Bán chạy (không lọc), **Mới về chỉ sách tiếng Việt**, rồi **một** kệ "Sách ngoại văn" riêng (link "Xem tất cả" → `/danh-muc/sach-ngoai-van`) đặt sau ba kệ trên. Sách tiếng Anh chỉ chiếm tối đa một kệ trong bốn ở màn đầu; trang tiếng Anh dùng cùng bố cục (giá, danh mục vẫn theo nhà sách Việt).
   - Trộn trong từng kệ theo tỉ lệ (VD 2 Việt : 1 Anh): mỗi kệ hai query rồi xen kẽ ở server; thứ tự "mới nhất" / "bán chạy" bị bẻ theo tỉ lệ.
   - Theo locale (`/en` ưu tiên sách tiếng Anh): người dùng giao diện tiếng Anh ở Việt Nam chưa chắc muốn sách tiếng Anh; bố cục hai bản khác nhau, khó kiểm tra.

4. **Kệ Bán chạy khi chưa có dữ liệu bán**
   - ★ Chỉ hiện khi có ≥ 6 sách `sold_count > 0`; ẩn cả tiêu đề, không để kệ rỗng.
   - Luôn hiện, sắp theo `sold_count` rồi `created_at`: hiện tại thành bản sao của "Mới về".
   - ✗ Sinh `sold_count` giả: trái nguyên tắc dữ liệu thật, và lệch với số đơn ở admin.

5. **Kệ Nổi bật**
   - ★ Sách `is_featured` (admin chọn; đổi `is_featured` đã làm mới tag `books` từ 7a), bìa nét trước. Ẩn khi < 4 sách. Việc của bạn: chọn ~12 sách trong admin.
   - Tự lấy sách bìa nét có giảm giá cao nhất khi admin chưa chọn: không rỗng, nhưng "nổi bật" thành "giảm giá".

6. **CTA của hero và link "Xem tất cả"**
   - ★ Trang mới **Tất cả sách** `/sach` (`/en/books`), dùng lại `CatalogView` (lọc giá / ngôn ngữ / còn hàng, sắp xếp, phân trang qua URL). CTA hero "Xem tất cả sách" → `/sach`; "Xem tất cả" của Mới về → `/sach?lang=vi&sort=newest`, Bán chạy → `/sach?sort=bestselling`. Cần thêm `'/books': { vi: '/sach', en: '/books' }` vào `pathnames`, sitemap thêm trang này (Phase 10).
   - Không trang mới: CTA trỏ về một danh mục gốc, các kệ không có "Xem tất cả" (trừ Sách ngoại văn).

7. **Điều hướng kệ trên desktop**
   - ★ Nút trước / sau (client leaf nhỏ, không thư viện, chỉ hiện từ `md` và khi còn chỗ để cuộn; `prefers-reduced-motion` thì cuộn không animation). Chuột không cuộn ngang được nếu không có nút. Ngân sách: ≤ 1.5KB gzip, đo bằng `measure:js`.
   - Không nút: 0 JS thêm; desktop cuộn bằng trackpad / Shift + lăn chuột / thanh cuộn.

8. **Hero**
   - ★ Chỉ chữ: trích dẫn (Lora, có sẵn) + 1 CTA. LCP là chữ, không phải tải ảnh trước.
   - Kèm 3 bìa nổi bật xếp chồng: đẹp hơn nhưng LCP thành ảnh (phải `preload`), và phụ thuộc admin đã chọn sách nổi bật bìa nét.

9. **Làm mới cache sau khi script đổi bìa**
   - ★ Script chạy ngoài Next nên không gọi được `updateTag`. Dự án chưa deploy (Phase 10): lần build kế tiếp prerender lại với bìa mới; `next start` local thì cache `hours` tự hết hoặc khởi động lại. Ghi bước "chạy script trước khi build / deploy" vào `data.md`.
   - Route handler `POST /api/revalidate` có secret (env mới) để script gọi `updateTag` cho từng `book:{id}`: cần thêm biến môi trường và một endpoint phải bảo vệ; để dành khi đã deploy và phải thay bìa thường xuyên.

## Thiết kế trang chủ (theo ★)

```
Hero          trích dẫn (Lora) + CTA "Xem tất cả sách"
Nổi bật       is_featured, bìa nét trước        (ẩn khi < 4)
Bán chạy      sold_count > 0                     (ẩn khi < 6)
Mới về        sách tiếng Việt, mới nhất          → /sach?lang=vi&sort=newest
Sách ngoại văn  tiếng Anh, mới nhất              → /danh-muc/sach-ngoai-van
Danh mục      lưới danh mục gốc + con (có sẵn, chỉnh khoảng cách theo token)
```

- Mỗi kệ 12 sách, khoảng cách section 64–96px desktop / 40–56px mobile (CLAUDE.md).
- Query mới trong `features/books/queries.ts`: `getHomeShelves()` (một hàm `'use cache'`, `cacheTag('books')` + `book:{id}` từng sách, `cacheLife('hours')`), chạy các query kệ song song bằng `Promise.all`. Kiểu dùng chung `BookCard`.
- Trang chủ vẫn prerender (không đọc cookies / searchParams; phần theo phiên chỉ ở header như hiện tại). Ảnh kệ `sizes="160px"`, lazy (LCP là chữ hero).
- Kệ rỗng / ít sách: ẩn theo ngưỡng ở mục 4, 5; Mới về / Sách ngoại văn rỗng thì hiện câu trống có sẵn (`newArrivalsEmpty`).
- Chuỗi mới trong `messages/{vi,en}.json` → `home` (tên kệ, CTA, nhãn nút kệ). Tên kệ "Sách ngoại văn" lấy từ tên danh mục (`localize`).

## File sẽ tạo / sửa

- `supabase/migrations/<ngày>_cover_width.sql`, `supabase/schema.sql`, `src/types/database.ts`
- `scripts/covers.ts` (+ Vitest cho hàm thuần: chọn sách cần thay, nhận dạng tên file của import, điều kiện nhận ảnh), `package.json` (`covers` script)
- `scripts/import-books.ts`, `src/lib/cover-image.ts`, `src/features/admin/books/actions.ts`: ghi `cover_width`
- `src/features/books/queries.ts` (`getHomeShelves`, `getNewBooks` bỏ), `src/features/books/components/shelf.tsx` (+ client leaf nút kệ)
- `src/app/[locale]/(shop)/page.tsx`, `src/app/[locale]/(shop)/books/page.tsx` (Tất cả sách), `src/i18n/routing.ts`, `src/features/books/catalog-params.ts` (context `all`)
- `messages/vi.json`, `messages/en.json`; footer (ghi nguồn Open Library, nếu chạy mục 1)
- `e2e/home.spec.ts` (mới), `docs/plans/data.md`, `CLAUDE.md`

## Test

- Vitest: điều kiện chọn sách / nhận ảnh của `scripts/covers.ts`; ghép kệ (bìa nét trước, lấp đủ, không trùng id); ngưỡng ẩn kệ.
- e2e (`desktop`, `mobile`, không cần service key): thứ tự kệ, kệ "Mới về" toàn sách tiếng Việt, "Sách ngoại văn" là kệ duy nhất có sách tiếng Anh ngoài Nổi bật / Bán chạy, CTA → `/sach`, "Xem tất cả" đúng URL, không tràn ngang, nút kệ cuộn được (desktop), `/en` cùng bố cục. Trang `/sach`: lọc ngôn ngữ, sắp xếp, phân trang.
- `measure:js` trang chủ + trang sách; build xác nhận `/` vẫn prerender (◐/○).

## Việc của chủ dự án

1. Duyệt plan, chọn ở "Cần chọn" (mục 1 có câu hỏi điều khoản Open Library).
2. Chạy migration `cover_width` (tôi viết, bạn kiểm tra như 7a), rồi tôi sinh lại types.
3. Nếu chọn mục 1: duyệt ảnh lưới "bìa cũ | bìa mới" của dry-run trước khi `--apply`.
4. Chọn ~12 sách nổi bật trong admin (bìa nét).

## Giới hạn / rủi ro đã biết

- Kệ Bán chạy dùng tag `book:{id}` của sách đang có trên kệ: một sách khác vừa bán chạy lên chỉ vào kệ khi cache `hours` hết hạn.
- Open Library có thể không có bìa cho phần lớn sách Việt → trang danh mục sách Việt vẫn còn bìa 128px; thay tay trong admin nếu cần.
- Ngưỡng 300px chọn theo thẻ kệ 160px ở màn 2x; bìa lớn ở trang sách (sticky, rộng hơn) vẫn thấy mờ với ảnh 300–575px.

## Tiến độ

- [x] Migration `cover_width` + `schema.sql` + types (sửa tay); import / admin upload ghi `cover_width` (**chờ migration**)
- [ ] `scripts/covers.ts --measure` (đo 189 bìa): **chủ dự án chạy sau migration**
- [x] Open Library: dry-run → tự duyệt → apply 12 bìa; ghi nguồn + điều khoản vào `data.md`, footer
- [x] `getHomeShelves`, kệ + nút kệ, hero, trang Tất cả sách
- [x] e2e `home.spec.ts`; typecheck / lint / build / test sạch; e2e 179/182 (1 chờ migration); `measure:js`; báo cáo
