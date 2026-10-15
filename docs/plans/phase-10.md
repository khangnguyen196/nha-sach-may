# Phase 10: SEO, ISR fallback, 404 thật, e2e mua hàng, Lighthouse, chuẩn bị deploy

Trạng thái: **xong trên nhánh `phase-10`, chờ migration (của Phase 8, 9) + duyệt** (đêm 2026-10-16, plan tự duyệt, chọn hết ★). **Không tự deploy, không tạo tài khoản**: phần deploy là cấu hình + hướng dẫn trong `owner-todo.md` (mục 6).

## Báo cáo (2026-10-16)

**Đã xong**
- SEO: `/sitemap.xml` (trang chủ, Tất cả sách, danh mục, sách, tác giả; hreflang vi / en; bỏ cây danh mục ẩn), `/robots.txt`, `metadataBase`, `og:*` mặc định + ảnh OG 1200×630 (logo + tên + câu giới thiệu song ngữ), trang sách `og:type=book` + bìa làm `og:image`, JSON-LD `Book`/`Product` + `Offer` (VND, còn / hết hàng) + `AggregateRating` (khi có) + `BreadcrumbList`, trang chủ `WebSite` + `SearchAction`.
- 404 thật: slug sách / danh mục / tác giả không tồn tại (hoặc đang ẩn) → **HTTP 404** + trang 404 đúng ngôn ngữ (proxy). Kiểm bằng curl + e2e: `/sach/khong-ton-tai…`, `/en/books/…`, `/danh-muc/…`, `/tac-gia/…` → 404; slug thật, `/sach`, `/en/books` → 200.
- ISR fallback: bỏ `instant = false` ở 3 trang slug. e2e admin (tạo sách / danh mục / tác giả sau build rồi mở trang) qua; slug đã prerender vẫn có nội dung đầy đủ trong HTML tĩnh (`.next/server/app/vi/books/sapiens.html` có `<h1>`).
- e2e: sách e2e riêng cho `checkout.spec` / `orders.spec` (không còn đổi tồn kho sách thật), `purchase.spec` (khách → đăng nhập → địa chỉ → voucher → VietQR → chi tiết → hủy → danh sách đơn, desktop + mobile), `seo.spec` (sitemap, robots, JSON-LD, OG, 404).
- Deploy: header bảo mật (`nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, HSTS), GitHub Actions `ci.yml` (typecheck, lint, Vitest, build; e2e bật bằng biến `RUN_E2E`), `.env.example` đủ biến, hướng dẫn từng bước trong `owner-todo.md`.

**Kiểm tra**
- `typecheck`, `lint`, `build`: sạch. Vitest: 47 file / 370 test (mới: `paths` slug, `slug-guard`, `sitemap`, `json-ld`).
- `test:e2e` đầy đủ lượt 1: **209 qua**, 7 fail, 2 không chạy (serial). Sửa 2 lỗi thật của test mới / dữ liệu test (`purchase.spec` gặp bản sao ẩn của trang vừa rời; sách e2e của admin lên kệ "Mới về" rồi bị xóa → trang chủ prefetch slug đã mất → 404 trong console của `admin-smoke`) → lượt 2 các spec đó qua. Còn **chờ migration**: `checkout.spec` "khách không tự hủy đơn đã thanh toán" (desktop + mobile), `admin-vouchers` "không sửa được used_count", `admin-books` "upload bìa" (`cover_width`; 2 test sau nó không chạy vì serial, chạy riêng thì qua).
- `measure:js` (gzip, ngoài baseline 170KB): trang chủ **39.1KB**, `/en` 39.1KB, trang sách **41.9KB** (ngân sách 50KB), trang danh mục 52.0KB (trước Phase 10: 51.9KB, đã cao từ trước vì bộ lọc / sheet; ngân sách 50KB chỉ áp cho trang sách).
- Lighthouse 12.8 (mobile, mô phỏng 4G chậm + CPU 4x, `next start` local, Chrome headless):

  | Trang | Performance | LCP | CLS | TBT | Accessibility | Best practices | SEO |
  |---|---:|---:|---:|---:|---:|---:|---:|
  | `/` | 83 | 4.6 s | 0 | 100 ms | 100 | 100 | 100 |
  | `/en` | 84 | 4.5 s | 0 | 80 ms | 100 | 100 | 100 |
  | `/sach/sapiens` | 88 | 3.6 s | 0 | 100 ms | 100 | 100 | 92 (*) |
  | `/danh-muc/van-hoc` | 77 | 5.1 s | 0 | 220 ms | 100 | 100 | 92 (*) |

  (*) "canonical" trỏ `http://localhost:3000` (chưa đặt `SITE_URL`) trong khi đo ở cổng 3200: lỗi của môi trường đo, hết khi deploy với `SITE_URL` / domain Vercel.

  LCP **chưa đạt mục tiêu 2.5 s** trong mô phỏng: trang chủ là chữ hero (Render Delay ~4.1 s: 12 file font woff2 ~170KB + ~180KB JS tranh băng thông 1.6 Mbps); danh mục là ảnh bìa đầu lưới (Load Delay ~1.9 s). Đã thử bỏ preload Be Vietnam Pro: trang chủ 4.0 s nhưng trang sách 4.2 s (nhiễu của mô phỏng) → **không giữ**. Đề xuất (chưa làm, cần duyệt vì đổi typography): bớt độ đậm font (Be Vietnam Pro 400 / 600, bỏ 500), `preload` ảnh bìa đầu tiên của lưới danh mục, đo lại bằng Vercel Speed Insights trên domain thật.
- Ghi nhận thêm: response của trang prerender có thêm một header `Link` hreflang mang host lúc build (VD `localhost:3100`) bên cạnh header đúng của proxy (next-intl `alternateLinks`). Trên production cùng một domain nên vô hại; muốn gọn thì tắt `alternateLinks` (hreflang đã có trong `<head>`).

**Bị chặn**: không.

---

Plan gốc:


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

| # | Lựa chọn | Lý do | Phương án khác |
|---|---|---|---|
| 1 | Chọn hết ★ (1–9) | theo `night.md` | |
| 2 | Ảnh OG mặc định là **PNG tĩnh** sinh một lần bằng `scripts/og-image.ts` (sharp + font hệ thống Windows Cambria / Segoe UI) và commit, thay vì `opengraph-image.tsx` (ImageResponse) | font mặc định của `next/og` thiếu dấu tiếng Việt; không phải commit file font hay tải font lúc build; ảnh không đổi | ImageResponse + commit Lora TTF (OFL); ảnh OG riêng từng sách |
| 3 | URL ảnh OG là `/-/opengraph-image.png` (Next tự đặt khi ảnh tĩnh nằm dưới `[locale]`) | một ảnh cho cả hai locale; trả 200 `image/png` | ảnh riêng từng locale |
| 4 | Proxy 404: danh sách slug cache trong bộ nhớ 60 giây + hỏi thẳng khi không có trong danh sách | trang thật không tốn query; sách vừa tạo / đổi slug mở được ngay | query mỗi request; chỉ cache (slug mới 404 tới 60 giây) |
| 5 | Rewrite sang `/<locale>/__not-found` (catch-all trả 404) thay vì `NextResponse.rewrite(…, { status: 404 })` | catch-all đã trả 404 thật (smoke test có sẵn) | |
| 6 | Sitemap một file, URL chính là bản tiếng Việt + `hreflang` vi / en; bỏ danh mục con của gốc ẩn và sách của chúng | < 1.000 URL; dữ liệu e2e (gốc ẩn) không lọt vào sitemap | hai dòng mỗi trang |
| 7 | robots chặn `/admin`, `/api/` và trang riêng tư hai locale; **không** chặn `/tim-kiem` | trang tìm kiếm đã `noindex, follow` (bot cần đọc được để thấy noindex) | chặn cả tìm kiếm |
| 8 | JSON-LD `@type: ["Book", "Product"]` | Google đọc `Offer` / giá từ Product; Book cho ISBN, tác giả | chỉ Book |
| 9 | ISR fallback: page đọc `params` trong Suspense; `LocaleSwitcher` thêm một lớp Suspense (fallback = link trang chủ của ngôn ngữ kia) | đúng hướng Lộ trình; chỉ App Shell của slug chưa biết thấy fallback | giữ `instant = false` |
| 10 | Sách e2e riêng: một bộ mỗi project tạo ở setup | `checkout` / `orders` dùng nhóm sách khác nhau (low / regular vs plenty / medium) nên không giẫm nhau | khóa theo sách |
| 11 | `created_at` của mọi sách e2e = 2000-01-01 | không lên kệ "Mới về" | lọc slug `e2e-` trong query kệ (code chỉ để phục vụ test) |
| 12 | Không CSP | Next cần nonce cho CSP chặt → mọi trang thành dynamic, mất prerender | CSP lỏng (`unsafe-inline`) ít giá trị |
| 13 | CI: e2e chỉ chạy khi biến `RUN_E2E = true`, khuyên project Supabase riêng | e2e ghi dữ liệu thật; repo chưa có secret | luôn chạy e2e |
| 14 | Lighthouse bằng `npx lighthouse` + Chrome có sẵn trên máy (không thêm dependency); Chrome của Playwright không chạy được với chrome-launcher (`spawn UNKNOWN`) | | Playwright + PerformanceObserver |
| 15 | Không đổi font / preload để kéo LCP (thử một lần, kết quả không ổn định) | đổi typography cần duyệt | bớt độ đậm font |
| 16 | Không làm captcha (hướng dẫn bật Turnstile ở `owner-todo.md` mục 7) | cần khóa ngoài; Supabase đã rate limit | |

## Tiến độ

- [x] Sitemap, robots, `metadataBase`, OG, JSON-LD
- [x] 404 thật trong proxy
- [x] ISR fallback (bỏ `instant = false`)
- [x] Sách e2e riêng + e2e luồng mua hàng
- [x] Header bảo mật, CI, `.env.example`, hướng dẫn deploy
- [x] Lighthouse (LCP chưa đạt 2.5 s trong mô phỏng, xem báo cáo)
- [x] typecheck / lint / build / test / e2e (trừ test chờ migration); `measure:js`; báo cáo
