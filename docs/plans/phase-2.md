# Phase 2: Layout

Trạng thái: plan đã duyệt, chưa code.

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
