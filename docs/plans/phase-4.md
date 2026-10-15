# Phase 4: Auth + sổ địa chỉ

Trạng thái: **đã duyệt** (2026-10-15): chọn hết các ★, sửa mục 5 (nguồn dữ liệu hành chính) và mục 8 (tài khoản e2e). Xem "Quyết định đã duyệt" ở cuối.

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

- Authentication → URL Configuration: Site URL + Redirect URLs (`http://localhost:3000/**`, domain Vercel sau này).
- Email Templates "Confirm signup" và "Reset password": link đổi sang `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=...` (`type=recovery` cho đặt lại mật khẩu).
- SMTP mặc định của Supabase giới hạn vài email/giờ: đủ để thử tay; e2e không gửi email (tài khoản test tạo bằng admin API).

## Tiến độ

- [x] `scripts/build-divisions.ts` + `npm run build:divisions` → `src/features/account/data/divisions.json` + `NOTICE.md` (assert 34 / 3.321)
- [x] `features/account/divisions.ts` (tra mã → tên, tên vi → en) + Vitest
- [x] `i18n/routing.ts`: pathname auth + tài khoản + sổ địa chỉ
- [x] `lib/errors.ts` + `messages/*.json → errors`: mã lỗi auth; namespace `auth`, `account`, `address`
- [x] `lib/auth.ts` (`getCurrentUser`), `features/auth/{schemas,actions}.ts`, `safeNextPath` + Vitest (schema, map `AuthError.code`)
- [x] Trang `(auth)`: đăng nhập, đăng ký, quên mật khẩu, đặt lại mật khẩu; `/api/auth/confirm`
- [x] `proxy.ts`: chặn `/tai-khoan/*` khi chưa đăng nhập, chuyển người đã đăng nhập khỏi trang đăng nhập/đăng ký
- [ ] Header: trạng thái đăng nhập (Server Component trong `<Suspense>`); trang tài khoản + đăng xuất + ô chọn ngôn ngữ email (`profiles.locale`)
- [ ] Sổ địa chỉ: queries, actions (tạo / sửa / xóa / đặt mặc định), `/api/divisions/[province]`, trang danh sách / thêm / sửa
- [ ] Đặt lại mật khẩu: `updatePassword` + `signOut({ scope: 'others' })`
- [ ] e2e: global setup + teardown (`scripts/e2e-user.ts`, gồm user riêng cho test đặt lại mật khẩu + helper `generateLink` / kiểm tra refresh token), `storageState`, `e2e/account.spec.ts`
- [ ] typecheck / lint / build / test / e2e sạch; `measure:js` trang sách không tăng

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
