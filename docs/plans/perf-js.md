# Đợt "giảm JS client" (perf-js)

Trạng thái (2026-10-20): **đã merge `main`**: ff `ddf769b..51bf49f` (`git push origin perf-js:main`, không force) 2026-10-20 02:46Z; CI check `main` run 39360765505 ✔; e2e `main` run 39360765659 ✔ 427 qua / 10 skip / **1 flaky** (`cart-account.spec.ts:94`, RSC 404, xem dưới); Vercel Production Ready 2026-10-20T02:49:05Z (deployment 7190235128). D, sheet lazy, C, ★8 xong; sáng 2026-10-20: palette trả focus (quyết định (d)) + 4 lượt review; code cuối `51bf49f`. B chưa làm (★4 / ★5, chờ quyết lại). Kết quả: mục "Báo cáo", "Sáng 2026-10-20", "Trước merge" cuối file.

Mục tiêu: giảm JS tải ngay ở mọi trang, đưa `/sach` + trang danh mục về dưới ngân sách, bỏ zod khỏi client của cửa hàng.

## Hiện trạng (measure:js, gzip ngoài baseline 170KB, bản build cuối của ux-messages)

| Route | KB | Ngân sách |
|---|---:|---|
| `vi` (trang chủ) | 42.2 | không có |
| `vi/books` (`/sach`) | 55.3 | không có (★1) |
| `vi/categories/van-hoc` | 55.3 | không có (★1) |
| `vi/books/sapiens` (trang sách) | 45.3 | ≤ 50 (`CLAUDE.md`) |
| `vi/cart` | 46.1 | không có |
| `vi/checkout` (shell) | 44.9 | không có |
| `vi/login` | 36.6 | không có |

(Số cuối đợt ux-messages sẽ cập nhật ở mục "Báo cáo" của `ux-messages.md`; bảng này dùng làm mốc "trước".)

Phân rã (đo bằng `next analyze`, có sẵn trong Next 16, không thêm dependency; xem `ux-messages.md` → measure:js):
- Gói `cn` (thay clsx + tailwind-merge): ~25KB raw / ~10KB gzip, mọi trang (Button và 21 file khác import).
- `/sach`, danh mục: sheet bộ lọc tải ngay (Radix Dialog, react-remove-scroll, focus-scope…): ~30KB raw / ~10KB gzip hơn trang sách.
- lucide ở client leaf: lõi `Icon` + helper ~3.5KB nén từng phần ở trang sách.
- Palette tìm kiếm (tải lười khi ⌘K) kéo zod (~30KB) qua `features/books/schemas.ts`.

## Thứ tự

Bước 0 `scripts/analyze-diff.mjs` (so module trước / sau từ `next analyze export`) → D → lazy-load sheet bộ lọc → C → B (B: chờ quyết lại, xem ★4 / ★5). Mỗi bước một commit (hoặc một nhánh nhỏ), đo `measure:js` trước / sau, e2e CI xanh rồi mới sang bước sau.

### Bước 0 – `scripts/analyze-diff.mjs` (xong 2026-10-19, nhánh `sau-ux`)

So module JS client trước / sau từ `next analyze export` (JSON Lines, có sẵn trong Next 16, không dependency). Thấy cả chunk **tải lười** (palette ⌘K, khung chat, sheet) mà `measure:js` không thấy.

```bash
npx next analyze -o --snapshot before                        # ở commit trước; cần env như build (xem dưới)
npx next analyze export --snapshot before > ../before.jsonl  # lưu NGOÀI .next (rm -rf .next làm mất snapshot)
npx next analyze -o --snapshot after                         # sau khi sửa
npx next analyze export --snapshot after > ../after.jsonl
node scripts/analyze-diff.mjs ../before.jsonl ../after.jsonl --route "/[locale]/books/[slug]"
```

- Cần env như `npm run build` (`next.config.ts` kiểm env): ở worktree thì **hỏi chủ dự án trước** khi link `.env.local` (CLAUDE.md → Bảo mật), không coi là bước thường lệ.
- Chạy lệnh `export … > file` trong **bash** (Git Bash). Script vẫn đọc được file do PowerShell ghi (UTF-16 / có BOM).
- `--route`: route nội bộ như trong export (`/[locale]`, `/[locale]/books`, `/[locale]/books/[slug]`, `/[locale]/categories/[slug]`…); bỏ trống = mọi route chung. `--all`: in cả module không đổi.
- In tổng "Tải ngay" / "Tải lười" và bảng module thêm / bớt / đổi cỡ, xếp theo chênh lệch. Cỡ là `compressed_size` của next analyze (ước lượng theo module), không cộng ra đúng số gzip của `measure:js`: dùng để so chênh lệch, số ngân sách vẫn lấy từ `measure:js`.
- Kiểm thử script (2026-10-19): cùng một export → "Không có module nào đổi"; export giả bỏ module zod ở trang sách → "Tải lười" 92.2KB → 58.7KB (−33.5KB), liệt kê đúng 14 module zod (khớp ước tính ~30KB của bước 1).

### Bước 1 – D: bỏ zod khỏi palette tìm kiếm

- **File**: `src/features/books/components/search-palette.tsx`, `src/features/books/schemas.ts` (giữ schema cho server), file mới `src/features/books/search-input.ts` (hàm thuần), Vitest mới.
- **Cách làm**: palette dùng `normalizeSearchQuery(q)` (trim, 2–100 ký tự, gộp khoảng trắng, chữ thường) và `parseSearchResponse(json)` viết tay (kiểm `ok === true`, mảng hit, từng trường đúng kiểu) thay `searchQuerySchema` / `searchResponseSchema`. Server (`/api/search`, `catalogParamsSchema`) vẫn dùng zod. Vitest khớp kết quả hàm tay với schema zod trên cùng bộ input (như `normalizeCartItems` ↔ `cartItemsSchema`).
- **Ước tính**: chunk palette −25 đến −30KB gzip (tải khi mở ⌘K, không nằm trong measure:js). JS tải ngay: 0.
- **Rủi ro**: hàm tay lệch schema (q có ký tự lạ, response thiếu trường) → Vitest so hai bên trên cùng input, thêm case biên (khoảng trắng Unicode, 1 / 2 / 100 / 101 ký tự).
- **Kiểm**: Vitest; e2e có mở palette (`layout.spec`, `catalog.spec`: `openPalette`); mắt: mở ⌘K trên desktop + mobile, gõ có dấu / không dấu, chọn kết quả.

### Bước 2 – lazy-load sheet bộ lọc ở `/sach` và trang danh mục

- **File**: `src/features/books/components/filter-sheet.tsx` (tách nút mở khỏi nội dung sheet), file mới cho nội dung sheet, `catalog-view.tsx` nếu cần; `sort-select.tsx` giữ nguyên.
- **Cách làm**: nút "Bộ lọc" là client leaf nhỏ (không Radix); nội dung sheet (`components/ui/sheet` + Radix Dialog + react-remove-scroll) tải bằng `next/dynamic` khi bấm (giống dialog gợi ý mã ở checkout). Prefetch khi rê chuột / focus nút (★2) để mở không trễ.
- **Ước tính**: `/sach` và danh mục −8 đến −9KB gzip (55.3 → ~46–47KB).
- **Rủi ro**: lần bấm đầu trễ thêm một request chunk (4G chậm ~100–300 ms); focus trap / trả focus về nút khi đóng phải giữ như cũ; không JS: bộ lọc hiện nay có chạy không JS không → kiểm, giữ nguyên hành vi.
- **Kiểm**: e2e catalog (lọc giá / ngôn ngữ / sắp xếp, mobile sheet), `measure:js` `vi/books`, `vi/categories/van-hoc`; mắt: mở / đóng sheet bằng chuột, bàn phím (Esc, Tab), mobile Safari.
- Sau bước này đặt ngân sách cho 2 route (★1) và ghi vào `CLAUDE.md` + `scripts/measure-js.mjs` (cột ngân sách theo route, `docs/progress.md`).

### Bước 3 – C: icon lucide của client leaf render ở server

- **File**: `theme-toggle.tsx`, `cart-badge.tsx`, `search-trigger.tsx`, `shelf-nav.tsx`, `review-form.tsx`; muốn bỏ hẳn lõi lucide khỏi trang sách thì cả `components/ui/field.tsx`, `add-to-cart-button.tsx`, `chat-bubble.tsx` (client leaf khác cũng import lucide). Server Component cha truyền icon qua `children` / prop `icon: ReactNode`.
- **Ước tính**: −2 đến −3KB gzip mọi trang có các leaf này (chỉ đạt khi KHÔNG còn client module nào của trang import lucide; còn một chỗ thì lõi `Icon` vẫn ở lại, chỉ bớt từng icon ~0.1–0.4KB).
- **Rủi ro**: icon đổi theo state ở client (sun / moon của theme, chevron trái / phải khi tràn kệ) → truyền cả hai icon, client chọn hiện cái nào; `field.tsx` dùng ở rất nhiều form.
- **Kiểm**: e2e layout (theme toggle, kệ, giỏ), review, form lỗi; mắt: dark / light, kệ trang chủ, badge giỏ, form có lỗi.

### Bước 4 – B: bỏ `cn` khỏi bundle client

- **File**: `src/lib/utils.ts`, `src/components/ui/button.tsx` và 21 file khác import `cn` (danh sách: `grep -rl "from 'cn'\|from '@/lib/utils'" src`), chủ yếu `components/ui/*`.
- **Cách làm (★4)**: client nối class bằng hàm nhỏ tự viết (`cx(...parts)`: bỏ falsy, nối bằng khoảng trắng, ~0.1KB) hoặc `clsx` (hiện chỉ là dependency gián tiếp → thêm vào `package.json` là dependency mới, cần duyệt); chỉ giữ việc gộp class đè ở chỗ thật sự cần. Chỗ khó: `Button` gọi `cn(buttonVariants({ variant, size, className }))` → `className` của nơi gọi (VD `h-11 px-5`, `w-full`, `text-xs`) đè class của `size` / `variant`. Bỏ `cn` thì hai class cùng nhóm cùng có mặt, thắng thua theo thứ tự CSS của Tailwind, không theo thứ tự viết → phải sửa nơi gọi (thêm `size` mới thay vì đè class, hoặc variant riêng).
- **Ước tính**: −8 đến −10KB gzip mọi trang (chỉ khi không còn module client nào import `cn`; server component vẫn dùng `cn` được).
- **Rủi ro**: cao nhất trong 4 bước: lỗi giao diện không có test bắt (nút sai cao / sai padding / sai màu). Cần rà mọi `className` truyền vào `Button`, `buttonVariants`, input, badge… và chụp so sánh trước / sau.
- **Kiểm**: typecheck, e2e toàn bộ; mắt (desktop + mobile, dark + light): header, trang chủ, `/sach` (bộ lọc), trang sách (nút thêm giỏ), giỏ, thanh toán (dialog gợi ý mã), đăng nhập / đăng ký, tài khoản, admin (form sách, bảng). Đề xuất thêm screenshot so sánh bằng Playwright (`toHaveScreenshot`) cho 6–8 trang trước khi làm (★5).

## Ngân sách đề xuất

- Trang sách: giữ ≤ 50KB.
- `/sach` + danh mục: **≤ 50KB** sau bước 2 (★1); trước khi làm bước 2 ghi rõ là đang vượt (55.3KB).
- Các route khác: ≤ 50KB (hiện tất cả dưới 47KB), để measure-js báo khi vượt.

## ★ Đã quyết 2026-10-19

- ★1 **50KB** cho `/sach` + trang danh mục.
- ★2 **prefetch** chunk sheet khi rê chuột / focus nút.
- ★3 **viết tay** + Vitest so với schema zod.
- ★4 + ★5 **CHƯA** làm B và test screenshot; quyết lại sau khi xong D → sheet lazy → C và đo lại (B không cần để đạt ngân sách).
- ★6 **để nguyên** `book-form.tsx` (admin).
- ★7 **có**: thêm `scripts/analyze-diff.mjs`, làm **trước** D (2026-10-19, theo gợi ý reviewer: bước D đổi chunk palette tải lười, `measure:js` không thấy, cần so module).
- ★8 **giữ** polyfill `noModule` trong số đo suốt đợt, ghi chú trong `scripts/measure-js.mjs`; đổi baseline sau đợt (sửa cả mốc 170KB trong `CLAUDE.md` mục Hiệu năng và `BASELINE_GZIP_KB` trong `scripts/measure-js.mjs`). **Đã làm ở `9a26b40`** (cuối đợt, trước merge): baseline 131.4KB, mục "Trước merge (2026-10-20)" cuối file.

Thứ tự đợt perf-js: `analyze-diff.mjs` → D → sheet lazy → C. B để sau.

## ★ Câu hỏi ban đầu (giữ để tra)

- ★1 Ngân sách `/sach` + danh mục: 50KB (bằng trang sách, đề xuất) hay 48KB (chặt hơn, cần bước 3)?
- ★2 Sheet bộ lọc: prefetch chunk khi rê chuột / focus nút (đề xuất) hay chỉ tải khi bấm?
- ★3 D: hàm kiểm tra viết tay (đề xuất, 0KB) hay `zod/mini` (cùng gói zod đã có, không thêm dependency, nhưng vẫn vài KB)?
- ★4 B: (a) hàm `cx` tự viết + sửa nơi gọi để không còn class đè (đề xuất, không thêm dependency); (a') như (a) nhưng dùng `clsx` (thêm dependency trực tiếp); (b) giữ `cn` chỉ cho `Button` (không giảm được vì `Button` có ở mọi trang); (c) không làm B.
- ★5 Thêm test screenshot (Playwright `toHaveScreenshot`, ảnh baseline commit vào repo, chạy trên CI Linux) trước bước 4?
- ★6 `book-form.tsx` (admin, client) cũng import zod: để nguyên (admin không có ngân sách JS) hay làm cùng D?
- ★7 Công cụ so module trước / sau (đọc `next analyze export`, đêm 2026-10-18 dùng script tạm ngoài repo): thêm `scripts/analyze-diff.mjs` vào repo?
- ★8 measure:js có loại polyfill `noModule` (~38.6KB, trình duyệt hiện đại không tải) khỏi số đo không (đổi baseline cho khớp)?

## Báo cáo (đêm 2026-10-20)

Đo trên máy dev, build với DB production (hard link `.env.local` theo quy trình được duyệt cho lượt này: tạo trước mỗi đợt build, xóa ngay sau, `fsutil hardlink list` chỉ còn bản gốc). Số liệu thô (log build, `measure-*.txt`, export `next analyze` `before / after-d / after-sheet / after-c.jsonl`) ở `D:/Bán sách-backup/perf/` (ngoài repo).

### measure:js (KB gzip ngoài baseline 170KB, ngân sách 50KB)

| Route | Trước (`56bcf5e`) | Sau D (`8c7c5a7`) | Sau sheet (`46719ef`) | Sau C (`3334285`) | Ngân sách |
|---|---:|---:|---:|---:|---|
| `vi` (trang chủ) | 42.2 | 42.2 | 42.3 | **41.4** | ĐẠT |
| `vi/books` (`/sach`) | 55.3 | 55.3 | 43.0 | **41.9** | ĐẠT (trước: vượt) |
| `vi/categories/van-hoc` | 55.3 | 55.3 | 43.0 | **41.9** | ĐẠT (trước: vượt) |
| `vi/books/sapiens` | 45.3 | 45.3 | 45.4 | **44.2** | ĐẠT |
| `vi/cart` | 46.1 | 46.1 | 46.2 | **45.8** | ĐẠT |
| `vi/checkout` | 45.0 | 45.0 | 45.1 | **44.8** | ĐẠT |
| `vi/login` | 36.6 | 36.6 | 36.7 | **36.0** | ĐẠT |

±0.1KB ở bước sheet (route không có sheet) là do chia chunk lại (số script 15 → 14), không phải module mới. Commit sửa theo review (`0ef0086`) đổi comment / class / `.catch` của prefetch, thêm test tĩnh `src/lib/client-no-zod.test.ts`, đổi chữ in của `measure-js.mjs` ("thừa" → "vượt"); không đo lại (đo lại sau đợt sửa sáng 2026-10-20, mục cuối). `vi/checkout` 44.9 ở "Hiện trạng" (bản build cuối của ux-messages) và 45.0 ở cột "Trước" (build `56bcf5e` đêm 2026-10-20): hai bản build khác nhau, chênh 0.1KB trong mức dao động do chia chunk.

### next analyze (`scripts/analyze-diff.mjs`, ước lượng theo module, dùng để so chênh lệch)

| Bước | Route | Tải ngay | Tải lười |
|---|---|---|---|
| D | mọi route có palette | 0 | −33.6KB (16 module zod + `schemas.ts` bớt, `search-input.ts` +0.3KB) |
| Sheet | `/[locale]/books`, `/[locale]/categories/[slug]` | −48.2KB | +48.5KB (Radix Dialog, focus-scope, dismissable-layer, react-remove-scroll, aria-hidden… chuyển sang chunk tải khi bấm) |
| Sheet | route khác | −0.1KB | 0 |
| C | `/[locale]` −1.6, `/books` −1.7, `/books/[slug]` −1.9, `/cart` −0.6, `/login` −1.3KB | | +0.7 đến +1.2KB (ở các route liệt kê, icon chỉ còn trong chunk lười của palette / khung chat; `/gio-hang` và `/thanh-toan` vẫn còn icon tải ngay từ `cart-view.tsx`, `checkout-form.tsx`) |
| Cả đợt | `/[locale]/books` | 306.6 → 256.7KB (−49.9) | 60.6 → 76.6KB (+16.1) |
| Cả đợt | `/[locale]/books/[slug]` | 262.1 → 260.0KB (−2.1) | 92.2 → 59.8KB (−32.4) |

### Khác plan

- **D**: zod 4.6 đếm độ dài chuỗi theo **code point** (`'📚'` dài 1), không theo UTF-16 unit → `normalizeSearchQuery` đếm `[...s].length`. Vitest bắt được lệch này ở lần chạy đầu.
- **C**: `lucide-react` 1.57 đánh dấu `Icon.mjs` là `"use client"` (dùng `LucideProvider` context) → icon render ở Server Component **vẫn** kéo lõi `Icon` (~2KB ước lượng) xuống client. Bước C chỉ bớt module từng icon; ước tính "−2 đến −3KB khi không còn client module nào import lucide" của plan không đạt được bằng cách này (bỏ hẳn lõi phải vẽ SVG thẳng mọi icon hoặc bỏ lucide: không làm, cần quyết). Đo thật: −0.3 đến −1.2KB.
- **C** làm thêm `sort-select.tsx`, `filter-sheet.tsx` (cùng trang `/sach`), `components/ui/field.tsx` (`SelectField` vẽ thẳng SVG chevron vì file dùng ở nhiều client form: đăng nhập, đánh giá…). Cũng làm `add-to-cart-button.tsx`, `chat-bubble.tsx` (plan để tùy chọn); `components/admin/admin-shell.tsx` (admin) phải sửa theo vì prop `icons` của `ThemeToggle` bắt buộc. Icon truyền vào không kèm class; class kích thước nằm ở component (`[&_svg]:size-…`, span `hidden dark:contents` cho sun / moon).
- Sheet: nút giữ `aria-haspopup="dialog"`, thêm `aria-expanded`; mất `aria-controls` / `data-state` của `SheetTrigger` (nội dung chưa có trong DOM khi chưa mở).
- Theo review: `review-form` bỏ class `group` của label sao (`has-checked:[&_svg]:fill-primary` trên label thay `group-has-checked:fill-primary` trên svg). Bản cũ khớp với mọi tổ tiên `.group`, nên ở trang đơn (`<details class="group">`) chọn 1 sao làm cả 5 sao tô kín. Lỗi này reviewer suy ra từ CSS, chưa kiểm bằng mắt (cần đăng nhập + đơn đã giao).
- Build local lỗi tạm 2 lần ở bước C (`getRelatedBooks: Internal server error` lúc prerender, rồi "`use cache` took too long" ở `getHomeShelves`), cùng loại "Lỗi #3 (build)" ở `handoff.md`; lần 3 qua (health Supabase lúc đó 0,2 s). `next analyze` cùng code build qua cả 3 lần.

### Test thêm / đổi

- Vitest mới `src/features/books/search-input.test.ts` (65 ca): `normalizeSearchQuery` ↔ `searchQuerySchema` (rỗng, 1 / 2 / 100 / 101 ký tự, khoảng trắng hai đầu, NBSP, U+3000, U+FEFF, U+2028/2029, em / thin space, zero-width space, tab / xuống dòng, có dấu / không dấu / NFD, emoji, surrogate lẻ, 100 / 101 code point); `parseSearchResponse` ↔ `searchResponseSchema` (hợp lệ, rỗng, `coverUrl` null / thiếu / undefined / số, `ok` false / "true" / thiếu, `data` thiếu / null / không phải mảng, hit null / mảng, `id` chuỗi / NaN / Infinity / số lẻ, thiếu `slug`, `title` số, `authors` sai kiểu, key thừa bị bỏ).
- Vitest mới `src/lib/client-no-zod.test.ts` (bản đêm: 44 ca; đã viết lại sáng 2026-10-20, xem mục cuối; theo gợi ý review): mọi file `'use client'` của cửa hàng (trừ admin, ★6) không import giá trị từ `zod` / `…/schemas` (`import type` được phép). Đã thử thêm `searchQuerySchema` vào import của palette → test fail, rồi trả lại.
- e2e mới `e2e/catalog.spec.ts` "mobile: sheet bộ lọc (tải lười) — Enter mở, Tab ở trong sheet, Esc / "Xong" đóng, focus về nút" (desktop skip: nút chỉ hiện dưới `md`).
- Không xóa / skip / nới test nào; không đổi chuỗi expected nào.

### CI

| Commit | CI check | e2e |
|---|---|---|
| `8c7c5a7` (D) | 39296424992 ✔ | 39296425020 ✔ 421 qua / 9 skip / 0 flaky |
| `46719ef` (sheet + docs) | 39297885429 ✔ | 39297885209 ✔ 422 qua / 10 skip / 0 flaky |
| `3334285` (C) | 39299313643 ✔ | 39299313775 ✔ 422 qua / 10 skip / 0 flaky |
| `0ef0086` (sửa theo review) | 39300594509 ✔ | 39300594469 ✔ 422 qua / 10 skip / 0 flaky |
| `823e3f0` (docs) | 39300884807 ✔ | không chạy (chỉ `.md`) |

### Kiểm bằng mắt (Claude in Chrome, Preview `3334285`, chỉ xem)

- ⌘K (Ctrl K) mở palette; "sapiens" → 2 gợi ý; "nguyen nhat anh" → "Sương Khói Quê Nhà", "Làm bạn với bầu trời"; chọn kết quả → trang sách. ĐẠT.
- Trang sách: icon giỏ ở nút "Thêm vào giỏ" và header 16px, icon tìm kiếm 16px, mũi tên kệ 16px. ĐẠT.
- Sáng / tối: sáng → hiện mặt trăng (mặt trời 0px), nhãn "Chuyển sang giao diện tối"; tối → hiện mặt trời. ĐẠT.
- Kệ "Nổi bật" trang chủ: bấm mũi tên phải → kệ cuộn, nút trái bật. ĐẠT.
- `/sach`: lọc "Tiếng Anh" → `/sach?lang=en`, 189 → 117 cuốn; `/danh-muc/van-hoc` "Tiếng Việt" → `?lang=vi`, chip đổi trạng thái, có "Xóa bộ lọc" (26 cuốn, danh mục toàn sách Việt). Chevron sort 16px. ĐẠT.
- Sheet bộ lọc: **chưa kiểm mobile** (Chrome không thu được cửa sổ: `resize_window` báo xong nhưng `innerWidth` vẫn 1536). Ở desktop mở bằng `click()` qua JS (nút `md:hidden`): sheet "Bộ lọc" hiện, 14 link, focus trong sheet, 18 lần Tab vẫn trong sheet, Esc đóng; focus về `body` vì nút đang `display: none` ở desktop (đúng dự kiến). Ca mobile (focus về nút) do e2e mới trên Pixel 7 kiểm.
- HTML không JS của `/sach` (fetch cùng origin): Preview `sau-ux` (`56bcf5e`) và `perf-js`: nút "Bộ lọc" cùng 43 class (SHA-256 16 ký tự `4615c06793ee24f7`), cùng chữ / icon, `aria-haspopup="dialog"` + `aria-expanded="false"`; khác `data-slot` (`sheet-trigger` → `button`) và mất `data-state="closed"`; 7 link lọc (`price` ×4, `lang` ×2, `stock`) giống hệt; không có dialog trong HTML ở cả hai. Không JS: như cũ (nút không làm gì, hàng lọc desktop chạy bằng link).
- Console: không lỗi.

### Review (code-reviewer, diff `56bcf5e..3334285`)

- NGHIÊM TRỌNG: không có.
- NÊN SỬA: (1) câu quy ước dialog trong CLAUDE.md ghi quá thực tế (palette không trả focus về nút khi đóng; gợi ý mã không tải trước) → đã viết lại, ghi rõ chỗ lệch; (2) docs chưa cập nhật → mục này + CLAUDE.md; `progress.md` để lúc merge (dưới); (3) tải chunk lỗi: prefetch sinh unhandled rejection → đã `.catch`; bấm khi tải lỗi → error boundary của route (cùng mẫu với gợi ý mã, khung chat) → **chưa sửa**, đề xuất làm chung cho cả 3 chỗ.
- GỢI Ý đã làm: bỏ `group` thừa; sửa comment `search-input.ts`; `measure-js.mjs` "thừa" → "vượt" + comment bảng ngân sách; test tĩnh chặn zod.
- GỢI Ý chưa làm: chỉ đặt `aria-expanded` khi đã mounted; `{ ssr: false }` cho thống nhất; e2e "bấm khi chunk chưa về" bằng `page.route` làm chậm chunk.

### Ghi vào progress.md khi merge

- Xóa: dòng D (`[Đợt "giảm JS client" – làm D trước]`), dòng C, dòng sheet lazy, dòng `[Đo] scripts/measure-js.mjs thêm cột ngân sách theo route`, dòng `[Đợt perf-js] cập nhật mốc JS trong CLAUDE.md:153`, dòng `[Đã quyết 2026-10-19] ★ perf-js`.
- Xóa thêm: dòng `[Đo] measure:js đang cộng cả polyfill noModule…` (★8 đã làm ở `9a26b40`).
- Giữ: dòng B (đổi nhãn, dưới), `[Không làm] E`.
- Thêm:
  - "[Đợt nhỏ] Tải chunk lỗi khi bấm (sheet bộ lọc, gợi ý mã, khung chat, palette): next/dynamic (React.lazy) giữ lỗi tới khi tải lại trang → error boundary + nút 'Thử lại'."
  - "[Chấp nhận 2026-10-20] Lõi lucide Icon ('use client' trong lucide-react 1.57) vẫn tải ở mọi trang cửa hàng; mọi route đã dưới ngân sách."
  - "[Mức thấp] cart-view.tsx, checkout-form.tsx (client) còn import lucide (ngoài plan C)."
  - "[Theo dõi] Lỗi #3 build ('use cache' took too long, getRelatedBooks) gặp lại 2 lần khi build local 2026-10-20; CI / Vercel xanh."
  - "[Mức thấp] scripts/analyze-diff.mjs:16-17 comment còn ghi 'polyfill noModule, measure:js cũng đếm' (sau ★8 measure:js in nhưng không cộng)."
- Đổi nhãn dòng B thành "[Chờ quyết lại ★4 / ★5]".

## Sáng 2026-10-20: sửa theo review lượt 2 + palette trả focus (quyết định (d))

Quyết định của chủ dự án (2026-10-20): (b) chấp nhận lõi lucide `Icon` vẫn tải; (c) error boundary khi tải chunk lỗi → đợt nhỏ riêng; (d) palette trả focus về nút → sửa trong perf-js. `origin/main` (sau khi `sau-ux` merge, `ddf769b`) đã merge vào nhánh (`36267fb`, không xung đột).

- Palette (`search-trigger.tsx`, `search-palette.tsx`, `components/ui/command.tsx` thêm `onCloseAutoFocus` cho `CommandDialog`): đóng bằng Esc / bấm ra ngoài / Ctrl K lần nữa → focus về chỗ đã mở (nút nếu mở bằng nút; phần tử đang focus lúc nhấn Ctrl K, trừ `body`); chọn kết quả → chuyển trang như cũ, không kéo focus về header. Trước đây Radix trả focus về Trigger, mà palette không có Trigger → focus rơi về `body`.
- Theo review lượt 3: nhớ chỗ trả focus theo trạng thái mở của chính palette (`openRef`), không theo `closest('[role="dialog"]')` (trước đó Ctrl K trong ô nhập của khung chat — dialog không modal trên desktop — không lưu chỗ); `focus({ preventScroll: true })` như FocusScope của Radix; mở lại palette thì reset cờ `navigating` (chọn kết quả rồi Ctrl K trước khi hiệu ứng đóng xong).
- Prefetch bỏ qua lỗi tải trước ở `search-trigger.tsx`, `chat-bubble.tsx` (như `filter-sheet.tsx`); comment ghi lỗi tải khi bấm để đợt error boundary.
- Comment đúng lý do: `theme-toggle.tsx` (chỉ bớt module từng icon, lõi `Icon` vẫn tải), `field.tsx` (bớt `createLucideIcon` + module `chevron-down`).
- `src/lib/client-no-zod.test.ts` viết lại (45 ca: 44 file client + 1 ca kiểm đầu vào): lập danh sách module zod = module (không phải `'use server'`: import vào client chỉ là tham chiếu action) có import / re-export / `import()` giá trị từ `zod`, cộng **bắc cầu** mọi module import giá trị từ một module đã có trong danh sách (theo review lượt 3; VD Phase 5a: badge giỏ → `store.ts` → `guest-cart.ts` → `schemas.ts`); cấm file `'use client'` của cửa hàng import giá trị từ `zod` hoặc từ các module đó; bỏ regex `isSchemas`; loại `app/admin`, `features/admin`, `components/admin` trừ `admin-link.tsx`. Thử import cấm rồi trả lại: (1) `searchQuerySchema` từ `../schemas` vào palette, `@/lib/text-schema` vào `theme-toggle.tsx`, `export { z } from 'zod'` vào `cart-badge.tsx` → 3 ca fail đúng file; (2) bắc cầu: `import { cartItemsSchema } from './schemas'` vào `guest-cart.ts` → 7 ca fail (`add-to-cart-button`, `cart-badge`, `cart-sync`, `cart-view`, `guest-cart.tsx`, `user-cart`, `checkout-form`). Không bắt: `import x = require(...)`, `require()`, specifier `.js` → `.ts` (repo chưa dùng).
- e2e mới `e2e/layout.spec.ts` "palette: mở bằng nút → Esc → focus về nút; Ctrl K → Esc → focus về phần tử trước đó" (desktop + mobile): mở bằng nút → Esc → focus ở nút; focus CTA "Xem tất cả sách" → Ctrl K → Esc → focus ở CTA; Ctrl K → Ctrl K (đóng bằng phím tắt) → focus ở CTA; focus ở `body` → Ctrl K → Esc → nút không được focus.

measure:js (KB ngoài baseline, so với `3334285`; mọi route ngân sách 50KB, ĐẠT):

| Route | `3334285` | Sau sửa (`84cb1c7` + e2e) |
|---|---:|---:|
| `vi` | 41.4 | 41.5 |
| `vi/books` | 41.9 | 42.0 |
| `vi/categories/van-hoc` | 41.9 | 42.0 |
| `vi/books/sapiens` | 44.2 | 44.3 |
| `vi/cart` | 45.8 | 45.9 |
| `vi/checkout` | 44.8 | 45.0 |
| `vi/login` | 36.0 | 36.1 |

+0.1–0.2KB: logic trả focus của nút tìm kiếm (header, mọi trang) + `.catch` của prefetch.

CI sáng 2026-10-20:

| Commit | CI check | e2e |
|---|---|---|
| `36267fb` (merge `origin/main`, chỉ `.md`) | 39350768858 ✔ | không chạy (chỉ `.md`) |
| `25df4c5` (cùng lần push với `84cb1c7`) | 39351444864 ✔ | 39351444838 ✔ 424 qua / 10 skip / 0 flaky |
| `637fac5` (sửa theo review lượt 3) | 39352817986 ✔ | 39352818023 ✔ 424 qua / 10 skip / 0 flaky |

Review lượt 3 (`origin/main..25df4c5`): 0 NGHIÊM TRỌNG; NÊN SỬA (1) Ctrl K khi focus trong dialog khác, (2) test zod chỉ một bước → đã sửa; GỢI Ý đã làm: `preventScroll`, reset `navigating`, 2 ca e2e thêm (đóng bằng phím tắt, focus ở `body`), docs; chưa làm: ca e2e "chọn kết quả → focus không lên nút", các lỗ hổng nhỏ của test tĩnh (`require`, `.js`).

measure:js ở `637fac5` (SHA code cuối lúc đó; mốc mới ở mục "Trước merge"): `vi` 41.5, `vi/books` 42.0, `vi/categories/van-hoc` 42.0, `vi/books/sapiens` 44.3, `vi/cart` 46.0, `vi/checkout` 45.0, `vi/login` 36.1KB — mọi route ĐẠT ngân sách 50KB (`vi/cart` +0.1KB so với lượt đo trước: dao động do chia chunk).

Kiểm bằng mắt (Claude in Chrome, Preview `637fac5` https://nha-sach-j08l2naul-khangtpvl1-3775.vercel.app, chỉ xem):
- Bấm nút tìm kiếm → palette mở (focus ở ô nhập) → Esc → palette đóng, focus ở nút tìm kiếm (có vòng focus). Production (code cũ) cùng thao tác → focus ở `body`.
- Focus CTA "Xem tất cả sách" → Ctrl K → Esc → focus về CTA, trang không cuộn (`scrollY` 0).
- Qua công cụ này, phím Esc **đầu tiên** sau khi palette mở không đóng palette, lần 2 mới đóng; production (code cũ) y hệt → do cách công cụ gửi phím, không phải lỗi mới (e2e Playwright đóng bằng 1 lần Esc, desktop + mobile).
- `/sach`: sheet "Bộ lọc" (mở bằng `click()` qua JS vì nút `md:hidden` ở desktop): 14 link, focus trong sheet, 18 lần Tab vẫn trong sheet, Esc đóng, `aria-expanded` về `false`. Console không lỗi.
- Chưa kiểm mobile (Chrome không thu được cửa sổ, đêm qua): chờ chủ dự án test iPhone.

## Trước merge (2026-10-20, sau khi chủ dự án test ĐẠT)

Chủ dự án test 2026-10-20, ĐẠT: (A) đăng ký trên production bằng email đã có tài khoản, vi + en → "Kiểm tra hộp thư" + 2 link, không lộ email; (B) Preview perf-js trên điện thoại: sheet "Bộ lọc" ở `/sach` và `/danh-muc/van-hoc` (mở / lọc / "Xong" / trang sau không cuộn), tìm kiếm, icon, sáng / tối.

Sửa theo review cuối (`9a26b40`, + docs / dọn nhỏ ở commit sau):
- Đóng palette bằng Ctrl K cũng xóa chữ đã gõ: `search-palette.tsx` xóa theo `open` (đổi state khi prop đổi, trong lúc render) thay vì trong từng chỗ đóng; bỏ `handleOpenChange` chỉ chuyển tiếp.
- `search-trigger.tsx`: không ghi đè chỗ trả focus khi phần tử đang focus nằm trong `[cmdk-root]` (Esc rồi Ctrl K ngay, lúc palette đang đóng dở).
- ★8: `measure-js.mjs` không cộng script `noModule` (polyfill 38.59KB gzip), `BASELINE_GZIP_KB` 170 → 131.4; in 2 chữ số thập phân khi cách ngân sách < 0.1KB. So cách đo cũ / mới trên cùng bản build `637fac5`: số "ngoài baseline" vi 41.5 / 41.5, `/sach` 42.0 / 42.1, danh mục 42.0 / 42.1, sách 44.3 / 44.3, giỏ 46.0 / 46.0, thanh toán 45.0 / 45.0, đăng nhập 36.1 / 36.1 (lệch ≤ 0.1KB do làm tròn) → giữ thay đổi. Các bảng trước mục này tính theo baseline 170KB có polyfill; số "ngoài baseline" so được với nhau.
- e2e `e2e/layout.spec.ts`: ca "focus ở body" kiểm khẳng định (`expect.poll(… document.activeElement === document.body)`); test mới "palette: đóng bằng Ctrl K cũng xóa chữ đã gõ"; test mới "palette: Esc rồi Ctrl K ngay (palette đang đóng dở) → lần đóng sau vẫn về phần tử ban đầu". Ca sau kiểm trên nhánh nháp `palette-diag` (chỉ test palette, `--repeat-each 10 --retries 0`, desktop + mobile): bỏ bản sửa → ca mới fail 20/20, ca palette khác 80/80 qua (run 39357491566); có bản sửa → 100/100 qua (run 39358065123). Nhánh nháp đã xóa (local + remote).

measure:js ở `9a26b40` (cách đo mới, ngân sách 50KB, tất cả ĐẠT):

| Route | `637fac5` (cách cũ) | `9a26b40` (cách mới) |
|---|---:|---:|
| `vi` | 41.5 | 41.5 |
| `vi/books` | 42.0 | 42.1 |
| `vi/categories/van-hoc` | 42.0 | 42.1 |
| `vi/books/sapiens` | 44.3 | 44.3 |
| `vi/cart` | 46.0 | 46.0 |
| `vi/checkout` | 45.0 | 45.0 |
| `vi/login` | 36.1 | 36.2 |

