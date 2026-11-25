# tim-sach-cu: tab Sách cũ ở trang tìm kiếm

Yêu cầu (chủ dự án, 2026-11-25): trang tìm kiếm (`/tim-kiem`, `/en/search`) có 2 tab "Sách mới" | "Sách cũ (N)" trên URL,
tab Sách cũ hiện tin đang bán trong Chợ sách cũ của các sách khớp từ khóa. Không đổi database, không thêm thư viện.

## Kế hoạch (vòng 1)

- **URL**: `type=used` = tab Sách cũ; không có / giá trị khác = tab Sách mới (mặc định, giữ nguyên như trước). Dải tab là
  `<nav aria-label>` gồm 2 `Link` (không phải tablist của ARIA), tab đang chọn `aria-current="page"`, cao 44px. Link đổi
  tab giữ `q` đúng chữ người dùng gõ + `sort` / `price` / `lang` / `cat` / `stock`, bỏ `page` (`searchTabHref`,
  `features/used/market-params.ts`, Vitest). Tab Sách cũ không hiện bộ lọc / sắp xếp của sách mới nhưng vẫn để trên URL.
- **Form tìm**: đang ở tab Sách cũ thì form GET có `<input type="hidden" name="type" value="used">` → tìm lại vẫn ở tab
  Sách cũ. Tab Sách mới không đổi.
- **Truy vấn 2 bước** (`features/used/public-queries.ts`), không cần RPC mới:
  1. `matchingUsedSearchBookIds(q, visibleIds)`: RPC `search_books` (gõ không dấu như tab Sách mới) chỉ lấy `id`, lọc
     danh mục đang hiện (`visibleBooksFilter`, quyết định 10), `.range(0, 999)` (max_rows 1000 của PostgREST; catalog
     ~250 cuốn). Cache `books` + `categories`, `hours`.
  2. Tab Sách cũ: `listMarketListings({ bookIds, sort: 'newest', page })` (thêm `bookIds` vào `MarketListInput`: dùng lại
     select, ký ảnh, PGRST103, `.range` + count exact, tag `used-listings` + `book:{id}` của từng sách trên trang). N =
     `total`. Trang > 1 rỗng → `InlineNotFound`.
  3. Tab Sách mới: N bằng `searchUsedCount` (`features/used/search-count.ts` → `matchingUsedSearchBookIds` +
     `countUsedListings`), chạy song song với `listBooks` (`Promise.all`); lỗi ở bất kỳ bước nào → nhãn "Sách cũ" không
     số (key `tabUsedPlain`), kết quả sách mới vẫn hiện; lỗi nội bộ của Next ném tiếp (`unstable_rethrow`); log chỉ ghi
     bước (ids / count) + tên lỗi. Không ký ảnh.
- **Đếm N** (`countUsedListings`): `select('book_id, books!inner(id)', { count: 'exact' })` + `status = approved` +
  `in(book_id)`, KHÔNG head count: đọc `book_id` để chỉ gắn tag `book:{id}` cho sách có tin (gắn cho mọi sách khớp thì
  từ khóa rộng vượt 128 tag, Next bỏ phần thừa kèm cảnh báo). `books!inner` bỏ tin của sách ngừng bán (RLS của books),
  như danh sách. Tag `used-listings` làm mới khi duyệt / gỡ / rút / sửa tin. Đã thử trên DB thật (next start ở máy,
  chỉ đọc): N khớp số tin của chợ.
- **Chặn theo sở thích**: lưới dùng `MarketGrid` (khung `[data-book-slot]` + `BlockedVeil`) nên tin của sách bị chặn có
  ô mờ như ở chợ. N tính cả tin của sách bị chặn, như các bộ đếm khác (chặn chỉ bằng CSS, không phá cache).
- **Skeleton**: fallback của Suspense có `SearchTabsSkeleton` cùng chiều cao dải tab (44px gồm viền). Trang chưa có từ
  khóa (không có tab) co lại 44px một lần khi nội dung thật thay vào: chấp nhận (fallback không biết q).
- **JS client**: không thêm client component; measure:js mọi route không đổi (vi/search 43.7KB → 43.7KB ngoài baseline).
- **e2e** `e2e/search-used-account.spec.ts`: mỗi project một sách thật + từ khóa không dấu riêng (desktop-account
  `suong-khoi-que-nha` / "suong khoi", mobile-account `oxford-thuong-yeu` / "oxford thuong"), rỗng: "ky mong" (khớp sách
  không có tin), "qxzw vjk" (không khớp sách nào). Bất biến ở `scripts/e2e-seed.test.ts`.

## Để sau

- Dòng "Có N bản cũ từ X ₫" trên từng thẻ / kết quả ở tab Sách mới.
- Dòng "Tìm trong chợ sách cũ" trong ô tìm nhanh Ctrl K (palette).
- Trần 1000 sách khớp một từ khóa (max_rows của PostgREST): catalog lớn hơn thì sách khớp thứ 1001 trở đi không có tin
  ở tab Sách cũ. Cần thì chuyển bước 1 sang RPC riêng (đổi DB).
- (h) e2e ô mờ chặn theo sở thích ở tab Sách cũ (chưa có helper chặn dùng lại được cho spec này; khóa chặn của thẻ
  MarketGrid có Vitest `features/used/market-blocks.test.ts`, chưa có e2e ở chợ sách cũ).
- Fallback chung cho cả 2 tab là lưới sách mới (bìa 2:3); tab Sách cũ (ảnh 3:4) nhảy nhẹ khi stream vào lần đầu.
- Trần 128 tag của Next: từ khóa rộng khớp > 127 sách có tin → tag `book:{id}` thừa bị bỏ, N của sách ngừng bán chỉ
  đúng lại khi `used-listings` đổi hoặc hết hạn `hours`; tag cũng chỉ tính trên 1000 tin đầu (max_rows). Gộp với hướng
  RPC riêng.
- Hai cách đếm có thể lệch tạm thời: tab Sách cũ chỉ gắn `book:{id}` của sách ở trang đang xem → sách có tin ở trang 2
  ngừng bán thì total của trang 1 cũ tới khi `used-listings` đổi (như chợ sách cũ hiện nay).
- URL dài: `.in('book_id', ≤ 1000 id)` ≈ 5–6KB trên URL GET; catalog lớn dễ gặp 414 trước trần 1000 → cùng hướng RPC
  riêng.
- `?type=used` khi chưa có từ khóa / từ khóa 1 ký tự: màn gợi ý không có dải tab; có thể nhắc "tìm trong chợ sách cũ".
- Gửi ô tìm trong lúc trang tìm kiếm còn đang tải (form fallback của Suspense) ở tab Sách cũ → về tab Sách mới; chữ gõ
  vào fallback cũng mất khi form thật thay vào (có từ trước đợt). Chưa sửa vì: form cần q từ URL nên phải nằm trong
  Suspense; khóa fallback làm hỏng tìm kiếm khi tắt JS; chuyển sang client useSearchParams thì tốn JS mà vẫn cần
  Suspense. e2e chờ form thật trước khi gõ (search-used-account ca (c), như catalog.spec).
- Tắt JS thì form tìm ở tab Sách cũ luôn gửi sang tab Sách mới (cửa hàng cần JS, theo `docs/plans/no-js.md`).
- Comment ở `e2e/search-used-account.spec.ts` (đoạn chờ form thật ở ca (c)) nêu lý do không chờ `input[name=type]` chưa
  chính xác (reviewer vòng 4: bản sao ẩn nằm ngoài `<main>`); sửa khi đụng file đó lần tới (không sửa ở vòng 5 để
  không làm e2e chạy lại).
