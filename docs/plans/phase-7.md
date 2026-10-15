# Phase 7: Admin

Trạng thái: **7a xong, đã merge vào `main`** (2026-10-15); `test:e2e` đầy đủ 160/160 qua trước khi merge. Chọn hết các ★ (mục 3: chuỗi admin chỉ tiếng Việt, ngoại lệ ghi vào CLAUDE.md), bổ sung 2 điểm (xem "Bổ sung khi duyệt"). **7b xong trên nhánh `phase-7b`, chờ duyệt merge** (2026-10-16).

## Báo cáo 7b (2026-10-16)

**Đã xong**
- `/admin/don-hang`: lọc trạng thái, tìm theo mã đơn / SĐT (bỏ khoảng trắng) / tên người nhận (một `.or()`, giá trị quote + escape), 25 dòng / trang. Tổng quan: "Đơn chờ xác nhận" link sang danh sách đã lọc.
- `/admin/don-hang/[code]`: dùng lại `OrderDetails` của khách + khối "Xử lý đơn" (nút bước kế tiếp, hủy kèm lý do bắt buộc), thanh toán (phương thức, trạng thái, voucher), khách hàng (tài khoản đặt, thời điểm cập nhật).
- `advanceOrder` / `cancelOrderAsAdmin`: update có điều kiện `status = <trạng thái admin đang thấy>`; 0 dòng → `ORDER_STATUS_CHANGED` + `refresh()`. Hủy → `expireOrderBooks` (trigger hoàn kho). `nextStatuses` trùng bảng DB (Vitest đọc `private.order_status_transition_allowed` trong `schema.sql`).
- Trang chi tiết đơn của khách hiện trạng thái thanh toán (COD giao xong → "Đã thanh toán").
- `/admin/voucher`: danh sách (tìm theo mã, trạng thái tính sẵn: đang chạy / đã tắt / chưa bắt đầu / hết hạn / hết lượt, cùng thứ tự kiểm tra với `voucher_discount`), tạo, sửa, xóa.
- Bổ sung khi duyệt: link "Quản trị" chỉ admin thấy, ở trang tài khoản (thẻ "Quản trị cửa hàng") và cạnh icon tài khoản ở header. Quyền kiểm ở server (`isAdmin()`, `React.cache`), không thêm client component.

**Migration**: không cần. Mọi ràng buộc 7b đã có từ `20261015160000_admin.sql`.

**Quyết định tự chọn / lệch plan**
1. Header: icon quản trị chỉ hiện từ `sm` (640px). Nút thứ 6 làm header tràn ngang 16px ở 360–390px (e2e đo); điện thoại dùng thẻ ở trang tài khoản (một chạm từ avatar). Icon nằm trong `<Suspense>` riêng: icon tài khoản không phải chờ thêm một RPC `is_admin`.
2. Link vào admin dùng `AdminLink` (`prefetch={false}`) thay vì `<a>`: ESLint `no-html-link-for-pages` chặn `<a href="/admin">`, và `next/link` đã có sẵn trong bundle nên không thêm JS; sang root layout khác Next tự tải lại cả trang.
3. Hủy đơn ở admin dùng lại `CancelOrderForm` của khách (nhãn khác, lý do bắt buộc ở server: khóa `admin.validation.cancelReason`). Nút bước kế tiếp là component luôn render ở cùng vị trí (như `CancelOrderForm`) để thông báo còn sau `refresh()` khi đơn đã tới trạng thái cuối.
4. Bật / tắt voucher là ô "Đang bật" trong form sửa (như danh mục), không có nút riêng.
5. Xóa voucher bị chặn (`VOUCHER_IN_USE`) khi `used_count > 0` **hoặc** còn đơn gắn `voucher_id` (đơn đã hủy làm `used_count` giảm nhưng vẫn trỏ tới voucher).
6. Ô thời gian voucher: `datetime-local` theo giờ Việt Nam, đổi sang `timestamptz` bằng offset +07:00 cố định (server Vercel chạy UTC). Kiểm ngày giờ không có thật (31/02, 24:00) + kết thúc phải sau bắt đầu.
7. Mã lỗi mới (vi + en): `ORDER_STATUS_CHANGED`, `VOUCHER_CODE_TAKEN`, `VOUCHER_IN_USE`; khóa mới `order.paymentStatus.*` (vi + en), `layout.admin`, `account.admin*`.
8. e2e: `placeE2eOrder` (dùng chung `admin-cleanup` + `admin-orders`), `createE2eVoucher` / `deleteE2eVouchers(codes)` trong `scripts/e2e-user.ts`.

**Kiểm tra**
- `typecheck`, `lint`, `build`: sạch. Vitest: 35 file / 309 test qua (mới: `status`, `datetime`, `state`, schema voucher).
- `test:e2e` đầy đủ: **170/170 qua ở lượt đầu** (10.0 phút; 160 cũ + 10 mới: 5 `admin-orders`, 3 `admin-vouchers`, 2 `admin-smoke` link quản trị desktop / mobile; `account.spec` thêm kiểm tra user thường không thấy link).
- `measure:js`: trang chủ = baseline + 38.5KB, trang sách (`vi/books/lam-ban-voi-bau-troi`, `vi/books/sapiens`) + 39.2KB: bằng đúng số của `main` sau 7a.
- Soát giao diện bằng ảnh chụp (desktop): danh sách / chi tiết đơn, danh sách / form voucher, trang tài khoản. Sửa: hàng 2 cột của form voucher lệch dọc khi một ô có gợi ý (`items-start`).

**Giới hạn / rủi ro**
- `vouchers.used_count` không có quyền cột: admin gọi thẳng PostgREST sửa được (app không ghi cột này). Muốn chặn cần migration `grant update (…)` như `books` / `orders`.
- Header gọi thêm RPC `is_admin` cho mỗi trang của user đã đăng nhập (stream riêng, không chặn nội dung).
- Trang chi tiết đơn admin hiện mã đơn hai lần (tiêu đề + khối `OrderDetails` dùng chung).
- Ô `datetime-local` hiển thị theo locale trình duyệt (mm/dd/yyyy trên trình duyệt tiếng Anh).

**Việc của bạn**: duyệt merge `phase-7b`; thay 5 bìa trong `docs/plans/data.md` → "Bìa cần thay trong admin".

## Báo cáo 7a (2026-10-15)

**Đã xong**
- `/admin`: tổng quan (đơn chờ xác nhận, sách sắp hết / hết hàng / đang ẩn, link sang danh sách đã lọc), khung admin (điều hướng trái trên desktop / trên cùng trên mobile, "Về cửa hàng", đổi theme), 404 tiếng Việt riêng của admin.
- `/admin/sach`: bảng 25 dòng / trang, lọc bằng form GET trên URL (từ khóa, danh mục lá, đang bán / đã ẩn, sắp hết / hết hàng). Tìm trên `search_text` (tên + phụ đề + ISBN + tác giả, gõ không dấu), mỗi từ một `ilike` đã escape.
- `/admin/sach/[id]`: sửa mọi cột của form, `*_en`, giá, tồn kho, danh mục (chỉ danh mục lá, nhóm theo danh mục gốc), NXB, tác giả (các dòng tác giả + vai trò, "Thêm dòng"; không JS vẫn có một dòng trống), nổi bật, ẩn / hiện, upload bìa. Lỗi tại ô: giá gốc < giá bán, slug / ISBN trùng, danh mục không phải lá.
- `/admin/danh-muc`: cây 2 cấp kèm số sách, tạo / sửa (cha phải là gốc, danh mục có con phải là gốc, danh mục có sách không làm cha được).
- `/admin/tac-gia`: danh sách tìm theo tên hoặc slug, tạo / sửa, danh sách sách của tác giả, xóa khi không còn sách (`AUTHOR_HAS_BOOKS`).
- Bảo mật: mọi Server Action admin gọi `assertAdmin()` ở hai câu đầu (Vitest đọc AST các `actions.ts` kiểm tra); RLS + quyền cột + bucket là lớp cuối (e2e).
- Cache: `catalogTagsFor` (Vitest) → `updateTag`; e2e xác nhận trang công khai đổi ngay sau khi sửa giá / tồn kho, ẩn / hiện, đổi danh mục, gắn tác giả.
- 2 điểm bổ sung khi duyệt: `cancelAndDeleteOrders` tự hoàn kho đơn `delivered` (e2e `admin-cleanup`); escape `ilike` (`lib/like.ts` + Vitest).

**Migration**: `supabase/migrations/20261015160000_admin.sql` (bản có mục 5, policy `book_covers_admin_select`: Storage chỉ xóa được object mà phiên đọc được, thiếu policy select thì `remove()` trả về rỗng, không báo lỗi) đã chạy trên Supabase sau khi bạn kiểm tra trên Postgres local. Types sinh lại: không có diff.

**Việc của bạn**: không còn. Bạn đã test tay 7a (tìm không dấu, sửa tồn kho → trang công khai cập nhật ngay, danh mục, tác giả) và thay bìa trang lót của "100 câu hỏi về lịch sử chữ Quốc ngữ" bằng admin.

**Lỗi có sẵn đã sửa (ngoài phạm vi admin nhưng admin làm lộ ra)**: trang sách / danh mục / tác giả có slug không nằm trong `generateStaticParams` (tạo hoặc đổi slug sau lần build, kể cả sách import giữa hai lần deploy) trả **HTTP 500**. Với Partial Prefetching, Next dựng App Shell cho tham số chưa biết; page đọc `params` và header đọc `useParams` ngoài `<Suspense>` nên dựng shell thất bại. Đã thêm `export const instant = false` cho 3 trang đó (như trang địa chỉ / đơn hàng): slug mới render theo request, slug đã prerender giữ nguyên. Cách triệt để (đọc params trong `<Suspense>`, header không chặn shell) đụng mọi trang công khai → ghi vào Lộ trình Phase 10 trong CLAUDE.md.

**Quyết định tự chọn / lệch plan**
1. Tìm sách trên `search_text` thay vì `title` / `isbn` (đã ghi ở "Bổ sung khi duyệt").
2. Tìm tác giả: mỗi từ là một `.or()` "tên chứa từ HOẶC slug chứa từ đã slugify", giá trị trong `.or()` quote + escape (`quoteFilterValue`). Chỉ tìm theo slug thì tác giả có slug tự đặt không tìm được bằng tên.
3. `catalogTagsFor` thêm `books` cả khi đổi tên / phụ đề / ISBN (kết quả tìm kiếm), ngôn ngữ (bộ lọc ngôn ngữ), giá sang khoảng lọc khác, tồn kho qua 0 (bộ lọc còn hàng): các danh sách đó không chứa tag của sách. Sửa giá trong cùng khoảng, mô tả, bìa… vẫn chỉ `book:{id}`. Sách đang ẩn sửa gì cũng chỉ `book:{id}`.
4. Đổi bìa: chỉ xóa ảnh cũ khi không `order_items` nào còn trỏ tới (`order_items.cover_url` là bản sao lúc đặt, xóa thì trang chi tiết đơn cũ mất ảnh).
5. ESLint cho phép `redirect` / `usePathname` của `next/navigation` trong cả `features/admin` (action redirect về `/admin/...`), không chỉ `app/admin` + `components/admin`. `next/link` chỉ được import trong `admin-link.tsx`; `AdminHref` chỉ nhận `/admin…`.
6. Lỗi tại ô của admin: khóa riêng `admin.validation` (chỉ `vi.json`, Vitest đối chiếu `ADMIN_VALIDATION_KEYS`). `useFormAction` để khối lỗi chung ở dạng `quiet` mỗi khi có lỗi tại ô (trước chỉ với `INVALID_INPUT`), để `SLUG_TAKEN`, `CATEGORY_HAS_BOOKS`, `COVER_*` không hiện hai lần. Hành vi các form cửa hàng không đổi.
7. Query admin chờ `io()` trước Supabase (`features/admin/supabase.ts`): prefetch App Shell theo phiên của link admin từng báo "unstable value Date.now()" (Supabase so hạn token).
8. Upload bìa kiểm tra cỡ ở client trước (không gửi file quá 4MB); không JS thì server kiểm tra như nhau.
9. Bộ lọc danh mục ở danh sách sách chỉ có danh mục lá (sách chỉ gắn vào lá), không lọc theo danh mục cha.
10. e2e: user admin tạo trong cùng setup (file `e2e/.auth/admin-credentials.json` riêng, không đổi dạng `credentials.json`); dọn dữ liệu theo đúng slug của spec (`cleanupE2eAdminData(slugs)`), bản không tham số chỉ ở setup / teardown; xóa tuần tự từng bảng (xóa song song sách + tác giả từng deadlock); `findBooksByStock*` bỏ sách `e2e-…` (sách admin test đang bán và có id lớn nhất). `ACCOUNT_SPECS` thêm `$` và loại `admin-*.spec.ts` (`admin-orders.spec.ts` của 7b khớp cả `orders.spec.ts`).
11. Xóa ảnh bìa cũ chạy trong `after()` (sau khi đã trả phản hồi): sau migration, test bìa từng hết 30s vì action gọi Supabase tuần tự ~9 lượt (mỗi lượt ~1s ở mạng máy dev). Thứ tự "ghi `cover_url` xong mới kiểm tra `order_items` rồi xóa" giữ nguyên; e2e chờ object cũ biến mất bằng `expect.poll` (10s).

**Kiểm tra**
- `typecheck`, `lint`, `build`: sạch. Vitest: 31 file / 289 test qua.
- e2e sau migration:
  - 2 test chờ migration: `admin-security` (quyền cột + bucket) qua ngay; `admin-books` "bìa cũ bị xóa" hết 30s ở bước upload (xem lệch plan 11), sửa xong `admin-books` qua 7/7.
  - Project admin (desktop-admin + mobile-admin, 16 test): sau sửa 15/16 qua, `admin-smoke` desktop hết 5s chờ bảng stream về; chạy riêng lại thì qua cả desktop lẫn mobile.
  - `test:e2e` đầy đủ (160 test), 3 lượt cách nhau 3 phút, không nới timeout, đều chạy trước khi sửa upload bìa: lượt 1 hỏng ở setup (`listUsers: fetch failed`, 100 test không chạy); lượt 2: 135 qua, 7 fail (`fetch failed` khi tạo dữ liệu test, timeout ở `cart-account`, `checkout`, `error-page`, `admin-catalog`); lượt 3: 142 qua, 3 fail (`clearCart: fetch failed`, `checkout` mobile timeout, bìa admin). Test cửa hàng fail mỗi lượt một chỗ khác nhau, kèm `fetch failed` tới Supabase → do mạng; chưa có lượt nào cửa hàng sạch hoàn toàn, nên chạy lại khi mạng ổn.
- `e2e/orders.spec.ts`: test "12 đơn" chuyển đơn qua `confirmed → shipping → delivered` thay vì nhảy thẳng `pending → delivered` (trigger mới chặn). Thay đổi này có sẵn trong working tree, không do tôi viết; đúng nên gộp vào commit.
- `test:e2e` đầy đủ sau khi sửa upload bìa (trước khi merge): **160/160 qua** ở lượt đầu (10.1 phút).
- Trước migration (lượt trước): 146 / 143 / 143 qua, chỉ 2 test admin chờ migration fail ở phần admin.
- `measure:js` (so với build của `main`): mọi chunk app ở trang chủ / trang sách giữ nguyên kích thước. Chỉ runtime Turbopack (`turbopack-*.js`, chứa danh sách chunk của cả app) tăng 3.8 → 4.3KB gzip vì app có thêm route admin. Trang chủ = baseline + 38.5KB (main: 38.1), trang sách + 39.2KB (main: 38.7).

**Giới hạn / rủi ro**
- Ô chọn tác giả / NXB của form sách tải hết danh sách: quá 1.000 dòng sẽ bị `max-rows` của PostgREST cắt. Khi đó cần ô tìm kiếm thay `<select>`.
- Slug mới (sau build) render theo request với `instant = false`, chưa được cache như trang đã prerender cho tới lần deploy sau.
- Sách e2e có thể vào "Mới về" trên trang chủ nếu cache danh sách được làm mới đúng lúc test chạy. Bản deploy dùng chung DB thì có thể giữ trong cache tới hết `cacheLife('hours')`, không chỉ vài giây như plan ghi. Phase 10 tách dữ liệu e2e sẽ xử lý.
- File > 4.5MB gửi không có JS bị Next chặn trước action → trang lỗi chung thay vì lỗi tại ô (có JS thì client chặn từ trước).

Phạm vi (lộ trình): quản trị sách (sửa thông tin, `*_en`, giá, tồn kho, ẩn / hiện, upload bìa), danh mục, tác giả, đơn hàng (đổi trạng thái, hủy), voucher. Chỉ tiếng Việt, dưới `/admin` (không có `[locale]`).

**Không** có: nhập sách mới từ Google Books trong admin (vẫn dùng `npm run import:books`), ảnh phụ (`book_images`), sửa NXB (chỉ chọn NXB có sẵn), quản lý user / phân quyền (đặt admin vẫn bằng SQL), báo cáo doanh thu, email báo trạng thái đơn (Phase 9), rich editor (mô tả là textarea).

## Bổ sung khi duyệt

1. **Dọn dữ liệu e2e sau migration.** Trigger mới chặn `delivered → cancelled` với **mọi** role, kể cả service role. `cancelAndDeleteOrders` (`scripts/e2e-user.ts`) đang hủy đơn để trigger hoàn kho → sẽ lỗi với đơn test đã tới `delivered` (7b), cả câu `update` hỏng, sót đơn và không hoàn kho sách test.
   - Sửa: đơn `delivered` thì đọc `order_items`, xóa đơn, rồi tự cộng lại `stock` và trừ `sold_count` (không âm) bằng service role, giảm `used_count` của voucher nếu có (như trigger làm khi hủy). Đơn ở trạng thái khác giữ cách cũ (hủy → trigger hoàn kho → xóa).
   - Thứ tự "đọc → xóa → hoàn kho": lỗi giữa chừng thì thiếu hoàn kho chứ không hoàn hai lần khi chạy lại.
   - Test (`e2e/admin-cleanup.spec.ts`, không mở trình duyệt): user e2e đặt sách e2e qua RPC, service role đưa đơn `pending → confirmed → shipping → delivered`, gọi `cancelAndDeleteOrders` → đơn bị xóa, `stock` / `sold_count` về như trước khi đặt.
2. **Tìm sách trong admin bằng `ilike`** trên `search_text` (tên + phụ đề + ISBN + tác giả, đã bỏ dấu, có index trigram) thay vì `title` / `isbn`: gõ không dấu vẫn ra, một cột nên không cần `.or()` (giá trị trong `.or()` phải quote thêm một lớp). Từ khóa bỏ dấu ở app giống `normalize_vi`, tách theo khoảng trắng, mọi từ phải khớp (như `search_books`). Mỗi từ escape `\`, `%`, `_`; `*` đổi thành `_` vì PostgREST coi `*` trong mẫu like là `%`. Hàm thuần trong `src/lib/like.ts` + Vitest.

## Có cần migration không

**Có**, một file `supabase/migrations/<ngày>_admin.sql` (+ cập nhật `schema.sql`, sinh lại types):

1. **Luồng trạng thái đơn ở DB** (cần chọn 8): `handle_order_status_change` chặn mọi chuyển trạng thái ngoài luồng, mã lỗi mới `ORDER_INVALID_TRANSITION` (detail `{"from": …, "to": …}`). `ORDER_REOPEN_FORBIDDEN` giữ nguyên cho `cancelled → *`.
2. **Quyền cột của `orders`**: `revoke update on public.orders from authenticated; grant update (status, payment_status, cancelled_reason) on public.orders to authenticated`. RLS `orders_admin_update` đã giới hạn dòng cho admin; quyền cột chặn sửa tiền / địa chỉ / dòng sách kể cả khi là admin. `cancel_order` / `place_order` là `security definer` nên không bị ảnh hưởng.
3. **Quyền cột của `books`**: chỉ cho `authenticated` update các cột sửa được trong admin; bỏ `sold_count`, `avg_rating`, `review_count`, `search_text`, `created_at`, `updated_at` (cột do DB quản lý, CLAUDE.md → Database). Insert giữ nguyên (admin không tạo sách mới ở phase này, nhưng e2e tạo sách test bằng service role). Trigger không bị chặn: quyền cột chỉ xét các cột có trong câu `UPDATE` (trigger BEFORE ghi `search_text` / `updated_at` vẫn chạy), còn `book_authors_touch_book` / `authors_touch_books` / `place_order` là `security definer`.
4. **Giới hạn bucket `book-covers`**: `allowed_mime_types = '{image/webp}'`, `file_size_limit = 1048576` (1MB). Server chỉ upload WebP đã xử lý (600px ≈ 30–120KB), nên bucket từ chối mọi thứ khác kể cả khi ai đó có phiên admin và gọi thẳng Storage API.
5. (Cần chọn 9) COD giao xong → `payment_status = 'paid'` trong cùng trigger.

Không đổi RLS: các policy `*_admin_insert/update/delete` của catalog, `vouchers_admin_all`, `orders_admin_update`, storage `book_covers_admin_*` đã đủ.

## Bảo mật: ba lớp + RLS

1. **Proxy** (có sẵn): `/admin*` gọi `is_admin`, không phải admin → về `/`.
2. **Layout** (có sẵn): `AdminGate` → `requireAdmin()`.
3. **Mỗi Server Action admin tự kiểm tra** (mới): dòng đầu tiên của mọi action trong `features/admin/**/actions.ts` là `const denied = await assertAdmin(); if (denied) return denied` → `{ ok: false, code: 'FORBIDDEN' }` (mã mới trong `ERROR_CODES` + `errors.FORBIDDEN`). Không dựa vào layout / proxy: Server Action là endpoint POST gọi thẳng được bằng action ID, không đi qua layout.
   - `assertAdmin()` (`features/admin/auth.ts`, `server-only`): `getCurrentUser()` + RPC `is_admin` (một request, `React.cache`).
   - Vitest tĩnh: đọc các file `features/admin/**/actions.ts`, mọi `export async function` phải có `await assertAdmin()` là câu lệnh đầu. Thêm action mới mà quên kiểm tra thì test fail.
4. **RLS + quyền cột** là lớp chặn cuối: user thường gọi thẳng PostgREST (`update books`, `update orders`, upload Storage) đều bị chặn. Có e2e kiểm tra bằng client của user thường.

Mọi input parse bằng zod ở server (`features/admin/*/schemas.ts`), kể cả id bind sẵn.

## Cần chọn

★ = đề xuất.

1. **Chia phase**
   - ★ Hai nhánh, hai lần báo cáo / merge: **7a** catalog (sách + bìa, danh mục, tác giả) → **7b** đơn hàng + voucher (cần migration mục 1, 2, 5). Migration viết một lần ở đầu 7a để chạy một lần.
   - Một nhánh cho cả phase: ít vòng duyệt hơn nhưng diff rất lớn, e2e dài, khó dừng giữa chừng.

2. **Form và JS ở admin**
   - ★ Cùng cách với cửa hàng: Server Component + form Server Action + `useFormAction` (chạy được không JS, lỗi từng ô). Admin không thuộc ngân sách 50KB của trang sách, nhưng vẫn không thêm thư viện (form, bảng, rich editor, upload). Bảng danh sách là `<table>` HTML, lọc / phân trang trên URL.
   - Thêm thư viện bảng / form: nhanh hơn khi làm nhưng trái quy tắc "thêm dependency phải hỏi", và admin nhỏ không cần.

3. **Chuỗi giao diện admin**
   - ★ Namespace `admin` chỉ có trong `messages/vi.json`; test "cùng bộ key" bỏ qua namespace này, `en.json` xóa namespace `admin` hiện có. Kiểu message key vẫn lấy từ `vi.json` nên type-safe. Không phải dịch hàng trăm chuỗi admin không ai đọc bằng tiếng Anh.
   - Giữ hai file cùng bộ key: đúng quy tắc hiện tại nhưng phải viết bản tiếng Anh cho toàn bộ admin.

4. **Upload bìa**
   - ★ Server Action nhận `File` qua `FormData`:
     - Giới hạn **4MB** (giới hạn body request của Vercel là 4.5MB) + `experimental.serverActions.bodySizeLimit: '4.5mb'` trong `next.config.ts`. Kiểm tra `file.size` trước khi đọc.
     - Kiểm tra loại bằng **nội dung file**, không tin `file.type` / đuôi: `sharp(buffer).metadata()` → chỉ nhận `jpeg`, `png`, `webp`, `avif`; `limitInputPixels` (40MP) chống ảnh bom.
     - Xử lý giống import: rộng 600px, `withoutEnlargement`, WebP quality 80. Tách `toCoverWebp` ra `src/lib/cover-image.ts` (không `server-only`, để `scripts/import-books.ts` dùng chung), có Vitest với ảnh mẫu sinh bằng sharp.
     - Lưu `book-covers/<book_id>-<8 ký tự ngẫu nhiên>.webp` (tên mới mỗi lần): ảnh cũ đang được CDN / `next/image` cache 1 năm (`cacheControl: '31536000'`), ghi đè cùng tên thì người xem vẫn thấy bìa cũ. Ghi `cover_url` xong mới xóa object cũ (nếu nằm trong bucket); lỗi giữa chừng thì xóa object mới vừa upload.
     - Mã lỗi mới: `COVER_TOO_LARGE`, `COVER_INVALID` (lỗi tại ô).
   - Client upload thẳng lên Storage bằng signed URL: không qua giới hạn 4.5MB nhưng không resize / kiểm tra được ở server (bucket chỉ nhận WebP thì client phải tự chuyển).

5. **Làm mới cache khi sửa catalog** (`updateTag`, trong Server Action)
   - ★ Hàm thuần `catalogTagsFor(change)` (`features/admin/cache-tags.ts`, Vitest), action gọi `updateTag` cho từng tag nó trả:
     - Sửa tại chỗ (tên, phụ đề, mô tả, `*_en`, giá, giá gốc, tồn kho, bìa, NXB, năm…), **ẩn** sách: `book:{id}` (trang sách + mọi danh sách đang chứa sách đó, đã gắn tag theo sách từ 5b).
     - Đổi sự có mặt trong danh sách: **hiện lại** sách đã ẩn, đổi danh mục, đổi slug, đổi tác giả, đổi `is_featured`: `book:{id}` + `books` (danh sách chưa chứa sách đó không có tag của nó; slug cũ cache `null` chỉ có tag `books`).
     - Danh mục (tên, `*_en`, mô tả, thứ tự, ẩn / hiện, cha): `categories` + `books` khi ẩn / hiện hoặc đổi cha (trang danh mục cha lọc theo id danh mục con).
     - Tác giả (tên, slug, tiểu sử, `bio_en`): `authors` + `book:{id}` của các sách của tác giả đó (tên tác giả hiện trên thẻ sách).
     - Đơn hàng (7b): hủy → `expireOrderBooks` (có sẵn); đổi trạng thái khác không đụng tồn kho → không làm mới catalog.
   - Luôn `updateTag('books')` cho mọi thay đổi: đơn giản nhưng mỗi lần sửa giá là xóa cache mọi danh sách.

6. **Xóa**
   - ★ Không xóa cứng sách / danh mục từ UI, chỉ **ẩn** (`is_active = false`): `order_items.book_id` là `on delete set null` (đơn cũ mất liên kết), `cart_items` xóa theo cascade, sách xóa nhầm không lấy lại được. Tác giả chỉ xóa được khi không còn sách nào (nếu không `book_authors` bị xóa theo cascade, sách mất tác giả không báo). Voucher đã dùng thì chỉ tắt, chưa dùng thì xóa được.
   - Cho xóa cứng có xác nhận: gọn danh sách nhưng rủi ro như trên.

7. **Tác giả của sách**
   - ★ Chọn từ tác giả có sẵn: các dòng `<select>` tác giả + `<select>` vai trò (tác giả / dịch giả / minh họa), nút "Thêm dòng" (không JS: luôn có thêm 1 dòng trống). Tác giả mới tạo ở trang Tác giả. Lưu bằng một Server Action: xóa + chèn lại `book_authors` của sách (trigger `book_authors_touch_book` cập nhật `search_text`).
   - Gõ tên, tự tạo tác giả nếu chưa có: nhanh hơn nhưng dễ sinh tác giả trùng do gõ khác dấu / hoa thường.

8. **Luồng trạng thái đơn**
   - ★ Chặn ở **DB** (migration mục 1) và chỉ hiện nút hợp lệ ở UI. Luồng: `pending → confirmed → shipping → delivered`; hủy được từ `pending`, `confirmed`, `shipping` (admin hủy **bắt buộc lý do**); `delivered` và `cancelled` là trạng thái cuối. Hàm thuần `nextStatuses(status)` ở app (Vitest) trùng bảng với DB. Trùng lúc khách tự hủy: update có điều kiện `status = <trạng thái đang hiển thị>` → 0 dòng thì báo "Đơn vừa đổi trạng thái" + `refresh()` (như Phase 6 mục 7).
   - Chỉ chặn ở app: không cần migration, nhưng admin (hoặc script) gọi thẳng PostgREST vẫn đi lùi được (`delivered → pending`).

9. **Thanh toán COD**
   - ★ Trigger: đơn COD chuyển `delivered` → `payment_status = 'paid'`. Khớp quy tắc Phase 9 (đơn `paid` không tự hủy được) và hiện đúng "Đã thanh toán" ở trang chi tiết của khách.
   - Admin tự đánh dấu đã thu tiền: linh hoạt hơn nhưng thêm một thao tác dễ quên.

10. **Danh sách sách trong admin**
    - ★ `<table>` 25 dòng / trang (`.range()` + `count: 'exact'`), lọc trên URL: tìm theo tên / ISBN (`ilike` trên `title` / `isbn`, client theo phiên nên thấy cả sách ẩn; `search_books` chỉ trả sách đang bán), danh mục, trạng thái (đang bán / đã ẩn), "sắp hết" (tồn kho ≤ 5). Cột: bìa nhỏ, tên, danh mục, giá, tồn kho, trạng thái. Sửa nhanh tồn kho ngay trên dòng thì để sau.
    - Tải hết rồi lọc ở client: trái CLAUDE.md.

11. **Slug**
    - ★ Sửa được, gợi ý từ tên (dùng chung `slugify` của import, chuyển sang `src/lib/slug.ts`). Trùng → `SLUG_TAKEN` tại ô (map lỗi unique `23505` của Postgres). Đổi slug sách → link cũ 404 (chưa có redirect slug cũ, ghi vào giới hạn).
    - Khóa slug sau khi tạo: không bao giờ hỏng link, nhưng không sửa được slug xấu từ Google Books.

12. **e2e admin**
    - ★ Project mới `desktop-admin` (+ một smoke `mobile-admin` cho danh sách và form sách):
      - **User admin test** do `scripts/e2e-user.ts` tạo (`createE2eUser('admin')` + service role đặt `profiles.role = 'admin'`), xóa ở teardown như các user khác; `cleanupE2eUsers` dọn user sót.
      - **Không sửa sách thật**: mọi sách / danh mục / tác giả / voucher của test có slug / mã bắt đầu `e2e-admin-` (voucher `E2E-ADMIN-…`), tạo bằng service role trong `beforeEach` (hoặc qua UI khi chính việc tạo là thứ được test), xóa trong `afterEach` + `try/finally` trong test. `cleanupE2eUsers` dọn thêm mọi dòng `e2e-admin-%` và object Storage của chúng (đọc `cover_url`) phòng khi test bị ngắt.
      - Đơn hàng cho test trạng thái: user khách e2e đặt **sách e2e** (đang bán, trong **danh mục e2e đang ẩn** để không lọt vào trang danh mục; vẫn có thể hiện ở "Mới về" trên trang chủ trong vài giây chạy test — ghi vào giới hạn). Dọn bằng `cancelAndDeleteOrders` rồi xóa sách.
      - Spec: `admin-books.spec.ts`, `admin-catalog.spec.ts` (danh mục, tác giả), `admin-orders.spec.ts`, `admin-vouchers.spec.ts`, `admin-security.spec.ts`.
    - Chạy admin trên cả desktop và mobile đầy đủ: thêm ~2 phút cho e2e, admin ít khi dùng trên điện thoại.

## Route (`src/app/admin/`)

| Đường dẫn | Nội dung |
|---|---|
| `/admin` | Tổng quan: số đơn chờ xác nhận, sách sắp hết / hết hàng, link nhanh |
| `/admin/sach` | Danh sách sách (lọc, phân trang) |
| `/admin/sach/[id]` | Sửa sách: thông tin, `*_en`, giá, tồn kho, danh mục, NXB, tác giả, nổi bật, ẩn / hiện, bìa |
| `/admin/danh-muc`, `/admin/danh-muc/moi`, `/admin/danh-muc/[id]` | Danh mục 2 cấp: tên, `name_en`, mô tả, `description_en`, cha, thứ tự, ẩn / hiện |
| `/admin/tac-gia`, `/admin/tac-gia/moi`, `/admin/tac-gia/[id]` | Tác giả: tên, slug, tiểu sử, `bio_en` |
| `/admin/don-hang`, `/admin/don-hang/[code]` | Đơn: lọc trạng thái, tìm mã / SĐT; chi tiết + nút chuyển trạng thái, hủy kèm lý do (7b) |
| `/admin/voucher`, `/admin/voucher/moi`, `/admin/voucher/[id]` | Voucher: mã (tự viết HOA), loại, giá trị, trần, đơn tối thiểu, giới hạn lượt, thời gian, bật / tắt (7b) |

- Admin không có `[locale]`, URL tiếng Việt viết thẳng tên thư mục. `Link` của `i18n/navigation` không dùng được (không có provider next-intl ở admin): thêm một `AdminLink` mỏng quanh `next/link` trong `src/components/admin/` + ngoại lệ ESLint chỉ cho thư mục `src/app/admin` và `src/components/admin`.
- Layout admin: thanh điều hướng trái (desktop) / trên (mobile), header gọn, cùng token màu. Trang nào cũng `noindex` (layout đã có).
- Ràng buộc danh mục: tối đa 2 cấp; danh mục đang có sách không được làm cha; danh mục cha không được gắn sách (CLAUDE.md: sách chỉ gắn danh mục lá). Kiểm tra ở action (zod + query), lỗi tại ô.

## Dữ liệu (`features/admin/**/queries.ts`)

- Client theo phiên (`lib/supabase/server.ts`), không `'use cache'`: admin cần thấy sách / danh mục ẩn và dữ liệu mới nhất. Mọi query trong `<Suspense>`.
- Sách: một query `books` + `categories(name)` + `book_authors(role, authors(id, name))` + `publishers(id, name)`. Danh sách chọn danh mục lá / NXB / tác giả cho form: chạy song song `Promise.all`.
- Đơn: `orders` + `order_items` (như Phase 6) + `profiles(full_name)` (RLS cho admin xem profile).

## Messages

Namespace `admin` (chỉ `vi.json`, cần chọn 3): điều hướng, tiêu đề trang, nhãn ô, nút, trạng thái, thông báo lưu. Mã lỗi mới trong `errors` (cả vi / en vì dùng chung `ERROR_CODES`): `FORBIDDEN`, `ORDER_INVALID_TRANSITION`, `SLUG_TAKEN`, `COVER_TOO_LARGE`, `COVER_INVALID`, `CATEGORY_HAS_BOOKS`, `AUTHOR_HAS_BOOKS`.

## Test

- Vitest: `catalogTagsFor`, `nextStatuses` (khớp bảng trong migration), `toCoverWebp` (JPEG / PNG → WebP 600px; ảnh nhỏ không phóng to; file không phải ảnh → lỗi), schema form sách (giá ≥ 0, `original_price ≥ price`, tồn kho ≥ 0, năm 1800–2100, slug), schema voucher (% ≤ 100, `ends_at > starts_at`), test tĩnh "mọi action admin gọi `assertAdmin` đầu tiên".
- e2e (cần chọn 12):
  - **Bảo mật**: khách / user thường vào `/admin` → về `/`; user thường gọi PostgREST `update books` / `update orders` → 0 dòng, upload Storage `book-covers` → lỗi; admin gọi `update orders set total = …` → lỗi quyền cột.
  - **Sách** (sách e2e): sửa giá + tồn kho → trang sách công khai hiện giá / tồn kho mới ngay (`updateTag`); ẩn → trang sách 404 + biến mất khỏi danh mục; hiện lại → xuất hiện lại; đổi danh mục → danh mục mới có, danh mục cũ không; `original_price < price` → lỗi tại ô; slug trùng → `SLUG_TAKEN`.
  - **Bìa**: upload JPEG ~1MB → `cover_url` mới trỏ `book-covers/<id>-….webp`, ảnh 600px, object cũ bị xóa, trang sách hiện bìa mới; file `.png` thực chất là text → `COVER_INVALID`; file > 4MB → `COVER_TOO_LARGE`, không có gì được upload.
  - **Danh mục / tác giả**: tạo, sửa `name_en` → `/en/categories/…` hiện tên mới; danh mục có sách không làm cha được; xóa tác giả còn sách → `AUTHOR_HAS_BOOKS`.
  - **Đơn** (7b): `pending → confirmed → shipping → delivered` (COD → "Đã thanh toán" ở trang chi tiết của khách); hủy không lý do → lỗi tại ô; hủy kèm lý do → tồn kho hoàn lại + trang sách cập nhật; đơn đã hủy không có nút chuyển; khách tự hủy trong lúc admin đang mở trang → admin bấm "Xác nhận" → thông báo + trạng thái mới; gọi thẳng PostgREST `cancelled → pending` → `ORDER_REOPEN_FORBIDDEN`, `delivered → pending` → `ORDER_INVALID_TRANSITION`.
  - **Voucher** (7b): tạo `E2E-ADMIN-…` (mã viết thường tự thành HOA), % > 100 → lỗi tại ô, tắt / xóa.
  - Mọi spec: `afterEach` + `finally` dọn dữ liệu `e2e-admin-`; chạy lại / `--repeat-each` qua.

## Việc của chủ dự án

1. Duyệt plan, chọn ở "Cần chọn".
2. Chạy migration `<ngày>_admin.sql` trên Supabase (tôi viết ở đầu 7a, bạn kiểm tra trước trên Postgres local như 5b), rồi tôi sinh lại types.
3. Sau 7a: thay bìa trang lót của "100 câu hỏi về lịch sử chữ Quốc ngữ" bằng admin (`docs/plans/data.md`).

## Giới hạn / rủi ro đã biết

- Đổi slug sách / tác giả / danh mục → link cũ 404 (chưa có bảng redirect).
- Sách e2e của test đơn hàng có thể hiện ở "Mới về" trên trang chủ trong lúc test chạy (dùng chung DB Supabase với bản deploy).
- `bodySizeLimit` áp cho mọi Server Action của app, không riêng upload bìa (Next chưa cho đặt theo action).

## Tiến độ

7a:
- [x] Migration `admin.sql` (luồng trạng thái đơn, quyền cột `orders` / `books`, giới hạn bucket, COD → paid) + `schema.sql` + types
  - [x] Viết `supabase/migrations/20261015160000_admin.sql` + cập nhật `schema.sql`
  - [x] Bạn kiểm tra trên Postgres local + chạy trên Supabase; sinh lại types (không có diff)
- [x] `assertAdmin` + mã `FORBIDDEN` + test tĩnh; layout admin, điều hướng, `AdminLink` + ngoại lệ ESLint; messages `admin` chỉ vi
- [x] `lib/slug.ts`, `lib/cover-image.ts` (dùng chung với import), `lib/like.ts` (escape `ilike`) + Vitest
- [x] Sách: danh sách, form sửa, tác giả của sách, ẩn / hiện, upload bìa; `catalogTagsFor` + Vitest
- [x] Danh mục, tác giả
- [x] e2e: user admin, dọn dữ liệu `e2e-admin-`, `cancelAndDeleteOrders` cho đơn delivered + `admin-cleanup`, `admin-security`, `admin-books`, `admin-catalog`, `admin-smoke` (desktop + mobile)
- [x] typecheck / lint / build / test sạch; `measure:js` (app không đổi, runtime Turbopack +0.5KB); báo cáo
- [x] e2e sạch: `test:e2e` đầy đủ 160/160

7b:
- [x] Đơn hàng: danh sách, chi tiết, chuyển trạng thái, hủy kèm lý do; `nextStatuses` + Vitest
- [x] Voucher: danh sách, tạo / sửa, bật / tắt / xóa
- [x] (Bổ sung khi duyệt 7b) Link "Quản trị" chỉ admin thấy: trang tài khoản + cạnh icon tài khoản ở header
- [x] e2e: admin thấy link, khách thường không thấy
- [x] e2e `admin-orders`, `admin-vouchers`
- [x] typecheck / lint / build / test / e2e sạch (170/170); `measure:js` không đổi; báo cáo
