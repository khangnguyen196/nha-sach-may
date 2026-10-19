# Đợt "giảm JS client" (plan, chưa làm)

Trạng thái: **plan, ★ đã quyết 2026-10-19** (viết 2026-10-19 trên nhánh `ux-messages`). Chưa làm. Thứ tự đợt: **`scripts/analyze-diff.mjs` → D → sheet lazy → C**; B để sau.

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
- ★8 **giữ** polyfill `noModule` trong số đo suốt đợt, ghi chú trong `scripts/measure-js.mjs`; đổi baseline sau đợt (sửa cả mốc 170KB trong `CLAUDE.md` mục Hiệu năng và `BASELINE_GZIP_KB` trong `scripts/measure-js.mjs`).

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
