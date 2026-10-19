# Đợt "sau-ux"

Trạng thái (2026-10-19, tối): **mục 1, 2, 3, 4 (bản sửa prefetch), 6 (A1) code xong** trên nhánh `sau-ux` (tạo từ `main` `1016280`), CI check + e2e xanh, **chưa merge**. Test đăng ký trên Preview: không làm (chủ dự án tự thử trên production sau merge). Mục 6 chờ duyệt + kết quả H1–H3 trước khi merge. Mục 5: đợt riêng. Mục 7: `catalog-fix.sql` đã viết, CHƯA chạy. Mục 8: xong. perf-js bước 0 (`scripts/analyze-diff.mjs`): xong.

Kết quả từng mục:
- Mục 1 `45970e8`: e2e 411 qua / 9 skip / 0 flaky (run 39240347309).
- Mục 2 `553fcfe` (+ docs `3f934b0`): e2e 411 qua / 9 skip (run 39241695759).
- Test đã đổi / xóa / thêm (mục 1–3):
  - Xóa (test của code bị xóa): `errors.test.ts` 2 expectation `email_address_invalid` / `email_address_not_authorized` → `emailRejected` (mapping đã xóa, không còn nơi dùng); `legacy-error-codes.test.ts` ca `INVALID_VOUCHER` (mã đã xóa); `voucher-errors.test.ts` phần tử `INVALID_VOUCHER` trong danh sách kiểm; `schemas.test.ts` expectation `user_already_exists` → `EMAIL_TAKEN` (mã đã xóa, mục 1 → "Code chết").
  - Đổi tên: `legacy-error-codes.test.ts` describe "báo giá thanh toán với mã lỗi cũ" → "báo giá thanh toán: lỗi voucher thiếu detail", "hủy đơn với mã lỗi cũ" → "hủy đơn: đơn không có / của tài khoản khác" (+ comment đầu file); `voucher-errors.test.ts` "có cả mã cũ (trước migration B) lẫn mã mới" → "có đủ các lý do của voucher".
  - Thêm: `actions.test.ts` (`signUp` vào `ACTIONS`: 13 ca bảng `SILENT` + NETWORK_ERROR + zod; describe "signUp: riêng của đăng ký" 6 ca); `errors.test.ts` describe `PRE_LOOKUP_SIGNUP_CODES` (2 ca); e2e `auth-email.spec.ts`: câu thân + link ở ca đăng ký en và vi, đăng ký lại cùng email (en) → cùng khối. Không đổi chuỗi expected cũ nào, trừ câu ★1 bản en dùng ’ (cũ `doesn't` / `hasn't` / `don't` → `doesn’t` / `hasn’t` / `don’t`).
- Mục 3 `485abe4` (chế độ báo, run 39243064552: `gen types --local` chạy được dù `postgres-meta` bị `-x`; trong schema `public`, bản `--local` chỉ khác bản sửa tay ở `order_items.line_total` = `never` khi Insert / Update; ngoài `public`, bản `--local` **không có** khối `__InternalSupabase` (`PostgrestVersion: "14.18"`) → postgrest-js suy kiểu theo PostgREST v12, typecheck vẫn sạch; còn lại là định dạng) → `bf9fcb8` (database.ts từ artifact, bật fail): e2e 411 qua, bước kiểm types xanh (run 39244493102). Chứng minh đỏ: nhánh nháp `types-red-check` đổi `authors.bio_en` → bước "Check src/types/database.ts" fail kèm đúng dòng lệch (run 39244521641), nhánh đã xóa.

Bối cảnh: đợt `ux-messages` đã lên production 2026-10-19, migration A + B đã chạy (`docs/plans/ux-messages.md`). Đợt này dọn các việc còn lại của nó (`docs/progress.md`) trước đợt perf-js (`docs/plans/perf-js.md`) (★6: sau-ux trước perf-js).

Quy ước chung: nhánh `sau-ux`, worktree riêng; mỗi mục một commit (hoặc vài commit); `typecheck`, `lint`, Vitest, `build`, CI check + e2e xanh trước khi sang mục sau (ngoại lệ: mục 4 chạy trên nhánh chẩn đoán riêng, song song được); không thêm dependency; không chạy SQL trên Supabase thật (đợt này không có migration nào được chạy; mục 6 / 7 nếu cần thì chỉ viết file); không xóa / skip / nới test, trừ test của chính code bị xóa ở mục 1 / 2 (liệt kê kèm lý do); đổi chuỗi expected thì liệt kê cũ → mới.

## ★ Đã quyết (2026-10-19)

- ★1 Câu "Kiểm tra hộp thư" của đăng ký (`auth.register.checkInbox`):
  - vi: "Nếu email dưới đây chưa có tài khoản (hoặc chưa xác nhận), liên kết xác nhận thường tới trong vài phút. Không thấy thư thì bạn xem mục Spam và kiểm tra lại địa chỉ email. Nếu đã có tài khoản, bạn đăng nhập hoặc dùng Quên mật khẩu."
  - en: "If the email below doesn't have an account yet (or hasn't been confirmed), a confirmation link usually arrives within a few minutes. If you don't see it, check your Spam folder and double-check the address. If you already have an account, sign in or use Forgot password."
  - "đăng nhập" / "Quên mật khẩu" ("sign in" / "Forgot password") là link (`t.rich` ở server, truyền ReactNode xuống form).
- ★2 (a): giữ `legacy-error-codes.test.ts`, bỏ ca `INVALID_VOUCHER`, đổi tên `describe` + comment đầu file (không còn là "mã cũ").
- ★3 (a): sinh lại `database.ts` bằng `--local` làm chuẩn, so chính xác.
- ★4: cho phép log tạm trên nhánh chẩn đoán (điều kiện ở mục 4).
- ★5: tắt JS → đợt riêng sau perf-js.
- ★6: sau-ux trước perf-js.
- 429 theo IP (`over_request_rate_limit`) ở đăng ký: "đã gửi" như 2 action kia. Đây là **lựa chọn có chủ đích**: mã này kiểm theo IP trước lookup nên không lộ email, nhưng để một quy tắc chung cho cả 3 action (mọi 429 đều im) dễ giữ hơn; người dùng thật hiếm khi chạm giới hạn này.
- `emailRejected` / `validation.emailRejected` / `email_address_*` trong `authFailure`: XÓA nếu grep xác nhận không còn nơi dùng (`signIn`, `updatePassword` không gửi thư nên không gặp mã này); liệt kê test bị xóa kèm lý do. Còn nơi dùng thì giữ + comment.

## 1. Đăng ký không để lộ email nào có tài khoản (P1)

**Hiện trạng** (`src/features/auth/actions.ts` `signUp`): mọi lỗi của GoTrue trừ `EMAIL_TAKEN` đều báo ra form (`authFailure` → `withAuthMessage`). `RATE_LIMITED`, `email_address_invalid` (dưới ô Email), `email_address_not_authorized`, 5xx (`NETWORK_ERROR` / `UNKNOWN`)… đều khác câu "Kiểm tra hộp thư".

**Đối chiếu GoTrue** (`supabase/auth` `internal/api/signup.go`, bản `master` đọc 2026-10-19):
- TRƯỚC khi tìm user (không nói gì về tài khoản, vẫn báo):
  - `config.DisableSignup` → `signup_disabled`
  - `validateSignupParams`: thiếu mật khẩu / kênh sai → `validation_failed`; `checkPasswordStrength` → `weak_password`
  - `!config.External.Email.Enabled` → `email_provider_disabled`
  - `validateEmail` (rỗng, > 255 ký tự, sai dạng) → `validation_failed`
  - (middleware giới hạn theo IP → `over_request_rate_limit`: trước lookup nhưng vẫn coi "đã gửi", xem ★ ở trên)
- SAU khi tìm user (`models.IsDuplicatedEmail`), khác nhau theo email:
  - đã có + đã xác nhận → trả 200 với user giả (không gửi thư); bật autoconfirm thì `user_already_exists` 422
  - đã có + chưa xác nhận → gửi lại thư xác nhận (`sendConfirmation`: kiểm tần suất theo `ConfirmationSentAt` → 429 "after N seconds", SMTP lỗi → `email_address_*` / 5xx). GoTrue **không đổi mật khẩu** ở lần đăng ký lại này.
  - chưa có → tạo user + `sendConfirmation` (lỗi gửi thư cũng ra 429 project / `email_address_*` / 5xx); hook `before_user_created` (project chưa bật) chỉ chạy với user mới
  - lỗi DB tìm user → 500 "Database error finding user"
- → Các mã sau lookup có thể khác nhau giữa email có / không có tài khoản: phải cùng một kết quả.

**Phạm vi**: `src/features/auth/actions.ts`, `src/features/auth/errors.ts` (+ `errors.test.ts`), `src/lib/errors.ts` (`VALIDATION_KEYS`), `src/app/[locale]/(auth)/register/page.tsx`, `src/features/auth/components/register-form.tsx` (chỉ phần hiển thị câu), `messages/vi.json` + `en.json`, `src/features/auth/actions.test.ts`, `e2e/auth-email.spec.ts`, `CLAUDE.md`, `docs/progress.md`.

**Cách làm**
- `errors.ts`: allowlist một chỗ `PRE_LOOKUP_SIGNUP_CODES` = `weak_password`, `validation_failed`, `signup_disabled`, `email_provider_disabled`, comment trỏ `internal/api/signup.go` (`Signup` → `validateSignupParams` / `validateEmail` trước `IsDuplicatedEmail`).
- `signUp`: báo lỗi CHỈ khi
  - zod chặn (đã có, trước khi gọi GoTrue);
  - không tới được máy chủ (`error.status === 0` → `NETWORK_ERROR`, như `unreachableOnly`);
  - mã trong allowlist → `authFailure` (`weak_password` dưới ô Mật khẩu, `validation_failed` → `INVALID_INPUT` đầu form, `signup_disabled` / `email_provider_disabled` → `SIGNUP_DISABLED`).
- Mọi mã khác (`email_address_invalid`, `email_address_not_authorized`, mọi 429, 5xx, `user_already_exists`, mã lạ) → cùng kết quả "Kiểm tra hộp thư"; log chỉ mã + label (dùng lại `unreachableOnly`), không email.
- `signUp` không dùng `withAuthMessage` nữa (không còn trả `RATE_LIMITED`); `signIn` vẫn dùng.
- `register/page.tsx`: bỏ `RATE_LIMITED` khỏi `getFormMessages`.
- `data.session` (autoconfirm) giữ redirect `/account` như cũ.
- Câu thành công theo ★1; `register-form.tsx` nhận `checkInbox: ReactNode`.
- Code chết: `email_address_invalid` / `email_address_not_authorized` trong `AUTH_ERRORS`, `'emailRejected'` trong `VALIDATION_KEYS`, `validation.emailRejected` (vi / en) → xóa nếu grep không còn nơi dùng. Sau đó (review): `EMAIL_TAKEN` (`user_already_exists` / `email_exists` trong `AUTH_ERRORS`, `ERROR_CODES`, `errors.EMAIL_TAKEN` vi / en) cũng không còn nơi dùng → đã xóa; `authErrorCode` chỉ còn test dùng → đã xóa (ca test chuyển sang `authFailure`).
- `CLAUDE.md`: quy ước "Quên mật khẩu / gửi lại email xác nhận" mở rộng thành "… / đăng ký" (đăng ký có thêm allowlist mã trước lookup).

**Test**
- Vitest `src/features/auth/actions.test.ts`: đưa `signUp` vào `ACTIONS` (dùng lại bảng `SILENT`: không lỗi, `email_address_*`, 429 theo tài khoản / project / IP, 500 hai kiểu, 503, `AuthUnknownError`, mã lạ) + ca riêng của đăng ký: `user_already_exists`; trước lookup báo đúng (`weak_password` → dưới ô Mật khẩu; `validation_failed` → `INVALID_INPUT`; `signup_disabled` / `email_provider_disabled` → `SIGNUP_DISABLED`); status 0 → `NETWORK_ERROR`; zod → không gọi GoTrue. Kiểm ca 429 theo tài khoản và `email_address_invalid` FAIL với code hiện tại.
- `errors.test.ts`: test allowlist (mã trong / ngoài).
- e2e `auth-email.spec.ts`: **thêm** assertion câu thân mới ở ca đăng ký en và ca đăng ký vi (hiện chỉ kiểm tiêu đề `checkInboxTitle`, không đổi), kèm link "Sign in" / "đăng nhập" đúng href.

**Rủi ro**
- Gõ sai tên miền (`gmial.com`): trước đây có lỗi dưới ô Email (`emailRejected`), giờ thấy "Kiểm tra hộp thư" mà không bao giờ có thư. Câu ★1 có "kiểm tra lại địa chỉ email" và form hiện địa chỉ ngay dưới câu.
- Lỗi gửi thư thật (SMTP hỏng, hết quota email của project): người dùng chỉ thấy "Kiểm tra hộp thư"; lỗi vẫn có trong log Vercel (mã, giữ 1 giờ ở gói Hobby).
- Dò qua thời gian phản hồi vẫn còn (GoTrue gửi thư đồng bộ): đã chấp nhận (`docs/progress.md`).
- Bản GoTrue hosted có thể khác `master`: allowlist chỉ chứa mã chắc chắn kiểm trước lookup; mã lạ mặc định "đã gửi" (an toàn).

**Xong khi**: Vitest + e2e CI xanh; chỉ còn allowlist + `NETWORK_ERROR` + zod hiện lỗi ở trang đăng ký; danh sách test đổi / xóa (cũ → mới); `CLAUDE.md`, `docs/progress.md` cập nhật (bỏ dòng "[Đã quyết – nhánh riêng sau merge] Đăng ký…").

## 2. Xóa `INVALID_VOUCHER` (P2, migration B đã chạy)

**Kiểm DB**: `grep INVALID_VOUCHER supabase/` (2026-10-19, `main` `1016280`):
- `schema.sql:1422`: chỉ trong comment danh sách mã lỗi.
- `migrations/20261018130000_error_reasons.sql:3`: comment (lịch sử, giữ).
- `checks/ux-messages-b.sql:8`: câu kiểm tra (lịch sử, giữ).
- `migrations.test.ts:175`, `:183`: test chặn mã quay lại (giữ, chủ ý).
- Không còn `raise exception 'INVALID_VOUCHER'` nào trong `schema.sql`.

**Cách làm**
- `src/lib/errors.ts`: bỏ `'INVALID_VOUCHER'` khỏi `ERROR_CODES` + sửa comment.
- `src/features/checkout/voucher-errors.ts`: bỏ khỏi `VOUCHER_ERRORS`; sửa comment đầu file và comment `minOrderShortfall` (giữ nhánh tự tính khi thiếu `shortfall` như phòng thủ, không nói "DB trước B" nữa).
- `src/features/checkout/queries.ts:48`: comment `voucherFailure` cho khớp.
- `messages/vi.json`, `messages/en.json`: bỏ `errors.INVALID_VOUCHER`.
- `schema.sql:1422`: xóa dòng comment (không đổi SQL).
- Tests:
  - `legacy-error-codes.test.ts` (★2 a): bỏ ca `INVALID_VOUCHER` (xóa vì mã đã bị xóa); đổi tên `describe` + comment đầu file: ca `VOUCHER_MIN_ORDER` thiếu `shortfall` thành test phòng thủ, ca `ORDER_NOT_CANCELLABLE` (DB vẫn trả cho đơn không có / của người khác) giữ nguyên.
  - `voucher-errors.test.ts:27-28`: bỏ `INVALID_VOUCHER` khỏi danh sách, đổi tên test "có cả mã cũ (trước migration B) lẫn mã mới" → "có đủ các lý do của voucher".
- `CLAUDE.md`: bỏ câu "`INVALID_VOUCHER` chỉ còn để chạy được trước migration B…".
- `docs/progress.md`: bỏ phần `INVALID_VOUCHER` ở dòng 10 và dòng 28 ("Xóa `INVALID_VOUCHER` sau khi migration B đã chạy.").

**Rủi ro**: bản app cũ không còn chạy ở đâu (production = `main` mới). Xóa nhầm câu dịch đang dùng → test so key / `ERROR_CODES` bắt.

**Xong khi**: `grep -rn INVALID_VOUCHER src messages e2e` rỗng (còn trong `supabase/migrations`, `supabase/checks`, `supabase/migrations.test.ts:175/183` là chủ ý); Vitest + e2e CI xanh.

## 3. Kiểm `src/types/database.ts` tự động trên CI (P2)

**Hiện trạng**: `database.ts` sửa tay theo migration A, chưa sinh lại từ DB; CLAUDE.md có lệnh `supabase gen types … --project-id` (cloud, cần đăng nhập, chỉ máy dev).

**Phạm vi**: `.github/workflows/e2e.yml`, `src/types/database.ts`, `CLAUDE.md`, docs.

**Cách làm** (không cần quyền vào Supabase thật)
- `e2e.yml` (bản cuối, sau review): bước sinh types (`id: gen_types`) chạy ngay sau "Seed books", **trước** Playwright: `supabase gen types typescript --local --schema public --schema graphql_public > "$RUNNER_TEMP/database.ts"`. Playwright chỉ cần seed xong (`!cancelled() && steps.seed.outcome == 'success'`), nên sinh types lỗi không chặn e2e. Upload artifact `database-types` + `diff -u src/types/database.ts "$RUNNER_TEMP/database.ts"` ở cuối, `always() && steps.gen_types.outcome == 'success'` (chạy cả khi Playwright fail / job quá giờ, không chạy khi sinh lỗi).
- `supabase start -x imgproxy,postgres-meta,supavisor`: `gen types --local` dùng image pg-meta. Thử trước với `-x` như cũ; CLI không chạy được (hoặc chậm vì kéo image) thì bỏ `postgres-meta` khỏi `-x`.
- Lượt đầu chế độ báo (`continue-on-error: true` + in diff) → tải artifact, commit làm `database.ts` chuẩn (★3 a), `typecheck` sạch → bật fail (bỏ `continue-on-error`).
- Quy trình cập nhật types về sau (máy dev không có Docker): đổi `schema.sql` → push → bước CI đỏ, artifact `database-types` có bản đúng → `gh run download <run> -n database-types` → chép vào `src/types/database.ts` → `npm run typecheck` → commit. CLAUDE.md: thay lệnh `--project-id` ở mục Lệnh và mục Database ("sinh lại types") bằng quy trình này.
- Lưu ý: bản `--local` (CLI 2.121.0) **không có** khối `__InternalSupabase` (`PostgrestVersion`) → postgrest-js suy kiểu theo PostgREST v12 (API kiểu v13+ như `maxAffected` sẽ không typecheck dù production có). Cần tính năng v13+ thì truyền `PostgrestVersion` ở chỗ tạo client, không sửa tay `database.ts` (bước so sẽ đỏ). Sau khi sinh lại luôn `typecheck`.

**Test**: đổi tạm một kiểu trong `database.ts` trên nhánh nháp → bước đỏ (không commit bản tạm vào `sau-ux`, xóa nhánh nháp).

**Rủi ro**: gen types cần pg-meta (xem trên). CLI đổi format giữa phiên bản → đã ghim 2.121.0. Tắt e2e (`RUN_E2E = false`) thì mất luôn bước kiểm types.

**Xong khi**: bước CI ở chế độ fail, xanh trên `sau-ux`; đã chứng minh đỏ khi lệch.

## 4. Request RSC 404 `/dang-nhap?next=%2Ftai-khoan&_rsc=…` (P2) — chẩn đoán, chưa sửa

**Đã biết**: `cart-account.spec.ts:94` (desktop-account) chập chờn 2/5 lượt đêm 18→19/10, qua ở retry; console "Failed to load resource: 404 … /dang-nhap?next=%2Ftai-khoan&_rsc=IP9tvrHI0WPQ482u" (cùng `_rsc` cả 2 lần). Có từ trước ux-messages. Giả thuyết: router prefetch / điều hướng `/tai-khoan` khi phiên vừa hết → proxy 307 sang `/dang-nhap?next=…` → request RSC (prefetch / segment prefetch) tới URL đó nhận 404. `(auth)` là route group có layout lồng (`src/app/[locale]/(auth)/layout.tsx`), **không** phải root layout khác (root layout khác chỉ có `app/admin`).

**Nhánh**: `diag-rsc-404` từ `main`, **không bao giờ merge**, xóa sau khi báo cáo.

**Được sửa trên nhánh đó**
- `e2e/diag-rsc-404-account.spec.ts` (khớp `ACCOUNT_SPECS`): user riêng (`createE2eUser`, xóa ở `finally`) để không giẫm giỏ của `cart-account.spec`.
- `e2e.yml`: chỉ chạy spec này, `--project=desktop-account --repeat-each 20 --retries 0`.
- `playwright.config.ts`: `stdout: 'pipe'` nếu cần.
- `src/proxy.ts`: log tạm, chỉ bật khi `VERCEL_ENV !== 'production'` **và** `E2E_FAULT_INJECTION === '1'` (giống `lib/supabase/fault-injection.ts`), `console.error`, chỉ header trong allowlist (`rsc`, `next-router-prefetch`, `next-router-segment-prefetch`, `next-router-state-tree`, `location`, `x-middleware-rewrite`, `x-nextjs-*`), **không bao giờ** `cookie` / `authorization`.

**Kế hoạch**
1. Tái hiện: đăng nhập → vào các trang như `cart-account.spec` → đăng xuất / hết phiên → điều hướng / prefetch `/tai-khoan`; ghi mọi response ≥ 400 (URL, method, header request trong allowlist, chuỗi redirect `redirectedFrom()`, header response trong allowlist).
2. Log proxy: request tới `/dang-nhap` có `_rsc` / header RSC → method, pathname + search, header allowlist, quyết định của proxy.
3. Phân loại: 404 do proxy (rewrite `__not-found`?), do Next (prefetch route có search params / segment prefetch qua redirect), hay do chuyển hướng đăng nhập khi phiên đổi giữa chừng.

**Xong khi**: ≥ 3 lần tái hiện kèm log chỉ ra tầng trả 404, hoặc 40+ lượt không tái hiện → dừng, ghi lại. CHƯA sửa; báo cáo + đề xuất sửa; xóa nhánh.

**Kết quả chẩn đoán (2026-10-19, nhánh `diag-rsc-404`, đã xóa)**
- Lượt 1 (run 39240819659, `7f5d489`): 20/20 hết giờ 30 giây ở bước chờ `networkidle` → không có số liệu. Log proxy: **proxy không thấy** header `rsc` / `next-router-*` lẫn tham số `_rsc` (Next bỏ trước khi gọi proxy) → proxy không phân biệt được request prefetch.
- Lượt 2 (run 39241891969, `27ae386`): luồng UI như `cart-account.spec.ts:94` (giỏ khách → đăng nhập → đăng xuất → đăng nhập lại), 20/20 **không** 404. Nhưng log có đúng request của lần flaky: prefetch `GET /tai-khoan?_rsc=IP9tvrHI0WPQ482u` với `next-router-segment-prefetch: /$d$locale/!KHNob3Ap/account/__PAGE__` (lúc đó còn phiên → 200). Cũng thấy chuỗi `/tai-khoan/don-hang?_rsc=…` (segment `/_tree`, đã đăng xuất) → 307 proxy → 307 Next → 200.
- Lượt 3 (run 39243179327, `384637c`): luồng UI thêm 20 lượt, **0** lần 404 (tổng 40 lượt UI). Ca gửi thẳng request prefetch đó khi **chưa đăng nhập**: **20/20 tái hiện**: segment `account/__PAGE__` → 404; đối chứng `/_tree` và `/$d$locale` → 200. (1 lượt báo fail vì listener `response` đọc header sau khi context đã đóng — lỗi của spec chẩn đoán, không liên quan.)
- Chuỗi request của ca 404 (cả 20 lần giống nhau):
  1. `GET /tai-khoan?_rsc=IP9tvrHI0WPQ482u` (`rsc: 1`, `next-router-prefetch: 1`, `next-router-segment-prefetch: /$d$locale/!KHNob3Ap/account/__PAGE__`) → **307 do proxy** (`authRedirect`, chưa đăng nhập) → `location: /dang-nhap?next=%2Ftai-khoan` (mất `_rsc`).
  2. `GET /dang-nhap?next=%2Ftai-khoan` (trình duyệt giữ header) → proxy cho qua (`x-middleware-rewrite: /vi/login?next=…`) → **307 do Next** (request RSC thiếu `_rsc` → thêm lại `_rsc` tính từ header) → `/dang-nhap?next=%2Ftai-khoan&_rsc=…`. Ở lần flaky, header của router khớp hash nên `_rsc` thêm lại trùng `IP9tvrHI0WPQ482u`, đúng URL trong log CI.
  3. `GET /dang-nhap?next=%2Ftai-khoan&_rsc=…` → **404 do Next**: trang đăng nhập prerender (`x-nextjs-prerender: 1`, `x-nextjs-cache: HIT`) không có segment `account/__PAGE__` mà header xin → Chromium log "Failed to load resource: 404" → `collectErrors` làm test fail.
- **Tầng trả 404: Next** (segment prefetch theo header của route cũ đi qua redirect của proxy sang route khác). Proxy chỉ tạo redirect đúng như thiết kế. Người dùng không thấy gì (prefetch hỏng, điều hướng thật vẫn sang trang đăng nhập); chỉ là dòng 404 trong console + 2 request thừa.
- **Nguồn prefetch khi chưa có phiên** (giả thuyết, chưa kiểm): (a) fallback Suspense của `AccountLink` (`components/layout/account-link.tsx`) là link `/account` nằm trong khung tĩnh của **mọi trang** → khách chưa đăng nhập mà hydrate xong trước khi phần động tới (máy CI bận) thì router prefetch `/tai-khoan` → chuỗi trên; (b) link `/account` của header khi còn phiên được prefetch đúng lúc cookie vừa xóa (đăng xuất).
- **Đề xuất sửa** (chưa làm, chờ duyệt): (1) `prefetch={false}` cho link `/account` ở fallback của `AccountLink` (và cân nhắc cả link `/account` khi đã đăng nhập: khu tài khoản là trang động, prefetch lợi ít); 0KB JS; (2) e2e: khách chưa đăng nhập tải trang chủ → không có request nào tới `/tai-khoan?_rsc`; (3) theo dõi `cart-account.spec.ts:94` vài lượt CI. Không sửa ở proxy (không thấy header RSC). Phương án phụ nếu (1) không đủ: fallback là icon không phải link.
- **Đã sửa (2026-10-19, `d60b369`)** theo quyết định: `prefetch={false}` CHỈ cho link `/account` trong fallback của `AccountLink` (`components/layout/account-link.tsx`); link `/account` khi đã đăng nhập giữ prefetch. e2e mới `layout.spec.ts` "khách chưa đăng nhập: không có request RSC / prefetch nào tới /tai-khoan (/en/account)" (trang chủ, `/sach/sapiens`, `/en`, `/en/books/sapiens`; chờ hydrate + 1,5 s). `cart-account.spec.ts:94` giữ nguyên.
- **Chứng minh test bắt được: KHÔNG đạt.** Nhánh nháp `prefetch-red-check` (bỏ `prefetch={false}`, chỉ chạy test này `--repeat-each 10 --retries 0`, desktop + mobile): **20/20 qua** (run 39249999264) → test không phân biệt được có / không có bản sửa; nhánh đã xóa. Lý do có thể: khi tải trang lần đầu, phần động (phiên) tới trước lúc React hydrate boundary nên fallback không bao giờ được hydrate thành `Link` (React không hydrate fallback của boundary đang chờ server) → không prefetch dù có bản sửa hay không. Vậy giả thuyết (a) "fallback ở lần tải đầu" **khó xảy ra**; fallback chỉ thành `Link` thật khi được render ở client (VD cây được render lại sau Server Action / refresh mà boundary hiện fallback) — chưa tái hiện được. Bản sửa vẫn giữ (chỉ bớt request, không đổi giao diện); test giữ làm kiểm hồi quy cho khách. Hiệu quả thật với lỗi chập chờn: **chưa kiểm**, theo dõi `cart-account.spec.ts:94` trên CI.

## 5. Tắt JavaScript → trang trắng khi Server Action trả kết quả — đợt riêng sau perf-js (★5)

**Đã biết** (đêm 18→19/10, run 39148697724): POST của Server Action khi tắt JS trên trang có khung tĩnh prerender (Cache Components) chỉ trả phần động (`<div hidden id="S:…">`), không có khung tĩnh → trang trắng; state đã tính đúng (`__next_f`). Action kết thúc bằng redirect không bị.

**Hướng điều tra**
- Next 16.4: tìm issue / discussion "progressive enhancement" + "cacheComponents" / "PPR" + "no JavaScript" + "server action"; đọc `app-render` (nhánh `isAction` + `formState` + resume postponed) để biết có cấu hình nào ép render đầy đủ cho POST.
- Thử nghiệm nhỏ (nhánh nháp): 1 trang thử có form + action trả lỗi, so HTML POST khi (a) Cache Components bật (hiện tại), (b) route động hoàn toàn (`await connection()` đầu page), (c) form trong Suspense động.
- Phương án dự phòng: khi không JS, action trả kết quả bằng redirect về chính trang kèm tham số URL (`?error=CODE` / `?sent=1`), trang đọc tham số trong Suspense (như `UrlNotices`). **Không** đưa email lên URL (URL vào log, lịch sử trình duyệt).
- Kiểm lại danh sách form lúc điều tra: ngoài 6 form đã biết (đăng nhập, gửi lại email, địa chỉ, đánh giá, thanh toán, hủy đơn) còn đăng ký, quên mật khẩu, đặt lại mật khẩu (trả kết quả trong khung tĩnh).

**Ước lượng**: điều tra + thử nghiệm ~0.5–1 ngày; phương án redirect ~1–2 ngày cho các form + e2e không JS.

## 6. Quy tắc ẩn danh mục (hướng A đã quyết) — đã code A1 trên `sau-ux`, chưa merge

Ẩn danh mục = ẩn luôn sách của nó ở trang chủ (đã có), `/sach`, tìm kiếm (palette + trang tìm kiếm), chatbot (`getChatCatalog`). Chi tiết (kiểm kê mọi chỗ liệt kê sách, định nghĩa "danh mục đang hiện", cache, ★ A1 / A2, test): mục "6 — chi tiết" bên dưới.

## 7. Dọn dữ liệu tác giả / tên sách — SQL sửa đã viết (`catalog-fix.sql`), CHƯA chạy

File `supabase/checks/catalog-data-r.sql` (CHỈ ĐỌC) + đề xuất xử lý từng nhóm. Chi tiết: mục "7 — chi tiết" bên dưới. File SQL sửa viết SAU khi chủ dự án duyệt kết quả câu chỉ đọc, theo mẫu `authors-fix` (guard theo id + giá trị cũ, đếm dòng, rollback nếu lệch).

## 8. Docs (P3)

- `CLAUDE.md`, `docs/plans/handoff.md` và chỗ nói về trang lỗi: Vercel gói Hobby chỉ giữ runtime log 1 giờ → tra "mã tra cứu" phải trong 1 giờ; bỏ / sửa mọi đề xuất "xem Vercel Logs hằng tuần".
- File mới `supabase/checks/chat-usage.sql` (CHỈ ĐỌC, 3 câu: lượt gọi Gemini mỗi ngày, khách dùng chatbot mỗi ngày, 10 phút đông nhất); handoff trỏ tới file này (bảng giữ ~3 ngày).
- `docs/progress.md`: thêm "[Mức thấp] Thay 5 bìa sai + 6 bìa đáng ngờ (làm từ từ)"; dòng tắt JS thành "[Đợt riêng sau perf-js]" kèm ghi chú mục 5 (kiểm lại danh sách form; không đưa email lên URL).

## Thứ tự

Phần A (plan này) → mục 1 → 2 → 3 (mỗi mục CI check + e2e xanh) · mục 4 song song trên `diag-rsc-404` · mục 6, 7 (plan + SQL chỉ đọc) · mục 8 → `/baocao`. Chưa merge.

## 6 — chi tiết (plan, chờ duyệt; chưa code)

**Định nghĩa "danh mục đang hiện"**: `categories.is_active` (RLS anon chỉ trả dòng này) **và** là gốc hoặc có cha đang hiện. Dùng lại `visibleCategoryIds(getCategories())` (`src/features/books/utils.ts`). Cây tối đa 2 cấp (admin `checkParent` chặn cấp 3) nên một bước kiểm cha là đủ. Sách `category_id = null` (danh mục bị xóa → `on delete set null`): plan ban đầu đề xuất coi như **không hiện** (★6c); **đã thay bởi quyết định ở mục "Đã code" bên dưới: giữ hành vi hiện tại, vẫn hiện ở mọi danh sách**.

**Kiểm kê chỗ liệt kê sách** (grep `from('books')` / `rpc('search_books')` trong `src`, bỏ admin):

| Chỗ | Hàm (file) | Đang lọc danh mục hiện? | Theo hướng A |
|---|---|---|---|
| Trang chủ: 4 kệ | `getHomeShelves` (`features/books/queries.ts`) | **Có** (`.in('category_id', visibleCategoryIds)`) | giữ |
| `/sach` (lưới + đếm + phân trang + bộ lọc) | `listBooks` qua `withCategoryFilter` (`features/books/listing.ts`) | **Không** (không `cat` → không lọc; `?cat=` nhận cả danh mục con của gốc ẩn) | lọc |
| Trang tìm kiếm `/tim-kiem` | `listBooks({ q })` → RPC `search_books` | **Không** | lọc |
| Palette ⌘K | `searchBookHits` (`/api/search`) → RPC `search_books` | **Không** | lọc |
| Chatbot: catalog ứng viên | `getChatCatalog` (`features/chat/queries.ts`) | **Không** | lọc |
| Chatbot: thẻ sách trả lời | `getChatBookCards(slugs)` | gián tiếp (slug chỉ lấy từ ứng viên, `enum` của Gemini) | không đổi |
| Trang danh mục | `listBooks({ categoryIds })` | danh mục ẩn → 404 (RLS + slug guard); danh mục con của gốc ẩn **vẫn có trang** (e2e dựa vào "gốc ẩn + con đang hiện") | không đổi (★6d) |
| Trang tác giả | `listBooks({ bookIds })` | **Không** | ★6a: đề xuất lọc |
| Kệ "Cùng danh mục" ở trang sách | `getRelatedBooks(bookId, categoryId)` | không cần khi sách thuộc danh mục hiện; sách thuộc danh mục ẩn (mở qua link) thì kệ toàn sách ẩn | ★6a: đề xuất ẩn kệ khi danh mục của sách không hiện |
| Sitemap | `app/sitemap.ts` | **Có** (cây đang hiện, bỏ `category_id null`) | giữ |
| `generateStaticParams` trang sách | `getAllBookSlugs` | không (chỉ prerender) | không đổi (A1) |
| Giỏ khách / giỏ tài khoản / đặt hàng | `cart/queries.ts`, `cart/actions.ts`, RPC | không | không đổi (A1) |

**Cách làm (A1)** — không cần sửa DB: `search_books` là hàm invoker trả `setof books`, PostgREST nhận thêm `.in('category_id', …)` trên kết quả RPC (như filter `price`, `language` đang dùng). Không migration.
- `withCategoryFilter`: chỉ nhận danh mục đang hiện; không `cat` → `categoryIds = visibleCategoryIds(categories)`; `?cat=` chỉ nhận slug trong cây đang hiện. `/sach` và `/tim-kiem` dùng chung.
- `searchBookHits(q)`: đọc `getCategories()` (cache, tag `categories`) → `.in('category_id', visible)`.
- Chatbot: lọc `catalog` **một lần** ngay sau `Promise.all` trong `askMay` (`visibleCategoryIds(categories)`), dùng bản đã lọc cho **cả** `selectCandidates` lẫn `knownSlugs` (chỉ lọc ứng viên thì `knownSlugs` vẫn nhận slug sách ẩn). Sách đang xem thuộc danh mục ẩn vẫn vào prompt qua `fallbackCandidate(current)`: đúng A1 (link trực tiếp vẫn xem được).
- Trang tác giả (nếu ★6a đồng ý): `listBooks({ bookIds, categoryIds: visible })`; tác giả chỉ có sách ẩn → trạng thái rỗng như khi không có sách.
- Kệ "Cùng danh mục" (nếu ★6a đồng ý): danh mục của sách không nằm trong cây hiện → không render kệ.
- Bộ lọc thật dùng `.or(visibleBooksFilter(ids))` (`category_id.is.null,category_id.in.(…)`, ~30 id) → URL PostgREST ngắn; cache key của `listBooks` thêm mảng id (đổi khi danh mục đổi, lúc đó tag `books` cũng hết hạn).

**Cache**: admin ẩn / hiện / đổi cha danh mục → `catalogTagsFor({ kind: 'category' })` trả `categories` + `books` (+ `chat-catalog` qua `adminCatalogTags`). `listBooks`, `searchBookHits`, `getRelatedBooks` gắn tag `books`; `getChatCatalog` gắn `books`, `categories`, `chat-catalog` → đủ, không cần tag mới. Khi làm: kiểm `cache-tags.test.ts` có ca ẩn danh mục.

**★6 A1 / A2** (trang chi tiết / giỏ / đặt hàng với sách thuộc danh mục ẩn):
- **A1** (đề xuất của chủ dự án, đợt này): chỉ ẩn khỏi danh sách; link trực tiếp vẫn xem / thêm giỏ / mua. Công sức ~0.5–1 ngày (4–6 chỗ lọc + test). Không migration.
- **A2**: coi như ngừng bán: trang sách 404 (proxy slug guard + `getBookBySlug` phải biết danh mục), giỏ hiện "Ngừng bán", `place_order` / `quote_*` chặn (migration sửa RPC + `books_public_read` hoặc hàm `private.book_visible`), e2e đặt hàng trên sách e2e (đang ở danh mục gốc ẩn) phải chuyển sang danh mục hiện. Công sức ~2–3 ngày + migration chạy tay + rủi ro đơn đang mở.
- ★6a: lọc cả trang tác giả + ẩn kệ "Cùng danh mục" (đề xuất: có).
- ★6c: sách không có danh mục coi như ẩn (đề xuất: có, khớp trang chủ / sitemap; H3 cho biết bao nhiêu cuốn). → Đã thay bởi quyết định ở mục "Đã code" bên dưới (giữ hành vi hiện tại).
- ★6d: danh mục con của gốc ẩn giữ trang riêng (link trực tiếp) như hiện tại (đề xuất: giữ, e2e admin dựa vào).

**SQL chỉ đọc**: `supabase/checks/hidden-categories-r.sql` (H1 số sách theo trạng thái danh mục, H2 danh mục không hiện còn sách, H3 sách không có danh mục). Chưa chạy.

**Test**
- Vitest: `withCategoryFilter` (không `cat` → id cây hiện; `cat` là con của gốc ẩn → bỏ qua), lọc catalog chatbot (hàm thuần), `visibleCategoryIds` (thiếu ca cha ẩn thì thêm).
- e2e (dữ liệu có sẵn "gốc ẩn + con hiện" + sách `e2e-shop-…` ở danh mục gốc ẩn): sách e2e **không** hiện ở `/sach`, `/tim-kiem?q=<tên>`, palette; vẫn mở được bằng link (A1). Chatbot `[mock:5-books]` không trả sách e2e.
- Rủi ro e2e: spec đang tìm sách e2e qua `/sach` / tìm kiếm / palette sẽ hỏng (ứng viên: `purchase.spec`, `admin-books.spec`, `catalog.spec`, `crawl.spec`; grep khi làm) → sửa spec dùng link trực tiếp hoặc sách thật.

**Xong khi** (sau khi duyệt): các chỗ lọc + ★6a; Vitest + e2e CI xanh; CLAUDE.md ghi quy tắc ("ẩn danh mục = ẩn sách khỏi mọi danh sách; link trực tiếp vẫn mua được").

**Đã code (2026-10-19, chưa merge, chờ duyệt + kết quả H1–H3)** — quyết định: A1; ★6a theo đề xuất (lọc trang tác giả + ẩn kệ "Cùng danh mục"); ★6d theo đề xuất (giữ trang riêng của danh mục con của gốc ẩn); ★6c: **giữ hành vi hiện tại từng chỗ** — sách không có danh mục KHÔNG bị ẩn thêm ở đâu (vẫn hiện ở `/sach`, tìm kiếm, palette, chatbot, trang tác giả như trước; trang chủ / sitemap vốn đã không có).
- `features/books/utils.ts`: `visibleBooksFilter(ids)` (chuỗi `or` của PostgREST: `category_id.is.null,category_id.in.(…)`; rỗng → chỉ `is.null`), `inVisibleCategories(books, categories)` (lọc trong bộ nhớ).
- `listBooks`: tham số `visibleCategoryIds` → `.or(visibleBooksFilter(…))`, dùng được trên bảng lẫn kết quả RPC `search_books`.
- `withCategoryFilter` (`/sach`, `/tim-kiem`): chỉ danh mục đang hiện (chip, `?cat=`); không chọn danh mục → `visibleCategoryIds`.
- `searchBookHits` (palette): đọc `getCategories()` → `.or(…)`; thêm tag `categories`.
- `askMay`: lọc `catalog` một lần (`inVisibleCategories`) cho cả `selectCandidates` lẫn `knownSlugs`.
- Trang tác giả: `listBooks({ bookIds, visibleCategoryIds })`. Trang sách: kệ "Cùng danh mục" chỉ hiện khi danh mục lá nằm trong cây đang hiện.
- Không migration. Cache: không đổi (ẩn / hiện / đổi cha danh mục đã làm mới `categories` + `books` + `chat-catalog`).
- Test: Vitest `listing.test.ts` (mới, 4 ca), `utils.test.ts` (`visibleBooksFilter` 2 ca, `inVisibleCategories` 1 ca); e2e `hidden-category.spec.ts` (mới, 4 test: trang tìm kiếm, `/api/search`, trang tác giả, link trực tiếp + không có kệ; đối chứng sách không có danh mục vẫn hiện). Giới hạn của e2e: danh mục tạo sau build không vào cache `getCategories` (`'max'`) → e2e kiểm đường lọc được nối vào từng chỗ, logic cây (con của gốc ẩn) kiểm ở Vitest. Chatbot chưa có e2e riêng (catalog chatbot cache theo giờ, sách tạo trong test không vào) → Vitest `inVisibleCategories`.
- CI: `1e8d0dd` → `da7433a` e2e 421 qua / 9 skip / 0 flaky (run 39251380596); `60d2617` e2e xanh (run 39252747366). Sau review: spec đổi tên `hidden-category-account.spec.ts` (chạy sau setup, trước teardown), thêm `showRelatedShelf` + Vitest, Vitest `askMay` lọc catalog.
- `measure:js` (build với DB production, cùng máy): trước / sau giống hệt — trang chủ (`vi`) +42.2KB, `/sach` (`vi/books`) +55.3KB, trang sách (`vi/books/sapiens`) +45.3KB (thay đổi chỉ ở server).
- **Đo tác động trên dữ liệu thật (2026-10-19, Claude in Chrome, chỉ đọc; thay cho H1–H3)**: PROD = https://nha-sach-may.vercel.app (code cũ), PREV = https://nha-sach-may-git-sau-ux-khangtpvl1-3775.vercel.app (deploy `0ec2cab`, xác nhận trên trang deployment của Vercel), cùng DB production.
  - Danh mục (admin PROD): 24 danh mục, **tất cả "Đang hiện"**, không có danh mục ẩn, không có danh mục con nào dưới gốc ẩn.
  - `/sach`: PROD 189 cuốn, PREV 189 cuốn; tập slug thu qua 8 trang giống hệt (SHA-256 16 ký tự đầu `87e756422f90d795` ở cả hai) → **0 sách biến mất** khi merge (với dữ liệu hiện tại).
  - Kiểm mẫu trên PREV: `/tim-kiem?q=sapiens` 2 cuốn, `/api/search?q=sapiens` 2 gợi ý, `/sach/sapiens` 200 và có kệ "Cùng danh mục" (danh mục đang hiện).
  - Sách không có danh mục (★6c): admin `/admin/sach` 189 dòng (mọi trạng thái), **0 dòng thiếu danh mục**, 0 sách "Đã ẩn" → quyết định ★6c hiện không ảnh hưởng sách nào.
  - Chatbot: không test (Preview không có key Gemini), dựa vào Vitest.

## 7 — chi tiết (plan, chờ duyệt; chưa có SQL sửa)

**SQL chỉ đọc**: `supabase/checks/catalog-data-r.sql` (chưa chạy):
- R1 tác giả đã biết (86/87/88, 113/114, 90/92, 93/94, 75, 22, 24, 89, 107) kèm sách + vai trò;
- R2 tìm thêm cặp trùng (từ đầu + từ cuối của slug, bỏ chữ viết tắt 1 ký tự: `peter-f-drucker` ~ `peter-drucker`);
- R3 tác giả "A và B" / "A and B" / "&" / ",";
- R4 tác giả là tổ chức / chung chung, kèm số tác giả khác của từng sách;
- R5 tên sách tiếng Việt không dấu (≥ 3 từ, không có chữ cái riêng tiếng Việt; xem từng dòng);
- R6 "chân dùng";
- R7 tên còn hậu tố định dạng + `format` hiện tại + `format` / tên đề xuất.

**Đề xuất xử lý** (SQL sửa viết sau khi duyệt kết quả, theo mẫu `authors-fix.sql`: một transaction, guard theo id + giá trị cũ, đếm dòng, lệch → `raise exception` → rollback; phần 2 chỉ đọc để kiểm; không đổi slug; sau khi chạy: Redeploy Vercel vì SQL chạy ngoài app không làm mới cache):
- **Gộp tác giả trùng**: giữ id có tên đầy đủ / đúng nhất, hòa thì id nhiều sách hơn rồi id nhỏ hơn (chốt sau R1); chuyển `book_authors` sang id giữ (bỏ dòng trùng khóa chính), xóa id thừa. Trang tác giả của slug thừa thành 404 như authors-fix (★7a: hoặc giữ id thừa không sách).
- **id 75 "Trần Tuyết Nhung và Anthony Reid"**: đổi tên id 75 thành "Trần Tuyết Nhung" (giữ slug cũ), tạo tác giả "Anthony Reid" (slug `anthony-reid` nếu chưa có), gắn vào cùng các sách với cùng vai trò.
- **Tổ chức / chung chung** (22 Nhà xuất bản Kim Đồng, 24 Nhiều tác giả, 89 Harvard Business Review, 107 Ladybird): **★7b** — (a) bỏ liên kết khi sách còn tác giả khác, giữ khi là tác giả duy nhất (thẻ sách không trống); (b) bỏ hết; (c) giữ nguyên. Đề xuất (a); "Nhiều tác giả" giữ (đúng nghĩa với tuyển tập).
- **Tên không dấu** (R5): sửa tay từng cuốn theo bìa (chủ dự án xác nhận tên đúng), không suy tự động.
- **"chân dùng" → "chân dung"** (R6).
- **Hậu tố định dạng** (R7): bỏ hậu tố khỏi `title`, đặt `format` theo hậu tố khi đang sai; `search_text` do trigger tự tính lại; slug giữ.

**Xong khi** (đợt này): file chỉ đọc + plan; chủ dự án chạy R1–R7, dán kết quả, duyệt ★7a / ★7b → đợt sau viết `supabase/checks/catalog-data-fix.sql`.

**SQL sửa đã viết (2026-10-19, CHƯA chạy)**: `supabase/checks/catalog-fix.sql` theo danh sách chủ dự án duyệt. Phần 0 (chỉ đọc) lưu slug hiện tại để đối chiếu. Review toàn đợt: thêm guard "tên mới không trùng sách khác đang có" (bản bìa mềm "Lịch Sử Việt Nam Thời Tự Chủ - Tập Hai" đã có) → tên mới của bản bìa cứng là "Lịch Sử Việt Nam Thời Tự Chủ - Tập Hai (bìa cứng)"; C5 thêm `so_sach_cung_ten`. Chủ dự án đã chạy thử bản này trên bản sao schema có dữ liệu mẫu giống production (2026-10-19): chạy đúng; tên trùng → rollback cả khối. Phần 1 một khối DO (lệnh nguyên tử, không bọc begin / commit), mỗi thay đổi guard theo id + tên cũ (tên sách: tên cũ chính xác, đúng 1 dòng), đếm dòng, lệch → `raise exception` → rollback cả khối:
1. Gộp (id giữ ← id gộp): 87 "Peter F. Drucker" ← 86 "Peter Ferdinand Drucker", 88 "Peter Drucker"; 114 "Stephen Hawking" ← 113 "Stephen W. Hawking"; 90 "Jim Collins" ← 92 "James Charles Collins"; 94 "Jerry Porras" ← 93 "Jerry I. Porras". Chuyển `book_authors` (`on conflict do nothing`), kiểm mọi liên kết đã có ở id giữ, rồi xóa liên kết + tác giả của id gộp (đúng 5). Không gộp 101 / 104 (Covey), không đụng 99.
2. Tách id 75 → "Trần Tuyết Nhung" (giữ slug); "Anthony Reid" (slug `anthony-reid`, đã có thì dùng dòng đó) gắn đúng các sách của id 75, cùng vai trò.
3. Bỏ liên kết 89 "Harvard Business Review" khỏi "The Peter F. Drucker Reader" và 107 "Ladybird" khỏi "Ladybird Readers Level 4 - Roald Dahl - Esio Trot (ELT Graded Reader)" chỉ khi sách còn ≥ 1 tác giả role `author` khác (sau bước gộp); xóa 89 / 107 nếu không còn liên kết (còn thì NOTICE, giữ). Giữ 22, 24.
4. Tên sách (giữ slug): "Kien Chuot Va Ruoi" → "Kiến, Chuột và Ruồi"; "chân dùng" → "chân dung"; bỏ hậu tố định dạng ở 4 sách, `format` = hardcover / paperback / hardcover / hardcover.
Phần 2 (chỉ đọc) C1–C7 có cột mong đợi. Sau khi chạy: Redeploy Vercel. R2 / R5 tìm thêm: file sau.
