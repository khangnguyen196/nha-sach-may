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
npx playwright test --project=desktop --project=mobile    # e2e catalog/layout, không cần SUPABASE_SERVICE_ROLE_KEY
npx playwright test --project=desktop-admin --project=mobile-admin   # e2e admin (cần SUPABASE_SERVICE_ROLE_KEY)
```

`test:e2e` đầy đủ gồm cả project `desktop-account` / `mobile-account`: setup tạo user test bằng admin API (`scripts/e2e-user.ts`) nên **cần `SUPABASE_SERVICE_ROLE_KEY`** trong `.env.local`.

Quy ước e2e:
- Spec cần user khớp `ACCOUNT_SPECS` trong `playwright.config.ts` (`(account|checkout|orders|error-page).spec.ts`); spec mới cần user thì thêm vào regex. Spec admin là `admin-*.spec.ts` (`ADMIN_SPECS`, loại khỏi mọi project khác; `admin-orders.spec.ts` khớp cả `orders.spec.ts`), chạy ở `desktop-admin` (mobile chỉ `admin-smoke`), phiên admin qua `adminTest` (`e2e/admin.ts`); user admin do cùng setup tạo (`makeAdmin`). Mỗi project có 3 user riêng: chính, checkout, orders (không giẫm giỏ / đơn của nhau khi chạy song song: `checkout.spec` xóa mọi đơn của user checkout sau mỗi test).
- Test làm đổi trạng thái không quay lại được (đổi mật khẩu…) tự tạo user riêng cho mỗi lần chạy và xóa ở `finally`: retry trên CI / `--repeat-each` phải qua.
- Locator đặt trong `<main>` (`page.getByRole('main')…`) khi trang có Suspense stream: ngay sau hydrate, React có thể còn giữ bản sao ẩn của boundary (`<div hidden id="S:…">` cuối body).
- Đặt hàng thật trên sách thật: dọn bằng `cancelAndDeleteOrders` trước khi xóa user. Đơn chưa giao: hủy để trigger hoàn kho rồi xóa; đơn `delivered`: tự hoàn kho rồi xóa (trigger chặn `delivered → cancelled` với mọi role, kể cả service role).
- Dữ liệu test admin: sách / danh mục / tác giả slug `e2e-admin-…` (voucher `E2E-ADMIN-…`), tạo bằng service role, không sửa dữ liệu thật. Spec dọn bằng `cleanupE2eAdminData(slugs)` đúng slug của mình (bản không tham số xóa mọi dữ liệu e2e-admin, chỉ setup / teardown gọi: spec khác chạy song song). Danh mục test: gốc ẩn + con đang hiện (có trang danh mục, không lên menu). Danh mục tạo bằng service role không làm mới cache danh mục của Next → lưu lại một danh mục qua admin trước khi mở trang danh mục công khai. `findBooksByStock*` bỏ sách slug `e2e-…`.
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
    books/  cart/  checkout/  orders/  account/  reviews/  admin/
      components/  actions.ts  queries.ts  schemas.ts  types.ts
  components/ui/       # shadcn primitives
  components/layout/   # Header, Footer, LocaleSwitcher, ThemeToggle
  components/admin/    # AdminLink, khung admin, ShopLink, bảng / form dùng chung của admin
  lib/                 # supabase/{server,client,public,env}.ts, i18n-db.ts, errors.ts, utils.ts
  types/database.ts
  proxy.ts             # (Next 16, thay middleware.ts) — refresh session Supabase rồi next-intl; /admin bỏ qua next-intl
messages/vi.json  messages/en.json
supabase/schema.sql  seed.sql  migrations/
scripts/import-books.ts  book-list.json   # công cụ nạp dữ liệu, chạy local
e2e/                   # Playwright
```

- `lib/supabase/server.ts`: client theo phiên (đọc cookies) → chỉ dùng trong `<Suspense>`. `lib/supabase/public.ts`: client anon không cookies → dùng cho query catalog trong `'use cache'`.
- Locale ở server lấy từ `next/root-params` (`i18n/request.ts`), API ổn định từ Next 16.3, không cần cờ experimental. Nhờ vậy không cần `setRequestLocale`, trang vẫn prerender được, và `getTranslations()` gọi được trong `'use cache'` (locale tự vào cache key). `/admin` không có `[locale]` → mặc định `vi`.
- **Server Action không đọc được `next/root-params`** → không gọi `getLocale()` hay `getTranslations()` không kèm locale trong action. Page bind locale sẵn (`action.bind(null, locale)`), action parse lại bằng `parseLocale` (tham số bind đi qua client). Action trả mã lỗi; chuỗi đã dịch xuống form qua props (`getFormMessages`). Lỗi có tham số ICU (`OUT_OF_STOCK`: title, stock) thì action dịch sẵn bằng `withMessage(locale, failure)` (`lib/error-message.ts`, dùng `getTranslations({ locale })` — chạy được trong action) và client hiện `failure.message`.
- **Proxy và Route Handler** không import `i18n/navigation.ts` (`getPathname` kéo theo `i18n/request.ts` → `next/root-params`, không build được ở đó): dùng `localizedPath` trong `i18n/paths.ts`.
- Đọc phiên: `getCurrentUser()` (`lib/auth.ts`, `getClaims()` + `await io()` trước đó vì Supabase so hạn token bằng `Date.now()`), luôn trong `<Suspense>`. Trang cần đăng nhập dùng `requireUser(locale, href)`. Redirect bằng giá trị lấy từ URL (`?next=`) phải qua `safeNextPath`.
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
- Form gửi Server Action dùng `useFormAction` (`lib/use-form-action.ts`): giữ progressive enhancement, bỏ qua submit khi đang gửi, lỗi mạng → `UNKNOWN` trong khối lỗi của form (không lên error boundary).
- Tiền tạm tính ở giỏ/checkout (subtotal, ship, giảm giá, mốc freeship) lấy từ RPC `quote_order` (giỏ khách: `quote_items`), không tự tính ở client.

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
  | `/sach/[slug]` | `/en/books/[slug]` |
  | `/tac-gia/[slug]` | `/en/authors/[slug]` |
  | `/tim-kiem` | `/en/search` |
  | `/gio-hang` | `/en/cart` |
  | `/thanh-toan` | `/en/checkout` |
  | `/tai-khoan` | `/en/account` |

  Slug của sách, danh mục, tác giả dùng chung cho cả hai ngôn ngữ.
- Luôn dùng `Link`, `redirect`, `useRouter`, `usePathname` từ `i18n/navigation.ts`, không import từ `next/link` hay các hàm tương ứng của `next/navigation` (ESLint chặn). Hàm next-intl không bọc (`notFound`, `useParams`, `useSearchParams`) thì import từ `next/navigation` bình thường.
- **Ngoại lệ — `LocaleSwitcher`** dùng `<a>` thường với `href` tính bằng `getPathname` (từ `i18n/navigation.ts`), không dùng `Link`: `Link` có prop `locale` luôn ép prefix kể cả locale mặc định, nên en→vi ra `/vi?x=1` và client nav giữ nguyên URL không canonical đó (proxy không kịp chuyển về `/?x=1`). `getPathname` không ép prefix. Đổi ngôn ngữ vì vậy là tải lại cả trang, chấp nhận được vì mọi nội dung đều đổi. Chỗ này có `eslint-disable-next-line no-restricted-syntax` kèm comment; ngoài ra không chỗ nào khác được dùng `<a href={…}>` cho link nội bộ, trừ admin trỏ ra cửa hàng (`ShopLink`, link "Về cửa hàng", `admin/error.tsx`: admin là root layout khác, không có provider của next-intl).
- **Admin** (`app/admin`, không có `[locale]`, URL tiếng Việt viết thẳng): link nội bộ qua `AdminLink` (`components/admin/admin-link.tsx`, kiểu `AdminHref` chỉ nhận `/admin…`), `redirect` / `usePathname` lấy từ `next/navigation` (ESLint cho phép trong `app/admin`, `components/admin`, `features/admin`).
- `messages/vi.json` và `en.json` chia namespace theo feature (`common`, `book`, `cart`, `checkout`, `account`, `errors`…). Bật type-safe cho message keys. Hai file phải luôn **cùng bộ key**: có test so sánh, thiếu key thì fail. **Ngoại lệ**: namespace `admin` chỉ có trong `vi.json` (admin chỉ tiếng Việt, không có `[locale]`); test so key bỏ qua namespace này, kiểu message key vẫn lấy từ `vi.json`. Mã lỗi (`errors`) dùng chung `ERROR_CODES` nên mã mới của admin vẫn phải có ở cả hai file.
- Messages được biên dịch lúc build (`experimental.messages.precompile` của plugin next-intl trong `next.config.ts`) → client không kéo `intl-messageformat` (~9KB gzip). Đây là API **experimental**: mỗi lần nâng next-intl phải kiểm tra lại (changelog, build, `measure:js`, e2e). Client leaf nhận chuỗi đã dịch qua props; chỉ palette (tải lười) dùng `useTranslations`, nên `NextIntlClientProvider` chỉ truyền namespace `search`.
- Trang lỗi: `error.tsx` là client component và không nhận props từ server → layout (`[locale]/layout.tsx`, `admin/layout.tsx`) dịch sẵn namespace `errorPage` và truyền qua `ErrorMessagesProvider`; `error.tsx` đọc bằng `useErrorMessages()`. `global-error.tsx` thay cả root layout nên dùng bản chép `i18n/global-error-messages.ts` (Vitest kiểm tra khớp `errorPage` và `localizedPath('/')`): sửa chuỗi ở `messages/*.json` thì chép sang. UI lỗi không hiện `error.message` / `digest`; Next log lỗi ở server.
- Chuỗi có giá trị chỉ biết ở client (tên sách của giỏ khách, số trên badge, số tiền còn thiếu để freeship): server dịch sẵn và giữ chỗ trống, `t('removeLabel', { title: placeholder('title') })`, client điền bằng `fillTemplate` (`lib/template.ts`). Chỉ cho tham số đơn giản, không dùng với plural/select → câu tiếng Anh viết sao cho không cần số nhiều ("Cart, items: {count}").
- **Dữ liệu DB**: cột gốc là tiếng Việt, cột `*_en` là tiếng Anh (`name_en`, `description_en`, `bio_en`…). Dùng một helper duy nhất `localize(row, 'name', locale)` trong `lib/i18n-db.ts` để fallback `*_en` → cột gốc khi null. **Tên sách không dịch.**
- Giá luôn tính bằng VND ở cả hai ngôn ngữ, format qua formatter của next-intl theo locale (vi: `98.000 ₫`, en: `₫98,000`). Ngày tháng cũng format qua formatter.
- Lỗi từ DB/RPC là **mã** (`OUT_OF_STOCK`, `INVALID_VOUCHER`…, danh sách ở cuối `schema.sql`). `lib/errors.ts` map mã sang `errors.<CODE>`; thông tin chi tiết lấy từ `error.details` (JSON).
- SEO: `generateMetadata` theo locale, `alternates.languages` (hreflang) cho mỗi trang, sitemap có cả hai locale.
- `LocaleSwitcher` giữ nguyên trang hiện tại và params khi đổi ngôn ngữ. Lưu `profiles.locale` khi user đổi (dùng cho email).

## Database

Nguồn sự thật là `supabase/schema.sql`. Đổi schema thì viết migration trong `supabase/migrations/`, cập nhật `schema.sql`, sinh lại types.

- Tiền là `integer` VND.
- RLS bật cho mọi bảng. Không tắt RLS, không dùng service role trong app.
- Cột do DB quản lý (trigger/RPC), không ghi từ app: `search_text`, `sold_count`, `avg_rating`, `review_count`, `display_name`, `updated_at`.
- Quyền cột (migration `admin.sql`): `orders` chỉ update được `status`, `payment_status`, `cancelled_reason`; `books` không update được cột do DB quản lý. Admin thêm ô sửa cột mới của `books` → thêm cột vào `grant update (…)`.
- Luồng trạng thái đơn chặn ở trigger `handle_order_status_change` (mọi role, kể cả service role; bảng chuyển trong `private.order_status_transition_allowed`): `pending → confirmed → shipping → delivered`, hủy được từ 3 trạng thái đầu; `delivered`, `cancelled` là trạng thái cuối (`ORDER_INVALID_TRANSITION`, `ORDER_REOPEN_FORBIDDEN`). COD chuyển `delivered` → `payment_status = 'paid'`.
- Bucket `book-covers` chỉ nhận `image/webp` ≤ 1MB. Ảnh bìa qua `toCoverWebp` (`lib/cover-image.ts`, dùng chung import và admin); admin lưu tên mới mỗi lần (`<book_id>-<8 hex>.webp`, ảnh cũ bị CDN cache 1 năm), chỉ xóa ảnh cũ khi không đơn nào còn trỏ tới (`order_items.cover_url`).
- RPC cho app: `search_books`, `quote_order`, `quote_items`, `place_order`, `cancel_order`, `set_default_address`, `merge_cart` (danh sách + mã lỗi ở cuối `schema.sql`). Hàm nội bộ nằm trong schema `private`, không lộ ra API.
- Tìm kiếm qua RPC `search_books(q)`: gõ không dấu, khớp từng từ không cần đúng thứ tự. Phân trang bằng `.range()` + `count: 'exact'` (`estimated` trên RPC không chính xác).
- Sách chỉ gắn vào danh mục lá. Trang danh mục cha lọc `category_id in (<id các danh mục con>)`.
- Địa chỉ 2 cấp: Tỉnh/Thành phố → Phường/Xã. Đổi địa chỉ mặc định qua RPC `set_default_address`.
- Phí ship: 30.000₫, miễn phí từ 300.000₫ (hằng số trong `private.flat_shipping_fee()` / `private.free_ship_from()`). UI lấy mốc freeship từ `quote_order` (giỏ tài khoản) / `quote_items` (giỏ khách, cấp cho anon, nhận danh sách `{book_id, quantity}` như `merge_cart`), không hard-code.
- `reviews`: client chỉ ghi được `rating`, `content` (column grant); `user_id` tự lấy từ phiên đăng nhập.

## Dữ liệu

- `seed.sql` chỉ chứa danh mục và voucher. Sách, tác giả, NXB là **dữ liệu thật**, nạp bằng `npm run import:books` từ Google Books API: tên, tác giả, NXB, ISBN, năm xuất bản, số trang, mô tả, ảnh bìa.
- Quy trình import: `--dry-run` (có/không `--hires-covers`, ghi ra 2 file riêng) → mở file xem/sửa → `--from-preview <file>` để ghi DB. Không import thẳng từ Google Books: quota Books API ~1.000 request/ngày (cần `GOOGLE_BOOKS_API_KEY`, quota ẩn danh thường đã hết), và dữ liệu vào DB phải đúng bản đã duyệt. `--from-preview` validate lại file (zod, cùng ràng buộc với DB) trước khi ghi.
- Muốn thêm sách: sửa `scripts/book-list.json` rồi chạy lại quy trình trên. Định dạng: danh mục lá → mảng truy vấn; mỗi truy vấn là chuỗi (1 request) hoặc `{ "q": "...", "pages": n }` (n request; API trả ≤ 20 cuốn/trang dù xin 40; dừng sớm khi hết kết quả). Cú pháp dùng được với sách tiếng Việt: từ khóa trơn (`tiếng Anh`, `Nam Cao`) hoặc **một** toán tử `inauthor:`/`inpublisher:` đứng đầu + từ trơn (`inauthor:Nguyễn Nhật Ánh`, `inpublisher:Kim Đồng truyện`). **Không** dùng ngoặc kép (`inauthor:"…"` có dấu → 0 kết quả), **không** lặp toán tử cho từng từ (→ 0), **không** dùng `intitle:` / `subject:` (với `langRestrict=vi` thường ra 0). Ước tính quota: số trang search + số sách thu được (nếu `--hires-covers`); `--max-requests` (mặc định 900) chặn trên. Danh mục sách tiếng Anh (nhánh "Sách ngoại văn", `supabase/seed-foreign-books.sql`) khai báo dạng `{ "language": "en", "queries": [...] }`: script dùng `langRestrict=en`, chỉ nhận `volumeInfo.language === 'en'` và ghi `books.language = 'en'`. Mọi danh mục khác chỉ nhận tiếng Việt. Dry-run tự bỏ sách đã có trong DB (ISBN hoặc tên + tác giả đầu) trước pha 2 để tiết kiệm quota. Sách đã có (theo ISBN) bị bỏ qua hoàn toàn, nên chạy lại bao nhiêu lần cũng an toàn và không đè giá, tồn kho hay chỉnh sửa trong admin. Ngoại lệ: sách đã có mà chưa có tác giả nào (lần chạy trước bị ngắt) sẽ được gắn lại tác giả. Hệ quả: ảnh bìa chỉ chọn được một lần lúc import, muốn đổi thì sửa trong admin.
- Google Books không có giá bán lẻ VN, nên `price`, `original_price`, `stock` được sinh ổn định theo ISBN (chạy lại vẫn ra cùng giá). Có giá thật thì ghi đè trong admin.
- Ảnh bìa **không hotlink** Google. Dry-run ghi 2 URL vào preview: `cover_small` (~128px, từ kết quả search) và `cover_large` (từ endpoint chi tiết, chỉ khi `--hires-covers`). Lúc ghi DB, script tải ảnh lớn; nếu tải lỗi hoặc là PNG < 40KB (thường là trang lót toàn chữ, không phải bìa) thì dùng ảnh nhỏ. Sau đó dùng `sharp` (có sẵn theo Next) thu về WebP rộng 600px (ảnh nhỏ giữ nguyên cỡ), upload `book-covers/<isbn>.webp` rồi ghi public URL vào `cover_url`. `images.remotePatterns` chỉ cho host Storage của project, đường dẫn `book-covers`.
- `mapVolume` chỉ giữ sách có `volumeInfo.language === 'vi'` (`langRestrict` của API không đủ chặt), chuẩn hóa chuỗi (title, subtitle, authors, publisher, description) bằng `normalizeText` và loại sách có `¿`/`�` trong tên. `normalizeText` = NFD → đưa dấu mũ/trăng (U+0302/U+0306) lên trước dấu thanh → NFC; chỉ NFC không sửa được "Nguyẽ̂n" vì hai dấu cùng combining class 230.
- **Giới hạn của Google Books với sách Việt** (đo ngày 2026-10-14): rất ít sách Việt có ISBN (mẫu: 11–15/20 kết quả thiếu ISBN), nên mỗi trang 20 kết quả chỉ ra khoảng 3 sách dùng được. Đã bỏ `intitle:` và `subject:` vì kết hợp với `langRestrict=vi` cho kết quả không ổn định (thường ra 0). Catalog hiện có 49 sách (lượt C); lượt mở rộng dùng từ khóa trơn + `inauthor:`/`inpublisher:`.
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
- **Header**: sticky, nền `background` mờ 80% + `backdrop-blur`, cao 64px. Chứa logo, ô tìm kiếm ở giữa (mở command palette với `⌘K`/`Ctrl K`), ngôn ngữ, theme, giỏ hàng, tài khoản.
- **BookCard**: ảnh bìa tỉ lệ 2:3, tên sách tối đa 2 dòng, tác giả màu `muted-foreground`, giá màu `primary`, giá gốc gạch ngang màu `subtle`, nhãn `-X%` nhỏ màu `sale`. Hết hàng thì ảnh bìa giảm opacity kèm nhãn.
- **Kệ sách (Shelf)**: hàng ngang cuộn được (scroll-snap), có tiêu đề cùng link "Xem tất cả". Đây là đơn vị bố cục chính của trang chủ.
- **Trang chủ**: hero tối giản (một câu trích dẫn về đọc sách bằng Lora + 1 CTA), sau đó là các kệ Nổi bật, Bán chạy, Mới về, rồi lưới danh mục.
- **Trang sách**: bìa lớn bên trái (sticky trên desktop), thông tin bên phải. Nút "Thêm vào giỏ" là CTA `primary` duy nhất trên màn hình.
- **Lưới**: 2 cột (mobile), 3 (sm), 4 (md), 5–6 (lg+).
- Mọi trạng thái loading/rỗng/lỗi đều có thiết kế riêng, không để trang trắng.

Dark mode là mặc định (`defaultTheme="dark"`), light mode là tùy chọn và vẫn dùng cùng bộ token.

## Bảo mật

- **Claude KHÔNG mở, đọc hay sửa `.env.local`**, kể cả khi nghi nó sai. Thay vào đó chạy `npm run check:env` (`scripts/check-env.mjs`, chỉ báo biến thiếu/sai định dạng, không in giá trị) rồi báo để tôi tự sửa.
- Chỉ dùng `npm run check:env` để kiểm tra env. **Không** viết script nào khác đọc env (kể cả script tạm/debug rồi xóa, kể cả qua `loadEnvConfig` của `@next/env`). Script của dự án cần env (`import:books`, `scripts/e2e-user.ts` ở Phase 4) chỉ được viết khi đã có trong plan đã duyệt (ngoại lệ này đã được duyệt).
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
9. Đánh giá, voucher ở checkout, VietQR (khách **không** tự hủy được đơn đã thanh toán `payment_status = 'paid'` vì chưa có quy trình hoàn tiền: migration cho `cancel_order` kiểm tra `payment_status`; UI đã ẩn nút hủy qua `canCancel` từ Phase 6), email theo locale; link trong email (xác nhận, đặt lại mật khẩu) trỏ tới trang trung gian có nút "Xác nhận" (POST) thay vì GET `/api/auth/confirm` tiêu thụ token ngay, chống trình quét link (Outlook Safe Links…) dùng mất token
10. SEO (sitemap, hreflang, OG image, JSON-LD), ISR fallback đúng cho slug tạo sau build (trang sách / danh mục / tác giả đang dùng `instant = false` từ Phase 7a vì App Shell cho tham số chưa biết trả 500: đọc `params` trong `<Suspense>`, header không chặn App Shell, rồi bỏ `instant = false`), 404 thật cho slug không tồn tại / `page` vượt quá (hiện trả UI 404 + `noindex` nhưng HTTP 200 vì Cache Components stream trước khi `notFound()` chạy; hướng xử lý: kiểm tra trong `proxy.ts`), test e2e luồng mua hàng, e2e song song trên CI có thể chọn trùng sách giữa các spec (VD test hủy đơn của `orders.spec` hạ tồn kho một cuốn xuống 3, rơi vào khoảng 2–5 mà `checkout.spec` chọn) → tách dữ liệu test (sách e2e riêng) hoặc khóa theo sách, đo Lighthouse, deploy
