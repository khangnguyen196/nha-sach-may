# Đợt "sau-ux" (plan, chưa làm)

Trạng thái: **plan, chờ duyệt** (viết 2026-10-19 trên nhánh `sau-ux`, tạo từ `main` `1016280`). Chưa sửa code.

Bối cảnh: đợt `ux-messages` đã lên production 2026-10-19, migration A + B đã chạy (`docs/plans/ux-messages.md`). Đợt này dọn các việc còn lại của nó (`docs/progress.md`) trước đợt perf-js (`docs/plans/perf-js.md`).

Quy ước chung cho mọi mục: nhánh `sau-ux`, làm trong worktree riêng; mỗi mục một commit (hoặc vài commit); `typecheck`, `lint`, Vitest, `build`, e2e CI xanh trước khi sang mục sau; không thêm dependency; không chạy SQL trên Supabase thật (mục này không cần migration); không xóa / skip / nới test (đổi chuỗi expected thì liệt kê cũ → mới).

## 1. Đăng ký không để lộ email nào có tài khoản

**Hiện trạng** (`src/features/auth/actions.ts` `signUp`): mọi lỗi của GoTrue trừ `EMAIL_TAKEN` đều báo ra form (`authFailure` → `withAuthMessage`). `RATE_LIMITED`, `email_address_invalid` (dưới ô Email), `email_address_not_authorized`, 5xx (`NETWORK_ERROR` / `UNKNOWN`)… đều khác câu "Kiểm tra hộp thư".

**Đối chiếu GoTrue** (`supabase/auth` `internal/api/signup.go`, đọc 2026-10-19):
- TRƯỚC khi tìm user (không nói gì về tài khoản, vẫn báo):
  - `config.DisableSignup` → `signup_disabled`
  - `validateSignupParams`: thiếu mật khẩu / kênh sai → `validation_failed`; `checkPasswordStrength` → `weak_password`
  - `!config.External.Email.Enabled` → `email_provider_disabled`
  - `validateEmail` (rỗng, > 255 ký tự, sai dạng) → `validation_failed`
- SAU khi tìm user (`models.IsDuplicatedEmail`), khác nhau theo email:
  - đã có + đã xác nhận → trả 200 với user giả (không gửi thư); bật autoconfirm thì `user_already_exists` 422
  - đã có + chưa xác nhận → gửi lại thư xác nhận (`sendConfirmation`: kiểm tần suất theo `ConfirmationSentAt` → 429 "after N seconds", SMTP lỗi → `email_address_*` / 5xx)
  - chưa có → tạo user + `sendConfirmation` (lỗi gửi thư cũng ra 429 project / `email_address_*` / 5xx); hook `before_user_created` (project chưa bật) chỉ chạy với user mới
  - lỗi DB tìm user → 500 "Database error finding user"
- → Các mã sau lookup có thể khác nhau giữa email có / không có tài khoản: phải cùng một kết quả.

**Cách làm**
- `signUp`: báo lỗi CHỈ khi
  - zod chặn (đã có, trước khi gọi GoTrue);
  - không tới được máy chủ (`error.status === 0`, như `unreachableOnly`);
  - mã GoTrue kiểm trước lookup: `weak_password` (dưới ô Mật khẩu, giữ `fieldErrors`), `validation_failed` (đầu form), `signup_disabled` / `email_provider_disabled` (`SIGNUP_DISABLED`).
- Mọi mã khác (`email_address_invalid`, `email_address_not_authorized`, mọi 429, 5xx, `user_already_exists`, mã lạ) → cùng kết quả thành công "Kiểm tra hộp thư"; log chỉ ghi mã (như `unreachableOnly`). Danh sách mã "trước lookup" là allowlist ở một chỗ (VD `PRE_LOOKUP_SIGNUP_CODES` trong `features/auth/errors.ts`), comment trỏ file / dòng GoTrue.
- `data.session` (autoconfirm) giữ redirect `/account` như cũ.
- Câu thành công (`auth.register.checkInbox`, vi / en) phải bao cả trường hợp thư không tới. Đề xuất:
  - vi: "Nếu email dưới đây chưa có tài khoản đã xác nhận, liên kết xác nhận sẽ tới trong vài phút. Không thấy thư thì bạn xem mục Spam hoặc thử lại sau vài phút."
  - en: "If the email below doesn't have a confirmed account yet, a confirmation link will arrive within a few minutes. If you don't see it, check your Spam folder or try again in a few minutes."
- `CLAUDE.md`: mở rộng quy ước "Quên mật khẩu / gửi lại xác nhận" thành "Quên mật khẩu / gửi lại xác nhận / đăng ký" (đăng ký có thêm allowlist mã trước lookup).

**Test**
- Vitest `src/features/auth/actions.test.ts` thêm `describe('signUp')` (mock như 2 action kia):
  - trước lookup báo đúng: `weak_password` → lỗi dưới ô Mật khẩu; `validation_failed` → đầu form; `signup_disabled` / `email_provider_disabled` → `SIGNUP_DISABLED`; status 0 → `NETWORK_ERROR`; zod → không gọi GoTrue.
  - sau lookup cùng kết quả "đã gửi": `email_address_invalid`, `email_address_not_authorized`, 429 theo user, 429 project, 500 / 503 (`AuthRetryableFetchError` không code), `user_already_exists`, mã lạ, không lỗi; log 1 lần kèm label, không chứa email.
  - Kiểm ít nhất ca 429 theo user và `email_address_invalid` FAIL với code hiện tại.
- e2e `auth-email.spec` (đăng ký en): câu "Check your inbox" mới (đổi chuỗi expected → liệt kê). Không thêm e2e cho 429 (nhịp của GoTrue dễ chập chờn).
- `features/auth/errors.test.ts`: test cho allowlist (mã trong / ngoài).

**Rủi ro**
- Người đăng ký thật gặp lỗi gửi thư (SMTP hỏng, hết quota email của project) chỉ thấy "Kiểm tra hộp thư" và không nhận thư → câu đã có "thử lại sau vài phút"; lỗi vẫn có trong log Vercel (mã).
- Dò qua thời gian phản hồi vẫn còn (GoTrue gửi thư đồng bộ): đã chấp nhận (`docs/progress.md`).
- Bản GoTrue của Supabase hosted có thể khác `master`: allowlist chỉ chứa mã chắc chắn kiểm trước lookup; mã lạ mặc định "đã gửi" (an toàn).

**Xong khi**: Vitest + e2e CI xanh; chỉ còn các mã trong allowlist + `NETWORK_ERROR` + zod hiện lỗi ở trang đăng ký; `CLAUDE.md`, `docs/progress.md` cập nhật (bỏ dòng "[Đã quyết – nhánh riêng sau merge] Đăng ký…").

## 2. Xóa `INVALID_VOUCHER` (migration B đã chạy)

**Kiểm DB**: `grep INVALID_VOUCHER supabase/` (2026-10-19, `main` `1016280`):
- `schema.sql:1422`: chỉ trong comment danh sách mã lỗi ("bản cũ trước ux-messages B, không còn hàm nào trả").
- `migrations/20261018130000_error_reasons.sql:3`: comment (mô tả việc tách mã).
- `checks/ux-messages-b.sql:8`: câu kiểm tra `not like '%INVALID_VOUCHER%'` (KB, đã chạy, khớp).
- `migrations.test.ts:175`: test "voucher_discount báo từng lý do, không còn INVALID_VOUCHER".
- Không còn `raise exception 'INVALID_VOUCHER'` nào trong `schema.sql` (test tĩnh trong `src/lib/errors.test.ts` đọc mọi `raise exception` cũng sẽ báo nếu còn).

**Cách làm**
- `src/lib/errors.ts`: bỏ `'INVALID_VOUCHER'` khỏi `ERROR_CODES` + sửa comment.
- `src/features/checkout/voucher-errors.ts`: bỏ khỏi `VOUCHER_ERRORS`, sửa comment.
- `messages/vi.json`, `messages/en.json`: bỏ `errors.INVALID_VOUCHER` (test so key / so `ERROR_CODES` giữ cân bằng).
- `schema.sql:1422`: xóa dòng comment (không đổi SQL; `migrations.test` vẫn qua).
- Tests:
  - `legacy-error-codes.test.ts` (3 ca "mã lỗi cũ" từ lúc deploy app tới lúc chạy B): `INVALID_VOUCHER` → câu chung; `VOUCHER_MIN_ORDER` thiếu `shortfall` → tự tính từ tạm tính; `ORDER_NOT_CANCELLABLE` → "tải lại trang" + `refresh()`. B đã chạy nên DB không còn trả 2 ca đầu; `ORDER_NOT_CANCELLABLE` DB vẫn trả (đơn không có / của người khác). **★2**: (a) bỏ ca `INVALID_VOUCHER`, giữ 2 ca còn lại (ca `VOUCHER_MIN_ORDER` thành test phòng thủ cho detail thiếu `shortfall`), sửa comment đầu file + tên `describe` (không còn là "mã cũ") — đề xuất; (b) xóa cả file, chuyển ca `ORDER_NOT_CANCELLABLE` sang test của `features/orders/actions`.
  - `voucher-errors.test.ts:28`: bỏ `INVALID_VOUCHER` khỏi danh sách kiểm.
  - `minOrderShortfall` khi detail thiếu `shortfall`: giữ (phòng thủ, không tốn gì).
- `CLAUDE.md`: bỏ câu "`INVALID_VOUCHER` chỉ còn để chạy được trước migration B…".
- Docs: `docs/progress.md` bỏ dòng "[B đã chạy, làm được (đợt sau-ux)]…" (phần `INVALID_VOUCHER`).

**Rủi ro**: bản app cũ không còn chạy ở đâu (production = `main` mới) → không còn ai cần mã cũ. Xóa nhầm câu dịch đang dùng → test so key / `ERROR_CODES` bắt.

**Xong khi**: `grep -rn INVALID_VOUCHER src messages e2e` rỗng (chỉ còn trong `supabase/migrations`, `checks` và docs lịch sử); Vitest + e2e CI xanh.

## 3. Kiểm `src/types/database.ts` tự động trên CI

**Hiện trạng**: `database.ts` sửa tay theo migration A (★ ux-messages), chưa sinh lại từ DB thật; CLAUDE.md có lệnh `supabase gen types … --project-id` (cần đăng nhập Supabase, chỉ máy dev).

**Cách làm** (không cần quyền vào Supabase thật)
- `.github/workflows/e2e.yml`, sau bước "Supabase local" (DB dựng từ `schema.sql` + seed, CLI 2.121.0 ghim sẵn): bước mới
  `supabase gen types typescript --local --schema public --schema graphql_public > "$RUNNER_TEMP/database.ts"` rồi `diff -u src/types/database.ts "$RUNNER_TEMP/database.ts"`.
- File hiện có sinh từ project cloud: có khối `__InternalSupabase: { PostgrestVersion: "14.18" }` và schema `graphql_public`. Bản `--local` có thể khác PostgREST version / thứ tự. **★3**: (a) sinh lại `database.ts` bằng `--local` một lần (commit bản đó làm chuẩn, so chính xác từ đó về sau) — đề xuất; (b) so sau khi chuẩn hóa (bỏ dòng `PostgrestVersion`, sắp khối).
- Lượt đầu chạy ở chế độ báo (không làm fail job, `continue-on-error: true` + in diff) để xem khác gì; khớp rồi mới bật fail.
- Script nhỏ `scripts/check-types.mjs`? Không cần: `diff` trong YAML là đủ (giữ đơn giản).
- Docs: CLAUDE.md mục Lệnh / Database ghi "types kiểm trên CI bằng `--local`"; `docs/progress.md` bỏ phần "chạy lại `supabase gen types`".

**Test**: chính bước CI (đổi tạm một kiểu trong `database.ts` trên nhánh nháp → bước fail, như cách kiểm test ở đợt trước; không commit bản tạm).

**Rủi ro**: kiểu do `supabase gen types` sinh từ DB local khác cloud ở phần ngoài `public` (extension, `graphql_public`) → chỉ so `public` + `graphql_public` (`--schema`). CLI đổi format giữa phiên bản → đã ghim 2.121.0.

**Xong khi**: bước CI chạy ở chế độ fail, xanh trên `sau-ux`; đổi tạm kiểu → đỏ (đã kiểm).

## 4. Request RSC 404 `/dang-nhap?next=%2Ftai-khoan&_rsc=…` — chẩn đoán trước, chưa sửa

**Đã biết**: `cart-account.spec.ts:94` (desktop-account) chập chờn 2/5 lượt đêm 18→19/10, qua ở retry; console "Failed to load resource: 404 … /dang-nhap?next=%2Ftai-khoan&_rsc=IP9tvrHI0WPQ482u" (cùng `_rsc` cả 2 lần). Có từ trước ux-messages. Giả thuyết: router prefetch / điều hướng `/tai-khoan` khi phiên vừa hết → proxy 307 sang `/dang-nhap?next=…` → request RSC (Partial Prefetching / segment prefetch) tới URL đó nhận 404.

**Kế hoạch chẩn đoán**
1. Tái hiện chắc chắn: spec nháp `e2e/diag-rsc-404.spec.ts` (chỉ trên nhánh chẩn đoán, không merge): đăng nhập → đăng xuất → trang chủ → hover / prefetch link "Tài khoản", lặp `--repeat-each 20` trên CI; ghi mọi response ≥ 400 kèm header request (`next-router-prefetch`, `next-router-segment-prefetch`, `rsc`, `next-router-state-tree`), status chuỗi redirect (`response.request().redirectedFrom()`), và header response (`x-middleware-rewrite`, `location`, `x-nextjs-*`).
2. Thêm log tạm có điều kiện ở `src/proxy.ts` (chỉ khi `E2E_FAULT_INJECTION=1`, tức chỉ e2e; không bao giờ production): mọi request có `_rsc` / header RSC tới `/dang-nhap` → in method, pathname + search, header RSC, quyết định của proxy (redirect / rewrite / next).
3. Phân loại kết quả: 404 do proxy (rewrite `__not-found`?), do Next (segment prefetch cho route có search params / route khác root layout `(auth)`?), hay do `authRedirect` khi `signedIn` đổi giữa chừng.
4. Báo lại kèm log trước khi đề xuất sửa (theo quy ước ★ ux-messages: có URL / log rồi mới sửa).

**Xong khi**: có ≥ 3 lần tái hiện kèm log đủ để chỉ ra tầng trả 404; báo cáo + đề xuất sửa; gỡ log / spec nháp.

**Rủi ro**: không tái hiện được trong 20 lượt → tăng `--repeat-each`, hoặc dừng và ghi lại (không sửa theo đoán).

## 5. Tắt JavaScript → trang trắng khi Server Action trả kết quả — chỉ ghi hướng điều tra

**Đã biết** (đêm 18→19/10, run 39148697724): POST của Server Action khi tắt JS trên trang có khung tĩnh prerender (Cache Components) chỉ trả phần động (`<div hidden id="S:…">`), không có khung tĩnh → trang trắng; state đã tính đúng (`__next_f`). Action kết thúc bằng redirect không bị.

**Hướng điều tra**
- Next 16.4: tìm issue / discussion "progressive enhancement" + "cacheComponents" / "PPR" + "no JavaScript" + "server action"; đọc `app-render` (nhánh `isAction` + `formState` + resume postponed) để biết có cấu hình nào ép render đầy đủ cho POST (VD tắt PPR riêng route bằng segment config, nếu Cache Components còn cho phép).
- Thử nghiệm nhỏ (nhánh nháp): 1 trang thử có form + action trả lỗi, so HTML POST khi (a) Cache Components bật (hiện tại), (b) route đánh dấu động hoàn toàn (`await connection()` ở đầu page), (c) form nằm trong Suspense động.
- Phương án dự phòng không phụ thuộc Next: khi không JS, action trả kết quả bằng redirect về chính trang kèm tham số URL (`?error=CODE` / `?sent=1`), trang đọc tham số trong Suspense (như `UrlNotices`). Có JS thì giữ hành vi hiện tại.

**Ước lượng**
- Điều tra + thử nghiệm: ~0.5–1 ngày.
- Nếu cần phương án redirect: ~1–2 ngày cho 6 form (đăng nhập, gửi lại email, địa chỉ, đánh giá, thanh toán, hủy đơn) + e2e không JS cho từng form.

**★5**: làm trong đợt này hay để đợt riêng? Đề xuất: **đợt riêng** sau perf-js (ảnh hưởng ít người dùng; chạm 6 form và cách bố trí form của trang đăng nhập).

## Thứ tự đề xuất

1 (bảo mật) → 2 (dọn nhỏ) → 3 (CI) → 4 (chẩn đoán, có thể chạy song song với 2–3 vì chỉ đụng e2e nháp + log có điều kiện) → 5 (chỉ ghi chú, theo ★5).

## ★ Cần chủ dự án quyết

- ★1 Câu "Kiểm tra hộp thư" mới của đăng ký (mục 1): dùng câu đề xuất hay chỉnh lại?
- ★2 `legacy-error-codes.test.ts` sau khi xóa `INVALID_VOUCHER`: (a) giữ file, bỏ ca `INVALID_VOUCHER` (đề xuất); (b) xóa cả file.
- ★3 `database.ts`: (a) sinh lại bằng `--local` làm chuẩn, so chính xác (đề xuất); (b) so sau khi chuẩn hóa.
- ★4 Mục 4 (RSC 404): cho phép log tạm có điều kiện `E2E_FAULT_INJECTION=1` trong `src/proxy.ts` trên nhánh chẩn đoán (không merge)?
- ★5 Mục 5 (tắt JS): làm trong đợt này hay đợt riêng (đề xuất: đợt riêng sau perf-js)?
- ★6 Thứ tự: sau-ux trước perf-js như handoff (đề xuất giữ), hay xen kẽ?
