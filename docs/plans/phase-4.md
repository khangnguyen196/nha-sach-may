# Phase 4: Auth + sổ địa chỉ

Trạng thái: **chờ duyệt**. Các mục "Cần chọn" ở cuối có đề xuất (★); duyệt nguyên plan = chọn hết các ★.

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
- `signUp` không tiết lộ email đã tồn tại hay chưa khi bật xác nhận email (Supabase trả user giả) → luôn hiện "Kiểm tra hộp thư".
- `next` (trang quay lại sau đăng nhập): chỉ nhận đường dẫn nội bộ (`/` đầu, không `//`, không `\`), sai → `/tai-khoan`. Hàm `safeNextPath` có test.

## Sổ địa chỉ

- Bảng `addresses` có sẵn (2 cấp: `province`, `ward`, `street`), RLS chỉ chủ sở hữu; đổi mặc định qua RPC `set_default_address`. Không đổi schema.
- `features/account/queries.ts`: `getAddresses()` (client theo phiên, trong `<Suspense>`, mặc định lên đầu rồi `created_at desc`, `id`).
- `features/account/actions.ts`: `createAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress` (RPC). Địa chỉ đầu tiên tự thành mặc định. Xóa địa chỉ mặc định → địa chỉ mới nhất còn lại thành mặc định (gọi RPC sau khi xóa). `user_id` không nhận từ client, lấy từ phiên (RLS `with check` chặn thêm lớp nữa).
- `addressSchema`: tên người nhận 1–100, điện thoại VN (`0` hoặc `+84` + đầu số di động 3/5/7/8/9 + 8 số; chuẩn hóa về dạng `0xxxxxxxxx`), tỉnh và phường phải có trong danh sách hành chính (xem quyết định 5), số nhà/đường 1–200.
- UI: danh sách thẻ địa chỉ (nhãn "Mặc định"), nút Sửa / Xóa / Đặt làm mặc định; form thêm/sửa ở trang riêng hoặc `Sheet` (xem quyết định 6). Trạng thái rỗng có thiết kế riêng. Xóa cần xác nhận.

## Header

- Icon tài khoản: chưa đăng nhập → link `/dang-nhap`; đã đăng nhập → link `/tai-khoan` kèm chữ cái đầu tên. Phần đọc phiên là Server Component nhỏ trong `<Suspense>` (fallback = icon hiện tại) → không thêm JS client, header vẫn prerender.
- Đăng xuất: nút (form + Server Action) trong trang tài khoản, không cần dropdown ở header.

## Messages

Namespace mới: `auth` (form, nhãn, thông báo "Kiểm tra hộp thư", đặt lại mật khẩu), `account` (trang tài khoản, đăng xuất), `address` (form, danh sách, xác nhận xóa, trạng thái rỗng), thêm mã lỗi vào `errors`. Cùng bộ key vi/en.

## Test

- Vitest: `signInSchema` / `signUpSchema` (email chuẩn hóa, mật khẩu ngắn), `addressSchema` (điện thoại VN hợp lệ / không hợp lệ, chuẩn hóa `+84` → `0`, tỉnh/phường không có trong danh sách), `safeNextPath` (`//evil.com`, `https://…`, `/\evil` → mặc định), map `AuthError.code` → mã lỗi app.
- e2e (`e2e/account.spec.ts`), dùng một tài khoản test đã xác nhận do global setup tạo/xóa (xem quyết định 8):
  - `/tai-khoan` khi chưa đăng nhập → `/dang-nhap?next=%2Ftai-khoan`; đăng nhập xong quay lại đúng trang.
  - Sai mật khẩu → thông báo lỗi tại chỗ, không lộ email có tồn tại hay không.
  - Header đổi sang trạng thái đã đăng nhập; đăng xuất → về trạng thái cũ, `/tai-khoan` lại bị chặn.
  - Sổ địa chỉ: thêm địa chỉ đầu tiên → là mặc định; thêm cái thứ hai, đặt làm mặc định → nhãn chuyển; số điện thoại sai → lỗi field; xóa → biến mất.
  - `/en/account` cùng luồng bằng tiếng Anh (một test ngắn).
  - Không lỗi console.
- `npm run measure:js -- vi/books/<slug>`: header thay đổi không được làm tăng JS trang sách.

## Việc của chủ dự án (Supabase Dashboard, Claude không làm được)

- Authentication → URL Configuration: Site URL + Redirect URLs (`http://localhost:3000/**`, domain Vercel sau này).
- Email Templates "Confirm signup" và "Reset password": link đổi sang `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=...` (`type=recovery` cho đặt lại mật khẩu).
- SMTP mặc định của Supabase giới hạn vài email/giờ: đủ để thử tay; e2e không gửi email (tài khoản test tạo bằng admin API).

## Tiến độ

(Thêm khi bắt đầu code.)

---

## Cần chọn

1. **Cách đăng nhập**: ★ email + mật khẩu (Supabase Auth, có xác nhận email và quên mật khẩu) · magic link / OTP qua email (không cần mật khẩu, nhưng mỗi lần đăng nhập tốn một email trong giới hạn SMTP) · thêm Google OAuth (cần tạo OAuth client trên Google Cloud; đề xuất để sau, thêm được mà không đổi cấu trúc).
2. **Xác nhận email khi đăng ký**: ★ bật (mặc định của Supabase, chặn đăng ký bằng email người khác) · tắt (đăng ký xong dùng ngay, tiện thử nghiệm nhưng không kiểm chứng email).
3. **Nơi gọi Supabase Auth**: ★ Server Actions + `@supabase/ssr` (cookie ghi ở server, form chạy không cần JS, không thêm supabase-js vào bundle client) · gọi từ client bằng `lib/supabase/client.ts` (supabase-js ~30KB gzip vào bundle trang auth).
4. **Chặn `/tai-khoan` khi chưa đăng nhập**: ★ proxy redirect (đã có claims sau bước refresh, không thêm request) + page kiểm tra lại · chỉ kiểm tra trong page (luôn render shell trước, redirect sau khi stream → không ra 307 thật, giống vấn đề 404 ở Phase 3).
5. **Danh sách Tỉnh/Thành → Phường/Xã** (2 cấp, sau sắp xếp hành chính 2025: 34 tỉnh/thành, ~3.300 phường/xã):
   - ★ File JSON tĩnh trong repo, sinh một lần bằng `scripts/build-divisions.ts` từ nguồn mở (đề xuất API `provinces.open-api.vn` bản v2; cần chủ dự án duyệt nguồn và giấy phép trước khi chạy vì script tải dữ liệu từ mạng). Danh sách tỉnh nhúng thẳng vào form; danh sách phường tải theo tỉnh qua Route Handler `GET /api/divisions/[province]` (cache CDN) để không gửi cả ~3.300 dòng xuống client. Server validate tên tỉnh/phường theo cùng file.
   - Gọi API ngoài lúc runtime (phụ thuộc bên thứ ba, lỗi mạng là không thêm được địa chỉ).
   - Nhập tự do bằng ô text (đơn giản nhất, dữ liệu bẩn, khó tính phí ship theo vùng sau này).
6. **Form địa chỉ**: ★ trang riêng `/tai-khoan/dia-chi/moi` và `/tai-khoan/dia-chi/[id]` (chạy không cần JS ngoài ô chọn phường, URL chia sẻ được, back đúng) · `Sheet` trên cùng trang danh sách (mượt hơn, thêm state client). Ô chọn tỉnh/phường: `<select>` gốc (★, 0 JS cho tỉnh; phường cần JS để nạp theo tỉnh) · combobox có tìm kiếm (dùng lại cmdk đã có, nặng hơn).
7. **Lưu `profiles.locale`**: ★ ghi theo locale hiện tại lúc đăng ký (qua metadata) + ô chọn "Ngôn ngữ email" trong trang tài khoản · tự cập nhật mỗi lần bấm LocaleSwitcher khi đã đăng nhập (đổi ngôn ngữ xem web không chắc là muốn đổi ngôn ngữ email; thêm một request mỗi lần đổi).
8. **Tài khoản cho e2e**: ★ global setup gọi `scripts/e2e-user.ts` (chạy local, dùng `SUPABASE_SERVICE_ROLE_KEY` đúng quy định "chỉ trong scripts/") tạo user đã xác nhận bằng `auth.admin.createUser({ email_confirm: true })`, teardown xóa user (cascade xóa profile + địa chỉ) · đăng ký qua UI trong test (vướng xác nhận email và giới hạn SMTP) · tài khoản cố định tạo tay (dữ liệu test tích tụ giữa các lần chạy).
9. **Trạng thái đăng nhập ở header**: ★ Server Component trong `<Suspense>`, chỉ đổi icon/chữ cái đầu và link (0 JS thêm) · dropdown menu (Radix DropdownMenu, thêm JS vào mọi trang, sát ngân sách 50KB).
