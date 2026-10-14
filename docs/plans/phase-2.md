# Phase 2: Layout

Trạng thái: đã xong (2026-10-15).

## Quyết định đã duyệt

- **Command palette**: `cmdk` qua shadcn `command` (dependency mới, tải bằng `next/dynamic` khi mở lần đầu).
- **Tìm kiếm cho palette**: Route Handler `GET /api/search?q=`
  - Validate `q` bằng zod: trim, 2–100 ký tự; sai → `400` + `{ code: 'INVALID_INPUT' }` (mã có bản dịch ở `errors`).
  - Dùng `lib/supabase/public.ts` (anon, không cookies), gọi RPC `search_books`, tối đa 8 kết quả (`.range(0, 7)`), chỉ select cột cần.
  - `Cache-Control: public, s-maxage=…, stale-while-revalidate=…` để CDN cache theo `q`. Kết quả không phụ thuộc locale (tên sách, tác giả không dịch).
- **LocaleSwitcher**: một nút chuyển sang ngôn ngữ còn lại, giữ pathname + params + searchParams (bọc `<Suspense>` vì `useSearchParams`). Lưu `profiles.locale` để Phase 4.
- **e2e tìm kiếm**: không phụ thuộc một cuốn cụ thể. Assert ≥ 1 kết quả với từ khóa chắc chắn có trong catalog, và test trường hợp không có kết quả (trạng thái rỗng có thiết kế riêng).

## File

- `components/layout/header.tsx` (Server): sticky, cao 64px, `bg-background/80` + `backdrop-blur`, viền dưới. Logo (wordmark Lora + icon tự vẽ), nút mở tìm kiếm (icon trên mobile), LocaleSwitcher, ThemeToggle, link giỏ hàng (badge ở Phase 5), link tài khoản.
- `components/layout/footer.tsx` (Server): danh mục cha từ `getCategories()`, dòng "Dự án học tập, phi thương mại", bản quyền.
- `components/layout/locale-switcher.tsx` (client, leaf).
- `components/layout/theme-toggle.tsx` (client): ẩn/hiện icon bằng CSS `dark:`, không cần `mounted` → không lệch hydration.
- `features/books/components/search-palette.tsx` (client): ⌘K / Ctrl+K, debounce 250ms, kết quả gồm bìa nhỏ + tên + tác giả, Enter vào "Xem tất cả" → `/tim-kiem?q=` (trang ở Phase 3).
- `app/api/search/route.ts`.
- `app/[locale]/layout.tsx`: Header + `<main id="main">` + Footer; các page bỏ `<main>` riêng.
- `app/icon.svg`.
- `messages/*.json`: namespace `layout`, `search`.

## Test e2e

- Header sticky.
- Đổi theme → class trên `<html>` đổi.
- Đổi ngôn ngữ giữ query (`/?x=1` → `/en?x=1`).
- ⌘K mở palette; từ khóa chắc chắn có → ≥ 1 kết quả; từ khóa vô nghĩa → trạng thái rỗng; điều hướng bằng phím; Esc đóng.
- Không lỗi console.

## Tiến độ

- [x] messages: namespace `layout`, `search`
- [x] /api/search (route handler + zod + cache header) — `searchBookHits` có thêm `use cache` (tag `books`) ngoài header CDN; response dạng `{ ok, data | code }`
- [x] ThemeToggle — icon + nhãn sr-only ẩn/hiện bằng `dark:`
- [x] LocaleSwitcher — `<a>` thường + `getPathname` của `i18n/navigation`, không dùng `Link`: `Link` có prop `locale` luôn ép prefix nên en→vi ra `/vi?x=1` và client nav giữ nguyên URL không canonical đó. Đổi ngôn ngữ giờ là tải lại cả trang. Nhãn "EN – Xem bằng tiếng Anh". Lưu `profiles.locale` để Phase 4.
- [x] Header (logo, icon.svg) — màn < 375px ẩn chữ logo (sr-only) để 5 nút vừa 320px; giỏ/tài khoản trỏ tới trang chưa có (Phase 5/6) → 404 tạm
- [x] Search palette (cmdk, ⌘K) — tách `search-trigger.tsx` (nút + phím tắt, nhẹ) và `search-palette.tsx` (`next/dynamic`, tải trước khi hover/focus). "Xem tất cả" là mục đầu → gõ rồi Enter là sang `/tim-kiem?q=`. Ảnh bìa trong palette `alt=""` (tên sách ngay cạnh). shadcn `command`: bỏ `input-group`/`input`/`textarea`, title sr-only đưa vào trong `DialogContent`, overlay dùng `bg-background/70`
- [x] Footer — không in năm (Date ở Server Component phá prerender khi bật cacheComponents)
- [x] Layout (`<main id="main">`, bỏ `<main>` ở page)
- [x] e2e — `e2e/layout.spec.ts`; từ khóa "chắc chắn có" là `978` (mọi sách đều có ISBN-13). `smoke.spec.ts`: tìm "Văn học"/"Literature" giới hạn trong `<main>` + `.first()` (footer có link trùng tên; nhánh "Sách ngoại văn" cũng có danh mục con trùng tên)
- [x] typecheck / lint / build / test (29) / e2e (26, desktop + mobile) sạch. JS ban đầu trang chủ ≈ 174KB gzip (cả framework), cmdk không nằm trong đó; chunk palette tải lười ≈ 48KB gzip
