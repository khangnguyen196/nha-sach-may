# Đợt "sau-ux"

Trạng thái: **plan đã duyệt 2026-10-19 (có chỉnh)**, đang làm trên nhánh `sau-ux` (tạo từ `main` `1016280`). Mục 4 làm ở nhánh `diag-rsc-404` (không bao giờ merge). Mục 6, 7: chỉ plan + SQL chỉ đọc, chờ duyệt.

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
- Code chết: `email_address_invalid` / `email_address_not_authorized` trong `AUTH_ERRORS`, `'emailRejected'` trong `VALIDATION_KEYS`, `validation.emailRejected` (vi / en) → xóa nếu grep không còn nơi dùng.
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
- `e2e.yml`: bước mới **sau** Playwright, `if: ${{ !cancelled() }}` (lệch kiểu không chặn e2e):
  `supabase gen types typescript --local --schema public --schema graphql_public > "$RUNNER_TEMP/database.ts"` → upload artifact `database-types` (luôn) → `diff -u src/types/database.ts "$RUNNER_TEMP/database.ts"`.
- `supabase start -x imgproxy,postgres-meta,supavisor`: `gen types --local` dùng image pg-meta. Thử trước với `-x` như cũ; CLI không chạy được (hoặc chậm vì kéo image) thì bỏ `postgres-meta` khỏi `-x`.
- Lượt đầu chế độ báo (`continue-on-error: true` + in diff) → tải artifact, commit làm `database.ts` chuẩn (★3 a), `typecheck` sạch → bật fail (bỏ `continue-on-error`).
- Quy trình cập nhật types về sau (máy dev không có Docker): đổi `schema.sql` → push → bước CI đỏ, artifact `database-types` có bản đúng → `gh run download <run> -n database-types` → chép vào `src/types/database.ts` → `npm run typecheck` → commit. CLAUDE.md: thay lệnh `--project-id` ở mục Lệnh và mục Database ("sinh lại types") bằng quy trình này.
- Lưu ý: bản `--local` có `PostgrestVersion` của stack local; đổi version làm đổi suy luận kiểu của postgrest-js → sau khi sinh lại phải `typecheck`, và để ý tính năng PostgREST mà production không có.

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

## 5. Tắt JavaScript → trang trắng khi Server Action trả kết quả — đợt riêng sau perf-js (★5)

**Đã biết** (đêm 18→19/10, run 39148697724): POST của Server Action khi tắt JS trên trang có khung tĩnh prerender (Cache Components) chỉ trả phần động (`<div hidden id="S:…">`), không có khung tĩnh → trang trắng; state đã tính đúng (`__next_f`). Action kết thúc bằng redirect không bị.

**Hướng điều tra**
- Next 16.4: tìm issue / discussion "progressive enhancement" + "cacheComponents" / "PPR" + "no JavaScript" + "server action"; đọc `app-render` (nhánh `isAction` + `formState` + resume postponed) để biết có cấu hình nào ép render đầy đủ cho POST.
- Thử nghiệm nhỏ (nhánh nháp): 1 trang thử có form + action trả lỗi, so HTML POST khi (a) Cache Components bật (hiện tại), (b) route động hoàn toàn (`await connection()` đầu page), (c) form trong Suspense động.
- Phương án dự phòng: khi không JS, action trả kết quả bằng redirect về chính trang kèm tham số URL (`?error=CODE` / `?sent=1`), trang đọc tham số trong Suspense (như `UrlNotices`). **Không** đưa email lên URL (URL vào log, lịch sử trình duyệt).
- Kiểm lại danh sách form lúc điều tra: ngoài 6 form đã biết (đăng nhập, gửi lại email, địa chỉ, đánh giá, thanh toán, hủy đơn) còn đăng ký, quên mật khẩu, đặt lại mật khẩu (trả kết quả trong khung tĩnh).

**Ước lượng**: điều tra + thử nghiệm ~0.5–1 ngày; phương án redirect ~1–2 ngày cho các form + e2e không JS.

## 6. Quy tắc ẩn danh mục (hướng A đã quyết) — chỉ plan + SQL chỉ đọc, chờ duyệt

Ẩn danh mục = ẩn luôn sách của nó ở trang chủ (đã có), `/sach`, tìm kiếm (palette + trang tìm kiếm), chatbot (`getChatCatalog`). Chi tiết (kiểm kê mọi chỗ liệt kê sách, định nghĩa "danh mục đang hiện", cache, ★ A1 / A2, test): mục "6 — chi tiết" bên dưới.

## 7. Dọn dữ liệu tác giả / tên sách — chỉ plan + SQL chỉ đọc, chờ duyệt

File `supabase/checks/catalog-data-r.sql` (CHỈ ĐỌC) + đề xuất xử lý từng nhóm. Chi tiết: mục "7 — chi tiết" bên dưới. File SQL sửa viết SAU khi chủ dự án duyệt kết quả câu chỉ đọc, theo mẫu `authors-fix` (guard theo id + giá trị cũ, đếm dòng, rollback nếu lệch).

## 8. Docs (P3)

- `CLAUDE.md`, `docs/plans/handoff.md` và chỗ nói về trang lỗi: Vercel gói Hobby chỉ giữ runtime log 1 giờ → tra "mã tra cứu" phải trong 1 giờ; bỏ / sửa mọi đề xuất "xem Vercel Logs hằng tuần".
- File mới `supabase/checks/chat-usage.sql` (CHỈ ĐỌC, 3 câu: lượt gọi Gemini mỗi ngày, khách dùng chatbot mỗi ngày, 10 phút đông nhất); handoff trỏ tới file này (bảng giữ ~3 ngày).
- `docs/progress.md`: thêm "[Mức thấp] Thay 5 bìa sai + 6 bìa đáng ngờ (làm từ từ)"; dòng tắt JS thành "[Đợt riêng sau perf-js]" kèm ghi chú mục 5 (kiểm lại danh sách form; không đưa email lên URL).

## Thứ tự

Phần A (plan này) → mục 1 → 2 → 3 (mỗi mục CI check + e2e xanh) · mục 4 song song trên `diag-rsc-404` · mục 6, 7 (plan + SQL chỉ đọc) · mục 8 → `/baocao`. Chưa merge.
