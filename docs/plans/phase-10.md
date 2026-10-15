# Phase 10: SEO, ISR fallback, 404 thật, e2e mua hàng, Lighthouse, chuẩn bị deploy

Trạng thái: **plan tự duyệt trong đêm 2026-10-16** (chủ dự án vắng, xem `night.md`). Chọn hết ★; lựa chọn ngoài Lộ trình ở "Quyết định tự chọn — duyệt cuối". **Không tự deploy, không tạo tài khoản**: phần deploy là cấu hình + hướng dẫn trong `owner-todo.md`.

Phạm vi (Lộ trình CLAUDE.md): sitemap, hreflang, OG image, JSON-LD; ISR fallback đúng cho slug tạo sau build (bỏ `instant = false`); 404 thật cho slug không tồn tại; e2e luồng mua hàng; tách dữ liệu e2e khỏi sách thật; đo Lighthouse; chuẩn bị deploy.

**Không** có: captcha (Supabase rate limit đủ cho dự án học tập; owner-todo ghi cách bật Turnstile nếu cần), CSP (Next cần nonce → mọi trang thành dynamic, mất prerender), analytics.

## Hiện trạng

- hreflang + canonical: có từ Phase 3 (`i18n/alternates.ts`). Chưa có `sitemap.xml`, `robots.txt`, `metadataBase`, ảnh OG, JSON-LD.
- Trang sách / danh mục / tác giả: `instant = false` (7a) vì App Shell cho slug chưa biết trả 500.
- Slug không tồn tại / `page` vượt quá: UI 404 + `noindex` nhưng HTTP 200 (Cache Components stream trước khi `notFound()` chạy).
- e2e: 170 test, `checkout.spec` / `orders.spec` đặt hàng trên sách thật (chọn theo tồn kho), có thể trùng sách khi chạy song song trên CI.

## Có cần migration không

**Không** dự kiến. Sitemap / 404 chỉ đọc cột public (`slug`, `updated_at`, `is_active` qua RLS). Sách e2e tạo bằng service role như admin e2e.

## Cần chọn (★ = đã chọn)

1. **Sitemap / robots**
   - ★ `app/sitemap.ts`: trang chủ, `/sach`, danh mục, sách, tác giả; mỗi URL kèm `alternates.languages` (vi / en), `lastModified` = `updated_at` (sách). `app/robots.ts`: chặn `/admin`, `/api`, giỏ / thanh toán / tài khoản / đăng nhập (cả hai locale); trỏ sitemap. URL gốc từ `siteUrl()` (Phase 9). `metadataBase` ở layout gốc.
   - Sitemap chia nhiều file (`generateSitemaps`): < 1.000 URL, chưa cần.
2. **Ảnh OG**
   - ★ Trang sách: `openGraph.images` = ảnh bìa đã có trong Storage (600px, không sinh ảnh mới). Trang khác: `opengraph-image.tsx` ở `[locale]` (ImageResponse của `next/og`, có sẵn trong Next): tên cửa hàng + câu trích dẫn, font Lora có dấu tiếng Việt commit vào repo (`src/assets/fonts`, OFL, kèm giấy phép) vì font mặc định của `next/og` thiếu dấu.
   - Sinh ảnh OG riêng cho từng sách (bìa + tên): thêm thời gian build × 189 sách × 2 locale, lợi ích nhỏ.
3. **JSON-LD**
   - ★ Trang sách: `Book` (+ `offers` VND, `availability`, `isbn`, `author`, `aggregateRating` khi có đánh giá) và `BreadcrumbList`; trang chủ: `WebSite` + `SearchAction` (`/tim-kiem?q=`). Chuỗi JSON escape `<` (chống chèn `</script>` từ mô tả sách).
4. **ISR fallback (bỏ `instant = false`)**
   - ★ Đọc `params` trong `<Suspense>` ở 3 trang, header không chặn App Shell (phần đọc `useParams` của `LocaleSwitcher` nằm trong Suspense). Kiểm tra bằng build + e2e: tạo sách / danh mục / tác giả slug `e2e-…` sau build → 200 + nội dung đúng; slug đã prerender vẫn ○ / ◐. Nếu Next vẫn trả 500 sau 3 lần sửa → giữ `instant = false`, ghi "Bị chặn".
5. **404 thật**
   - ★ `proxy.ts` kiểm tra slug của `/sach/*`, `/danh-muc/*`, `/tac-gia/*` (cả `/en/...`) với danh sách slug lấy bằng client anon, cache trong bộ nhớ của proxy 60 giây (một request / phút / instance, không phải mỗi request). Không có → rewrite sang trang not-found với status 404. Lỗi mạng khi tải danh sách → cho qua (giữ hành vi cũ, không chặn trang thật). `?page=` vượt quá: giữ soft 404 + `noindex` (biết số trang cần đếm theo bộ lọc).
   - Query DB mỗi request trong proxy: chậm mọi trang sách.
6. **Dữ liệu e2e tách khỏi sách thật**
   - ★ Setup tạo 6 sách `e2e-shop-<project>-…` (tồn kho 50, giá cố định, danh mục test ẩn khỏi menu như admin e2e, `created_at` lùi về 2000 để không lên kệ "Mới về") cho mỗi project; `checkout.spec`, `orders.spec`, `cart-account.spec` đặt hàng trên sách của project mình. Teardown xóa đơn + sách. Sách thật không còn bị đổi tồn kho bởi e2e.
7. **e2e luồng mua hàng**
   - ★ `purchase.spec.ts` một luồng liền: khách vãng lai thêm sách vào giỏ → đăng nhập → giỏ gộp → checkout có voucher → chuyển khoản (thẻ VietQR) → danh sách đơn → chi tiết → hủy (đơn chưa trả). Một biến thể COD ngắn trên mobile.
8. **Lighthouse**
   - ★ Chạy `npx lighthouse` (không thêm vào `package.json`) trên `next start` local, preset mobile (Moto G Power, 4G chậm), trang chủ + trang sách + danh mục; ghi LCP / CLS / TBT vào báo cáo. Không chạy được (thiếu Chrome / mạng) → ghi "Bị chặn", đo LCP / CLS bằng `PerformanceObserver` trong Playwright.
9. **Chuẩn bị deploy**
   - ★ Vercel (theo stack): không cần `vercel.json`; `next.config.ts` thêm header bảo mật (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, HSTS); `.env.example` đủ biến; GitHub Actions `ci.yml` (typecheck, lint, Vitest, build; e2e chạy khi có secret); hướng dẫn từng bước (Vercel import repo, env, domain, Supabase URL Configuration, template email, Resend) trong `owner-todo.md`.

## File sẽ tạo / sửa

- `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/[locale]/opengraph-image.tsx`, `src/assets/fonts/*`, `src/app/[locale]/layout.tsx` (`metadataBase`)
- `src/lib/json-ld.ts` (+ test), trang sách, trang chủ
- 3 trang slug + header / `LocaleSwitcher` (ISR fallback)
- `src/proxy.ts` + `src/lib/slug-guard.ts` (+ test)
- `scripts/e2e-user.ts` (sách e2e), `e2e/*.spec.ts`, `e2e/purchase.spec.ts`
- `next.config.ts`, `.github/workflows/ci.yml`, `.env.example`, `docs/plans/owner-todo.md`

## Test

- Vitest: JSON-LD (escape, giá, availability), danh sách URL sitemap (đủ hai locale, không có trang riêng tư), slug guard (khớp đường dẫn hai locale, cache hết hạn, lỗi mạng cho qua).
- e2e: `/sitemap.xml`, `/robots.txt` hợp lệ; JSON-LD trên trang sách parse được; slug không tồn tại → **status 404** + UI 404; slug tạo sau build → 200; luồng mua hàng.
- `measure:js` trang chủ + trang sách không tăng (JSON-LD là thẻ `<script type="application/ld+json">`, không phải JS chạy).

## Việc của chủ dự án

Xem `owner-todo.md` → "Deploy".

## Quyết định tự chọn — duyệt cuối

(Bổ sung trong lúc làm; xem cuối file.)

## Tiến độ

- [ ] Sitemap, robots, `metadataBase`, OG, JSON-LD
- [ ] 404 thật trong proxy
- [ ] ISR fallback (bỏ `instant = false`)
- [ ] Sách e2e riêng + e2e luồng mua hàng
- [ ] Header bảo mật, CI, `.env.example`, hướng dẫn deploy
- [ ] Lighthouse
- [ ] typecheck / lint / build / test / e2e; `measure:js`; báo cáo
