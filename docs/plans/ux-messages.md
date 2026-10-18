# Đợt sửa "ux-messages" (sau Phase 11)

Trạng thái: **plan đã duyệt (2026-10-18)**, đang ở bước 2 (migration + SQL kiểm tra, chưa code app). Nhánh `ux-messages` tạo từ `origin/main` `fa78aab`.

Mục tiêu: khách luôn hiểu chuyện gì đang xảy ra.
- Lỗi do khách: nói đúng lý do và cách làm tiếp, đặt ngay chỗ liên quan.
- Lỗi do web: sửa tận gốc; chỗ còn có thể lỗi thì hiện câu trung tính kèm mã tra cứu và email liên hệ.

Quy ước trong file này:
- "Hiện trạng" trích từ code ở `fa78aab`.
- Câu mới ghi **vi / en**. Riêng namespace `chat` chỉ có vi.
- `{email}` là hằng `SUPPORT_EMAIL` (mục 10).
- Mã lỗi mới đều thêm vào `ERROR_CODES` (`src/lib/errors.ts`) và `errors.*` ở cả hai file messages (test so key).

## ★ Quyết định (đã duyệt 2026-10-18)

- ★1 `false` · ★2 hiện mờ · ★3 tách 2 file A / B · ★4 tách · ★5 không thêm · ★7 giữ slug · ★8 hiện digest, sửa `CLAUDE.md` · ★9, ★10, ★11 đồng ý.
- **★6 đổi**: **không** thêm query ở proxy cho `/tai-khoan/don-hang?page>1`. Giữ soft 404 (HTTP 200) như trang lưới, dùng `NotFoundView kind="page"` (câu chung + link "Về trang đầu", `notFound.firstPage`). Lý do: trang riêng tư, không index; 404 thật không có lợi mà thêm một query. Ghi vào handoff là đã quyết, đóng mục mở.
- **★12** đồng ý: chỉ lọc kệ trang chủ. Handoff "đợt sau": `/sach`, tìm kiếm **và** catalog chatbot (`getChatCatalog`) cũng chưa loại sách thuộc danh mục ẩn → cần quyết quy tắc chung.
- Thêm: mỗi migration kèm câu SQL kiểm tra (chỉ đọc hoặc tự rollback bằng lỗi cố ý, có cột "mong đợi"): `supabase/checks/ux-messages-a.sql`, `ux-messages-b.sql`.
- Thêm: mục 15 làm commit chẩn đoán trước; log URL ra request khác thì **dừng, báo** trước khi sửa.

Bảng đề xuất ban đầu (giữ để tra):

| # | Câu hỏi | Đề xuất |
|---|---|---|
| ★1 | Mã đang có (`CHAOBAN10`, `GIAM20K` + mã bạn tạo trên production) mặc định `is_public` = ? | **`false`** (cột `default false`): admin chủ động bật từng mã, không lộ mã nội bộ. `seed.sql` đặt `true` cho 2 mã seed để e2e / máy local có gợi ý. |
| ★2 | Mã chưa đủ điều kiện trong danh sách gợi ý: hiện mờ hay ẩn? | **Hiện mờ** + lý do ("Mua thêm 50.000 ₫…"): khách biết mua thêm là được giảm. Chỉ áp cho lý do "chưa đủ đơn tối thiểu" (lý do duy nhất còn lại sau khi RPC đã lọc tắt / chưa tới ngày / hết hạn / hết lượt). |
| ★3 | **Thứ tự chạy migration.** Bạn muốn một file chung cho mục 1 + 1b. Nhưng đổi mã lỗi trong `voucher_discount` / `cancel_order` làm **bản app đang chạy** gặp mã lạ: `getCheckoutQuote` ném lỗi với mã voucher không quen → `/thanh-toan?voucher=SAI` ra trang lỗi; hủy đơn hiện "Đã có lỗi xảy ra". Còn cột `is_public` + RPC thì code mới cần có trong DB trước (sinh types). | **Tách 2 file**: **A** (chỉ thêm: cột `is_public`, RPC `checkout_vouchers`) chạy trước khi code, để sinh types; **B** (mã lỗi mới của `voucher_discount`, `cancel_order`) chạy **sau** khi bản app mới đã deploy (app mới hiểu cả mã cũ lẫn mã mới). Nếu bạn vẫn muốn một file: chạy ngay sau khi merge + deploy, app viết tay types cho cột / RPC rồi sinh lại để so, và trong vài phút giữa deploy và migration thì trang admin voucher lỗi, nút "Chọn mã" ẩn. |
| ★4 | Tách "không tồn tại" và "đang tắt" giúp người dò mã biết mã nào có thật (không có giới hạn tần suất thử mã). | Làm đúng yêu cầu (tách). Câu "đang tắt" không nói thêm gì về mã ("Mã này hiện đã ngừng áp dụng"). Rủi ro chấp nhận được với dự án học tập; ghi vào rủi ro còn lại. |
| ★5 | Giới hạn lượt dùng **mỗi tài khoản**: schema hiện **không có** (chỉ `usage_limit` chung). | **Không thêm** trong đợt này; ghi rõ "chưa có" trong plan. Muốn thì làm riêng (cột `per_user_limit` + đếm `orders` theo `user_id`, chặn trong `place_order`). |
| ★6 | `/tai-khoan/don-hang?page=99`: trả 404 thật? | **Có**, proxy kiểm **chỉ khi `page > 1`** (đếm `orders` theo `user_id` + lọc trạng thái, một query head). Khác trang lưới (bỏ vì mọi trang > 1 chậm thêm ~100 ms): đây là trang theo phiên, vốn đã động, ít người sang trang 2. Nếu bạn không muốn thêm query ở proxy: giữ soft 404 như trang lưới. |
| ★7 | Sửa tên tác giả ngược: slug giữ nguyên hay đổi? | **Giữ slug cũ** (VD `huy-thiep-nguyen`): link cũ chạy tiếp, không cần bảng redirect. Đổi slug cần bảng `author_slug_redirects` + proxy redirect 308: để đợt khác nếu cần. |
| ★8 | Trang lỗi hiện mã tra cứu (`error.digest`): đổi quy ước trong `CLAUDE.md` ("UI lỗi không hiện `error.message` / `digest`"). | Hiện **digest** (chuỗi băm, không chứa dữ liệu), **không** hiện `error.message`. Sửa dòng đó trong `CLAUDE.md`. |
| ★9 | Ghi chú đơn hàng ở trang thanh toán mất khi áp mã (form GET → tải lại trang). Ngoài yêu cầu nhưng cùng luồng với 1b. | Lưu nháp ghi chú vào `sessionStorage` (khóa theo trang thanh toán, xóa khi đặt hàng xong), khôi phục khi tải lại. Chừng 0.3KB JS ở trang thanh toán. |
| ★10 | Khách bấm "Gửi lại email xác nhận": giới hạn tần suất. | Dựa vào giới hạn của Supabase (`over_email_send_rate_limit`, mỗi email ~60 giây) + nút tự khóa 60 giây đếm ngược ở client. Không thêm bảng đếm riêng. |
| ★11 | Gợi ý mã cần mức giảm thật với giỏ hiện tại để xếp hạng. | RPC tính luôn (gọi `private.voucher_discount` với tạm tính của giỏ), app không tự tính tiền (đúng quy ước "tiền từ RPC"). |
| ★12 | Mục 15: kệ trang chủ bỏ sách thuộc danh mục đang ẩn (đổi hành vi: hiện giờ sách đang bán nhưng nằm trong danh mục ẩn vẫn lên kệ). `/sach` và tìm kiếm cũng chưa lọc. | Lọc ở **kệ trang chủ** trong đợt này (sửa gốc của test chập chờn). `/sach` + tìm kiếm để đợt sau, ghi vào handoff. |

## Thứ tự làm (đề xuất)

1. ✅ Bạn duyệt plan + trả lời ★.
2. ✅ Migration A + B, `schema.sql`, `seed.sql`, `migrations.test.ts`, câu SQL kiểm tra (`supabase/checks/ux-messages-a.sql`, `ux-messages-b.sql`), 2 câu chỉ đọc mục 16 (`supabase/checks/authors-reversed-names.sql`). Push, **dừng**.
3. Bạn review, chạy **A** + `ux-messages-a.sql`, chạy R1 / R2 mục 16 rồi dán kết quả. Mình sinh lại types. (**B chưa chạy.**)
4. Code theo thứ tự: 10 → 11 → 1/1b → 2 → 3/4/5 → 6/9 → 7 → 8 → 12 → 13 → 14 → 15. Câu UPDATE mục 16 gửi riêng.
5. `typecheck`, `lint`, `build`, Vitest, `measure:js` (trang sách, trang chủ, `vi/login`, `vi/checkout` không prerender nên đo bằng chunk), e2e trên CI. Push, báo.
6. Merge xong + deploy: bạn chạy **B** + `ux-messages-b.sql`.

---

## 1. Mã giảm giá: tách `INVALID_VOUCHER`

**Hiện trạng**
- `private.voucher_discount` (`supabase/schema.sql:362-394`): không tồn tại / tắt / chưa tới ngày / hết hạn / hết lượt đều `raise 'INVALID_VOUCHER'` (không detail). Đơn tối thiểu đã tách: `VOUCHER_MIN_ORDER` + detail `min_order_value`.
- Câu: "Mã giảm giá không hợp lệ hoặc đã hết hạn." / "This voucher code is invalid or has expired."
- `normalizeVoucherCode` (`src/features/checkout/voucher.ts`) trả `null` khi mã sai định dạng (`AB`, có dấu, > 30 ký tự) → **bỏ qua im lặng**, khách bấm "Áp dụng" mà không thấy gì. Đây là lỗi do khách bị nuốt, sửa cùng mục này.
- Lỗi hiện dưới ô (`voucher-field.tsx`, `#voucher-error`, `aria-describedby`): vị trí đúng rồi, chỉ đổi nội dung.

**Mã + câu mới**

| Mã | vi | en |
|---|---|---|
| `VOUCHER_NOT_FOUND` | Không có mã giảm giá này. Bạn kiểm tra lại từng ký tự nhé. | We couldn't find this code. Please check it letter by letter. |
| `VOUCHER_INACTIVE` | Mã này hiện đã ngừng áp dụng. Bạn thử mã khác nhé. | This code is no longer active. Please try another one. |
| `VOUCHER_NOT_STARTED` (detail `starts_at`) | Mã này dùng được từ {starts_at, date, ::dd/MM/yyyy HH:mm}. Bạn quay lại lúc đó nhé. | This code can be used from {starts_at, date, ::MMM d, yyyy HH:mm}. |
| `VOUCHER_EXPIRED` (detail `ends_at`) | Mã này đã hết hạn ngày {ends_at, date, ::dd/MM/yyyy}. | This code expired on {ends_at, date, ::MMM d, yyyy}. |
| `VOUCHER_EXHAUSTED` | Mã này đã hết lượt dùng. Bạn thử mã khác nhé. | This code has been fully redeemed. Please try another one. |
| `VOUCHER_MIN_ORDER` (detail thêm `shortfall`) | Mua thêm {shortfall, number, price} để dùng mã này (đơn từ {min_order_value, number, price}). | Add {shortfall, number, price} more to use this code (orders from {min_order_value, number, price}). |
| `INVALID_VOUCHER` (giữ, xem dưới) | giữ câu cũ | giữ câu cũ |

- Ngày format theo `timeZone: 'Asia/Ho_Chi_Minh'` đã có ở `src/i18n/request.ts`; `withMessage` dùng `getTranslations({ locale })` nên ICU date chạy được trong action / query. Detail là chuỗi ISO → `withMessage` đổi sang `Date` cho khóa `starts_at` / `ends_at` (hàm nhỏ trong `lib/error-message.ts`, Vitest).
- Mã sai định dạng → `VOUCHER_NOT_FOUND` hiện dưới ô (không gọi DB). `normalizeVoucherCode` tách thành `parseVoucherInput(value) → { code } | { invalid: raw } | null` (null = ô trống).
- `INVALID_VOUCHER` **giữ** trong `ERROR_CODES`, messages và `VOUCHER_ERRORS` để app mới chạy được cả trước lẫn sau migration B. Sau khi B chạy, không còn chỗ nào raise; xóa ở đợt sau (ghi vào handoff).

**SQL** (migration B, idempotent: `create or replace function`)
```sql
if p_voucher.id is null then raise exception 'VOUCHER_NOT_FOUND'; end if;
if not p_voucher.is_active then raise exception 'VOUCHER_INACTIVE'; end if;
if p_voucher.starts_at is not null and now() < p_voucher.starts_at then
  raise exception 'VOUCHER_NOT_STARTED' using detail = json_build_object('starts_at', p_voucher.starts_at)::text;
end if;
if p_voucher.ends_at is not null and now() > p_voucher.ends_at then
  raise exception 'VOUCHER_EXPIRED' using detail = json_build_object('ends_at', p_voucher.ends_at)::text;
end if;
if p_voucher.usage_limit is not null and p_voucher.used_count >= p_voucher.usage_limit then
  raise exception 'VOUCHER_EXHAUSTED';
end if;
if p_subtotal < p_voucher.min_order_value then
  raise exception 'VOUCHER_MIN_ORDER' using detail = json_build_object(
    'min_order_value', p_voucher.min_order_value, 'shortfall', p_voucher.min_order_value - p_subtotal)::text;
end if;
```
- Thứ tự kiểm giống `voucherState()` của admin (`features/admin/vouchers/state.ts`).
- `place_order` / `quote_order` không đổi (cùng gọi hàm này). Danh sách mã lỗi cuối `schema.sql` cập nhật.

**App**
- `checkout/queries.ts`: `VOUCHER_ERRORS` thêm 5 mã mới.
- `checkout/actions.ts` `failed()`: voucher lỗi lúc đặt (mã vừa hết lượt / hết hạn giữa chừng) đã đi qua `refresh()` + `withMessage`; chỉ cần mã mới có trong `ERROR_CODES`.

**Test**
- Vitest: `parseVoucherInput`; `withMessage` đổi detail ngày; `migrations.test.ts` (tự kiểm hàm mới có trong `schema.sql`); test tĩnh đọc `schema.sql`: mọi mã `raise exception '<CODE>'` có trong `ERROR_CODES` (nếu chưa có test này thì thêm).
- e2e `checkout.spec` (desktop + mobile): tạo voucher bằng service role cho từng trường hợp (tắt, `starts_at` mai, `ends_at` hôm qua, `usage_limit = used_count`, đơn tối thiểu lớn) → đúng câu dưới ô, tổng không đổi; mã sai định dạng (`AB`) → "Không có mã…". `createE2eVoucher` thêm tham số `isActive`, `startsAt`, `endsAt`, `usageLimit`, `isPublic`.
- Test cũ "mã sai → `Mã giảm giá không hợp lệ hoặc đã hết hạn.`" đổi câu mong đợi sang câu mới của `VOUCHER_NOT_FOUND` (cùng kịch bản, vẫn so chính xác cả câu: không nới). Test "đơn tối thiểu → chứa 50.000.000" giữ nguyên, thêm kiểm số tiền còn thiếu.

**Migration**: có (B, `20261018130000_error_reasons.sql`; kiểm tra `supabase/checks/ux-messages-b.sql`).

## 1b. Gợi ý mã ở trang thanh toán

**Hiện trạng**: khách không SELECT được `vouchers` (policy chỉ admin). Chưa có gợi ý.

**DB** (migration A, idempotent)
```sql
alter table public.vouchers add column if not exists is_public boolean not null default false;
-- grant update (… , is_public) on public.vouchers to authenticated;  (bản grant mới thay bản cũ)

create or replace function public.checkout_vouchers()
returns table (code text, description text, description_en text,
               discount_type public.discount_type, discount_value int, max_discount int,
               min_order_value int, ends_at timestamptz,
               discount int,      -- mức giảm với giỏ hiện tại; null khi chưa đủ tối thiểu
               shortfall int)     -- số tiền còn thiếu để đủ tối thiểu (0 = đủ)
language plpgsql stable security definer set search_path = '' as $$ … $$;
revoke all on function public.checkout_vouchers() from public, anon;
grant execute on function public.checkout_vouchers() to authenticated;
```
- `auth.uid()` null → `AUTH_REQUIRED`. Tạm tính: cùng câu `select … from cart_items join books … and b.is_active` của `quote_order`. Tách thành `private.cart_subtotal(p_user uuid)` dùng cho **cả** `quote_order` và RPC mới, để không lệch (đổi `quote_order` = `create or replace` cùng chữ ký, kết quả như cũ).
- Lọc: `is_public and is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()) and (usage_limit is null or used_count < usage_limit)`. Biên `ends_at` khớp `voucher_discount` (`now() > ends_at` mới hết hạn).
- `discount`: `case when subtotal >= min_order_value then private.voucher_discount(v, subtotal) end`. Giỏ trống → không trả dòng nào.
- Chỉ trả các cột trên. **Không** trả `id`, `used_count`, `usage_limit`, `starts_at`, `is_active`, `is_public`; mã không public không bao giờ ra. `limit 20`, sắp `discount desc nulls last, shortfall, code`.
- Quyền / RLS: bảng `vouchers` giữ nguyên (khách vẫn không SELECT được). RPC `security definer` (chủ hàm đọc được bảng), `set search_path = ''`, mọi tên viết đủ schema. Không cấp cho `anon` (trang thanh toán cần đăng nhập).
- Giới hạn mỗi tài khoản: schema chưa có (★5) → bỏ điều kiện "khách đã dùng hết".

**App**
- `checkout/queries.ts`: `getCheckoutVouchers()` (client theo phiên, trong Suspense cùng `getCheckoutQuote`, `Promise.all`). Kiểu suy từ types sinh tự động.
- Hàm thuần `features/checkout/voucher-suggestions.ts`:
  - `toSuggestion(row, locale)` → `{ code, title, condition, expires, eligible: true, discount } | { …, eligible: false, reason: { kind: 'min_order', shortfall } }`.
  - `sortSuggestions`: đủ điều kiện trước, giảm nhiều nhất lên đầu; chưa đủ xếp theo `shortfall` tăng dần.
  - Server dịch sẵn mọi chuỗi (mức giảm "Giảm 10%, tối đa 50.000 ₫" / "Giảm 20.000 ₫", "Đơn từ 150.000 ₫", "HSD 31/12/2026", lý do "Mua thêm 50.000 ₫ để dùng mã này") → client leaf chỉ nhận mảng chuỗi (không kéo `intl-messageformat`, không zod).
- UI `voucher-picker.tsx` (client leaf, tải lười bằng `next/dynamic` khi bấm nút): nút "Chọn mã giảm giá" cạnh ô nhập (ẩn khi không có mã nào, ẩn khi đã áp mã).
  - Một Radix `Dialog` (`components/ui/dialog.tsx`), class responsive: dưới `sm` là tấm trượt từ dưới lên (full width, `rounded-t-[14px]`, `max-h-[85dvh]`, cuộn bên trong, safe-area đáy), từ `sm` là dialog nhỏ giữa màn hình. Không cần hook media query (CSS thuần). Chuyển động tắt theo `prefers-reduced-motion`.
  - Mỗi mã là một thẻ: mã (font mono), mức giảm, điều kiện, hạn dùng. Đủ điều kiện → nút "Áp dụng". Chưa đủ → thẻ mờ (`opacity-60`), dòng lý do màu `muted-foreground` (vẫn đạt 4.5:1 vì không làm mờ chữ lý do), nút `disabled` + `aria-disabled`.
  - "Áp dụng" = điều hướng `?voucher=<CODE>&address=<id>` (cùng URL form GET hiện có) → đi đúng luồng `getCheckoutQuote` + hiện "Đang tính lại tổng tiền…". Không có đường áp mã thứ hai.
  - Mobile: chữ ≥ 16px, nút ≥ 44px; desktop: chữ 14px, nút 36px.
- Admin: ô tick "Hiện trong gợi ý ở trang thanh toán" (`is_public`) trong `voucher-form.tsx`, `voucherFormSchema`, `form-props.ts`; cột "Gợi ý" ở danh sách `/admin/voucher`.
- Seed: `seed.sql` thêm `is_public = true` cho 2 mã seed. e2e tạo thêm mã không public.
- `measure:js`: picker ở chunk riêng; nút trong trang thanh toán (đã có client wrapper `VoucherPending`) + ~0.5KB.

**Câu mới** (namespace `checkout`)

| Khóa | vi | en |
|---|---|---|
| `voucherPick` | Chọn mã giảm giá | Choose a voucher |
| `voucherListTitle` | Mã giảm giá cho đơn này | Vouchers for this order |
| `voucherPercent` | Giảm {value}%{max, select, none {} other {, tối đa {max}}} | {value}% off{max, select, none {} other {, up to {max}}} |
| `voucherFixed` | Giảm {amount} | {amount} off |
| `voucherMinOrder` | Đơn từ {amount} | Orders from {amount} |
| `voucherNoMin` | Mọi đơn hàng | Any order |
| `voucherExpires` | HSD {date} | Expires {date} |
| `voucherNoExpiry` | Không giới hạn thời gian | No expiry date |
| `voucherShortfall` | Mua thêm {amount} để dùng mã này | Add {amount} more to use this code |
| `voucherUse` | Áp dụng | Apply |
| `voucherClose` | Đóng | Close |

(`voucherPercent` dùng `select` ở server, không ở client.)

**Test**
- Vitest: `toSuggestion` (đủ / chưa đủ, lý do + số tiền thiếu, có / không trần giảm, có / không hạn), `sortSuggestions`; `voucherFormSchema` nhận `is_public`; `migrations.test.ts` (cột trong `create table`, grant mới, RPC không cấp `anon`).
- e2e `checkout-vouchers.spec.ts` (desktop + mobile, user checkout riêng, sách e2e riêng):
  1. Chỉ mã public hiện trong danh sách; mã không public không có.
  2. Mã không public gõ tay vẫn áp được.
  3. Mã public tối thiểu lớn → thẻ mờ, câu "Mua thêm …", nút disabled.
  4. Bấm "Áp dụng" mã đủ điều kiện → "Đã áp dụng mã X", dòng giảm giá + tổng đúng (so với `quote_order`).
  5. Mobile: tấm nằm sát đáy, nút ≥ 44px (đo `boundingBox`), chữ ≥ 16px (computed style).
  - "Không có mã nào → ẩn nút": không test e2e (phải tắt mọi mã public → giẫm spec khác chạy song song); kiểm bằng Vitest hàm quyết định hiện nút.
  - Mã test tên `E2E-ADMIN-…`, dọn bằng `deleteE2eVouchers(codes)`. Seed thật (`CHAOBAN10`, `GIAM20K`) có thể hiện chung: spec chỉ kiểm mã của mình có / không có, không đếm tổng.
  - Bất biến mới trong `scripts/e2e-seed.test.ts`: `seed.sql` có ít nhất 1 mã public.

**Migration**: có (A, `20261018120000_voucher_suggestions.sql`; kiểm tra `supabase/checks/ux-messages-a.sql`).

## 2. Hủy đơn: tách `ORDER_NOT_CANCELLABLE`

**Hiện trạng**
- `cancel_order` (`schema.sql:759-788`): `update … where id and user_id = auth.uid() and status = 'pending' and payment_status <> 'paid'`; không khớp → `ORDER_NOT_CANCELLABLE`.
- Câu: "Đơn hàng này không thể hủy." / "This order can no longer be cancelled."
- UI: `cancel-order-form.tsx` (`<details>`, chạy không cần JS); nút chỉ hiện khi `canCancel`. Lỗi chỉ gặp khi trạng thái đổi giữa lúc mở trang và lúc bấm (admin vừa xác nhận, vừa nhận tiền, tab khác đã hủy). Action gọi `refresh()` rồi hiện câu lỗi.

**SQL** (migration B): đọc đơn `for update` theo `id` + `user_id = auth.uid()`:
- Không có (sai id / đơn người khác) → `ORDER_NOT_CANCELLABLE` (giữ, không lộ đơn của người khác).
- `status = 'cancelled'` → `ORDER_ALREADY_CANCELLED`.
- `status in ('confirmed','shipping')` → `ORDER_IN_PROGRESS` (detail `status`).
- `status = 'delivered'` → `ORDER_DELIVERED`.
- `payment_status = 'paid'` → `ORDER_PAID`.
- Còn lại → update như cũ.

**Câu mới**

| Mã | vi | en |
|---|---|---|
| `ORDER_IN_PROGRESS` | Cửa hàng đã {status, select, shipping {giao đơn cho bên vận chuyển} other {xác nhận đơn}} nên bạn không tự hủy được nữa. Cần hủy, bạn gửi email tới {email} kèm mã đơn nhé. | The store has already {status, select, shipping {handed this order to the courier} other {confirmed this order}}, so it can no longer be cancelled here. To cancel, email {email} with your order code. |
| `ORDER_DELIVERED` | Đơn đã giao xong nên không hủy được. Cần đổi trả, bạn gửi email tới {email} kèm mã đơn nhé. | This order has been delivered, so it can't be cancelled. For returns, email {email} with your order code. |
| `ORDER_PAID` | Đơn đã thanh toán nên cần cửa hàng hủy và hoàn tiền. Bạn gửi email tới {email} kèm mã đơn nhé. | This order is already paid, so the store needs to cancel and refund it. Email {email} with your order code. |
| `ORDER_ALREADY_CANCELLED` | Đơn này đã được hủy trước đó, bạn không cần làm gì thêm. | This order was already cancelled. Nothing else to do. |
| `ORDER_NOT_CANCELLABLE` | Không hủy được đơn này. Bạn tải lại trang để xem trạng thái mới nhất. | This order can't be cancelled. Reload the page to see its latest status. |

- `{email}` điền ở `withMessage` (tham số chung cho mọi mã, lấy từ `SUPPORT_EMAIL`), chữ thường trong câu; dưới khối lỗi có thêm link `mailto:` (component `SupportLink`, mục 10) cho các mã trong `SUPPORT_CODES`.
- Sau `refresh()`, trang đã hiện trạng thái mới + giải thích (`orders.explain.*`); nút hủy biến mất nhưng câu lỗi vẫn hiện (nhánh `!cancellable && state` đã có).
- Admin hủy (`cancelOrderAsAdmin`) không đi qua `cancel_order`, không đổi.

**Test**
- Vitest: map mã → câu có `{email}`; `SUPPORT_CODES`; `migrations.test.ts`.
- e2e `orders.spec` (desktop + mobile, user orders riêng, sách e2e riêng): mở trang đơn `pending` → service role đổi sang `confirmed` (rồi `paid` với đơn chuyển khoản; rồi `cancelled`) → bấm Hủy → đúng câu + link `mailto:` + nút hủy biến mất. Dọn bằng `cancelAndDeleteOrders`.

**Migration**: có (B, cùng file với mục 1).

## 3. Đăng ký / đăng nhập: lỗi auth rơi vào `INVALID_INPUT` / `UNKNOWN`

**Hiện trạng** (`src/features/auth/errors.ts`): map 10 mã Supabase; còn lại → `NETWORK_ERROR` (status 0 / ≥ 500) hoặc `UNKNOWN`. `email_address_invalid` → `INVALID_INPUT` **không có `fieldErrors`** → "Dữ liệu không hợp lệ." ở khối lỗi đầu form. Mọi lỗi auth đều ở đầu form, kể cả `WEAK_PASSWORD`, `SAME_PASSWORD`.

**Map mới** (`authFailure(error) → Failure` thay `authErrorCode`, trả cả `fieldErrors`)

| Mã Supabase | Kết quả | Chỗ hiện |
|---|---|---|
| `email_address_invalid` | `INVALID_INPUT` + `fieldErrors.email = 'emailRejected'` | dưới ô Email |
| `email_address_not_authorized` | như trên (`emailRejected`) | dưới ô Email |
| `weak_password` | `WEAK_PASSWORD` + `fieldErrors.password = 'passwordWeak'` | dưới ô Mật khẩu |
| `same_password` | `SAME_PASSWORD` + `fieldErrors.password = 'passwordSame'` | dưới ô Mật khẩu |
| `validation_failed` | `INVALID_INPUT` (form) | đầu form |
| `signup_disabled`, `email_provider_disabled` | `SIGNUP_DISABLED` (mới) | đầu form |
| `user_banned` | `ACCOUNT_LOCKED` (mới) + `SupportLink` | đầu form |
| `session_not_found`, `session_expired`, `refresh_token_not_found`, `reauthentication_needed`, `flow_state_expired`, `flow_state_not_found`, `bad_code_verifier` | `LINK_EXPIRED` ở đặt lại mật khẩu (phiên khôi phục hết hạn); `SESSION_EXPIRED` (mới) ở chỗ khác | đầu form |
| `over_email_send_rate_limit`, `over_request_rate_limit`, `over_sms_send_rate_limit` | `RATE_LIMITED` (+ `seconds`, mục 5) | đầu form |
| `request_timeout`, `hook_timeout`, `unexpected_failure`, status 0 / ≥ 500 | `NETWORK_ERROR` / `UNKNOWN` (lỗi web) | đầu form, kèm `SupportLink` khi `UNKNOWN` |
| `invalid_credentials` | giữ `INVALID_CREDENTIALS` ở đầu form (không chỉ ra ô nào sai: tránh dò email) | đầu form |

- Cần lỗi ở ô thì `FormAlert` tự `quiet` (đã có).
- `requestPasswordReset` hiện nuốt mọi lỗi trừ `RATE_LIMITED` (khách thấy "đã gửi" kể cả khi mất mạng). Sửa: vẫn nuốt lỗi có thể lộ email có tồn tại hay không (`user_not_found`, `email_address_not_authorized`); trả `NETWORK_ERROR` / `UNKNOWN` / `RATE_LIMITED` (không lộ gì).
- `/api/auth/confirm`: lỗi mạng của `verifyOtp` / `exchangeCodeForSession` đang thành `?error=LINK_EXPIRED`. Sửa: lỗi mạng / 5xx → `?error=NETWORK_ERROR`, trang đích hiện câu mạng (không bảo khách xin link mới khi link còn dùng được). Trang `/xac-nhan` POST cũng vậy.

**Câu mới**

| Khóa | vi | en |
|---|---|---|
| `validation.emailRejected` | Email này không nhận được thư. Bạn kiểm tra lại địa chỉ (VD ten@gmail.com) nhé. | This email can't receive mail. Please check the address (e.g. name@gmail.com). |
| `validation.passwordWeak` | Mật khẩu dễ đoán quá. Bạn dùng ít nhất 8 ký tự, trộn chữ và số nhé. | This password is too easy to guess. Use at least 8 characters with letters and numbers. |
| `validation.passwordSame` | Mật khẩu mới phải khác mật khẩu đang dùng. | Your new password must be different from the current one. |
| `errors.SIGNUP_DISABLED` | Nhà Sách Mây đang tạm ngừng nhận đăng ký mới. Bạn quay lại sau nhé. | Nhà Sách Mây isn't accepting new sign-ups right now. Please come back later. |
| `errors.ACCOUNT_LOCKED` | Tài khoản này đang bị khóa. Bạn gửi email tới {email} để được hỗ trợ nhé. | This account is locked. Email {email} for help. |
| `errors.SESSION_EXPIRED` | Phiên đăng nhập đã hết hạn. Bạn đăng nhập lại rồi thử lại nhé. | Your session has expired. Please sign in again and retry. |

(`passwordWeak`: nội dung theo cấu hình mật khẩu của Supabase; kiểm `supabase/config.toml` `[auth] minimum_password_length` / `password_requirements` khi code và để câu khớp.)

**Test**
- Vitest `features/auth/errors.test.ts`: bảng mã → `Failure` (cả `fieldErrors`); `requestPasswordReset` không lộ email.
- e2e `auth-email.spec`: đăng ký bằng email zod nhận nhưng GoTrue từ chối → lỗi dưới ô Email (`aria-describedby` trỏ đúng), không có "Dữ liệu không hợp lệ.". `signUp` chạy ở server nên không chặn request bằng `page.route` được: cần tìm một email như vậy trên Supabase local khi code. Không tìm được thì báo lại (không giả lập), mục này chỉ còn Vitest.

**Migration**: không.

## 4. Đăng nhập khi email chưa xác nhận: gửi lại email

**Hiện trạng**: `EMAIL_NOT_CONFIRMED` → "Email chưa được xác nhận. Vui lòng mở thư xác nhận trong hộp thư của bạn." ở đầu form. Không có `auth.resend` ở đâu cả; cách duy nhất là đăng ký lại.

**Cách sửa**
- Action mới `resendConfirmation(locale, _prev, formData)` (`features/auth/actions.ts`): parse `email` (zod), `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authCallbackUrl(…, 'signup') } })`. Kết quả luôn "đã gửi" nếu không phải lỗi giới hạn / mạng (không lộ email có tồn tại).
- `LoginForm`: khi `failure.code === 'EMAIL_NOT_CONFIRMED'`, trong khối lỗi hiện nút "Gửi lại email xác nhận". Nút là `<button formAction={resend}>` của **cùng form** (gửi luôn ô email đang có; không cần trả email về từ server). Chạy được không cần JS.
- Sau khi gửi: "Đã gửi lại. Bạn mở hộp thư (cả mục Spam) nhé." + nút khóa 60 giây, đếm ngược ("Gửi lại sau 42 giây"). Bị Supabase giới hạn → câu `RATE_LIMITED` có số giây (mục 5).
- Template: email gửi lại dùng template "Confirm signup" như đăng ký (song ngữ theo `user_metadata.locale`). Supabase local (Mailpit) cũng vậy.

**Câu mới** (namespace `auth`)

| Khóa | vi | en |
|---|---|---|
| `errors.EMAIL_NOT_CONFIRMED` | Email này chưa được xác nhận. Bạn mở thư xác nhận trong hộp thư (cả mục Spam), hoặc bấm gửi lại bên dưới. | This email isn't confirmed yet. Open the confirmation email (check Spam too), or send it again below. |
| `auth.resendConfirm` | Gửi lại email xác nhận | Resend confirmation email |
| `auth.resendSent` | Đã gửi lại. Bạn mở hộp thư (cả mục Spam) nhé. | Sent again. Please check your inbox (and Spam). |
| `auth.resendWait` | Gửi lại sau {seconds} giây | Resend in {seconds}s |

(`resendWait` chỉ có tham số đơn giản: server giữ chỗ trống, client điền bằng `fillTemplate`.)

**Test**
- Vitest: action trả "đã gửi" khi Supabase trả lỗi lộ email; map giới hạn.
- e2e `auth-email.spec` (vi + en): đăng ký → không bấm link → đăng nhập → câu chưa xác nhận + nút → bấm → "Đã gửi lại", nút khóa; Mailpit có **2** thư xác nhận cho email đó, link trong thư thứ 2 dùng được. Bấm lại ngay → nút vẫn khóa (client). Câu `RATE_LIMITED` từ Supabase kiểm bằng Vitest (e2e phải chờ đúng nhịp 60 giây của GoTrue: dễ chập chờn).

**Migration**: không.

## 5. `RATE_LIMITED`

**Hiện trạng**: chỉ Supabase Auth sinh mã này. Câu: "Bạn thao tác quá nhanh. Vui lòng đợi vài phút rồi thử lại." / "Too many attempts…" (đổ lỗi cho khách, không nói thời gian).

**Cách sửa**
- GoTrue trả câu dạng "For security purposes, you can only request this after 52 seconds." với `over_email_send_rate_limit` → `authFailure` bắt số giây bằng regex → `details.seconds`. Không bắt được → không có `seconds`.
- Hai câu (ICU `select` theo có / không có số giây, dịch ở server bằng `withMessage`):

| | vi | en |
|---|---|---|
| có `seconds` | Hệ thống đang tạm giới hạn số yêu cầu để bảo vệ tài khoản. Bạn thử lại sau {seconds} giây nhé. | We're limiting requests for a moment to keep accounts safe. Please try again in {seconds} seconds. |
| không có | Hệ thống đang tạm giới hạn số yêu cầu để bảo vệ tài khoản. Bạn thử lại sau vài phút nhé. | We're limiting requests for a moment to keep accounts safe. Please try again in a few minutes. |

- Form auth hiện câu qua `failure.message` (đã có đường `withMessage` cho lỗi có tham số).
- Chat có mã riêng (`CHAT_QUOTA_EXCEEDED`…), không đổi.

**Test**: Vitest (bắt số giây, không bắt được, ICU 2 nhánh cả vi / en). e2e: không (Supabase local khó tái hiện ổn định; đã có mục 4).

**Migration**: không.

## 6. Sách / danh mục / tác giả không có hoặc đang ẩn

**Hiện trạng**
- Proxy (`src/proxy.ts`) kiểm slug bằng client anon (sách / danh mục ẩn cũng 404) → rewrite `/<locale>/__not-found` → `[...rest]` gọi `notFound()` → `[locale]/not-found.tsx` (HTTP 404). Trang không biết loại tài nguyên.
- Câu chung: "Không tìm thấy trang" / "Trang bạn tìm không tồn tại hoặc đã được chuyển đi." + nút "Về trang chủ".
- Fallback trong trang (proxy lỗi mạng → cho qua) `books/[slug]/page.tsx:112` gọi `notFound()` sau stream.

**Cách sửa**
- Proxy giữ nguyên quyết định, chỉ thêm loại: rewrite kèm request header `x-not-found: book | category | author | order | address` (`NextResponse.rewrite(url, { request: { headers } })`). Header đặt ở proxy, khách không tự đặt được cho request đã qua rewrite (proxy xóa header này ở mọi request đi vào trước khi xử lý).
- `not-found.tsx`: khung tĩnh (tiêu đề chung + link) và một leaf trong `<Suspense>` đọc `headers()` để chọn câu theo loại. Fallback của Suspense là câu chung (cùng chiều cao, không CLS). Status 404 đã quyết trước khi stream nên không ảnh hưởng.
- Component dùng chung `NotFoundView({ kind })` cho cả `not-found.tsx` và `InlineNotFound` (soft 404 truyền `kind` thẳng).
- Link: "Tìm sách" (`/tim-kiem`), "Xem danh mục" (`/sach`), "Về trang chủ".
- Fallback trong trang sách / danh mục / tác giả: đổi `notFound()` sau stream → `<InlineNotFound kind="book" />` (hết #419 nếu proxy cho qua).

**Câu mới** (namespace `notFound`)

| Khóa | vi | en |
|---|---|---|
| `title` | Không tìm thấy trang | Page not found |
| `description` (chung) | Trang bạn tìm không có hoặc đã được chuyển đi. Bạn thử tìm sách hoặc xem danh mục nhé. | The page you're looking for doesn't exist or has moved. Try searching or browsing categories. |
| `book` | Cuốn sách này không có hoặc đã ngừng bán. Bạn thử tìm tên sách hoặc xem các danh mục nhé. | This book doesn't exist or is no longer sold. Try searching for the title or browse categories. |
| `category` | Danh mục này không có hoặc đang tạm ẩn. Bạn xem các danh mục khác nhé. | This category doesn't exist or is hidden for now. Browse other categories. |
| `author` | Không có tác giả này trong nhà sách. Bạn thử tìm theo tên nhé. | We don't have this author. Try searching by name. |
| `search` | Tìm sách | Search books |
| `browse` | Xem danh mục | Browse categories |
| `backHome` | Về trang chủ | Back to home |

(`order`, `address`: mục 9 / 13.)

**Test**
- Vitest: proxy gắn đúng `x-not-found` theo route; proxy xóa header do khách gửi.
- e2e `seo.spec` / `not-found.spec` (desktop + mobile, vi + en): `/sach/khong-ton-tai` → HTTP 404 + câu sách + 2 link; sách ẩn (sách e2e `is_active = false`) → 404 + cùng câu; `/danh-muc/…`, `/tac-gia/…` tương tự; URL lạ (`/abc`) → câu chung. Test 404 cũ giữ nguyên.

**Migration**: không.

## 7. `AUTH_REQUIRED`: kèm link đăng nhập

**Hiện trạng**: câu "Vui lòng đăng nhập để tiếp tục." ở form địa chỉ, ngôn ngữ email, đánh giá, giỏ (`cart-view.tsx:342`); không có link. Thanh toán / hủy đơn đã tự redirect `?next=`. Gặp khi phiên hết hạn trong lúc trang đang mở.

**Cách sửa**
- Link đăng nhập tính ở **server**: page biết href của chính nó (`getPathname({ href, locale })`, kể cả query đang có) → truyền `loginHref = /dang-nhap?next=<href>` vào form props / messages. Một đường cho cả có JS lẫn không JS, không cần đọc `location`. `next` vẫn qua `safeNextPath` khi đăng nhập.
- `FormAlert` nhận `action?: ReactNode`; khi `failure.code === 'AUTH_REQUIRED'` (hoặc `SESSION_EXPIRED`, mục 12) form hiện link "Đăng nhập lại". Áp cho form địa chỉ, ngôn ngữ email, đánh giá, giỏ (`CartSummary`).
- Bấm link là rời trang nên chữ đang nhập sẽ mất → câu **không** hứa giữ dữ liệu:

| | vi | en |
|---|---|---|
| `errors.AUTH_REQUIRED` | Phiên đăng nhập đã hết. Bạn đăng nhập lại để tiếp tục nhé. | You've been signed out. Please sign in again to continue. |
| `common.signInAgain` | Đăng nhập lại | Sign in again |

**Test**
- Vitest: hàm dựng `loginHref` (vi / en, có query, ký tự đặc biệt).
- e2e `account.spec` (user riêng tự tạo + xóa ở `finally`): mở form địa chỉ → xóa cookie phiên → gửi → câu mới + link `?next=` đúng trang → bấm → đăng nhập → quay lại đúng trang.

**Migration**: không.

## 8. `NETWORK_ERROR` + form giữ dữ liệu

**Hiện trạng**: "Không kết nối được máy chủ, thử lại sau ít phút." / "Could not reach the server. Please try again in a few minutes." `useFormAction` chặn reset form (`preventDefault` + dispatch tay) → các form đi qua hook này giữ chữ khi lỗi (đã rà: đăng nhập, đăng ký, quên / đặt lại mật khẩu, địa chỉ, thanh toán, đánh giá, ngôn ngữ email, hủy đơn, form admin).

**Câu mới**: **vi** "Không kết nối được máy chủ. Bạn kiểm tra mạng rồi bấm lại nhé, thông tin đã nhập vẫn còn nguyên." / **en** "Couldn't reach the server. Check your connection and try again; everything you entered is still here."

**Chỗ chưa đúng phải sửa**
- `AddToCartButton` (`add-to-cart-button.tsx:62-71`), `UserCart` (`user-cart.tsx:49-59`): gọi action trong `startTransition` **không** try/catch → mất mạng ném lên error boundary (cả trang thành trang lỗi; suy từ code, chưa thử). Sửa: try/catch → `NETWORK_ERROR` + rollback optimistic. Giỏ không có ô nhập nên dùng khóa riêng `cart.networkError` (vẫn một mã `NETWORK_ERROR`): **vi** "Không kết nối được máy chủ. Bạn kiểm tra mạng rồi bấm lại nhé." / **en** "Couldn't reach the server. Check your connection and try again."
- Chat (`chat-panel.tsx:74, 84`): xóa ô nhập **trước** khi gửi, lỗi mạng hiện "Mây hơi mệt rồi…". Sửa: lỗi mạng → trả lại chữ vào ô + câu `chat.network`: "Không kết nối được máy chủ. Bạn kiểm tra mạng rồi gửi lại nhé, câu hỏi vẫn còn trong ô." (chỉ vi).
- Thanh toán: ghi chú mất khi áp mã (★9).
- Không JS: form POST thật → server render lại với `defaultValue` cũ (mất chữ). Ngoài phạm vi (mất mạng thì không POST được, không phát sinh `NETWORK_ERROR`).

**Test**
- Vitest: `useFormAction` trả `NETWORK_ERROR` khi action ném (đã có? kiểm; thiếu thì thêm).
- e2e `network.spec.ts` (desktop + mobile): với mỗi form chính (đăng nhập, đăng ký, địa chỉ, thanh toán ghi chú, đánh giá, hủy đơn có lý do), điền → `context.setOffline(true)` → gửi → câu mới hiện, **giá trị mọi ô còn nguyên** (`toHaveValue`) → `setOffline(false)` → gửi lại được. Thêm giỏ: thêm vào giỏ khi offline → câu lỗi, badge rollback, trang không ra error boundary. Chat (vi): chữ trả lại ô.

**Migration**: không.

## 9. Không tìm thấy đơn hàng

**Hiện trạng**
- Proxy: mã sai định dạng → 404; mã đúng định dạng → đếm `orders` theo mã + `user_id` (client theo phiên) → 0 thì 404 (câu chung "Không tìm thấy trang"). Proxy lỗi → cho qua, trang hiện `InlineNotFound` (HTTP 200).
- Mã sai định dạng, không có, của người khác: **cùng** một phản hồi (tốt), chỉ thiếu câu riêng.

**Cách sửa**: proxy rewrite kèm `x-not-found: order` (mục 6) cho cả 3 trường hợp; `InlineNotFound kind="order"` ở fallback trong trang chi tiết đơn + trang đặt hàng thành công (mục 13c). Link "Xem đơn hàng của tôi" (`/tai-khoan/don-hang`) + "Về trang chủ".

**Câu mới** (`notFound.order`)
- **vi**: "Không tìm thấy đơn hàng này. Có thể mã đơn chưa đúng, hoặc đơn này thuộc một tài khoản khác. Bạn kiểm tra lại trong Tài khoản → Đơn hàng."
- **en**: "We couldn't find this order. The order code may be wrong, or the order belongs to another account. Please check under Account → Orders."
- `notFound.myOrders`: "Đơn hàng của tôi" / "My orders".

**Test**: e2e `orders.spec` (desktop + mobile, vi + en): mã sai định dạng, mã đúng định dạng nhưng không có, mã đơn của user khác (đơn của user checkout) → HTTP 404 + **cùng một** câu (so chính xác, so nội dung `<main>` 3 trường hợp bằng nhau) ở cả `/tai-khoan/don-hang/<mã>` và `/thanh-toan/thanh-cong/<mã>`. Test 404 đơn hiện có giữ nguyên.

**Migration**: không.

## 10. Email liên hệ

- Hằng duy nhất `SUPPORT_EMAIL = 'nha-sach-may@googlegroups.com'` trong `src/lib/support.ts` (file không import gì → `global-error.tsx` / `ErrorView` dùng được mà không kéo thư viện).
- `SupportLink` (`components/layout/support-link.tsx`, server-safe, không icon lucide để dùng được trong `ErrorView`): `<a href="mailto:…">{email}</a>`.
- Hiện ở: footer (dòng "Liên hệ: …" / "Contact: …", cả `CompactFooter`), trang lỗi (mục 11), các mã cần hỗ trợ (`SUPPORT_CODES` = `ORDER_IN_PROGRESS`, `ORDER_DELIVERED`, `ORDER_PAID`, `ACCOUNT_LOCKED`, `UNKNOWN`).
- `withMessage` luôn truyền `email: SUPPORT_EMAIL` cho mọi câu `errors.*` (câu không dùng `{email}` thì bỏ qua).
- Không đụng Supabase Auth SMTP / `EMAIL_FROM`.
- Messages: `layout.footerContact`: "Liên hệ: {email}" / "Contact: {email}" (rich text, `<a>`).

**Test**: Vitest: `SUPPORT_EMAIL` là email hợp lệ; test tĩnh không chuỗi `@googlegroups.com` nào khác trong `src/` và `messages/`. e2e `layout.spec`: footer có link `mailto:` đúng.

## 11. `error.tsx` (lỗi không lường trước)

**Hiện trạng**: "Không tải được trang" + "Đã có lỗi khi tải nội dung. Có thể kết nối đang chập chờn, bạn thử lại sau ít phút nhé." Không có digest, không có email. Bản sao ở `i18n/global-error-messages.ts`.

**Câu mới** (`errorPage`)

| Khóa | vi | en |
|---|---|---|
| `title` | Có lỗi phía Nhà Sách Mây | Something went wrong on our side |
| `description` | Có lỗi phía Nhà Sách Mây, không phải do bạn. Bạn bấm "Thử lại" nhé; nếu vẫn lỗi, gửi mã tra cứu bên dưới tới {email} để nhóm kiểm tra. | This is a problem at Nhà Sách Mây, not something you did. Please press "Try again"; if it keeps happening, send the reference code below to {email}. |
| `reference` | Mã tra cứu: {digest} | Reference code: {digest} |
| `retry` | Thử lại | Try again |
| `backHome` | Về trang chủ | Back to home |

- `ErrorView` nhận `digest?: string`; chỉ hiện dòng mã khi có (lỗi server có digest; lỗi chỉ ở client thì không, câu mô tả vẫn đúng: "gửi mã tra cứu bên dưới" → khi không có digest dùng bản `descriptionNoRef`: "… nếu vẫn lỗi, bạn gửi email tới {email} kèm đường dẫn trang này nhé." / "… if it keeps happening, email {email} with the link to this page.").
- `{email}` là `SupportLink`; `ErrorView` vẫn không import thư viện dùng chung (chỉ `lib/support.ts`). Chạy `measure:js` sau khi đổi.
- Digest tra được trong log Vercel (Next log lỗi server kèm digest). Ghi cách tra vào `owner-todo.md`.
- `admin/error.tsx`, `global-error.tsx`, `(shop)/error.tsx`, `[locale]/error.tsx` truyền `error.digest`. Comment "Supabase chập chờn" ở `(shop)/error.tsx` sửa theo.
- `CLAUDE.md`: sửa quy ước digest (★8).

**Test**: Vitest `messages.test.ts` (bản sao global-error khớp, đã có, thêm khóa mới). e2e `error-page.spec` (đã có cookie `e2e-fault=rest`): câu mới, có dòng "Mã tra cứu:" + chuỗi digest, link `mailto:`, không còn "chập chờn".

**Migration**: không.

## 12. Rà mọi chỗ trả `UNKNOWN`

Nguồn chung: `toFailure` (lỗi PostgREST có `message` không phải mã đã biết → `UNKNOWN`), `authErrorCode` (mục 3), `useFormAction` (mã không nằm trong `getFormMessages` của trang → câu `UNKNOWN`).

| Chỗ | Điều kiện | Do khách? | Đổi thành |
|---|---|---|---|
| `toFailure` | `PGRST301` / JWT hết hạn | có (phiên cũ) | `SESSION_EXPIRED` + link đăng nhập lại (mục 7) |
| `toFailure` | `42501` (RLS chặn ghi) | thường là phiên hết / không đủ quyền | `FORBIDDEN` ở admin; `SESSION_EXPIRED` ở cửa hàng nếu không có phiên |
| `toFailure` | `57014` (statement timeout), lỗi khác | không | giữ `UNKNOWN` (+ `SupportLink`) |
| `features/auth/*` | mã Supabase chưa map | thường có | mục 3 |
| `requestPasswordReset` | mọi lỗi bị nuốt thành "đã gửi" | — | mục 3 |
| `reviews/actions.ts:25, 52` | `bookId` bind sai (chỉ khi sửa tay request) | không | giữ `UNKNOWN` |
| `admin/authors/actions.ts:60` | update 0 dòng: tác giả vừa bị xóa ở tab khác | có (dữ liệu cũ) | `ITEM_DELETED` (mới) |
| `admin/vouchers/actions.ts:49` | update 0 dòng | có | `ITEM_DELETED` |
| `admin/vouchers/actions.ts:72` | xóa mã đã bị xóa | có | coi như thành công (giống `deleteReviewAsAdmin`) |
| `admin/categories/actions.ts:90, 95` | danh mục vừa bị xóa | có | `ITEM_DELETED` |
| `admin/categories/actions.ts:45`, `books/actions.ts:56` | lỗi query, không qua `toFailure` | không | `toFailure` (lỗi mạng → `NETWORK_ERROR`) |
| `admin/books/actions.ts:100, 128` | `readSnapshot` null: không phân biệt lỗi DB với sách đã xóa | cả hai | tách: lỗi → `toFailure`; không có → `ITEM_DELETED` |
| `admin/books/actions.ts:105, 136, 167, 189` | 0 dòng / không có sách | có | `ITEM_DELETED` |
| `admin/books/actions.ts:115` | lưu sách xong nhưng lỗi `book_authors` | không | `BOOK_AUTHORS_NOT_SAVED` (mới): đã lưu một phần, nói rõ |
| `admin/books/actions.ts:178` | upload Storage lỗi | không | `toFailure` / `UNKNOWN` |
| `admin/*` id bind sai (`rowIdSchema`, `orderIdSchema`…) | chỉ khi sửa tay | không | giữ `UNKNOWN` |
| `account/actions.ts:38` | insert địa chỉ `.single()` → `PGRST116` | không (RLS) | giữ |
| `cart/actions.ts` (6 chỗ) | lỗi DB | không | giữ `UNKNOWN`; lỗi mạng đã thành `NETWORK_ERROR` |
| `checkout/actions.ts:69`, `orders/actions.ts:48` | lỗi RPC không có mã | không | giữ |
| `api/search`, `api/cart/guest` | catch → 500 | không | giữ |

**Câu mới**

| Mã | vi | en |
|---|---|---|
| `ITEM_DELETED` | Mục này vừa bị xóa ở nơi khác. Bạn tải lại danh sách để xem dữ liệu mới nhất. | This item was just deleted elsewhere. Reload the list to see the latest data. |
| `BOOK_AUTHORS_NOT_SAVED` | Đã lưu thông tin sách nhưng chưa lưu được tác giả. Bạn bấm Lưu lại một lần nữa nhé. | The book was saved, but its authors weren't. Please press Save again. |
| `UNKNOWN` | Có lỗi phía Nhà Sách Mây, không phải do bạn. Bạn thử lại nhé; nếu vẫn lỗi, gửi email tới {email}. | Something went wrong on our side, not yours. Please try again; if it keeps happening, email {email}. |

(Admin chỉ tiếng Việt nhưng `errors.*` dùng chung nên vẫn có bản en.)

**Test**: Vitest cho `toFailure` (từng mã PostgREST), từng action admin 0 dòng → `ITEM_DELETED` (mock client như test hiện có); test tĩnh: mọi `code` mà action trả nằm trong `getFormMessages` của trang dùng nó (nếu làm được bằng đọc file; không thì kiểm tay và ghi lại).

**Migration**: không.

## 13. Lỗi web còn mở trong handoff

**a. `/tai-khoan/don-hang?page=99` trả 200** → **đã quyết giữ soft 404** (★6): không kiểm ở proxy. Trang đổi `InlineNotFound` → `NotFoundView kind="page"` (câu chung + link "Về trang đầu" / "Go to first page", `notFound.firstPage`, giữ bộ lọc trạng thái trên link). Handoff: đóng mục mở này, ghi lý do. Test: e2e `?page=99` → HTTP 200, có `noindex`, câu + link "Về trang đầu" trỏ đúng trang 1 (giữ `status`).

**b. `/tai-khoan/dia-chi/[id]` gọi `notFound()` trong Suspense** → proxy kiểm (id sai định dạng → 404; đếm `addresses` theo `id` + `user_id` bằng client theo phiên, như đơn) → rewrite 404 `x-not-found: address`. Trang đổi `notFound()` → `<InlineNotFound kind="address" />`. Câu `notFound.address`: "Không tìm thấy địa chỉ này. Bạn xem lại trong Sổ địa chỉ nhé." / "We couldn't find this address. Please check your address book." + link "Sổ địa chỉ" / "Address book". e2e: id không có, id của user khác → HTTP 404 + câu; console không có React #419.

**c. Trang đặt hàng thành công hiện 404 dưới "Đặt hàng thành công"** → đưa icon + `<h1>` + câu dẫn vào **trong** boundary (chỉ render khi có đơn). Shell chỉ còn skeleton (giữ đúng chiều cao để không CLS). Không có đơn → `InlineNotFound kind="order"` (mục 9). `generateMetadata` giữ tiêu đề "Đặt hàng thành công" (không query; chấp nhận: trường hợp này chỉ xảy ra khi proxy lỗi). e2e: khó tái hiện (cần proxy lỗi mà trang chạy) → Vitest render component `OrderSuccess` với `order = null` không có chữ "Đặt hàng thành công"; e2e đơn thật vẫn có `<h1>`.

**d. `layout.spec:66` / `account.spec:71` chập chờn** → mục 15 (`layout.spec` là lỗi thật của `LocaleSwitcher`; `account.spec` là request 404).

**Migration**: không.

## 14. Trang đăng nhập mất chữ đã gõ

**Hiện trạng**
- `login/page.tsx`: `<Suspense fallback={<Form …/>}>` + `FormWithParams` đọc `searchParams` (`next`, `error`, `confirmed`). Sau điều hướng phía client, fallback hydrate rồi bị **thay bằng form khác** ~60 ms sau → mất chữ (CI tái hiện ~3/24 lần trên mobile). e2e né bằng `fillLogin` chờ form thật.
- `forgot-password/page.tsx` **cùng lỗi** (fallback là cùng form, `FormWithError` đọc `?error=`). Sửa luôn.

**Cách sửa**: chỉ **một** form, nằm trong khung tĩnh, không phụ thuộc `searchParams`:
- `next`: client leaf `NextField` (`<input type="hidden" name="next">`) đọc `location.search` bằng `useSyncExternalStore` (server snapshot `''`) → điền sau hydrate, không thay form. Server action vẫn `safeNextPath`.
- Không JS (form POST trước khi JS chạy hoặc tắt JS): input `next` rỗng → action lấy `next` từ `Referer` (URL trang đăng nhập, cùng origin) qua `safeNextPath`. Vitest cho hàm lấy `next` từ `Referer` (khác origin → bỏ).
- `?error=LINK_EXPIRED` / `?confirmed=1`: khối thông báo riêng trong `<Suspense fallback={null}>` **phía trên** form (không bọc form). Chỉ hiện khi URL có tham số → layout dịch xuống một lần lúc tải (hiếm, chấp nhận) và chữ đã gõ không bị đụng.
- Bỏ `Form` / `FormWithParams`; khối thông báo tự hiện câu, `LoginForm` bỏ prop `initialError`.
- `fillLogin` không nới: bước "URL có `next` ⇒ chờ form có input ẩn `next`" đổi thành "chờ input ẩn `next` có giá trị" (input giờ luôn có, giá trị điền sau hydrate) — chặt tương đương, ghi trong báo cáo.

**Test**
- e2e mới `login-typing.spec.ts` (desktop + mobile, vi + en): khách → giỏ → "Thanh toán" (điều hướng phía client tới `/dang-nhap?next=…`) → gõ email **ngay khi ô hiện ra** (không chờ hydrate), `--repeat-each` 10 lần ở lần chạy CI đầu → email còn nguyên, `<main>` chỉ có **1** `<form>` suốt quá trình (MutationObserver đếm form được thêm = 0), đăng nhập xong về đúng `next`. Tương tự `/quen-mat-khau?error=LINK_EXPIRED`.
- Không JS (`javaScriptEnabled: false`): `/dang-nhap?next=%2Fgio-hang` → đăng nhập → về `/gio-hang`.

**Migration**: không.

## 15. Request 404 làm `account.spec:71`, `cart-account.spec:94` chập chờn

**Đã xem** (run 39105867611, 39102507538, 39051786575):
- `account.spec:71` (desktop-account) fail ở dòng 89, `cart-account.spec:94` (mobile-account) fail ở dòng 119 với **3** dòng "Failed to load resource: 404". `collectErrors` (`e2e/helpers.ts:3`) chỉ ghi chữ console, không có URL.
- Trace chỉ có ở lần retry (`trace: 'on-first-retry'`), mà retry nào cũng qua: 4 trace không có response ≥ 400. **Chưa bắt được URL**, nên nguyên nhân dưới đây là suy luận có căn cứ.

**Nguyên nhân nghi nhiều nhất**: kệ "Bán chạy" ở trang chủ còn link tới sách e2e đã bị xóa.
1. Cả hai test đi qua `/` sau khi đăng xuất. Trên luồng đó, đường duy nhất ra 404 là proxy rewrite vì slug không còn (đơn hàng: khách chưa đăng nhập bị 307 trước; danh mục e2e đều ẩn).
2. Kệ Bán chạy (`features/books/queries.ts:82-87`) chỉ lọc `sold_count > 0`, **không** loại sách thuộc danh mục ẩn. Sách thật seed có `sold_count = 0` → trên CI kệ này toàn sách e2e đã có đơn (`e2e-shop-…`, `e2e-admin-…`, sách của `purchase.spec`). Bản vá `created_at` năm 2000 chỉ né kệ "Mới về".
3. Spec admin / checkout gọi `updateTag` giữa lúc chạy → trang chủ render lại, kéo sách e2e lên kệ. Spec khác xóa sách bằng service role (không `updateTag`) → trang chủ giữ link chết.
4. `<Link>` prefetch `/sach/e2e-…?_rsc=` → danh sách slug (cache 60 giây) hết hạn → proxy hỏi thẳng → không có → 404 → Chromium log lỗi. 3 lỗi trên mobile khớp 3 thẻ sách trong viewport. Lần retry: HTML trang chủ không còn kệ Bán chạy (đã render lại, < 6 sách → ẩn): khớp giả thuyết.

**Cách sửa**
- **Chẩn đoán trước** (commit riêng, đầu đợt): `collectErrors` ghi thêm mọi response ≥ 400 kèm URL (giống `collectErrorsAllow404`, `helpers.ts:22-26`). Không lọc lỗi nào, assert giữ nguyên: chỉ làm thông báo fail có URL. Chạy CI vài lượt (`gh workflow run`) để xác nhận.
- **Gốc**: kệ trang chủ (Nổi bật, Bán chạy, Mới về, Sách ngoại văn) chỉ lấy sách thuộc **danh mục lá đang hiện, có cha đang hiện** (`getHomeShelves` nhận danh sách id lá từ `getCategories()` mà trang chủ đã gọi, thêm `.in('category_id', ids)`). Đây cũng là lỗi sản phẩm: sách trong danh mục admin đang ẩn hiện lên kệ. Bất biến mới trong `scripts/e2e-seed.test.ts`: kệ Bán chạy vẫn ẩn với dữ liệu seed (không spec nào dựa vào nó hiện).
- Lưới `/sach` và tìm kiếm cũng chưa lọc danh mục ẩn: ghi nhận, **không** sửa đợt này (đổi hành vi catalog, cần quyết riêng) → thêm vào "Việc mở" của handoff.
- Nếu log URL cho thấy request khác: sửa theo URL thật, báo lại trước khi làm.

**`layout.spec:66` (mobile, run 39088263454)**: lỗi thật của `LocaleSwitcher`, không phải test.
- Bấm "EN" trên `/?x=1` → về `/en`, mất `?x=1`.
- HTML trong trace: boundary Suspense **ngoài** của `LocaleSwitcher` hiện fallback `<a href="/en">` (không có script `PATCH_QUERY`); nội dung thật nằm trong `<div hidden id="S:3">` gần cuối HTML, chưa chuyển vào chỗ. Mobile trên CI chậm → bấm trúng link fallback.
- Comment `locale-switcher.tsx:14-15` ("trang đã prerender không bao giờ thấy fallback này") sai.
- Sửa: gắn `PATCH_QUERY` cho cả fallback ngoài (cùng script như fallback trong) + sửa comment. Test thêm `toHaveAttribute('href', '/en?x=1')` trước khi bấm (cả chiều en → vi) — bổ sung, không thay assert cũ.
- e2e: `layout.spec` chạy `--repeat-each 10` trên CI một lần ở nhánh để xác nhận.

**Migration**: không.

## 16. Tên tác giả ngược thứ tự

**Hiện trạng**: Google Books trả "Huy Thiệp Nguyễn" (tên trước, họ sau). `slugify(name)` sinh slug từ tên lúc import → slug cũng ngược (`huy-thiep-nguyen`). Đổi tên trong DB: trigger "đổi tên tác giả → tính lại `search_text`" (`schema.sql:276`) cập nhật tìm kiếm.

**Bước 1: 2 câu chỉ đọc** trong `supabase/checks/authors-reversed-names.sql` (bạn chạy, dán kết quả):
- **R1**: tác giả có từ cuối là họ Việt phổ biến, từ đầu không phải họ. Họ chia 2 mức: **chắc** (hầu như không dùng làm tên riêng) và **cần xem** (cũng là tên riêng: Mai, Hà, Lâm, Hoàng…). So khớp trên slug (đã bỏ dấu). Cột `co_dau_viet = false` đánh dấu tên có thể là tên nước ngoài; `ten_de_xuat` đưa từ cuối lên đầu để tham khảo.
- **R2**: cặp tác giả cùng tập từ nhưng khác thứ tự (một người bị tách đôi).

**Bước 2: câu UPDATE** (viết sau khi có kết quả, gửi riêng để bạn review + tự chạy)
- Chỉ đổi `name` theo danh sách id bạn duyệt (không suy tự động trong UPDATE): `update public.authors set name = v.name from (values (12, 'Nguyễn Huy Thiệp'), …) v(id, name) where authors.id = v.id and authors.name = <tên cũ>;` (điều kiện tên cũ chống chạy hai lần / chạy nhầm). Bọc `begin; … commit;`, kèm `select` kiểm trước / sau.
- **Slug giữ nguyên** (★7): link cũ chạy tiếp.
- Cặp trùng người (nếu có): gộp `book_authors` sang một id rồi xóa id kia; slug của id bị xóa sẽ 404 → nếu có cặp như vậy, mình báo trước và đề xuất giữ id có slug đúng thứ tự.
- Cache: SQL chạy ngoài app nên không gọi `updateTag`; lưu một tác giả trong admin chỉ làm mới tag sách của tác giả đó. → Sau khi chạy UPDATE: **Redeploy** trên Vercel để mọi trang prerender (và catalog rút gọn của chatbot) lấy tên mới. Ghi rõ trong câu gửi kèm.
- Import sau này: Google vẫn trả tên ngược → `slugify` ra slug cũ → khớp tác giả đã có (upsert theo slug, `ignoreDuplicates`), tên đã sửa không bị ghi đè. Rủi ro: một cuốn khác có tên đúng thứ tự → slug mới → tác giả trùng. Thêm vào `scripts/import-books.ts`: trước khi tạo tác giả mới, tìm tác giả có cùng tập từ trong slug → dùng lại (Vitest). Làm trong đợt này (nhỏ, chặn tái phát).

**Test**: Vitest cho hàm so tập từ của slug (`sameNameTokens`) dùng ở import. SQL không có test tự động (bạn chạy tay).

**Migration**: không (dữ liệu, chạy tay).

---

## Ghi chú chung khi code

- Không thêm dependency. Không mở `.env.local`. Không chạy SQL lên Supabase. Không push `main`.
- Không xóa / skip / nới test cũ. Test cũ so câu đã đổi thì đổi câu mong đợi sang câu mới (vẫn so chính xác), liệt kê trong báo cáo.
- `CLAUDE.md` cập nhật: quy ước digest, `SUPPORT_EMAIL`, `x-not-found`, mã lỗi voucher / hủy đơn, `checkout_vouchers`, `is_public`, quy ước login không bọc form trong Suspense.
- `handoff.md`, `final-report.md` cập nhật cuối đợt.
