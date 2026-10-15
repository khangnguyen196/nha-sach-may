# Phase 5a: Giỏ hàng

## Báo cáo (2026-10-15)

**Đã xong**: toàn bộ Phase 5a trên nhánh `phase-5a` (chưa merge). Gồm giỏ khách (localStorage), giỏ tài khoản (`cart_items`) và gộp giỏ khi có phiên. Gộp chạy trong khóa `navigator.locks` nên mở nhiều tab không nhân đôi số lượng. Header có badge số cuốn. Trang sách có nút "Thêm vào giỏ", vẫn dùng được khi chưa có JS. Trang `/gio-hang` dùng chung giao diện cho khách và tài khoản, tạm tính lấy từ `quote_order` / `quote_items`, có thanh freeship, cảnh báo vượt tồn kho, dòng "Ngừng bán", trạng thái rỗng / lỗi / đang tải. Chi tiết ở mục Tiến độ.

**Việc của bạn**: không còn. Migration `quote_items` đã chạy, types đã sinh lại (commit `5d60f88`).

**Quyết định tự chọn / lệch plan, cần duyệt**:
1. **Zod không vào bundle client.** `store → guest-cart → schemas` từng kéo zod (~30KB gzip) vào mọi trang qua badge ở header, làm trang sách lên 65.9KB ngoài baseline. Giờ `guest-cart.ts` (chạy ở client) tự kiểm tra giỏ localStorage và tham số `items`. `schemas.ts` (zod) chỉ còn dùng cho input của Server Action. Có Vitest dạng bảng (18 ca) bắt `normalizeCartItems` và `cartItemsSchema` phải ra cùng kết quả. Lệch quy tắc "zod dùng chung client/server" ở đúng chỗ này: client chỉ đọc localStorage, không gửi dữ liệu nào mà server không parse lại.
2. **Chuỗi có giá trị chỉ biết ở client** (tên sách của giỏ khách, số trên badge, số tiền còn thiếu để được freeship): server dịch sẵn và giữ nguyên chỗ trống, VD `t('removeLabel', { title: placeholder('title') })`. Client điền vào bằng `fillTemplate` (`lib/template.ts`, có test). Chỉ dùng cho tham số đơn giản. Vì vậy `badgeLabel` tiếng Anh viết là "Cart, items: {count}" để không cần dạng số nhiều.
3. **Lỗi có tham số dịch ở server** (mục 10 ★): `Result` thất bại có thêm `message?`. `withMessage(locale, failure)` nằm ở `lib/error-message.ts`. Đã kiểm chứng `getTranslations({ locale })` chạy được trong Server Action; e2e kiểm tra `OUT_OF_STOCK` ở cả vi và en.
4. **`/api/cart/guest` cache theo bộ id thay vì từng id**: sách lấy bằng **một** query `in('id', …)`, key cache là danh sách id đã sắp, tag `books` + `book:{id}`. Đổi số lượng không đổi bộ id nên vẫn trúng cache, và không tạo N query khi cache trống. Tạm tính (`quote_items`) cũng cache theo giỏ (`cacheLife('minutes')`). Response có `s-maxage=60`.
5. **Giới hạn 99 cuốn / sách** (khi tồn kho ≥ 99) trả `INVALID_INPUT` kèm `message` "Mỗi sách đặt tối đa 99 cuốn". Không thêm mã lỗi mới. Tồn kho < 99 thì trả `OUT_OF_STOCK` kèm `title`, `stock`. Giảm số lượng luôn được, kể cả khi dòng đang vượt tồn kho.
6. **`addToCart` không `refresh()`** vì badge cập nhật bằng kết quả action. `setCartQuantity` / `removeFromCart` có `refresh()` để `useOptimistic` nhận props mới trong cùng transition. Khi chưa có JS: người đã đăng nhập thêm xong thì chuyển sang `/gio-hang`; khách chuyển sang đăng nhập với `next` là trang sách.
7. **Hai lỗi race do e2e phát hiện, đã sửa** (ngoài plan):
   - Bấm "Thêm" trước khi header stream xong: header tới sau với số cũ và ghi đè số đúng. Sửa: trường hợp này gọi `router.refresh()`.
   - Tab render ở server trước khi tab khác gộp xong nhưng hydrate sau khi localStorage đã bị xóa: badge giữ số cũ. Sửa: tab gộp xong ghi `nsm-cart-merged-at`. Tab khác tải lại khi nhận sự kiện `storage` của khóa này, hoặc khi mốc muộn hơn `performance.timeOrigin` của nó (kiểm tra một lần mỗi document).
8. **Sửa lỗi có từ Phase 3**: trên mobile, trang sách bị giãn ngang tới khoảng 1456px nên trình duyệt thu nhỏ cả trang. Nguyên nhân: `sr-only` (absolute) trong BookCard của kệ không có ancestor `position` nằm trong vùng cuộn, nên không bị cắt. Sửa bằng `relative` ở `<ul>` của Shelf. `layout.spec.ts` có test chống tái phát (trang chủ + trang sách, desktop + mobile).
9. **e2e**: `cart-account.spec.ts` là file riêng, chạy tuần tự (cả file dùng chung một giỏ tài khoản). Project `*-account` vẫn khớp nhờ regex `account\.spec\.ts`. `scripts/e2e-user.ts` có thêm `clearCart`, `cartQuantities` (admin) và `findBooksByStock` (chỉ quyền anon, nên `cart.spec.ts` chạy được không cần service key). Sách test lấy theo tồn kho thật, không sửa dữ liệu.
10. Nhỏ: `item_count` của `quote_items` là số dòng (giống `quote_order`). Dòng "Số cuốn" ở tóm tắt tính ở client từ các dòng còn bán, chỉ để hiển thị. Dòng "Ngừng bán" không biết tên sách (RLS ẩn sách đã tắt), nên hiện "Sách không còn bán".

**Giới hạn / rủi ro đã biết**:
- `addToCart` đọc số lượng hiện có rồi upsert, không nguyên tử. Hai tab cùng bấm "Thêm" một sách đúng cùng lúc có thể mất 1 lần cộng (trong một tab thì nút bị khóa khi đang gửi). Muốn chặt thì cần RPC `add_to_cart`. Đề xuất để khi cần.
- Sách ở `/api/cart/guest` cache `hours` theo tag. Admin sửa (Phase 7) revalidate tag là đúng ngay, nhưng **`place_order` (5b) trừ tồn kho mà không revalidate**, nên tồn kho hiện ở giỏ khách có thể cũ tới vài giờ (giỏ tài khoản luôn đọc mới; `place_order` vẫn kiểm tra lần cuối). Ở 5b nên rút `cacheLife` hoặc revalidate `book:{id}` sau khi đặt hàng.
- Giỏ khách cần JS (localStorage). Không JS thì `/gio-hang` của khách chỉ hiện skeleton, còn nút ở trang sách chuyển sang đăng nhập.
- Trình duyệt không có `navigator.locks` (Safari < 15.4): gộp không khóa, theo đúng plan.
- Nút "Thanh toán" trỏ `/thanh-toan`, trang này chưa có (5b).

**Bị chặn**: không. Không mở `.env.local` (chỉ `check:env`), không thêm dependency. Dev server của một chat khác giữ thư mục này nên không chạy được `next dev` thứ hai; kiểm tra tay bằng `build` + `start`.

**Kết quả kiểm tra** (lần chạy cuối, commit `d2ea54e`):
- `typecheck`, `lint`, `build`: sạch.
- `test` (Vitest): 155/155 (thêm 57: giỏ khách thuần, khớp client/server, tham số `items`, `fillTemplate`, `freeShipStatus`).
- `test:e2e`: 94/94, chạy 2 lượt liên tiếp (1 worker, desktop + mobile + account). Riêng giỏ: `cart.spec.ts` 7 test × 2, `cart-account.spec.ts` 5 test × 2, cộng 1 test tràn ngang × 2 trong `layout.spec.ts`. Không lỗi console.
- Kiểm tra tay trên preview (bản production): thêm vào giỏ khi là khách, badge, `/gio-hang` có dòng ngừng bán, tạm tính 359.000 ₫ = 280.000 + 79.000 (freeship), giảm số lượng → 219.000 ₫ + ship 30.000 ₫.

**Số đo JS** (`measure:js`, gzip, baseline 170KB):

| Route | Tổng | Ngoài baseline | Ghi chú |
|---|---|---|---|
| `vi/books/ban-van` cuối Phase 4 | 203.5KB | 33.5KB | |
| `vi/books/ban-van` khi zod còn lọt vào client | 235.9KB | 65.9KB | đã sửa (mục 1) |
| `vi/books/ban-van` | 206.0KB | **36.0KB** | +2.5KB: store, badge, `CartSync`, nút thêm (plan ước tính +2–4KB) |
| `en/books/ban-van` | 206.0KB | 36.0KB | |
| `vi` (trang chủ) | 205.4KB | 35.4KB | |
| `vi/cart` | 209.5KB | 39.5KB | `CartView` + `UserCart` + `GuestCart` |

**Commit trên nhánh `phase-5a`**:
- `ded1cdb` feat(db): quote_items RPC for guest carts, quote_order counts active books only
- `19f29e2` feat(cart): guest cart store, cart actions, header badge, add-to-cart button
- `9d118c4` feat(cart): cart page for signed-in users with optimistic quantity changes
- `de0ba37` test(e2e): guest and account cart flows; fix shelf widening mobile book page
- `b1b5b04` perf(cart): keep zod out of the client bundle
- `5d60f88` feat(cart): guest cart page via /api/cart/guest and quote_items
- `d2ea54e` fix(cart): stale header count after early add or cross-tab merge
- commit cuối: docs (báo cáo này)

**Sau duyệt (2026-10-15)**: duyệt cả 10 điểm lệch plan và 3 đề xuất dưới đây (đã cập nhật CLAUDE.md). Merge vào `main`.

**Đề xuất cập nhật CLAUDE.md** (đã làm):
- Mục Hiệu năng: module chạy ở client không import zod (≈30KB gzip). Dữ liệu client tự đọc (localStorage) thì kiểm tra bằng tay, kèm test khớp với schema zod của server.
- Mục i18n: chuỗi có giá trị chỉ biết ở client dùng `placeholder()` + `fillTemplate` (`lib/template.ts`). Lỗi có tham số ICU từ Server Action dùng `withMessage(locale, failure)`, client hiện `failure.message`.
- Mục Database: thêm vào phần Phí ship rằng giỏ khách tạm tính qua `quote_items` (anon).

---

Trạng thái: **đã xong trên nhánh `phase-5a`, chưa merge** (2026-10-15). Plan đã duyệt: chọn hết các ★; mục 7 có bổ sung (khóa gộp giỏ giữa các tab), xem "Quyết định đã duyệt" ở cuối.

Phạm vi: giỏ khách vãng lai (localStorage), giỏ tài khoản (`cart_items`), gộp giỏ khi đăng nhập (`merge_cart`), badge giỏ ở header, nút "Thêm vào giỏ" ở trang sách, trang giỏ (`/gio-hang`) với tạm tính từ server và mốc freeship. **Không** có checkout COD + trang đặt hàng thành công: đề xuất tách thành Phase 5b, plan riêng (xem Cần chọn 1). Không có voucher (Phase 9).

## Cần chọn

★ = đề xuất.

1. **Phạm vi phase**
   - ★ Tách: 5a giỏ hàng (plan này), 5b checkout COD + trang thành công (plan riêng sau khi 5a merge). Lý do: 5a đã có migration + nhiều client state; checkout thêm `place_order`, chọn địa chỉ, chặn tồn kho, e2e luồng mua. Gộp một phase thì diff và e2e quá lớn để duyệt.
   - Gộp cả checkout vào Phase 5 như lộ trình gốc.

2. **Tạm tính cho khách** (`quote_order` chỉ cấp cho `authenticated`, khách gọi bị `AUTH_REQUIRED`)
   - ★ RPC mới `quote_items(p_items jsonb)` cấp cho `anon` + `authenticated`: cùng công thức với `quote_order` (`private.shipping_fee`, `private.free_ship_from`), nhận danh sách `{book_id, quantity}` như `merge_cart`. Cần migration + bạn chạy SQL + sinh lại types. Kèm: **cả hai hàm chỉ cộng sách `is_active`** (hiện `quote_order` không lọc, trong khi trang giỏ sẽ hiện sách đã ẩn là "Ngừng bán", không tính tiền; `place_order` vẫn chặn bằng `BOOK_UNAVAILABLE`).
   - Khách không thấy tạm tính, chỉ thấy giá từng dòng + "Đăng nhập để xem tạm tính và phí giao hàng". Không đổi schema nhưng trái tinh thần "không tự tính ở client" ở chiều ngược lại (thiếu thông tin), UX kém.
   - Server Action tự cộng giá từ DB + hằng số freeship ở app. Không đổi schema nhưng lặp logic tiền và hard-code mốc freeship (CLAUDE.md cấm).

3. **Nút "Thêm vào giỏ" biết người dùng là khách hay đã đăng nhập** (trang sách prerender, phiên là dữ liệu theo request)
   - ★ Store nhỏ ở client (`useSyncExternalStore`, không thư viện) có `mode: 'unknown' | 'guest' | 'user'`. Phần header đọc phiên (đã có trong `<Suspense>` từ Phase 4) render client leaf `CartBadge` kèm `signedIn` → đặt `mode`. Nút đọc `mode`: `guest` → ghi localStorage; `user` → Server Action; `unknown` (bấm trước khi header stream xong, rất hiếm) → gọi Server Action, nhận `AUTH_REQUIRED` thì ghi localStorage.
   - Luôn gọi Server Action trước, `AUTH_REQUIRED` thì ghi localStorage. Đơn giản hơn nhưng khách tốn 1 round trip mỗi lần thêm và phụ thuộc mạng dù giỏ nằm ở máy.

4. **Badge đếm gì**
   - ★ Tổng số cuốn (tổng `quantity`), tối đa hiện "99+".
   - Số đầu sách (số dòng).

5. **Trang giỏ**
   - ★ Một client leaf `CartView` dùng chung cho khách và user. User: Server Component đọc `cart_items` + `quote_order` trong `<Suspense>`, truyền dữ liệu ban đầu xuống; khách: `CartView` tự nạp từ localStorage. Thao tác (đổi số lượng, xóa) qua `useOptimistic`, rollback khi lỗi. Một giao diện, hai "nguồn" (localStorage / Server Action).
   - Hai implementation riêng (user render ở server, khách render ở client). Ít JS hơn cho user nhưng lặp UI.

6. **Dữ liệu sách + tạm tính cho giỏ khách**
   - ★ Route Handler `GET /api/cart/guest?items=12x2,15x1` trả `{ lines, quote }` (sách lấy bằng client public, `'use cache'` theo từng id, tag `book:{id}`; tạm tính qua `quote_items`). GET nên có `Cache-Control` ngắn và dùng lại được giữa các khách có cùng giỏ.
   - Server Action trả cùng dữ liệu. Gõ kiểu tiện hơn nhưng là POST, không cache, chạy tuần tự với action khác.

7. **Gộp giỏ khi đăng nhập**
   - ★ Client leaf `CartSync` (nằm cạnh `CartBadge` trong header): khi `signedIn` và localStorage có hàng → gọi action `mergeGuestCart` (RPC `merge_cart`) → thành công thì xóa localStorage + `router.refresh()`; lỗi thì giữ nguyên localStorage, lần tải trang sau thử lại. Bao mọi đường vào phiên: form đăng nhập, link xác nhận email, đặt lại mật khẩu.
     - **Bổ sung khi duyệt — nhiều tab**: mở nhiều tab sau khi đăng nhập thì tab nào cũng thấy localStorage có hàng → `merge_cart` chạy nhiều lần, số lượng cộng dồn gấp đôi. Sửa: bọc bước gộp trong `navigator.locks.request('nsm-cart-merge', …)`; trong lock **đọc lại** localStorage, rỗng thì bỏ qua; gộp thành công thì xóa localStorage **trước khi** nhả lock (tab chờ lock sau đó đọc thấy rỗng). Trình duyệt không có `navigator.locks`: gộp như trên, không khóa. e2e: 2 tab cùng đăng nhập → số lượng không bị nhân đôi.
   - Gửi giỏ kèm form đăng nhập (hidden input) để `signIn` gộp trước khi redirect. Không bao được link xác nhận email / đặt lại mật khẩu.

8. **Số lượng so với tồn kho**
   - ★ Chặn ở `min(stock, 99)`: nút thêm và stepper không vượt; Server Action kiểm tra lại (`OUT_OF_STOCK` kèm `stock`, `BOOK_UNAVAILABLE`). Dòng có số lượng vượt tồn kho hiện tại (tồn kho giảm sau khi thêm) hiện cảnh báo + nút "Giảm còn N". `place_order` (5b) kiểm tra lần cuối. Khách: kiểm tra bằng `stock` trả về từ `/api/cart/guest`.
   - Chỉ chặn ở 99, để `place_order` báo hết hàng lúc đặt.

9. **Phản hồi sau khi bấm "Thêm vào giỏ"**
   - ★ Trạng thái inline dưới nút ("Đã thêm vào giỏ · Xem giỏ hàng", `role="status"`), badge tăng ngay (optimistic). Không thêm thư viện, không che nội dung.
   - Mở drawer giỏ (Sheet có sẵn): đẹp hơn nhưng kéo `CartView` vào bundle trang sách (ngân sách 50KB).
   - Toast: cần thêm component/thư viện.

10. **Lỗi có tham số ICU** (`OUT_OF_STOCK`: `"{title}" chỉ còn {stock} cuốn`) hiện ở client
    - ★ Action nhận `locale` bind sẵn (như Phase 4) và format bằng `getTranslations({ locale, namespace: 'errors' })`. `i18n/request.ts` dùng `locale` truyền vào trước `next/root-params` nên chạy được trong action (**sẽ kiểm chứng đầu tiên**; không được thì chuyển sang phương án dưới). `Result` thất bại thêm trường `message?: string` (đã dịch), `code` giữ nguyên.
    - Truyền namespace `errors` + `cart` vào `NextIntlClientProvider` và dùng `useTranslations` ở `CartView`. Thêm payload messages mọi trang, ngược quy ước "client leaf nhận chuỗi qua props".

## Route

| Internal | vi | en |
|---|---|---|
| `(shop)/cart/page.tsx` | `/gio-hang` | `/en/cart` (pathname đã có) |
| `app/api/cart/guest/route.ts` | `/api/cart/guest?items=…` (không locale) | |

`/gio-hang` không cần đăng nhập. Nút "Thanh toán" trỏ `/thanh-toan`; khách → proxy chuyển sang đăng nhập kèm `next` (thêm `/checkout` vào danh sách chặn của proxy ở 5b, cùng lúc có trang).

## Database (cần chọn 2 ★)

- `supabase/migrations/<ngày>_quote_items.sql` + cập nhật `schema.sql`:
  - `public.quote_items(p_items jsonb)` → `(item_count, subtotal, shipping_fee, total, free_ship_from)`, `stable security definer`, `search_path = ''`. Validate như `merge_cart`: mảng, ≤ 100 phần tử, gộp trùng `book_id`, `quantity` chặn 1–99, bỏ sách không tồn tại / `is_active = false`. Giỏ rỗng → toàn 0 + `free_ship_from`. `grant execute … to anon, authenticated`.
  - `quote_order`: thêm điều kiện `b.is_active` khi cộng tiền.
  - Thêm `quote_items` vào danh sách RPC cuối `schema.sql` và CLAUDE.md.
- Sinh lại `src/types/database.ts` (bạn chạy lệnh `supabase gen types`; tôi không có access token).
- Không đổi bảng, không đổi RLS (`cart_items_own` đã có).

## Giỏ khách (localStorage)

- `features/cart/guest-cart.ts`: khóa `nsm-cart-v1`, dạng `[{ book_id, quantity }]`. Đọc qua zod (`guestCartSchema`: ≤ 100 dòng, `book_id` nguyên dương, `quantity` 1–99, gộp trùng); JSON hỏng / sai dạng → coi như rỗng, ghi đè khi lưu lần sau. Mọi truy cập bọc `try/catch` (Safari private, storage bị chặn).
- Store `useSyncExternalStore`: subscribe sự kiện `storage` (đồng bộ giữa các tab) + sự kiện nội bộ khi chính tab này ghi. `getServerSnapshot` trả rỗng → không lệch hydration.
- Giỏ khách chỉ là gợi ý: giá, tồn kho, trạng thái bán luôn lấy lại từ server khi mở trang giỏ.

## Giỏ tài khoản

- `features/cart/queries.ts` (client theo phiên, trong `<Suspense>`):
  - `getCart()`: `cart_items` + `books(id, slug, title, cover_url, price, original_price, stock, is_active, book_authors(role, authors(name)))` trong **một** query, sắp `created_at`.
  - `getCartCount()`: tổng `quantity` (cho badge).
  - `getCartQuote()`: RPC `quote_order()`.
  - Kiểu `CartLine` derive từ query; dòng khách (từ `/api/cart/guest`) map về cùng kiểu.
- `features/cart/actions.ts` (bind `locale`; `user_id` lấy từ phiên): `addToCart(bookId, quantity)` (cộng dồn, chặn `min(stock, 99)`), `setCartQuantity(bookId, quantity)`, `removeFromCart(bookId)`, `mergeGuestCart(items)` (RPC `merge_cart`). Input qua zod (`features/cart/schemas.ts`, dùng chung với giỏ khách). Trả `Result<{ count, quote? }>` để client cập nhật badge / tạm tính không cần tải lại; sau mutation gọi `refresh()` cho phần render ở server.

## Header

- `CartLink` (Server Component trong `<Suspense>` cạnh `AccountLink`, dùng chung `getCurrentUser()` đã `React.cache`): đã đăng nhập → `getCartCount()`; truyền `{ signedIn, count }` cho client leaf `CartBadge`.
- `CartBadge`: user → số từ server (+ optimistic khi thêm); khách → tổng từ localStorage. Badge nằm tuyệt đối trên icon (không CLS), `aria-label` của link gồm số lượng ("Giỏ hàng, 3 cuốn"). Fallback của Suspense = icon không số (như hiện tại).
- `CartSync` (cần chọn 7 ★, có khóa `navigator.locks` giữa các tab) cùng chỗ.

## Trang sách

- Nút "Thêm vào giỏ" (client leaf, CTA `primary` duy nhất) vào chỗ đã giữ sẵn chiều cao ở `books/[slug]/page.tsx`. Hết hàng / ngừng bán → nút disabled "Hết hàng". Thêm 1 cuốn mỗi lần bấm; số lượng chỉnh ở trang giỏ.
- Không JS: nút là `<form action>` gọi Server Action → user thêm được; khách nhận `AUTH_REQUIRED` → chuyển sang đăng nhập (`next` = trang sách). Có JS thì như cần chọn 3.
- Ngân sách JS trang sách: hiện 33.5KB ngoài baseline; ước tính + 2–4KB (store, badge, nút). Đo `measure:js -- vi/books/<slug>` trước/sau, báo cáo.

## Trang giỏ (`/gio-hang`)

- Static shell: tiêu đề + khung 2 cột (danh sách | tóm tắt). Phần đọc phiên / giỏ trong `<Suspense>` với skeleton đúng kích thước.
- Dòng giỏ: bìa nhỏ (`alt=""` theo ngoại lệ trong CLAUDE.md), tên (link trang sách), tác giả, đơn giá, stepper số lượng (`−` / ô số / `+`, nhãn cho trình đọc màn hình), thành tiền dòng = **giá từ server × số lượng** (chỉ hiển thị; tổng luôn từ RPC), nút xóa. Ngừng bán → nhãn "Ngừng bán", không tính tiền, nút xóa. Vượt tồn kho → cảnh báo (cần chọn 8).
- Tóm tắt: số cuốn, tạm tính, phí giao hàng ("Miễn phí" khi 0), tổng; thanh tiến độ freeship "Mua thêm 45.000 ₫ để được miễn phí giao hàng" / "Đơn của bạn được miễn phí giao hàng" (số từ `quote.free_ship_from − quote.subtotal`, không hard-code). Thanh tiến độ là `<progress>` / `role="progressbar"` có nhãn; tôn trọng `prefers-reduced-motion`.
- Nút "Thanh toán" (CTA duy nhất) → `/thanh-toan`. Giỏ rỗng → `EmptyState` + link về trang chủ. Lỗi tải giỏ khách → trạng thái lỗi + "Thử lại".
- Đổi số lượng liên tục: debounce ~300ms rồi mới gọi action / API, `useOptimistic` cho số lượng + thành tiền dòng, tạm tính hiện trạng thái "đang cập nhật" (mờ) tới khi có quote mới; lỗi → rollback + thông báo.
- `generateMetadata`: `noindex`, hreflang.

## Messages

Namespace `cart` (badge, nút thêm, trạng thái đã thêm, trang giỏ, stepper, freeship, rỗng, lỗi tải, ngừng bán, vượt tồn kho). Mã lỗi dùng lại `BOOK_UNAVAILABLE`, `OUT_OF_STOCK`, `AUTH_REQUIRED`, `INVALID_INPUT` (không thêm mã mới). Cùng bộ key vi/en.

## Test

- Vitest:
  - `guestCartSchema` / đọc localStorage: JSON hỏng, dạng sai, trùng `book_id` (gộp), `quantity` ngoài 1–99, > 100 dòng.
  - Hàm thêm / đổi / xóa trên giỏ khách (thuần), chặn `min(stock, 99)`.
  - Parse / serialize `items` của `/api/cart/guest` (`12x2,15x1`), giá trị lạ → 400.
  - Chuỗi thanh freeship (còn thiếu / đã đủ) từ quote.
- e2e (`e2e/cart.spec.ts`; phần khách chạy trong project `desktop`/`mobile`, không cần service key; phần tài khoản trong `*-account`):
  - Khách: thêm sách ở trang sách → badge 1 → `/gio-hang` có dòng, tạm tính + phí ship khớp RPC; tăng số lượng tới khi vượt mốc → "miễn phí giao hàng"; xóa → giỏ rỗng; tải lại trang vẫn giữ giỏ.
  - Hai tab: thêm ở tab A → badge tab B cập nhật (sự kiện `storage`).
  - Gộp: khách thêm 2 sách → đăng nhập → badge = tổng giỏ cũ + giỏ tài khoản, localStorage rỗng; đăng xuất → badge về 0 (giỏ tài khoản vẫn còn khi đăng nhập lại).
  - Gộp nhiều tab: localStorage có hàng, mở 2 tab cùng phiên đăng nhập → số lượng trong giỏ tài khoản chỉ cộng một lần.
  - User: thêm / đổi số lượng / xóa, tải lại vẫn đúng (DB); sách hết hàng → nút disabled.
  - `/en/cart` hiển thị giá `₫98,000`.
  - Không lỗi console.
- `measure:js -- vi/books/<slug>` trước/sau, ghi vào báo cáo.

## Việc của chủ dự án

Migration: `supabase/migrations/20261015090000_quote_items.sql` (idempotent, chạy lại không sao). Không đổi bảng / RLS.

1. Kiểm tra migration (đã có cùng nội dung trong `schema.sql`).
2. Supabase Dashboard → SQL Editor → New query → dán toàn bộ file migration → Run. Kết quả mong đợi: "Success. No rows returned".
3. Kiểm tra nhanh trong SQL Editor (role mặc định là `postgres`; dòng đầu là giỏ rỗng, dòng sau là 2 cuốn của một sách đang bán):
   ```sql
   select * from public.quote_items('[]'::jsonb);
   select * from public.quote_items(jsonb_build_array(jsonb_build_object('book_id', (select id from public.books where is_active limit 1), 'quantity', 2)));
   ```
   Dòng đầu: `0 | 0 | 0 | 0 | 300000`. Dòng sau: `item_count = 1`, `subtotal = 2 × giá`, `shipping_fee` 30000 hoặc 0.
4. Sinh lại types: `npx supabase gen types typescript --project-id <ID> > src/types/database.ts` → `src/types/database.ts` có `quote_items` trong `Functions`.
5. Báo tôi để làm tiếp phần trang giỏ / `/api/cart/guest`.

## Tiến độ

- [x] Migration `quote_items` + `quote_order` lọc `is_active` + `schema.sql`
- [x] Bạn chạy SQL (2026-10-15); types sinh lại có `quote_items`
- [x] Kiểm chứng `getTranslations({ locale })` trong Server Action (cần chọn 10): chạy được, e2e "vượt tồn kho" kiểm tra cả vi và en
- [x] `features/cart/{schemas,guest-cart}.ts` + store + Vitest
- [x] `features/cart/{queries,actions}.ts`, `/api/cart/guest`
- [x] Header: `CartLink` / `CartBadge` / `CartSync` (khóa `navigator.locks`)
- [x] Trang sách: nút "Thêm vào giỏ"
- [x] Trang giỏ: `CartView`, tóm tắt, freeship, trạng thái rỗng / lỗi
- [x] Messages `cart` vi/en
- [x] e2e `cart.spec.ts` (khách: trang sách, 2 tab, tồn kho, trang giỏ, `/api/cart/guest`) + `cart-account.spec.ts` (giỏ tài khoản, gộp, gộp nhiều tab, lỗi theo locale, `/en/cart`)
- [x] typecheck / lint / build / test / e2e sạch; `measure:js` trang sách trong ngân sách (36.0KB ngoài baseline)

## Quyết định đã duyệt

Chọn hết các ★ (1–10). Bổ sung mục 7: gộp giỏ trong `navigator.locks.request('nsm-cart-merge')`, đọc lại localStorage trong lock, xóa trước khi nhả lock; không có `navigator.locks` thì gộp không khóa; e2e 2 tab không nhân đôi số lượng.

Thứ tự: migration trước (commit + push, dừng phần DB chờ bạn kiểm tra và chạy) → trong lúc chờ làm phần không phụ thuộc `quote_items` → bạn báo đã chạy SQL + sinh types thì làm tiếp.
