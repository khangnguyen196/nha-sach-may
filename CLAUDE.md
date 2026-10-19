# Nhà Sách Mây

Website bán sách online, **chỉ bán sách**, **song ngữ Việt/Anh**. Dự án học tập, phi thương mại, dùng dữ liệu sách thật. Tên là tên tạm.

Tôi đã có kinh nghiệm vibe code: không giải thích kiến thức cơ bản, không tóm tắt dài dòng. Trả lời bằng tiếng Việt, ngắn gọn, đi thẳng vào vấn đề. Tôi sẽ hỏi khi cần.

## Stack

- **Next.js** (App Router, React Server Components) + **TypeScript** strict
- **Tailwind CSS** + **shadcn/ui** (đã tùy biến theo design system bên dưới), icon **lucide-react**
- **Supabase** (Postgres, Auth, Storage) qua `@supabase/ssr`, types sinh tự động
- **next-intl** cho i18n · **zod** cho validation · **next-themes** cho dark/light
- Test: **Vitest** (logic thuần) + **Playwright** (luồng mua hàng)
- Script: **tsx** (`scripts/`)
- Deploy: **Vercel**

Thêm dependency mới phải có lý do rõ ràng (kích thước bundle, có cách làm native không) và hỏi tôi trước.

## Lệnh

```bash
npm run dev | build | lint | typecheck | test | test:e2e
npm run check:env                                         # kiểm tra .env.local, không in giá trị bí mật
npm run measure:js -- <route>                             # sau build: JS gzip của route prerender (vi, en, vi/books/<slug>)
npx supabase gen types typescript --project-id ylfgwcxddxvfxwldmwtf > src/types/database.ts   # Supabase CLI đã đăng nhập trên máy dev
npm run import:books -- --dry-run [--hires-covers]       # xem trước → scripts/out/preview.json | preview-hires.json
npm run import:books -- --from-preview <file>             # import đúng file đã duyệt, không gọi lại Google Books
npm run build:divisions                                   # sinh lại dữ liệu Tỉnh/Thành → Phường/Xã (commit nguồn cố định)
npm run covers -- --measure                               # ghi books.cover_width cho bìa chưa đo (không gọi API ngoài)
npm run covers -- --openlibrary --dry-run | --apply <file>  # bìa lớn hơn từ Open Library: xem trước + lưới so sánh → duyệt → ghi
npx supabase start                                        # e2e: Supabase local (cần Docker), dựng DB từ schema.sql + seed
npx tsx scripts/e2e-seed.ts                               # e2e: nạp 58 sách test (e2e/fixtures/books.json) + bìa giả vào Supabase local
npx playwright test --project=desktop --project=mobile    # e2e catalog/layout
npx playwright test --project=desktop-admin --project=mobile-admin   # e2e admin
```

**e2e chỉ chạy trên Supabase local** (Docker, `supabase/config.toml`), không bao giờ trên project cloud. CI làm hết ở `.github/workflows/e2e.yml` (mọi push trừ `docs/**` / `*.md`, chạy tay bằng `gh workflow run e2e.yml --ref <nhánh>`; tắt tạm bằng variable `RUN_E2E = false`), không dùng secret. Máy dev không có Docker → xem kết quả e2e trên CI (`gh run list --workflow e2e.yml`).

Quy ước e2e:
- Env e2e: `scripts/e2e-env.ts` (`loadLocalSupabase`) lấy URL + khóa từ `supabase status -o env`, ghi đè `process.env`, **từ chối** URL production (`ylfgwcxddxvfxwldmwtf`) và mọi host không phải `127.0.0.1` / `localhost`. Dùng ở `playwright.config.ts`, `scripts/e2e-user.ts`, `scripts/e2e-seed.ts`, `e2e/mailbox.ts`. `webServer.env` của Playwright đặt rỗng `RESEND_*`, `VIETQR_*`, `SITE_URL`… để `next start` không nhặt từ `.env.local` (Next chỉ điền biến chưa có).
- DB local dựng **chỉ từ `schema.sql`** + `seed.sql` + `seed-foreign-books.sql` (`[db.migrations] enabled = false`): migration mới phải chép vào `schema.sql` cùng commit (Vitest `supabase/migrations.test.ts`).
- Sách thật cho spec catalog / giỏ: `e2e/fixtures/books.json` (58 cuốn trích từ preview đã duyệt, mô tả ≤ 300 ký tự, có `sapiens`, tồn kho đặt tay: 1 cuốn 0, 1 cuốn 3, còn lại ≥ 20). Giả định của spec (> 1 trang lưới, kệ "Mới về" tràn, nhóm tồn kho…) kiểm ở `scripts/e2e-seed.test.ts`; spec mới dựa vào dữ liệu sách thì thêm bất biến vào đó. Thiếu dữ liệu là lỗi (throw), không `test.skip`.
- Email Auth thật: hộp thư giả Mailpit của Supabase local (`[local_smtp]`), template `supabase/templates/` như production; đọc bằng `waitForAuthEmail(email)` (`e2e/mailbox.ts`). `auth-email.spec.ts`: đăng ký (en), quên mật khẩu (vi).
- Spec cần user khớp `ACCOUNT_SPECS` trong `playwright.config.ts` (`(account|checkout|orders|error-page|reviews|purchase|crawl|auth-email).spec.ts`); spec mới cần user thì thêm vào regex. Spec admin là `admin-*.spec.ts` (`ADMIN_SPECS`, loại khỏi mọi project khác; `admin-orders.spec.ts` khớp cả `orders.spec.ts`), chạy ở `desktop-admin` (mobile chỉ `admin-smoke`), phiên admin qua `adminTest` (`e2e/admin.ts`); user admin do cùng setup tạo (`makeAdmin`). Mỗi project có 3 user riêng: chính, checkout, orders (không giẫm giỏ / đơn của nhau khi chạy song song: `checkout.spec` xóa mọi đơn của user checkout sau mỗi test).
- Test làm đổi trạng thái không quay lại được (đổi mật khẩu…) tự tạo user riêng cho mỗi lần chạy và xóa ở `finally`: retry trên CI / `--repeat-each` phải qua.
- Locator đặt trong `<main>` (`page.getByRole('main')…`) khi trang có Suspense stream: ngay sau hydrate, React có thể còn giữ bản sao ẩn của boundary (`<div hidden id="S:…">` cuối body).
- Đặt hàng trên **sách e2e riêng** (Phase 10): setup tạo mỗi project tài khoản một bộ sách `e2e-shop-…` (`createShopBooks`, danh mục gốc ẩn, `created_at` năm 2000 để không lên kệ "Mới về"; low / regular / plenty / medium), lưu `e2e/.auth/shop-books.json`, spec đọc bằng `readShopBooks(project)`; teardown `deleteShopBooks()`. Không spec nào đổi tồn kho sách thật. Sách e2e tạo trong spec (`createE2eBook`) cũng có `created_at` năm 2000. `purchase.spec` (luồng mua trọn vẹn) tự tạo user + sách + voucher.
- Dọn đơn bằng `cancelAndDeleteOrders` trước khi xóa user. Đơn chưa giao: hủy để trigger hoàn kho rồi xóa; đơn `delivered`: tự hoàn kho rồi xóa (trigger chặn `delivered → cancelled` với mọi role, kể cả service role).
- Dữ liệu test admin: sách / danh mục / tác giả slug `e2e-admin-…` (voucher `E2E-ADMIN-…`), tạo bằng service role, không sửa dữ liệu thật. Spec dọn bằng `cleanupE2eAdminData(slugs)` đúng slug của mình (bản không tham số xóa mọi dữ liệu e2e-admin, chỉ setup / teardown gọi: spec khác chạy song song). Danh mục test: gốc ẩn + con đang hiện (có trang danh mục, không lên menu). Danh mục tạo bằng service role không làm mới cache danh mục của Next → lưu lại một danh mục qua admin trước khi mở trang danh mục công khai. `findBooksByStock*` bỏ sách slug `e2e-…`. Đơn cho test admin: `placeE2eOrder` (user khách đặt sách e2e qua RPC `place_order`); voucher test: `createE2eVoucher` / `e2eVoucherCode`, dọn bằng `deleteE2eVouchers(codes)` đúng mã của spec.
- Chatbot Mây trên e2e: `webServer.env` đặt `CHAT_AI_MOCK=1` (AI giả `features/chat/mock.ts`, **không bao giờ gọi Gemini thật**; chỉ có hiệu lực khi URL Supabase là local và không có `VERCEL`), `GEMINI_API_KEY` rỗng, `CHAT_QUOTA_TOKEN` = `E2E_CHAT_QUOTA_TOKEN` (`scripts/e2e-env.ts`, token cố định của DB local, không bí mật; `e2e-seed.ts` ghi vào DB qua `set_chat_quota_token`). Ở chế độ giả, giới hạn IP + trần chung nhân 100, cooldown sau 429 tính theo khách (test song song không chặn nhau); giới hạn khách giữ nguyên. Cụm `[mock:5-books]`, `[mock:429]`, `[mock:429-day]`, `[mock:timeout]`, `[mock:crisis]`, `[mock:english]` trong câu hỏi điều khiển AI giả. Helper `openChat` / `ask` ở `e2e/chat.ts`.
- Mất mạng lúc gửi form: `failServerActions(page, url)` (`e2e/helpers.ts`) chặn đúng request Server Action (POST có header `next-action`); kiểm câu `NETWORK_ERROR` + giá trị các ô còn nguyên. `collectErrors` ghi kèm URL cho dòng "Failed to load resource" (không lọc dòng nào).
- Ép Supabase lỗi (trang lỗi): cookie `e2e-fault=rest` làm mọi request REST của client theo phiên ném lỗi mạng (`lib/supabase/fault-injection.ts`). Chỉ có tác dụng khi server chạy với `E2E_FAULT_INJECTION=1` (`webServer.env` của Playwright đặt sẵn); `VERCEL_ENV=production` luôn tắt. Không đặt biến này ngoài e2e.

Trước khi báo xong: `typecheck`, `lint`, `build` phải sạch. Có đụng logic giỏ hàng/đặt hàng thì chạy thêm test liên quan.

## Cấu trúc

```
src/
  app/[locale]/
    (shop)/            # trang chủ, danh mục, sách, tác giả, tìm kiếm, giỏ, thanh toán, tài khoản
    (auth)/            # đăng nhập, đăng ký
    layout.tsx         # <html lang={locale}>, NextIntlClientProvider, ThemeProvider
  app/admin/           # quản trị — chỉ tiếng Việt, không nằm dưới [locale]
  i18n/                # routing.ts (locales, pathnames), request.ts, navigation.ts
  features/            # chia theo domain, mỗi domain tự chứa:
    books/  cart/  checkout/  orders/  account/  reviews/  admin/  chat/
      components/  actions.ts  queries.ts  schemas.ts  types.ts
  components/ui/       # shadcn primitives
  components/layout/   # Header, Footer, LocaleSwitcher, ThemeToggle
  components/admin/    # AdminLink, khung admin, ShopLink, bảng / form dùng chung của admin
  lib/                 # supabase/{server,client,public,env}.ts, i18n-db.ts, errors.ts, utils.ts
  types/database.ts
  proxy.ts             # (Next 16, thay middleware.ts) — refresh session Supabase rồi next-intl; /admin bỏ qua next-intl
messages/vi.json  messages/en.json
supabase/schema.sql  seed.sql  migrations/  config.toml (Supabase local cho e2e)
scripts/import-books.ts  book-list.json   # công cụ nạp dữ liệu, chạy local
scripts/e2e-env.ts  e2e-seed.ts  e2e-user.ts   # env Supabase local + guard, nạp sách test, user / dữ liệu test
e2e/                   # Playwright; fixtures/books.json, mailbox.ts (Mailpit)
```

- `lib/supabase/server.ts`: client theo phiên (đọc cookies) → chỉ dùng trong `<Suspense>`. `lib/supabase/public.ts`: client anon không cookies → dùng cho query catalog trong `'use cache'`.
- Locale ở server lấy từ `next/root-params` (`i18n/request.ts`), API ổn định từ Next 16.3, không cần cờ experimental. Nhờ vậy không cần `setRequestLocale`, trang vẫn prerender được, và `getTranslations()` gọi được trong `'use cache'` (locale tự vào cache key). `/admin` không có `[locale]` → mặc định `vi`.
- **Server Action không đọc được `next/root-params`** → không gọi `getLocale()` hay `getTranslations()` không kèm locale trong action. Page bind locale sẵn (`action.bind(null, locale)`), action parse lại bằng `parseLocale` (tham số bind đi qua client). Action trả mã lỗi; chuỗi đã dịch xuống form qua props (`getFormMessages`). Lỗi có tham số ICU (`OUT_OF_STOCK`: title, stock) thì action dịch sẵn bằng `withMessage(locale, failure)` (`lib/error-message.ts`, dùng `getTranslations({ locale })` — chạy được trong action) và client hiện `failure.message`.
- Trang sách / danh mục / tác giả đọc `params` **bên trong** `<Suspense>` (không còn `instant = false`): slug tạo sau build stream theo request, slug đã prerender vẫn là HTML tĩnh. `LocaleSwitcher` đọc `useParams` trong Suspense riêng (fallback: link về trang chủ của ngôn ngữ kia, chỉ thấy ở App Shell của slug chưa biết).
- 404 thật: `proxy.ts` kiểm slug của `/sach/*`, `/danh-muc/*`, `/tac-gia/*` (cả `/en/…`) bằng `createSlugGuard` (`lib/slug-guard.ts`: danh sách slug cache 60 giây, không có thì hỏi thẳng một slug; lỗi mạng → cho qua) → không có thì rewrite sang `/<locale>/__not-found` (catch-all gọi `notFound()` trước khi stream → HTTP 404). Trang một đơn (`/thanh-toan/thanh-cong/<mã>`, `/tai-khoan/don-hang/<mã>`, cả `/en/…`) và trang sửa địa chỉ (`/tai-khoan/dia-chi/<id>`): proxy đếm `orders` theo mã (`addresses` theo id) + `user_id` bằng client theo phiên; lỗi → cho qua, trang hiện `InlineNotFound` (`components/layout/inline-not-found.tsx`: UI 404 + `noindex`, HTTP 200). Rewrite kèm header `x-not-found` (`lib/not-found-kind.ts`: book / category / author / order / address) → `not-found.tsx` đọc trong Suspense, `NotFoundView` hiện câu + link theo loại; đơn hàng: **cùng một câu** cho mã sai, đơn không có, đơn của tài khoản khác. `?page=` vượt quá của trang lưới và danh sách đơn **không** kiểm ở proxy, chỉ `InlineNotFound` (soft 404): proxy không đọc được cache của app (trên Vercel chạy tách runtime), từng thử hỏi một route nội bộ và mọi trang > 1 chậm thêm ~100 ms (2026-10-18). **Không gọi `notFound()` trong boundary đã stream**: React bỏ SSR của boundary, console báo React error #419.
- SEO: `app/sitemap.ts` (`lib/sitemap.ts`, chỉ cây danh mục đang hiện), `app/robots.ts`, `metadataBase` = `siteUrl()` (`lib/site-url.ts`: `SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → localhost), ảnh OG mặc định `app/[locale]/opengraph-image.png` (sinh bằng `scripts/og-image.ts`, commit ảnh), trang sách dùng bìa làm `og:image`. JSON-LD qua `lib/json-ld.ts` (`serializeJsonLd` thoát `<`): `Book`+`Offer`+`BreadcrumbList` ở trang sách, `WebSite`+`SearchAction` ở trang chủ.
- **Proxy và Route Handler** không import `i18n/navigation.ts` (`getPathname` kéo theo `i18n/request.ts` → `next/root-params`, không build được ở đó): dùng `localizedPath` / `localizedSlugPath` / `matchSlugPath` trong `i18n/paths.ts`.
- Proxy chỉ chuyển hướng đăng nhập cho **GET / HEAD**: POST là Server Action, tự kiểm phiên và trả `AUTH_REQUIRED` (chuyển hướng một action sang trang HTML làm client báo nhầm lỗi mạng).
- Trang đăng nhập / quên mật khẩu: form nằm trong khung tĩnh, **không** bọc trong Suspense (fallback là form thứ hai từng bị thay sau hydrate → mất chữ). `?next=` đọc ở client (`NextField`), không JS thì action lấy từ Referer (`nextFromReferer` + `safeNextPath`); thông báo của URL (`?error=`, `?confirmed=1`) ở `UrlNotices` trong Suspense riêng phía trên form.
- Quên mật khẩu / gửi lại email xác nhận (`requestPasswordReset`, `resendConfirmation`): **chỉ** báo lỗi khi không tới được máy chủ (`NETWORK_ERROR`, fetch lỗi) hoặc zod chặn dữ liệu nhập. Mọi phản hồi khác của GoTrue (`email_address_invalid`, `email_address_not_authorized`, mọi 429, 5xx, user không có, mã lạ) cùng kết quả "đã gửi": GoTrue tìm user trước rồi mới gửi thư / kiểm tần suất, báo khác đi là lộ email nào có tài khoản. Log chỉ ghi mã lỗi, không ghi message (có thể chứa email). Nút gửi lại khóa 60 giây cố định ở client.
- Đăng ký (`signUp`): như trên, cộng thêm các mã GoTrue kiểm **trước** khi tìm user (`PRE_LOOKUP_SIGNUP_CODES` trong `features/auth/errors.ts`: `weak_password` dưới ô Mật khẩu, `validation_failed`, `signup_disabled` / `email_provider_disabled`; đối chiếu `internal/api/signup.go`). Mọi mã khác, kể cả `user_already_exists` và 429 theo IP, cùng kết quả "Kiểm tra hộp thư" (câu nói rõ thư có thể không tới, kèm link đăng nhập / quên mật khẩu).
- Đọc phiên: `getCurrentUser()` (`lib/auth.ts`, `getClaims()` + `await io()` trước đó vì Supabase so hạn token bằng `Date.now()`), luôn trong `<Suspense>`. Trang cần đăng nhập dùng `requireUser(locale, href)`. Redirect bằng giá trị lấy từ URL (`?next=`) phải qua `safeNextPath`.
- Link trong email auth (`features/auth/confirm-link.ts`), hai dạng: (1) template riêng (`supabase/templates/`, song ngữ theo `{{ .Data.locale }}`, cần custom SMTP): `?token_hash=` → `GET /api/auth/confirm` **không** tiêu thụ token, chỉ chuyển sang trang trung gian `/xac-nhan` (`/en/confirm`) có nút "Xác nhận" → form POST (kiểm `Origin`) mới gọi `verifyOtp`; (2) template mặc định của Supabase: `signUp` / `resetPasswordForEmail` gửi `emailRedirectTo` / `redirectTo` = `authCallbackUrl(requestOrigin(Origin), locale, 'signup' | 'recovery')` → Supabase chuyển về kèm `?code=` → GET gọi `exchangeCodeForSession` (PKCE: cùng trình duyệt; khác trình duyệt thì đăng ký → `/dang-nhap?confirmed=1`, đặt lại mật khẩu → `LINK_EXPIRED`). URL callback phải nằm trong Redirect URLs của Supabase. Mọi `next` qua `safeNextPath`. Ô "Ngôn ngữ email" ghi cả `profiles.locale` lẫn `user_metadata.locale`.
- Pathname nội bộ (thư mục trong `app/[locale]`) bằng tiếng Anh; URL tiếng Việt map trong `i18n/routing.ts`. Trong code luôn viết `<Link href="/books/...">`.

Không dùng barrel file (`index.ts` re-export). Import trực tiếp.

## Nguyên tắc code

**Rendering & dữ liệu**
- Server Component là mặc định. `"use client"` chỉ cho lá (leaf) cần tương tác; đẩy boundary xuống thấp nhất có thể. Không bọc cả trang trong client component.
- Query nằm trong `features/*/queries.ts`, chỉ chạy ở server, có kiểu trả về rõ ràng. Component không gọi Supabase trực tiếp.
- Lấy quan hệ trong **một** query (`select('id, title, ..., book_authors(role, authors(name, slug))')`), không N+1. Chỉ select cột cần dùng, không `select('*')` ở danh sách.
- Phân trang bằng `.range()` + `count: 'estimated'`. Không tải toàn bộ rồi cắt ở client.
- Các request độc lập chạy song song (`Promise.all`), không await tuần tự.
- Streaming: tách khối chậm (đánh giá, sách liên quan) vào `<Suspense>` với skeleton đúng kích thước, tránh CLS.

**Cache**
- Dữ liệu catalog (sách, danh mục, tác giả) là public: cache theo cơ chế của phiên bản Next.js đang dùng, gắn tag (`books`, `book:{id}`, `categories`). Admin sửa → revalidate đúng tag, không revalidate toàn site.
- Dữ liệu theo user (giỏ, đơn, tài khoản) không cache chung.
- Dùng `React.cache` để dedupe query lặp trong cùng một request (VD: `generateMetadata` và page cùng lấy một cuốn sách).

**Mutation**
- Server Actions đặt trong `features/*/actions.ts`. Mọi input parse bằng zod schema dùng chung client/server (`schemas.ts`).
- Action trả về `Result<T>` = `{ ok: true, data } | { ok: false, code }`. Không throw ra UI. `code` là mã lỗi có bản dịch trong `messages/*.json → errors`.
- Giỏ hàng dùng `useOptimistic`, rollback khi lỗi.
- Đặt hàng/hủy đơn chỉ qua RPC `place_order` / `cancel_order`. Client không gửi giá hay tổng tiền.
  - `place_order` nhận `p_idempotency_key` (gửi lại cùng key → trả đúng đơn đã tạo) và `p_expected_total` (tổng đang hiển thị, **chỉ để so**; lệch → mã `CART_CHANGED` của DB). Key sinh trong phần động của trang (sau khi đọc phiên), không ở static shell: giá trị ngẫu nhiên / theo thời gian trong phần prerender bị đóng băng vào HTML dùng chung.
  - Đổi tồn kho (đặt / hủy đơn) → `updateTag('book:{id}')` từng sách; các cache danh sách đã gắn tag theo từng sách trả về.
- Form gửi Server Action dùng `useFormAction` (`lib/use-form-action.ts`): giữ progressive enhancement, bỏ qua submit khi đang gửi, lỗi mạng → `NETWORK_ERROR` trong khối lỗi của form (không lên error boundary, chữ đã gõ còn nguyên vì không reset form). Action đã dịch sẵn (`message`) thì form hiện `message`. Gọi action ngoài form (giỏ, thêm vào giỏ, chatbot) phải tự `try/catch` lỗi mạng. Trang truyền `getFormMessages(codes, { signInNext })` → lỗi `AUTH_REQUIRED` / `SESSION_EXPIRED` có link "Đăng nhập lại" (`SignInAgainLink`) về đúng trang.
- Lỗi do khách → mã riêng + câu nói rõ cách làm tiếp, đặt ngay chỗ liên quan (lỗi Supabase Auth gắn ô qua `authFailure` → `fieldErrors`). `UNKNOWN` chỉ cho lỗi phía web (câu có `{email}` liên hệ); admin: mục vừa bị xóa ở tab khác → `ITEM_DELETED`.
- Tiền tạm tính ở giỏ/checkout (subtotal, ship, giảm giá, mốc freeship) lấy từ RPC `quote_order` (giỏ khách: `quote_items`), không tự tính ở client.
- Voucher ở checkout nằm trên URL (`/thanh-toan?voucher=…`, `parseVoucherInput`): form GET riêng (ô + nút trong form đặt hàng, gắn bằng thuộc tính `form`), `getCheckoutQuote` tính lại; mã không dùng được → lỗi dưới ô theo lý do (`VOUCHER_NOT_FOUND` (cả mã sai dạng), `_INACTIVE`, `_NOT_STARTED`, `_EXPIRED`, `_EXHAUSTED`, `VOUCHER_MIN_ORDER` kèm số tiền còn thiếu), tổng không giảm. Mã hợp lệ đi vào form đặt hàng qua hidden `voucher_code`.
- Gợi ý mã: nút "Chọn mã giảm giá" (chỉ khi có mã) mở `VoucherPicker` (Radix Dialog tải lười, tấm trượt dưới `sm`, dialog từ `sm`); dữ liệu từ RPC `checkout_vouchers` (mã `is_public` đang dùng được + `discount` / `shortfall` với giỏ hiện tại do DB tính), xếp bằng `rankVouchers`. "Áp dụng" = điền ô + gửi đúng form GET (cùng luồng kiểm tra). Admin bật từng mã bằng ô "Hiện trong gợi ý ở trang thanh toán" (`is_public`, mặc định `false`).
- Ghi chú đơn hàng giữ qua lần tải lại khi áp mã: nháp `sessionStorage` (`features/checkout/note-draft.ts`), khóa `checkout-note-draft:<userId>`, **chỉ lưu chữ ghi chú**. Xóa lúc bấm đặt hàng (ghi lại nếu đặt không được); mở trang thanh toán thì xóa mọi khóa `checkout-note-draft*` khác (của tài khoản khác, khóa cũ không gắn tài khoản); đăng xuất qua `SignOutForm` (`features/auth/components/sign-out-form.tsx`) xóa hết trước khi gửi.
- Thanh toán: COD hoặc chuyển khoản VietQR. Payload EMVCo tự dựng (`features/payments/vietqr.ts`), QR vẽ SVG ở server bằng `uqr` (0KB client). Tài khoản nhận `getBankAccount()`: đủ 4 biến `VIETQR_*` thì thật, thiếu → **demo** + luôn cảnh báo "đừng chuyển tiền". Admin bấm "Đã nhận tiền" (update có điều kiện `payment_status = 'unpaid'`); hủy đơn đã thanh toán → `refunded` (hoàn tiền ngoài hệ thống).
- Email đơn hàng: `notifyOrder` (`features/orders/emails.ts`) gọi trong `after()`, không throw. `lib/email.ts`: Resend REST qua `fetch` khi có `RESEND_API_KEY` + `EMAIL_FROM`, thiếu → chỉ log (địa chỉ che `n***@…`). Ngôn ngữ = `profiles.locale` của người đặt; người nhận: khách tự đặt / hủy lấy từ phiên, admin đổi trạng thái lấy qua RPC `order_contact`. Màu trong HTML email là hằng `EMAIL_COLORS` (ngoại lệ "không hard-code màu": trình đọc thư không hiểu CSS variables).
- Đánh giá: danh sách công khai `getBookReviews` (cache, tag `book:{id}`), phần theo phiên (`MyReview`) trong `<Suspense>` riêng; ghi / sửa / xóa → `updateTag('book:{id}')`. Chưa nhận sách → RLS chặn insert (`42501` → `REVIEW_NOT_ALLOWED`). Admin gỡ ở `/admin/danh-gia`.
- **Chatbot Mây** (`features/chat/`, `docs/plans/phase-11.md`): Server Action `askMay` theo thứ tự: input (zod, `ageConfirmed`, lịch sử ≤ 4 lượt coi như dữ liệu không tin cậy) → bộ lọc tự hại (`crisis.ts`, câu trả lời cố định `chat.crisis`, không gọi AI, chạy **trước** bước khu vực) → chặn EEA / Anh / Thụy Sĩ (`x-vercel-ip-country`) → cooldown sau 429 → `consume_chat_quota` (cấp **vé** `GeminiTicket` cho đúng một lượt gọi; mỗi lượt gọi Gemini phải có vé, trần chung đếm lượt gọi, ngày theo `America/Los_Angeles`) → ≤ 30 ứng viên lọc trong bộ nhớ từ `getChatCatalog` (cache, tag `chat-catalog`; admin sửa catalog dùng `adminCatalogTags`) → Gemini REST **một lần**, không retry, không tự đổi model (`responseMimeType` + `responseJsonSchema` có `enum` slug) → `validateReply` → thẻ sách lấy từ DB. Giới hạn, model, danh sách nước bị chặn ở `config.ts`. Client chỉ gửi slug của sách đang xem; không gửi dữ liệu tài khoản / đơn cho Gemini; không lưu / log nội dung chat. Bong bóng (`chat-bubble.tsx`) chỉ ở layout `(shop)` khi locale `vi` và đủ env, ẩn ở `/checkout*`, tự ẩn khi phần tử `data-chat-avoid` (CTA) vào dải đáy; khung (`chat-panel.tsx`) tải lười.

**State**
- Filter, sort, page, query tìm kiếm nằm trên **URL searchParams**, không ở `useState`. Link chia sẻ được, back/forward đúng, render được ở server.
- Không thêm thư viện state toàn cục. Giỏ khách vãng lai: localStorage, gộp vào `cart_items` khi đăng nhập qua RPC `merge_cart`.

**TypeScript**
- Không `any`, không `as` để ép kiểu cho qua. Dùng types sinh từ Supabase và `z.infer`.
- Kiểu domain (`BookCard`, `CartLine`…) derive từ query, không viết tay song song.

**Chất lượng**
- Hàm nhỏ, early return, đặt tên rõ nghĩa. Không trừu tượng hóa sớm: chỉ tách hàm/component dùng chung khi có ≥ 2 chỗ dùng thật.
- Xóa code chết, không để code comment-out. Comment giải thích *tại sao*, không giải thích *cái gì*.
- Không hard-code chuỗi hiển thị, màu hay khoảng cách. Chuỗi lấy từ messages, màu và khoảng cách lấy từ token.

**Hiệu năng (mục tiêu trên mobile 4G)**
- LCP < 2.5s, CLS < 0.1, INP < 200ms.
- JS client: phần app thêm vào **ngoài framework ≤ 50KB gzip ở trang sách**. Baseline framework (app Next 16.4 + React 19.3 trống) ≈ 170KB gzip / ~147KB brotli, nên con số tuyệt đối < 100KB là bất khả thi.
  Cách đo (`scripts/measure-js.mjs`): lấy mọi `<script src>` trong HTML prerender `.next/server/app/<route>.html`, gzip level 9 từng file, cộng lại, trừ 170KB. Đường dẫn là đường dẫn nội bộ (`vi/books/<slug>`, không phải `/sach/...`). Mốc 2026-10-15: trang chủ 212.4KB gzip = baseline + 42.4KB (chủ yếu `intl-messageformat` của client `useTranslations` ~16KB, lucide + radix + cva + cn ~15KB). Sau Phase 3 (precompile messages, client leaf nhận chuỗi qua props): trang chủ và trang sách = baseline + 33.2KB.
- Module chạy ở client **không import zod** (≈30KB gzip; từng lọt vào mọi trang qua badge giỏ ở header). Dữ liệu client tự đọc (localStorage, tham số URL) thì kiểm tra bằng tay, kèm Vitest khớp kết quả với schema zod của server (VD `normalizeCartItems` ↔ `cartItemsSchema`). Schema zod cho input Server Action vẫn ở `schemas.ts`, chỉ server import. Sau Phase 5a: trang sách = baseline + 36.0KB.
- `next/image` với `sizes` đúng; ảnh bìa đầu trang (LCP) có `preload` (Next 16 bỏ `priority`). Font qua `next/font` (subset `latin` + `vietnamese`, `display: swap`).
- Component nặng/ít dùng (gallery zoom, rich editor admin) dùng `next/dynamic`.
- `global-error.tsx` và `ErrorView` (`components/layout/error-view.tsx`) **không import thư viện dùng chung** (next-intl, radix / `Button`, next-themes, lucide): Turbopack tải `global-error` ở mọi trang thành nhóm chunk riêng và chép lại mọi module nó import (từng đẩy trang chủ từ +35.4KB lên +56.7KB). Đổi file đặc biệt của Next (`error`, `global-error`, `not-found`, `loading`…) thì chạy `measure:js`. Sau Phase 6: trang chủ = baseline + 38.0KB, trang sách + 38.7KB.

**Accessibility**: WCAG AA. Có focus ring rõ, điều hướng được bằng bàn phím, có `alt` cho ảnh bìa (tên sách), dùng HTML ngữ nghĩa, tôn trọng `prefers-reduced-motion`.
- **Ngoại lệ alt**: ảnh bìa nằm cùng một link/mục với tên sách hiển thị ngay bên cạnh (kết quả palette, dòng giỏ hàng, item danh sách) thì `alt=""`, vì trình đọc màn hình sẽ đọc tên hai lần. Ảnh đứng một mình (bìa lớn ở trang sách, ảnh không kèm chữ) vẫn phải có `alt` là tên sách.

## Song ngữ (i18n)

- Locale: `vi` (mặc định), `en`. Routing `localePrefix: 'as-needed'`: tiếng Việt không có prefix, tiếng Anh có `/en`.
- Pathnames dịch theo ngôn ngữ (cấu hình `pathnames` trong `i18n/routing.ts`):

  | vi | en |
  |---|---|
  | `/danh-muc/[slug]` | `/en/categories/[slug]` |
  | `/sach` (tất cả sách) | `/en/books` |
  | `/sach/[slug]` | `/en/books/[slug]` |
  | `/tac-gia/[slug]` | `/en/authors/[slug]` |
  | `/tim-kiem` | `/en/search` |
  | `/gio-hang` | `/en/cart` |
  | `/thanh-toan` | `/en/checkout` |
  | `/tai-khoan` | `/en/account` |

  Slug của sách, danh mục, tác giả dùng chung cho cả hai ngôn ngữ.
- Luôn dùng `Link`, `redirect`, `useRouter`, `usePathname` từ `i18n/navigation.ts`, không import từ `next/link` hay các hàm tương ứng của `next/navigation` (ESLint chặn). Hàm next-intl không bọc (`notFound`, `useParams`, `useSearchParams`) thì import từ `next/navigation` bình thường.
- **Ngoại lệ — `LocaleSwitcher`** dùng `<a>` thường với `href` tính bằng `getPathname` (từ `i18n/navigation.ts`), không dùng `Link`: `Link` có prop `locale` luôn ép prefix kể cả locale mặc định, nên en→vi ra `/vi?x=1` và client nav giữ nguyên URL không canonical đó (proxy không kịp chuyển về `/?x=1`). `getPathname` không ép prefix. Đổi ngôn ngữ vì vậy là tải lại cả trang, chấp nhận được vì mọi nội dung đều đổi. Chỗ này có `eslint-disable-next-line no-restricted-syntax` kèm comment; ngoài ra không chỗ nào khác được dùng `<a href={…}>` cho link nội bộ, trừ admin trỏ ra cửa hàng (`ShopLink`, link "Về cửa hàng", `admin/error.tsx`: admin là root layout khác, không có provider của next-intl).
- **Admin** (`app/admin`, không có `[locale]`, URL tiếng Việt viết thẳng): link nội bộ qua `AdminLink` (`components/admin/admin-link.tsx`, kiểu `AdminHref` chỉ nhận `/admin…`), `redirect` / `usePathname` lấy từ `next/navigation` (ESLint cho phép trong `app/admin`, `components/admin`, `features/admin`). Cửa hàng trỏ vào admin (link "Quản trị", chỉ render khi `isAdmin()` ở server: trang tài khoản, cạnh icon tài khoản ở header từ `sm`) cũng dùng `AdminLink`, `prefetch={false}`; sang root layout khác Next tự tải lại cả trang.
- `messages/vi.json` và `en.json` chia namespace theo feature (`common`, `book`, `cart`, `checkout`, `account`, `errors`…). Bật type-safe cho message keys. Hai file phải luôn **cùng bộ key**: có test so sánh, thiếu key thì fail. **Ngoại lệ**: namespace `admin` và `chat` chỉ có trong `vi.json` (admin và chatbot Mây chỉ tiếng Việt); test so key bỏ qua hai namespace này, kiểu message key vẫn lấy từ `vi.json`. Mã lỗi (`errors`) dùng chung `ERROR_CODES` nên mã mới của admin vẫn phải có ở cả hai file.
- Messages được biên dịch lúc build (`experimental.messages.precompile` của plugin next-intl trong `next.config.ts`) → client không kéo `intl-messageformat` (~9KB gzip). Đây là API **experimental**: mỗi lần nâng next-intl phải kiểm tra lại (changelog, build, `measure:js`, e2e). Client leaf nhận chuỗi đã dịch qua props; chỉ palette (tải lười) dùng `useTranslations`, nên `NextIntlClientProvider` chỉ truyền namespace `search`.
- Trang lỗi: `error.tsx` là client component và không nhận props từ server → layout (`[locale]/layout.tsx`, `admin/layout.tsx`) dịch sẵn namespace `errorPage` và truyền qua `ErrorMessagesProvider`; `error.tsx` đọc bằng `useErrorMessages()`. `global-error.tsx` thay cả root layout nên dùng bản chép `i18n/global-error-messages.ts` (Vitest kiểm tra khớp `errorPage` và `localizedPath('/')`): sửa chuỗi ở `messages/*.json` thì chép sang. UI lỗi hiện **mã tra cứu** (`error.digest`, khớp dòng log của Next ở server / Vercel Logs; gói Hobby chỉ giữ runtime log **1 giờ** → khách gửi mã thì phải tra trong 1 giờ, quá hạn không còn dòng log) + email liên hệ, **không** hiện `error.message`. Câu mô tả có `{email}` / `{digest}` giữ chỗ trống, `ErrorView` điền (`getErrorPageMessages`).
- Chuỗi có giá trị chỉ biết ở client (tên sách của giỏ khách, số trên badge, số tiền còn thiếu để freeship): server dịch sẵn và giữ chỗ trống, `t('removeLabel', { title: placeholder('title') })`, client điền bằng `fillTemplate` (`lib/template.ts`). Chỉ cho tham số đơn giản, không dùng với plural/select → câu tiếng Anh viết sao cho không cần số nhiều ("Cart, items: {count}").
- **Dữ liệu DB**: cột gốc là tiếng Việt, cột `*_en` là tiếng Anh (`name_en`, `description_en`, `bio_en`…). Dùng một helper duy nhất `localize(row, 'name', locale)` trong `lib/i18n-db.ts` để fallback `*_en` → cột gốc khi null. **Tên sách không dịch.**
- Email liên hệ của nhóm: hằng duy nhất `SUPPORT_EMAIL` (`lib/support.ts`, không import gì), không chép địa chỉ vào code / messages (Vitest kiểm). Câu cần hỗ trợ dùng tham số `{email}` (`withMessage`, `getFormMessages` luôn truyền); `SupportEmailText` biến email trong câu thành link `mailto:` (`FormAlert` tự dùng).
- Giá luôn tính bằng VND ở cả hai ngôn ngữ, format qua formatter của next-intl theo locale (vi: `98.000 ₫`, en: `₫98,000`). Ngày tháng cũng format qua formatter.
- Lỗi từ DB/RPC là **mã** (`OUT_OF_STOCK`, `VOUCHER_EXPIRED`…, danh sách ở cuối `schema.sql`). `lib/errors.ts` map mã sang `errors.<CODE>`; thông tin chi tiết lấy từ `error.details` (JSON). `withMessage` luôn truyền `{email}` và đổi detail thời điểm (`starts_at`, `ends_at`) sang ngày giờ theo locale. Đổi mã lỗi một hàm DB = migration chạy **sau** khi bản app hiểu mã mới đã deploy (app mới hiểu cả mã cũ).
- SEO: `generateMetadata` theo locale, `alternates.languages` (hreflang) cho mỗi trang, sitemap có cả hai locale.
- `LocaleSwitcher` giữ nguyên trang hiện tại và params khi đổi ngôn ngữ. Lưu `profiles.locale` khi user đổi (dùng cho email).

## Database

Nguồn sự thật là `supabase/schema.sql`. Đổi schema thì viết migration trong `supabase/migrations/`, cập nhật `schema.sql`, sinh lại types.

- `supabase/config.toml` chỉ cho Supabase local của e2e. **Không** `supabase link` / `supabase db push` (sẽ chạy `migrations/` lên production); migration do chủ dự án chạy tay trong SQL Editor.

- Tiền là `integer` VND.
- RLS bật cho mọi bảng. Không tắt RLS, không dùng service role trong app.
- Cột do DB quản lý (trigger/RPC), không ghi từ app: `search_text`, `sold_count`, `avg_rating`, `review_count`, `display_name`, `updated_at`.
- Quyền cột (migration `admin.sql`, `payments_email.sql`): `orders` chỉ update được `status`, `payment_status`, `cancelled_reason`; `books` không update được cột do DB quản lý; `vouchers` không update được `used_count`, `created_at`. `cancel_order` không hủy đơn `payment_status = 'paid'`; không hủy được thì báo đúng lý do (`ORDER_IN_PROGRESS` kèm `status`, `ORDER_DELIVERED`, `ORDER_PAID`, `ORDER_ALREADY_CANCELLED`; đơn không có / của người khác vẫn `ORDER_NOT_CANCELLABLE`). `vouchers` cập nhật được `is_public`. Admin thêm ô sửa cột mới của `books` → thêm cột vào `grant update (…)`.
- Luồng trạng thái đơn chặn ở trigger `handle_order_status_change` (mọi role, kể cả service role; bảng chuyển trong `private.order_status_transition_allowed`): `pending → confirmed → shipping → delivered`, hủy được từ 3 trạng thái đầu; `delivered`, `cancelled` là trạng thái cuối (`ORDER_INVALID_TRANSITION`, `ORDER_REOPEN_FORBIDDEN`). COD chuyển `delivered` → `payment_status = 'paid'`. App có bản trùng `nextStatuses` (`features/admin/orders/status.ts`, Vitest đọc bảng trong `schema.sql`): sửa luồng thì sửa cả hai. Admin đổi trạng thái bằng update có điều kiện `status = <trạng thái đang hiển thị>`: 0 dòng (khách vừa tự hủy…) → `ORDER_STATUS_CHANGED` + `refresh()`.
- Bucket `book-covers` chỉ nhận `image/webp` ≤ 1MB. Ảnh bìa qua `toCoverWebp` (`lib/cover-image.ts`, dùng chung import và admin); admin lưu tên mới mỗi lần (`<book_id>-<8 hex>.webp`, ảnh cũ bị CDN cache 1 năm), chỉ xóa ảnh cũ khi không đơn nào còn trỏ tới (`order_items.cover_url`). `toCoverWebp` trả kèm chiều rộng thật → import, admin upload, `scripts/covers.ts` ghi `books.cover_width` (kệ trang chủ ưu tiên bìa ≥ `SHARP_COVER_WIDTH` = 300px; null = chưa đo).
- RPC cho app: `search_books`, `quote_order`, `quote_items`, `checkout_vouchers`, `place_order`, `cancel_order`, `set_default_address`, `merge_cart`, `order_contact`, `consume_chat_quota` (danh sách + mã lỗi ở cuối `schema.sql`). `set_chat_quota_token` chỉ `service_role` (e2e local); token production sinh bằng `select private.new_chat_quota_token()` trong SQL Editor. Hàm nội bộ nằm trong schema `private`, không lộ ra API.
- Tìm kiếm qua RPC `search_books(q)`: gõ không dấu, khớp từng từ không cần đúng thứ tự. Phân trang bằng `.range()` + `count: 'exact'` (`estimated` trên RPC không chính xác).
- Sách chỉ gắn vào danh mục lá. Trang danh mục cha lọc `category_id in (<id các danh mục con>)`.
- Địa chỉ 2 cấp: Tỉnh/Thành phố → Phường/Xã. Đổi địa chỉ mặc định qua RPC `set_default_address`.
- Phí ship: 30.000₫, miễn phí từ 300.000₫ (hằng số trong `private.flat_shipping_fee()` / `private.free_ship_from()`). UI lấy mốc freeship từ `quote_order` (giỏ tài khoản) / `quote_items` (giỏ khách, cấp cho anon, nhận danh sách `{book_id, quantity}` như `merge_cart`), không hard-code.
- Voucher: mã luôn viết HOA (check của bảng); ô thời gian admin nhập theo giờ Việt Nam, đổi sang `timestamptz` bằng offset +07:00 cố định (`features/admin/vouchers/datetime.ts`), không theo múi giờ của server. Voucher đã có đơn gắn (kể cả đơn đã hủy) chỉ tắt, không xóa (`VOUCHER_IN_USE`).
- `reviews`: client chỉ ghi được `rating`, `content` (column grant); `user_id` tự lấy từ phiên đăng nhập.

## Dữ liệu

- `seed.sql` chỉ chứa danh mục và voucher. Sách, tác giả, NXB là **dữ liệu thật**, nạp bằng `npm run import:books` từ Google Books API: tên, tác giả, NXB, ISBN, năm xuất bản, số trang, mô tả, ảnh bìa.
- Quy trình import: `--dry-run` (có/không `--hires-covers`, ghi ra 2 file riêng) → mở file xem/sửa → `--from-preview <file>` để ghi DB. Không import thẳng từ Google Books: quota Books API ~1.000 request/ngày (cần `GOOGLE_BOOKS_API_KEY`, quota ẩn danh thường đã hết), và dữ liệu vào DB phải đúng bản đã duyệt. `--from-preview` validate lại file (zod, cùng ràng buộc với DB) trước khi ghi.
- Muốn thêm sách: sửa `scripts/book-list.json` rồi chạy lại quy trình trên. Định dạng: danh mục lá → mảng truy vấn; mỗi truy vấn là chuỗi (1 request) hoặc `{ "q": "...", "pages": n }` (n request; API trả ≤ 20 cuốn/trang dù xin 40; dừng sớm khi hết kết quả). Cú pháp dùng được với sách tiếng Việt: từ khóa trơn (`tiếng Anh`, `Nam Cao`) hoặc **một** toán tử `inauthor:`/`inpublisher:` đứng đầu + từ trơn (`inauthor:Nguyễn Nhật Ánh`, `inpublisher:Kim Đồng truyện`). **Không** dùng ngoặc kép (`inauthor:"…"` có dấu → 0 kết quả), **không** lặp toán tử cho từng từ (→ 0), **không** dùng `intitle:` / `subject:` (với `langRestrict=vi` thường ra 0). Ước tính quota: số trang search + số sách thu được (nếu `--hires-covers`); `--max-requests` (mặc định 900) chặn trên. Danh mục sách tiếng Anh (nhánh "Sách ngoại văn", `supabase/seed-foreign-books.sql`) khai báo dạng `{ "language": "en", "queries": [...] }`: script dùng `langRestrict=en`, chỉ nhận `volumeInfo.language === 'en'` và ghi `books.language = 'en'`. Mọi danh mục khác chỉ nhận tiếng Việt. Dry-run tự bỏ sách đã có trong DB (ISBN hoặc tên + tác giả đầu) trước pha 2 để tiết kiệm quota. Sách đã có (theo ISBN) bị bỏ qua hoàn toàn, nên chạy lại bao nhiêu lần cũng an toàn và không đè giá, tồn kho hay chỉnh sửa trong admin. Ngoại lệ: sách đã có mà chưa có tác giả nào (lần chạy trước bị ngắt) sẽ được gắn lại tác giả. Hệ quả: ảnh bìa chỉ chọn được một lần lúc import, muốn đổi thì sửa trong admin.
- Google Books không có giá bán lẻ VN, nên `price`, `original_price`, `stock` được sinh ổn định theo ISBN (chạy lại vẫn ra cùng giá). Có giá thật thì ghi đè trong admin.
- Ảnh bìa **không hotlink** Google. Dry-run ghi 2 URL vào preview: `cover_small` (~128px, từ kết quả search) và `cover_large` (từ endpoint chi tiết, chỉ khi `--hires-covers`). Lúc ghi DB, script tải ảnh lớn; nếu tải lỗi hoặc là PNG < 40KB (thường là trang lót toàn chữ, không phải bìa) thì dùng ảnh nhỏ. Sau đó dùng `sharp` (có sẵn theo Next) thu về WebP rộng 600px (ảnh nhỏ giữ nguyên cỡ), upload `book-covers/<isbn>.webp` rồi ghi public URL vào `cover_url`. `images.remotePatterns` chỉ cho host Storage của project, đường dẫn `book-covers`.
- `mapVolume` chỉ giữ sách có `volumeInfo.language === 'vi'` (`langRestrict` của API không đủ chặt), chuẩn hóa chuỗi (title, subtitle, authors, publisher, description) bằng `normalizeText` và loại sách có `¿`/`�` trong tên. `normalizeText` = NFD → đưa dấu mũ/trăng (U+0302/U+0306) lên trước dấu thanh → NFC; chỉ NFC không sửa được "Nguyẽ̂n" vì hai dấu cùng combining class 230.
- **Giới hạn của Google Books với sách Việt** (đo ngày 2026-10-14): rất ít sách Việt có ISBN (mẫu: 11–15/20 kết quả thiếu ISBN), nên mỗi trang 20 kết quả chỉ ra khoảng 3 sách dùng được. Đã bỏ `intitle:` và `subject:` vì kết hợp với `langRestrict=vi` cho kết quả không ổn định (thường ra 0). Catalog hiện có 189 sách (lượt C: 49, lượt A + D: 140, chi tiết và danh sách sách đã loại trong `docs/plans/data.md`); lượt mở rộng dùng từ khóa trơn + `inauthor:`/`inpublisher:`.
- Bìa mờ (< 300px) thay bằng bìa Open Library qua `scripts/covers.ts` (một request / ISBN, giãn ≥ 3.5 giây, dừng khi 403 / 429; chỉ đụng bìa tên `<isbn>.webp` của import; ghi tên mới `ol-<isbn>-<8 hex>.webp`). Điều khoản + kết quả lượt 2026-10-16 trong `docs/plans/data.md`; footer ghi nguồn Open Library. Chạy trước khi build / deploy (script không gọi được `updateTag`).
- Bìa "ảnh lớn" của Google có thể chỉ rộng 128px, hoặc là trang lót dạng JPEG (bộ lọc PNG < 40KB không bắt được). Sau import nên xem lại bìa; bìa sai thì thay trong admin (Phase 7).
- `description_en` để trống thì fallback về tiếng Việt. Có thể bổ sung bằng script riêng sau.
- Dữ liệu từ nguồn ngoài có thể bẩn (thiếu mô tả, tên NXB không thống nhất, HTML lẫn trong mô tả). UI phải chịu được trường hợp thiếu field. Chuẩn hóa ở script, không chuẩn hóa ở UI.

## Design system: "Phòng đọc về đêm"

Lấy cảm hứng từ không khí tối giản, tĩnh, tập trung của make10000hours.com, chuyển thể thành một nhà sách: không gian tối như phòng đọc ban đêm, nơi **ảnh bìa sách là nguồn màu chính**, giao diện lùi về sau. Đối lập có chủ đích với kiểu nhà sách nhồi nhét banner: ít thành phần trên một màn hình, nhiều khoảng thở, không có chữ chạy, không có hiệu ứng nhấp nháy.

**Màu**: chỉ định nghĩa ở **một chỗ** (CSS variables trong `src/app/globals.css`, map vào Tailwind bằng `@theme inline`). Component chỉ dùng token ngữ nghĩa (`bg-surface`, `text-muted-foreground`, `bg-primary`…), không bao giờ dùng mã hex.

Tên token theo **quy ước shadcn** để thêm component không phải sửa tay. Chú ý hai chỗ dễ nhầm: `accent` và `muted` của shadcn là **nền hover** (= `surface-raised`), **không** phải màu nhấn; màu nhấn là `primary`.

> TODO: các mã hex dưới đây là bản đề xuất theo tinh thần dark-minimal của make10000hours.com. Thay bằng mã màu thật của trang đó (DevTools → Inspect → color picker) để bám sát. Đổi xong thì kiểm tra lại tương phản ≥ 4.5:1 cho chữ.

| Token | Dark (mặc định) | Light | Dùng cho |
|---|---|---|---|
| `background` | `#0B0B0C` | `#F7F5F0` | nền trang |
| `foreground` | `#EDEDED` | `#1C1917` | chữ chính |
| `surface` | `#141416` | `#FFFFFF` | card, panel |
| `surface-raised` | `#1C1C1F` | `#EFEBE3` | hover, dropdown, input |
| `primary` | `#F2B66D` | `#9A5B14` | màu "đèn đọc sách": CTA, giá, link |
| `primary-foreground` | `#1A1206` | `#FFFFFF` | chữ trên nền primary |
| `muted-foreground` | `#A3A3A3` | `#57534E` | chữ phụ, tác giả |
| `subtle` | `#8A8A8A` | `#6B6560` | meta, placeholder |
| `sale` | `#F87171` | `#C2410C` | nhãn giảm giá |
| `success` | `#4ADE80` | `#15803D` | trạng thái thành công |
| `border` | `rgb(255 255 255 / 0.08)` | `rgb(0 0 0 / 0.10)` | viền 1px |
| `input` | `rgb(255 255 255 / 0.14)` | `rgb(0 0 0 / 0.16)` | viền ô nhập |
| `qr`, `qr-background` | `#000000`, `#FFFFFF` | như dark | mã VietQR (app ngân hàng cần module tối trên nền sáng) |

Alias (không có giá trị riêng, trỏ về token ở trên):

| Token shadcn | Trỏ về |
|---|---|
| `card`, `popover` | `surface` (chữ: `foreground`) |
| `accent`, `muted`, `secondary` | `surface-raised` (chữ: `foreground`) |
| `ring` | `primary` |
| `destructive` | `sale` |

Tất cả cặp chữ/nền ở trên đã đạt ≥ 4.5:1. Chỉ dùng **một** màu nhấn (`primary`). Không thêm gradient sặc sỡ.

**Typography**
- UI và nội dung: **Be Vietnam Pro** (400/500/600).
- Tiêu đề lớn, tên sách ở trang chi tiết, trích dẫn: **Lora** (serif, 500/600), tạo chất "sách".
- Thang chữ: 12 / 14 / 16 (body) / 18 / 20 / 24 / 32 / 48. Line-height body 1.6, tiêu đề 1.2. Đoạn mô tả sách tối đa ~68 ký tự/dòng.

**Không gian & hình khối**
- Spacing theo bội số của 4px. Section cách nhau 64–96px trên desktop, 40–56px trên mobile.
- Radius: 6px (input, badge), 10px (card), 14px (modal, sheet). Ảnh bìa radius 4px.
- Không dùng shadow nặng. Chiều sâu tạo bằng chênh lệch giữa `surface` và `surface-raised` cộng border 1px. Ở dark mode, bìa sách khi hover có glow nhẹ (`shadow-glow`: `primary` ở opacity rất thấp, light mode không có).

**Chuyển động**: 150–250ms, `ease-out`. Card hover nâng lên 2px. Trang chuyển mượt, không bounce. Tắt hết khi `prefers-reduced-motion`.

**Thành phần chính**
- **Safe-area**: chỉ thành phần `fixed` sát cạnh màn hình (bong bóng / tấm chat) dùng `env(safe-area-inset-*)`, kèm `max()` với khoảng cách token (VD `bottom-[max(1rem,env(safe-area-inset-bottom))]`). Không đổi `viewport-fit` của cả site.
- **Header**: sticky, nền `background` mờ 80% + `backdrop-blur`, cao 64px. Chứa logo, ô tìm kiếm ở giữa (mở command palette với `⌘K`/`Ctrl K`), ngôn ngữ, theme, giỏ hàng, tài khoản.
- **BookCard**: ảnh bìa tỉ lệ 2:3, tên sách tối đa 2 dòng, tác giả màu `muted-foreground`, giá màu `primary`, giá gốc gạch ngang màu `subtle`, nhãn `-X%` nhỏ màu `sale`. Hết hàng thì ảnh bìa giảm opacity kèm nhãn.
- **Kệ sách (Shelf)**: hàng ngang cuộn được (scroll-snap), có tiêu đề cùng link "Xem tất cả", nút trước / sau từ `md` (`ShelfNav`, client leaf, chỉ hiện khi kệ tràn). Đây là đơn vị bố cục chính của trang chủ.
- **Trang chủ**: hero tối giản (một câu trích dẫn về đọc sách bằng Lora + 1 CTA → Tất cả sách `/sach`), sau đó là các kệ Nổi bật (`is_featured`, ẩn khi < 4), Bán chạy (`sold_count > 0`, ẩn khi < 6), Mới về (chỉ sách tiếng Việt), Sách ngoại văn, rồi lưới danh mục (`getHomeShelves`).
- **Trang sách**: bìa lớn bên trái (sticky trên desktop), thông tin bên phải. Nút "Thêm vào giỏ" là CTA `primary` duy nhất trên màn hình.
- **Lưới**: 2 cột (mobile), 3 (sm), 4 (md), 5–6 (lg+).
- Mọi trạng thái loading/rỗng/lỗi đều có thiết kế riêng, không để trang trắng.

Dark mode là mặc định (`defaultTheme="dark"`), light mode là tùy chọn và vẫn dùng cùng bộ token.

## Bảo mật

- **Claude KHÔNG mở, đọc hay sửa `.env.local`**, kể cả khi nghi nó sai. Thay vào đó chạy `npm run check:env` (`scripts/check-env.mjs`, chỉ báo biến thiếu/sai định dạng, không in giá trị) rồi báo để tôi tự sửa.
- **Không tạo link (hard link / symlink) hay bản copy của `.env.local`** cho worktree hay bất cứ chỗ nào khác mà không hỏi tôi trước. Worktree cần env để build / `next start` thì dừng lại hỏi.
- Chỉ dùng `npm run check:env` để kiểm tra env. **Không** viết script nào khác đọc env (kể cả script tạm/debug rồi xóa, kể cả qua `loadEnvConfig` của `@next/env`). Script của dự án cần env (`import:books`, `scripts/e2e-user.ts` ở Phase 4) chỉ được viết khi đã có trong plan đã duyệt (ngoại lệ này đã được duyệt).
- **Ngoại lệ đã duyệt (2026-10-17)**: `scripts/e2e-env.ts` đọc khóa của **Supabase local** qua `supabase status -o env` (khóa demo của stack Docker, không phải bí mật), với điều kiện: **không đọc file env nào** và **từ chối mọi URL không phải `127.0.0.1` / `localhost`** (kể cả production `ylfgwcxddxvfxwldmwtf`). Không in giá trị. e2e vì vậy không cần secret trên GitHub; khóa thật (production) vẫn không bao giờ đặt lên GitHub.
- **Ngoại lệ (Phase 11, chủ dự án duyệt 2026-10-18)**: `GEMINI_API_KEY` và `CHAT_QUOTA_TOKEN` là khóa bí mật **chỉ ở server**, được đặt trên **Vercel** (chỉ Production) vì chatbot không chạy được nếu thiếu. Không tiền tố `NEXT_PUBLIC_`, không đặt lên GitHub (CI dùng AI giả `CHAT_AI_MOCK=1` + token e2e cố định), không đọc trong `scripts/`. Project Google của key **không gắn billing** (chi phí = 0). Lộ key → thu hồi ở AI Studio; lộ token → chạy lại `private.new_chat_quota_token()` rồi cập nhật env.
- `.env.local` không commit. Client chỉ được dùng URL và anon/publishable key. `SUPABASE_SERVICE_ROLE_KEY` chỉ dùng trong `scripts/` chạy local, **không bao giờ** import vào `src/`.
- `/admin` kiểm tra `role = 'admin'` ở server (proxy và layout), không chỉ ẩn ở UI. Mọi Server Action admin tự kiểm tra ở hai câu đầu: `const denied = await assertAdmin(); if (denied) return denied` (Server Action gọi thẳng được bằng action ID, không qua layout / proxy; test tĩnh `features/admin/actions.test.ts`).
- Validate mọi input ở server, kể cả khi client đã validate.
- Tên và logo là của riêng dự án, không mượn nhận diện của nhà sách có thật. Một trang có form thanh toán mà trông giống thương hiệu thật rất dễ bị trình duyệt hoặc Vercel gắn cờ phishing khi deploy.

## Cách làm việc

- Tính năng lớn: đưa plan ngắn (file sẽ tạo/sửa, quyết định quan trọng) → chờ tôi duyệt → code.
- Việc nhỏ, rõ ràng: làm luôn.
- Có nhiều cách làm: nêu trade-off ngắn gọn rồi đề xuất một cách.
- Thấy vấn đề trong code hiện có (bug, rủi ro bảo mật, hiệu năng) thì báo, dù không nằm trong yêu cầu.
- Không viết lại phần đang chạy ổn nếu tôi không yêu cầu.
- Cuối mỗi task: đưa danh sách file đã đổi và một commit message (Conventional Commits).

## Lộ trình

1. Setup: Next + Tailwind token + shadcn + next-intl + next-themes + Supabase + middleware → chạy `schema.sql`, `seed.sql`, `import:books`
2. Layout: Header, Footer, LocaleSwitcher, ThemeToggle, command palette tìm kiếm
3. Catalog: danh mục, trang sách, tác giả, tìm kiếm, filter/sort qua URL
4. Auth + sổ địa chỉ
5. Giỏ hàng (guest + user, optimistic) → Checkout COD → trang đặt hàng thành công
6. Tài khoản: đơn hàng, chi tiết, hủy đơn
7. Admin: sách (upload bìa, nhập `*_en`), danh mục, tác giả, đơn hàng, voucher
8. Trang chủ hoàn chỉnh với các kệ
9. Đánh giá, voucher ở checkout, VietQR (khách **không** tự hủy được đơn đã thanh toán `payment_status = 'paid'` vì chưa có quy trình hoàn tiền: migration cho `cancel_order` kiểm tra `payment_status`; UI đã ẩn nút hủy qua `canCancel` từ Phase 6; **cùng migration đó** thêm quyền cột cho `vouchers`: `revoke update` + `grant update (…)` chỉ các cột form admin sửa, bỏ `used_count` (do `place_order` / trigger hủy đơn quản lý, đều `security definer`) và `created_at`, để admin gọi thẳng PostgREST không sửa được lượt dùng), email theo locale; link trong email (xác nhận, đặt lại mật khẩu) trỏ tới trang trung gian có nút "Xác nhận" (POST) thay vì GET `/api/auth/confirm` tiêu thụ token ngay, chống trình quét link (Outlook Safe Links…) dùng mất token
10. SEO (sitemap, hreflang, OG image, JSON-LD), ISR fallback đúng cho slug tạo sau build (trang sách / danh mục / tác giả đang dùng `instant = false` từ Phase 7a vì App Shell cho tham số chưa biết trả 500: đọc `params` trong `<Suspense>`, header không chặn App Shell, rồi bỏ `instant = false`), 404 thật cho slug không tồn tại / `page` vượt quá (hiện trả UI 404 + `noindex` nhưng HTTP 200 vì Cache Components stream trước khi `notFound()` chạy; hướng xử lý: kiểm tra trong `proxy.ts`), test e2e luồng mua hàng, e2e song song trên CI có thể chọn trùng sách giữa các spec (VD test hủy đơn của `orders.spec` hạ tồn kho một cuốn xuống 3, rơi vào khoảng 2–5 mà `checkout.spec` chọn) → tách dữ liệu test (sách e2e riêng) hoặc khóa theo sách, đo Lighthouse, deploy
