# Phase 3: Catalog

Trạng thái: **chờ duyệt**. Các mục "Cần chọn" ở cuối có đề xuất (★); duyệt nguyên plan = chọn hết các ★.

Phạm vi: trang danh mục, trang sách, trang tác giả, trang tìm kiếm, filter/sort/phân trang qua URL. Không có giỏ hàng (Phase 5), đánh giá (Phase 9), sitemap/OG/JSON-LD (Phase 10).

## Route

| Internal (`app/[locale]/(shop)/…`) | vi | en |
|---|---|---|
| `categories/[slug]/page.tsx` | `/danh-muc/[slug]` | `/en/categories/[slug]` |
| `books/[slug]/page.tsx` | `/sach/[slug]` | `/en/books/[slug]` |
| `authors/[slug]/page.tsx` | `/tac-gia/[slug]` | `/en/authors/[slug]` |
| `search/page.tsx` | `/tim-kiem` | `/en/search` |

Trang chủ hiện tại chuyển vào `(shop)/page.tsx` cho đúng cấu trúc CLAUDE.md (không đổi URL). `[...rest]` và `not-found.tsx` giữ ở `[locale]`.

## Rendering & cache

- Mỗi trang có **static shell** (tiêu đề, breadcrumb, mô tả danh mục) prerender được; phần đọc `searchParams` (lưới sách + filter đang chọn) nằm trong `<Suspense>` với skeleton đúng kích thước lưới → không CLS.
- `generateStaticParams` trả **toàn bộ** slug sách / danh mục / tác giả (catalog nhỏ, vài trăm trang × 2 locale). Slug mới sau build (admin thêm sách) render lần đầu rồi cache.
- Query trong `features/books/queries.ts` (+ `features/books/catalog-params.ts` cho phần parse URL), tất cả `'use cache'` + `createPublicClient()`:
  - `getBookBySlug(slug)` — `React.cache` bọc ngoài để `generateMetadata` và page dùng chung; tag `books`, `book:{id}`.
  - `listBooks({ categoryIds?, authorId?, q?, filters, sort, page })` — một hàm cho cả danh mục / tác giả / tìm kiếm; trả `{ books: BookCard[], total }`; tag `books`.
  - `getCategoryBySlug`, `getAuthorBySlug` — tag `categories` / `authors`.
  - `getRelatedBooks(bookId, categoryId)` — cùng danh mục, 12 cuốn, trong `<Suspense>`.
- Quan hệ lấy trong một query (`book_authors(role, authors(name, slug))`, `publishers(name, slug)`), không N+1.
- Phân trang: `.range()` + `count: 'estimated'` cho bảng `books`, `count: 'exact'` cho RPC `search_books` (theo CLAUDE.md).

## URL searchParams

Một schema zod `catalogParamsSchema` (`features/books/schemas.ts`) parse searchParams **ở server**, giá trị sai → bỏ qua về mặc định (không 400, không throw). Client chỉ đọc URL và tạo link mới, không giữ filter trong `useState`.

| Param | Giá trị | Mặc định |
|---|---|---|
| `sort` | `bestselling` · `newest` · `price-asc` · `price-desc` (+ `relevance` chỉ ở tìm kiếm) | danh mục/tác giả: `bestselling`; tìm kiếm: `relevance` |
| `page` | số nguyên ≥ 1 | 1 |
| `price` | xem quyết định 3 | — |
| `lang` | `vi` · `en` | — |
| `cat` | slug danh mục con (chỉ ở trang danh mục cha, trang tìm kiếm) | — |
| `stock` | `1` = chỉ còn hàng | — |
| `q` | chuỗi tìm kiếm (chỉ `/tim-kiem`), cùng `searchQuerySchema` với palette | — |

- Đổi filter/sort → reset `page`. Link phân trang và filter là `<Link>` thật (chạy không cần JS, crawl được), dùng `router.push` chỉ ở `<select>` sort.
- Trang > tổng số trang → `notFound()`.
- `relevance` = thứ tự trả về của `search_books` (bán chạy → mới), chưa phải điểm liên quan thật; ghi chú lại để Phase sau nâng cấp nếu cần.

## Component

`features/books/components/`:
- `book-card.tsx` (Server): bìa 2:3 radius 4px, tên 2 dòng, tác giả `muted-foreground`, giá `primary`, giá gốc gạch `subtle`, nhãn `-X%` màu `sale`, hết hàng → bìa mờ + nhãn. Cả card là một link; bìa `alt=""` theo ngoại lệ trong CLAUDE.md. Hover nâng 2px + `shadow-glow` (dark).
- `book-grid.tsx` + `book-grid-skeleton.tsx`: 2 / 3 (sm) / 4 (md) / 5–6 (lg+) cột.
- `catalog-toolbar.tsx`: tổng số kết quả, sort (client leaf nhỏ), filter (xem quyết định 4).
- `pagination.tsx` (Server): Trước / số trang rút gọn / Sau, `aria-current="page"`.
- `empty-state.tsx`: dùng chung cho danh mục rỗng, tìm kiếm không có kết quả, filter quá chặt (kèm link "Xóa bộ lọc").
- `book-gallery` trang sách: chỉ bìa chính trong phase này (`book_images` gần như rỗng); zoom để Phase 7+ bằng `next/dynamic`.
- `breadcrumb.tsx` (Server, `<nav aria-label>` + `<ol>`).

## Trang sách

- Trái: bìa lớn (sticky từ `md`), `preload` vì là LCP, `alt` = tên sách (ảnh đứng một mình).
- Phải: tên (Lora), phụ đề, tác giả + dịch giả (link trang tác giả), giá / giá gốc / -X%, tình trạng kho, bảng thông tin (ISBN, NXB, năm, số trang, khổ, ngôn ngữ, kích thước, trọng lượng; field null thì ẩn dòng), mô tả `localize(book, 'description')` chia đoạn theo `\n\n`, tối đa 68ch.
- Mô tả dài: `<details>` "Đọc thêm" (không cần JS) — xem quyết định 6.
- Dưới: kệ "Cùng danh mục" (Shelf cuộn ngang, scroll-snap) trong `<Suspense>`. Shelf này là bản đầu của component trang chủ Phase 8.
- `generateMetadata`: title = tên sách, description = 160 ký tự đầu của mô tả, `alternates.languages` (hreflang) qua `getPathname`.

## Trang danh mục / tác giả / tìm kiếm

- Danh mục cha: chip danh mục con (link `?cat=`), lưới gồm sách của mọi danh mục con (`category_id in (...)`). Danh mục lá: breadcrumb về cha.
- Tác giả: tên, ảnh (nếu có), `localize(author, 'bio')` (đa số rỗng → ẩn), lưới sách có sort + phân trang (không filter).
- Tìm kiếm: ô tìm kiếm là `<form method="get">` (chạy không cần JS), lưới + filter `cat`/`price`/`lang`/`stock`. `q` rỗng → trạng thái gợi ý. `generateMetadata` có `robots: noindex` cho trang tìm kiếm.
- Mọi trang: `generateMetadata` theo locale + `alternates.languages`.

## Messages

Namespace mới: `catalog` (sort, filter, pagination, empty, kết quả), `book` (thông tin chi tiết, tình trạng kho, định dạng `paperback`/`hardcover`/`boxset`, ngôn ngữ), `author`. Cùng bộ key vi/en.

## Test

- Vitest: `catalogParamsSchema` (giá trị lạ → mặc định, đổi filter reset page), hàm tính `-X%`, hàm rút gọn dãy số trang.
- e2e (`e2e/catalog.spec.ts`), không phụ thuộc một cuốn cụ thể (lấy sách đầu tiên từ lưới rồi đi tiếp):
  - Danh mục cha → có sách; chọn danh mục con → URL có `?cat=`, số kết quả đổi; Back → về trạng thái cũ.
  - Sort `price-asc` → giá tăng dần trên trang.
  - Trang 2 tồn tại khi tổng > page size; `?page=999` → 404.
  - Card → trang sách: `h1` đúng tên, có giá, link tác giả → trang tác giả có cuốn đó.
  - Đổi ngôn ngữ trên trang sách → `/en/books/<cùng slug>`, mô tả fallback tiếng Việt khi chưa có `description_en`.
  - `/tim-kiem?q=978` có kết quả; từ khóa vô nghĩa → empty state; palette "Xem tất cả" dẫn tới đây.
  - Không lỗi console, không CLS lớn khi lưới stream vào (so kích thước skeleton với lưới thật).
- Sửa `smoke.spec.ts` "bìa sách tải từ Storage": bìa trong card sẽ `alt=""` nên đổi `getByRole('img')` → `locator('img')`.
- `npm run measure:js -- vi/books/<slug>` ghi kết quả vào checklist.

## Tiến độ

(Thêm khi bắt đầu code.)

---

## Cần chọn

1. **Giảm JS dùng chung trước khi làm trang sách?** Trang chủ đã là baseline + 42.4KB, gần chạm ngân sách 50KB của trang sách, nên phần lớn đã nằm ở layout. Hai nguồn chính: `intl-messageformat` (~16KB, do client component gọi `useTranslations`) và lucide + radix + cva + cn (~15KB).
   - ★ **A.** Làm đầu Phase 3: client leaf (ThemeToggle, LocaleSwitcher, SearchTrigger) nhận chuỗi đã dịch qua props từ Server Component; palette (tải lười) giữ `useTranslations`. Đo lại, ghi số trước/sau. Nếu provider vẫn kéo `intl-messageformat` vào bundle ban đầu thì chỉ bọc `NextIntlClientProvider` quanh palette.
   - B. Để sau, làm trang sách trước rồi tối ưu nếu vượt ngân sách.
2. **Phân trang**: ★ số trang (`?page=n`, SSR, chia sẻ được, SEO tốt) · "Xem thêm" (cần client state, khó back/forward) · cuộn vô hạn. Page size ★ **24** (chia hết cho 2/3/4/6 cột).
3. **Lọc giá**: ★ khoảng định sẵn (`<100k`, `100–200k`, `200–300k`, `>300k`; `price=100-200`) · ô nhập min/max tự do (cần validate, ít dùng trên mobile).
4. **UI filter**:
   - ★ Desktop: hàng toolbar trên lưới (dropdown sort + các nhóm filter dạng nút/chip), không sidebar để giữ tinh thần tối giản. Mobile: nút "Bộ lọc" mở `Sheet` (shadcn, thêm `sheet.tsx`, dùng Radix Dialog đã có, không thêm dependency).
   - Sidebar trái cố định trên desktop (kiểu Fahasa/Tiki).
5. **Bộ filter** (chọn nhiều): ★ `cat` (danh mục con) · ★ `price` · ★ `lang` · ★ `stock` · NXB (danh sách NXB không thống nhất tên, nhiều NXB chỉ có 1 cuốn → đề xuất bỏ) · định dạng bìa (gần như toàn `paperback` → đề xuất bỏ) · điểm đánh giá (chưa có review → Phase 9).
6. **Mô tả dài ở trang sách**: ★ `<details>` "Đọc thêm" (0 JS, hiện ~6 dòng đầu ở `summary`) · client leaf clamp/expand (mượt hơn, thêm JS) · hiện toàn bộ.
7. **CTA "Thêm vào giỏ" ở Phase 3**: ★ chưa render, chừa chỗ trong layout (khối giá có khoảng trống cố định để Phase 5 không gây CLS) · render nút disabled "Sắp có" (code tạm phải xóa sau).
8. **Kệ "Cùng danh mục" ở trang sách**: ★ làm luôn (Suspense, Shelf dùng lại ở Phase 8) · để Phase 8.
9. **JSON-LD `Book`/`Product`**: ★ Phase 10 cùng SEO · làm luôn ở trang sách (vài dòng, không tốn JS).
10. **Tên danh mục ngoại văn ở `/en`**: sau khi đổi `name = name_en`, ở `/en` sẽ có hai mục tên **"Business"** (cha "Kinh tế" có `name_en = 'Business'` và con "Business" của Sách ngoại văn). ★ Đổi con thành **"Business & Economics"** (tên nhóm BISAC quen thuộc) · đổi `name_en` của "Kinh tế" thành "Economics & Business" · giữ nguyên.
