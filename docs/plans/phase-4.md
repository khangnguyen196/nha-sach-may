# Phase 4: Auth + sổ địa chỉ

## Báo cáo (2026-10-15)

**Đã xong**: toàn bộ Phase 4 trên nhánh `phase-4` (chưa merge). Đăng ký / đăng nhập / đăng xuất / quên + đặt lại mật khẩu (thu hồi phiên khác), `/api/auth/confirm`, proxy chặn `/tai-khoan/*`, trạng thái đăng nhập ở header, trang tài khoản (ngôn ngữ email), sổ địa chỉ (thêm / sửa / xóa / đặt mặc định) với dữ liệu hành chính 34 tỉnh / 3.321 phường. Chi tiết ở mục Tiến độ.

**Việc của bạn**: làm theo "Việc của chủ dự án → Hướng dẫn từng bước" (URL Configuration, bật Confirm email, sửa 2 email template). e2e không phụ thuộc mấy bước này; chúng cần cho đăng ký / quên mật khẩu bằng tay. Lưu ý SMTP mặc định của Supabase chỉ gửi tới email thành viên organization.

**Quyết định tự chọn / lệch plan, cần duyệt**:
1. **Footer theo route group**: `<main>` + `Footer` chuyển từ `[locale]/layout.tsx` xuống `(shop)/layout.tsx`; `(auth)/layout.tsx` dùng `CompactFooter` (chỉ dòng bản quyền, đúng ý "không footer dày"); `not-found.tsx` tự dựng `<main>` + `Footer` vì boundary của nó nằm ngoài layout route group.
2. **Thêm mã lỗi `SAME_PASSWORD`** (Supabase trả `same_password` khi đặt lại trùng mật khẩu cũ) và **namespace `validation`** cho lỗi từng ô: message trong zod là khóa (`passwordMin`, `phone`…), `VALIDATION_KEYS` trong `lib/errors.ts` có test khớp vi/en như `ERROR_CODES`.
3. **Email template dùng `locale={{ .Data.locale }}` thay vì `next=`**: route chọn trang đích theo `type` (xác nhận → `/tai-khoan`, recovery → `/dat-lai-mat-khau`) đúng ngôn ngữ lúc đăng ký. `next` vẫn nhận (đã lọc bằng `safeNextPath`), e2e dùng.
4. **e2e: mỗi project thiết bị một cặp user** (`e2e+<rand>-desktop`, `-desktop-reset`, `-mobile`, `-mobile-reset`), `storageState` riêng `e2e/.auth/{desktop,mobile}.json` + `credentials.json`, thay cho một `user.json`. Lý do: trên CI hai project chạy song song, dùng chung user thì test sổ địa chỉ / đổi mật khẩu giẫm lên nhau. Setup/teardown là **project Playwright** (`dependencies`) thay cho `globalSetup` (cần browser + webServer, có trace). Hệ quả: **mọi lần chạy e2e (kể cả catalog) cần `SUPABASE_SERVICE_ROLE_KEY`**.
5. **Server Action không đọc được `next/root-params`** (docs Next 16) → `getLocale()`/`getTranslations()` không dùng được trong action. Locale do page bind sẵn (`signIn.bind(null, locale)`), action parse lại (`parseLocale`). Action trả **mã**; chuỗi lỗi đã dịch đi xuống form client qua props (`getFormMessages`), đúng quy ước client leaf không dùng `useTranslations`.
6. **`src/i18n/paths.ts` → `localizedPath()`** cho proxy và Route Handler: `getPathname` của `i18n/navigation` kéo theo `i18n/request.ts` (`next/root-params`) nên không build được ở hai nơi đó. Page / Server Action vẫn dùng `getPathname`. Có test.
7. **`useFormAction`** (`lib/use-form-action.ts`): `<form action>` của React 19 tự reset form sau khi action chạy → sai mật khẩu là mất email đã nhập. Hook dispatch trong `onSubmit` (có JS) để giữ dữ liệu; không JS thì form vẫn POST thẳng Server Action.
8. **`await io()` trong `getCurrentUser`** trước `getClaims()`: Partial Prefetching prerender App Shell theo phiên, gặp `Date.now()` (Supabase so hạn token) thì log lỗi "unstable value Date.now()" ở mọi route đọc phiên. `io()` dừng prerender ở đó, request thật thì resolve ngay. Sau sửa: 0 lỗi server trong toàn bộ e2e.
9. **`export const instant = false` ở trang sửa địa chỉ** (`[id]`): id không có `generateStaticParams` nên `LocaleSwitcher` (đọc `useParams`) làm build lỗi prerender. Trang riêng tư, render theo request là đủ.
10. **Xác nhận xóa bằng `<details>`** (không JS, bàn phím dùng được, không kéo dialog vào bundle) thay vì modal.
11. **`next` sau đăng nhập dùng `redirect` của `next/navigation`** (có `eslint-disable` + comment trong `features/auth/actions.ts`): `next` đã là URL hiển thị (`/tai-khoan/dia-chi`, `/en/account`), không phải pathname nội bộ nên không đi qua `redirect` của next-intl được.
12. Nhỏ: điện thoại chỉ nhận `0…` hoặc `+84…` (không nhận `84…` trơn), bỏ khoảng trắng / chấm / gạch; mật khẩu tối đa 72 (giới hạn bcrypt); chữ cái ở header lấy từ **tên** (từ cuối: "Nguyễn Văn An" → "A"); `signUp` gặp email đã có vẫn hiện "Kiểm tra hộp thư"; quên mật khẩu chỉ báo lỗi `RATE_LIMITED`, lỗi khác vẫn hiện "đã gửi" (không lộ email nào có tài khoản).

**Giới hạn / rủi ro đã biết**:
- Ô phường/xã nạp qua `fetch` khi đổi tỉnh → **không JS thì không chọn được phường ở form thêm mới** (form sửa vẫn có sẵn phường của tỉnh đã lưu). Mọi form khác chạy được không JS.
- Link xác nhận là GET và tiêu thụ token ngay: một số dịch vụ quét link trong email (Outlook Safe Links…) có thể "bấm" trước người dùng → link báo hết hạn. Cách xử lý phổ biến: trang trung gian có nút "Xác nhận" (POST). Đề xuất để Phase 9 (email theo locale).
- Phiên trên thiết bị khác chỉ hết hạn thật khi access token hết hạn (≤ 1 giờ), như đã ghi ở mục Auth.

**Bị chặn**: không. Không sửa schema, không chạy SQL, không mở `.env.local` (chỉ `check:env`), không thêm dependency. `scripts/e2e-user.ts` đọc env theo ngoại lệ đã duyệt.

**Kết quả kiểm tra** (lần chạy cuối, commit `9b96d01`):
- `typecheck`, `lint`, `build`: sạch.
- `test` (Vitest): 95/95 (thêm 47: divisions, schemas auth + địa chỉ, `safeNextPath`, map `AuthError.code`, `invalidInput`, `VALIDATION_KEYS`, `localizedPath`, `initialOf`).
- `test:e2e`: 68/68 (setup + teardown + 33 test × desktop/mobile, 1 worker), server không log lỗi nào. Riêng `account.spec.ts`: 13 test × 2.
- Kiểm tra tay trên preview: `/dang-nhap`, `/en/register` (dark, desktop), lỗi từng ô ở light + mobile 375px.

**Số đo JS** (`measure:js`, gzip, baseline 170KB):

| Route | Tổng | Ngoài baseline | Ghi chú |
|---|---|---|---|
| `vi/books/ban-van` cuối Phase 3 | 203.2KB | 33.2KB | |
| `vi/books/ban-van` trước khi đổi header | 203.5KB | 33.5KB | +0.3KB: bảng `pathnames` (8 route mới) + nhánh `[id]` của `LocaleSwitcher`, nằm trong config điều hướng client |
| `vi/books/ban-van` sau khi đổi header | 203.5KB | **33.5KB** | header: **+0KB** (Server Component trong Suspense) |
| `en/books/ban-van` | 203.5KB | 33.5KB | |
| `vi/login` | 199.8KB | 29.8KB | |

**Commit trên nhánh `phase-4`**:
- `5c96fbb` feat(account): administrative divisions data from pinned source
- `cbf00cc` feat(auth): auth routes, error codes, messages and server actions
- `90eec2e` feat(auth): login, register, password reset pages, email confirm route, proxy guards
- `28a9b2b` docs(phase-4): step-by-step Supabase Dashboard setup for auth emails
- `4789b58` feat(account): header sign-in state, account page, address book
- `9b96d01` test(e2e): account flows with per-project test users
- commit cuối: docs (báo cáo này)

**Đề xuất cập nhật CLAUDE.md** (chưa sửa, chờ bạn): thêm `npm run build:divisions` vào mục Lệnh; ghi 3 quy tắc mới: Server Action không đọc `next/root-params` (bind locale), proxy / Route Handler dùng `localizedPath` thay `getPathname`, e2e cần `SUPABASE_SERVICE_ROLE_KEY`.

---

Trạng thái: **đã xong trên nhánh `phase-4`, chưa merge** (2026-10-15). Plan đã duyệt: chọn hết các ★, sửa mục 5 (nguồn dữ liệu hành chính) và mục 8 (tài khoản e2e). Xem "Quyết định đã duyệt" ở cuối.

Phạm vi: đăng ký, đăng nhập, đăng xuất, quên/đặt lại mật khẩu, bảo vệ khu tài khoản, sổ địa chỉ (thêm / sửa / xóa / đặt mặc định), trạng thái đăng nhập ở header. Không có giỏ hàng và `merge_cart` (Phase 5), danh sách đơn hàng (Phase 6), email theo locale (Phase 9), captcha (Phase 10).

## Route

| Internal | vi | en |
|---|---|---|
| `(auth)/login/page.tsx` | `/dang-nhap` | `/en/login` |
| `(auth)/register/page.tsx` | `/dang-ky` | `/en/register` |
| `(auth)/forgot-password/page.tsx` | `/quen-mat-khau` | `/en/forgot-password` |
| `(auth)/reset-password/page.tsx` | `/dat-lai-mat-khau` | `/en/reset-password` |
| `(shop)/account/page.tsx` | `/tai-khoan` | `/en/account` |
| `(shop)/account/addresses/page.tsx` | `/tai-khoan/dia-chi` | `/en/account/addresses` |
| `(shop)/account/addresses/new/page.tsx` | `/tai-khoan/dia-chi/moi` | `/en/account/addresses/new` |
| `(shop)/account/addresses/[id]/page.tsx` | `/tai-khoan/dia-chi/[id]` | `/en/account/addresses/[id]` |
| `app/api/divisions/[province]/route.ts` | `/api/divisions/<mã tỉnh>` (không locale) | |
| `app/api/auth/confirm/route.ts` | `/api/auth/confirm` (không locale) | |

- Thêm các pathname trên vào `i18n/routing.ts`.
- `/api/auth/confirm`: link trong email xác nhận / đặt lại mật khẩu trỏ về đây (`token_hash` + `type` + `next`), gọi `supabase.auth.verifyOtp({ token_hash, type })`, ghi cookie phiên rồi redirect về `next` (đã kiểm tra là đường dẫn nội bộ). Đặt dưới `/api` vì `proxy.ts` bỏ qua `/api` (không bị next-intl rewrite sang `/vi/...`).
- `(auth)` có layout riêng tối giản (form giữa trang, không footer dày) nhưng vẫn dùng Header chung.

## Rendering & session

- Trang auth và tài khoản đọc cookies → phần đọc phiên nằm trong `<Suspense>` (Cache Components), static shell là tiêu đề + khung form.
- `lib/auth.ts`: `getCurrentUser()` = `React.cache` bọc `createClient()` (server, cookies) + `supabase.auth.getClaims()`; trả `{ id, email } | null`. Không dùng `getSession()` ở server (không xác thực chữ ký JWT).
- Bảo vệ `/tai-khoan/*`: proxy đã có claims sau bước refresh → chưa đăng nhập thì redirect sang trang đăng nhập đúng locale kèm `?next=`; page kiểm tra lại ở server (như `/admin`). Đã đăng nhập mà vào `/dang-nhap`, `/dang-ky` → về `next` hoặc `/tai-khoan`.
- Sau khi đăng nhập / đăng xuất: `revalidatePath` không cần (không cache dữ liệu theo user); `redirect` từ `i18n/navigation`.

## Auth (Supabase, email + mật khẩu)

- Server Actions trong `features/auth/actions.ts`: `signIn`, `signUp`, `signOut`, `requestPasswordReset`, `updatePassword`. Input parse bằng zod schema dùng chung client/server (`features/auth/schemas.ts`): email (trim, lowercase), mật khẩu ≥ 8 ký tự, họ tên 1–100 ký tự.
- Form dùng `useActionState` + `<form action>`: chạy được không cần JS (progressive enhancement), có JS thì hiện lỗi tại chỗ không tải lại trang. Lỗi từng field từ `z.flattenError`, lỗi chung là mã trong `errors.*`.
- Trả `Result<T>` như quy ước. Thêm mã lỗi phía app vào `lib/errors.ts` + `messages/*.json → errors`: `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `EMAIL_NOT_CONFIRMED`, `WEAK_PASSWORD`, `RATE_LIMITED`, `LINK_EXPIRED`. Map từ `AuthError.code` của Supabase (`invalid_credentials`, `user_already_exists`, `email_not_confirmed`, `weak_password`, `over_email_send_rate_limit`, `otp_expired`); mã lạ → `UNKNOWN`.
- Đăng ký gửi `options.data = { full_name, locale }` → trigger `handle_new_user` tạo `profiles` đúng locale (không đổi schema).
- Đăng xuất: `signOut({ scope: 'local' })`, chỉ kết thúc phiên hiện tại.
- Đặt lại mật khẩu: link recovery → `/api/auth/confirm` (`type=recovery`) tạo phiên → trang đặt lại mật khẩu → `updatePassword` (`auth.updateUser({ password })`). **Thành công thì gọi `signOut({ scope: 'others' })`** để thu hồi mọi phiên khác (người khác đang giữ phiên cũ trên thiết bị khác); phiên hiện tại giữ nguyên. `signOut` lỗi thì vẫn báo đổi mật khẩu thành công (mật khẩu đã đổi) nhưng ghi log server.
  - Giới hạn: `getClaims()` xác thực JWT tại chỗ, nên phiên khác chỉ hết hạn thật khi access token hết hạn (mặc định 1 giờ) và không refresh được nữa; thu hồi chặn bước refresh. Muốn ngắn hơn thì chủ dự án giảm "JWT expiry" trong Supabase Dashboard.
- `signUp` không tiết lộ email đã tồn tại hay chưa khi bật xác nhận email (Supabase trả user giả) → luôn hiện "Kiểm tra hộp thư".
- `next` (trang quay lại sau đăng nhập): chỉ nhận đường dẫn nội bộ (`/` đầu, không `//`, không `\`), sai → `/tai-khoan`. Hàm `safeNextPath` có test.

## Sổ địa chỉ

- Bảng `addresses` có sẵn (2 cấp: `province`, `ward`, `street`), RLS chỉ chủ sở hữu; đổi mặc định qua RPC `set_default_address`. Không đổi schema.
- `features/account/queries.ts`: `getAddresses()` (client theo phiên, trong `<Suspense>`, mặc định lên đầu rồi `created_at desc`, `id`).
- `features/account/actions.ts`: `createAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress` (RPC). Địa chỉ đầu tiên tự thành mặc định. Xóa địa chỉ mặc định → địa chỉ mới nhất còn lại thành mặc định (gọi RPC sau khi xóa). `user_id` không nhận từ client, lấy từ phiên (RLS `with check` chặn thêm lớp nữa).
- `addressSchema`: tên người nhận 1–100, điện thoại VN (`0` hoặc `+84` + đầu số di động 3/5/7/8/9 + 8 số; chuẩn hóa về dạng `0xxxxxxxxx`), mã tỉnh + mã phường (phường phải thuộc tỉnh, theo file dữ liệu hành chính), số nhà/đường 1–200.
- Form gửi **mã** tỉnh/phường; server tra file dữ liệu rồi lưu **`full_name` tiếng Việt** ("Phường Sài Gòn", "Thành phố Hồ Chí Minh") vào `addresses.province` / `addresses.ward` (cột text sẵn có, không đổi schema). Hiển thị ở `/en`: tra ngược tên đã lưu → `full_name_en`; không tìm thấy (dữ liệu đổi) thì hiện tên đã lưu.
- UI: danh sách thẻ địa chỉ (nhãn "Mặc định"), nút Sửa / Xóa / Đặt làm mặc định; form thêm/sửa ở trang riêng. Ô tỉnh/phường là `<select>` gốc; danh sách phường nạp theo tỉnh qua `/api/divisions/[province]` (client leaf nhỏ). Trạng thái rỗng có thiết kế riêng. Xóa cần xác nhận.

## Dữ liệu hành chính (Tỉnh/Thành → Phường/Xã)

- Nguồn: [thanglequoc/vietnamese-provinces-database](https://github.com/thanglequoc/vietnamese-provinces-database), **cố định commit `8b78ba5118715e1fa81769286724db79346abf52`** (không dùng nhánh `main`), file `json/simplified_json_generated_data_vn_units.json`: 34 tỉnh/thành, 3.321 phường/xã, có tên tiếng Anh (`NameEn`, `FullNameEn`). Giấy phép MIT.
- `scripts/build-divisions.ts` (`npm run build:divisions`, chạy local, không đọc env): tải file JSON và `LICENSE` tại đúng commit qua `raw.githubusercontent.com/.../<commit>/...`, validate bằng zod, **assert đúng 34 tỉnh và 3.321 phường/xã** (sai → dừng, không ghi file), sinh JSON gọn `src/features/account/data/divisions.json`: mỗi tỉnh `{ code, name, name_en, full_name, full_name_en, wards: [{ code, name, name_en, full_name, full_name_en }] }`.
- Attribution: script ghi `src/features/account/data/NOTICE.md` cạnh file dữ liệu: nguồn, URL repo, commit, đường dẫn file gốc, và **nguyên văn** nội dung `LICENSE` của repo tại commit đó (gồm copyright notice). Hai file sinh ra được commit; chạy lại script phải ra cùng nội dung.
- Dùng ở server: validate mã + tra tên (`features/account/divisions.ts`). Client chỉ nhận danh sách tỉnh (34 dòng, nhúng vào form) và phường của tỉnh đang chọn (Route Handler, `Cache-Control` public dài vì dữ liệu cố định theo commit).

## Header

- Icon tài khoản: chưa đăng nhập → link `/dang-nhap`; đã đăng nhập → link `/tai-khoan` kèm chữ cái đầu tên. Phần đọc phiên là Server Component nhỏ trong `<Suspense>` (fallback = icon hiện tại) → không thêm JS client, header vẫn prerender.
- Đăng xuất: nút (form + Server Action) trong trang tài khoản, không cần dropdown ở header.

## Messages

Namespace mới: `auth` (form, nhãn, thông báo "Kiểm tra hộp thư", đặt lại mật khẩu), `account` (trang tài khoản, đăng xuất), `address` (form, danh sách, xác nhận xóa, trạng thái rỗng), thêm mã lỗi vào `errors`. Cùng bộ key vi/en.

## Test

- Vitest: `signInSchema` / `signUpSchema` (email chuẩn hóa, mật khẩu ngắn), `addressSchema` (điện thoại VN hợp lệ / không hợp lệ, chuẩn hóa `+84` → `0`, tỉnh/phường không có trong danh sách), `safeNextPath` (`//evil.com`, `https://…`, `/\evil` → mặc định), map `AuthError.code` → mã lỗi app.
- Vitest: `divisions.ts` (mã phường không thuộc tỉnh → lỗi; tra tên vi → en; file có đúng 34 tỉnh / 3.321 phường).
- e2e (`e2e/account.spec.ts`), tài khoản test do global setup tạo/xóa, đăng nhập sẵn bằng `storageState` (xem quyết định 8):
  - `/tai-khoan` khi chưa đăng nhập → `/dang-nhap?next=%2Ftai-khoan`; đăng nhập xong quay lại đúng trang.
  - Sai mật khẩu → thông báo lỗi tại chỗ, không lộ email có tồn tại hay không.
  - Header đổi sang trạng thái đã đăng nhập; đăng xuất → về trạng thái cũ, `/tai-khoan` lại bị chặn.
  - Sổ địa chỉ: thêm địa chỉ đầu tiên → là mặc định; thêm cái thứ hai, đặt làm mặc định → nhãn chuyển; số điện thoại sai → lỗi field; xóa → biến mất.
  - `/en/account` cùng luồng bằng tiếng Anh (một test ngắn).
  - Đặt lại mật khẩu thu hồi phiên khác (dùng **user riêng** `e2e+<random>-reset@example.com` do global setup tạo, không đụng `storageState` dùng chung): đăng nhập user này ở hai browser context A và B; helper trong `scripts/e2e-user.ts` gọi `auth.admin.generateLink({ type: 'recovery', email })` lấy `hashed_token` (không gửi email); A mở `/api/auth/confirm?token_hash=…&type=recovery&next=…` → đặt mật khẩu mới → thành công. Kiểm tra: refresh token lấy từ cookie phiên của B bị từ chối (helper gọi `auth.refreshSession({ refresh_token })` bằng anon key → lỗi), refresh token của A vẫn dùng được, và đăng nhập bằng mật khẩu cũ thất bại. Không kiểm tra B bị đá ra ngay qua UI (access token còn hạn, xem giới hạn ở mục Auth).
  - Không lỗi console.
- `npm run measure:js -- vi/books/<slug>`: header thay đổi không được làm tăng JS trang sách.

## Việc của chủ dự án (Supabase Dashboard, Claude không làm được)

Tóm tắt: URL Configuration, bật xác nhận email, sửa 2 email template. Hướng dẫn từng bước ngay bên dưới. e2e **không** phụ thuộc mấy bước này (tài khoản test tạo bằng admin API, link đặt lại mật khẩu lấy bằng `generateLink`, không gửi email); chúng cần cho đăng ký / quên mật khẩu bằng tay.

### Hướng dẫn từng bước

**1. URL Configuration**
1. Supabase Dashboard → chọn project → **Authentication** → **URL Configuration**.
2. **Site URL**: `http://localhost:3000` → **Save**. (Deploy Vercel ở Phase 10 thì đổi thành domain thật.)
3. **Redirect URLs** → **Add URL**: `http://localhost:3000/**` → **Save**. (Sau này thêm `https://<domain-vercel>/**`.)

**2. Bật xác nhận email** (quyết định 2)
1. **Authentication** → **Sign In / Providers** → **Email**.
2. Bật **Confirm email** → **Save**.
3. Cùng trang: **Minimum password length** để 8 cho khớp form (form đã chặn < 8; để thấp hơn cũng không sao).

**3. Email template "Confirm signup"**
1. **Authentication** → **Emails** (hoặc **Email Templates**) → tab **Confirm signup**.
2. Thay toàn bộ ô **Message body** bằng:
   ```html
   <h2>Xác nhận email / Confirm your email</h2>
   <p>Bấm vào liên kết dưới đây để kích hoạt tài khoản Nhà Sách Mây.<br>Click the link below to activate your Nhà Sách Mây account.</p>
   <p><a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=email&locale={{ .Data.locale }}">Xác nhận email / Confirm email</a></p>
   ```
3. **Save changes**.

**4. Email template "Reset password"**
1. Cùng chỗ → tab **Reset password** (hoặc **Reset Password**).
2. Thay **Message body** bằng:
   ```html
   <h2>Đặt lại mật khẩu / Reset your password</h2>
   <p>Bấm vào liên kết dưới đây để đặt mật khẩu mới. Liên kết chỉ dùng được một lần.<br>Click the link below to choose a new password. The link can only be used once.</p>
   <p><a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&locale={{ .Data.locale }}">Đặt lại mật khẩu / Reset password</a></p>
   ```
3. **Save changes**.

Ghi chú về template:
- Link trỏ `/api/auth/confirm` (không dùng `{{ .ConfirmationURL }}`): route gọi `verifyOtp({ token_hash, type })`, ghi cookie phiên rồi chuyển tới `/tai-khoan` (xác nhận đăng ký) hoặc `/dat-lai-mat-khau` (đặt lại mật khẩu). `{{ .Data.locale }}` là `user_metadata.locale` ghi lúc đăng ký (`vi`/`en`) → trang đích đúng ngôn ngữ; trống hoặc lạ thì về tiếng Việt. Không cần `next=` trong template (route tự chọn trang đích theo `type`); `next` chỉ dùng ở e2e.
- Link hỏng / hết hạn / đã dùng → `/dang-nhap?error=LINK_EXPIRED` (đăng ký) hoặc `/quen-mat-khau?error=LINK_EXPIRED` (đặt lại mật khẩu), có thông báo.
- Email theo `profiles.locale` (một ngôn ngữ) để Phase 9.

**5. Giới hạn SMTP mặc định của Supabase** (không phải cấu hình, chỉ cần biết khi thử tay)
- Chỉ gửi được tới email của **thành viên trong organization Supabase** (Organization → Team). Email khác: Supabase trả `email_address_not_authorized`, app hiện "Đã có lỗi xảy ra". Thử tay đăng ký bằng email của chính bạn, hoặc cấu hình SMTP riêng (Authentication → Emails → SMTP Settings) nếu cần.
- Giới hạn vài email/giờ (Authentication → Rate Limits). Vượt → app hiện "Bạn thao tác quá nhanh…".

**6. (Tùy chọn) Rút ngắn thời gian phiên cũ còn hiệu lực sau khi đổi mật khẩu**
- Project Settings → **JWT Keys** (hoặc Authentication → Sessions) → **Access token expiry** (mặc định 3600 giây). Giảm (VD 600) thì phiên trên thiết bị khác hết hạn sớm hơn sau khi bị thu hồi (xem mục Auth → Giới hạn). Không bắt buộc.

**Kiểm tra sau khi làm xong**: `npm run dev` → `/dang-ky` bằng email của bạn → mở thư → bấm link → về `/tai-khoan` đã đăng nhập. Rồi đăng xuất → `/quen-mat-khau` → mở thư → bấm link → `/dat-lai-mat-khau` → đặt mật khẩu mới → đăng nhập bằng mật khẩu mới.

## Tiến độ

- [x] `scripts/build-divisions.ts` + `npm run build:divisions` → `src/features/account/data/divisions.json` + `NOTICE.md` (assert 34 / 3.321)
- [x] `features/account/divisions.ts` (tra mã → tên, tên vi → en) + Vitest
- [x] `i18n/routing.ts`: pathname auth + tài khoản + sổ địa chỉ
- [x] `lib/errors.ts` + `messages/*.json → errors`: mã lỗi auth; namespace `auth`, `account`, `address`
- [x] `lib/auth.ts` (`getCurrentUser`), `features/auth/{schemas,actions}.ts`, `safeNextPath` + Vitest (schema, map `AuthError.code`)
- [x] Trang `(auth)`: đăng nhập, đăng ký, quên mật khẩu, đặt lại mật khẩu; `/api/auth/confirm`
- [x] `proxy.ts`: chặn `/tai-khoan/*` khi chưa đăng nhập, chuyển người đã đăng nhập khỏi trang đăng nhập/đăng ký
- [x] Header: trạng thái đăng nhập (Server Component trong `<Suspense>`); trang tài khoản + đăng xuất + ô chọn ngôn ngữ email (`profiles.locale`)
- [x] Sổ địa chỉ: queries, actions (tạo / sửa / xóa / đặt mặc định), `/api/divisions/[province]`, trang danh sách / thêm / sửa
- [x] Đặt lại mật khẩu: `updatePassword` + `signOut({ scope: 'others' })`
- [x] e2e: global setup + teardown (`scripts/e2e-user.ts`, gồm user riêng cho test đặt lại mật khẩu + helper `generateLink` / kiểm tra refresh token), `storageState`, `e2e/account.spec.ts`
- [x] typecheck / lint / build / test / e2e sạch; `measure:js` trang sách: header +0KB (bảng pathnames +0.3KB, xem Báo cáo)

---

## Quyết định đã duyệt

1. **Cách đăng nhập**: email + mật khẩu (Supabase Auth, có xác nhận email và quên mật khẩu). Google OAuth để sau.
2. **Xác nhận email khi đăng ký**: bật.
3. **Nơi gọi Supabase Auth**: Server Actions + `@supabase/ssr` (không thêm supabase-js vào bundle client).
4. **Chặn `/tai-khoan`**: proxy redirect (dùng claims đã có) + page kiểm tra lại.
5. **Danh sách Tỉnh/Thành → Phường/Xã**: file JSON tĩnh trong repo, sinh bằng `scripts/build-divisions.ts` từ `thanglequoc/vietnamese-provinces-database` tại commit `8b78ba5118715e1fa81769286724db79346abf52` (MIT, attribution + copyright notice trong `NOTICE.md` cạnh file dữ liệu). Lưu `FullName` tiếng Việt vào `addresses`; UI `/en` hiện `FullNameEn`. Chi tiết ở mục "Dữ liệu hành chính".
6. **Form địa chỉ**: trang riêng (`/tai-khoan/dia-chi/moi`, `/tai-khoan/dia-chi/[id]`), ô tỉnh/phường là `<select>` gốc.
7. **`profiles.locale`**: ghi theo locale lúc đăng ký + ô chọn "Ngôn ngữ email" trong trang tài khoản; không gắn vào LocaleSwitcher.
8. **Tài khoản cho e2e**: global setup gọi `scripts/e2e-user.ts` (chạy local, `SUPABASE_SERVICE_ROLE_KEY` chỉ trong `scripts/`):
   - Email ngẫu nhiên mỗi lần chạy: `e2e+<random>@example.com`, mật khẩu ngẫu nhiên; tạo bằng `auth.admin.createUser({ email_confirm: true })` (không gửi email).
   - **Trước khi tạo mới, dọn user e2e còn sót** (lần chạy trước bị ngắt): `auth.admin.listUsers` (phân trang), xóa mọi user có email khớp `e2e+*@example.com`. Teardown xóa các user vừa tạo (cascade xóa profile + địa chỉ). Ngoài user chính có thêm user `e2e+<random>-reset@example.com` chỉ dùng cho test đặt lại mật khẩu.
   - **Đăng nhập một lần** qua UI trong global setup, lưu `storageState` vào `e2e/.auth/user.json` (gitignore, cùng file thông tin đăng nhập cho test form đăng nhập); các test cần phiên dùng chung file này.
   - Đăng xuất trong app dùng `signOut({ scope: 'local' })` (chỉ phiên hiện tại, **đã duyệt**); test đăng xuất tự đăng nhập phiên riêng để không làm hỏng `storageState` dùng chung.
   - Đặt lại mật khẩu xong gọi `signOut({ scope: 'others' })`; test dùng user riêng (xem mục Test).
9. **Trạng thái đăng nhập ở header**: Server Component trong `<Suspense>`, chỉ đổi icon/chữ cái đầu và link (0 JS thêm).
