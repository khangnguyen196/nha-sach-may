# Đợt so-thich-canh-bao: chặn sách theo sở thích + cảnh báo nội dung nhạy cảm

Kế hoạch chủ dự án duyệt 2026-10-25 (bản vòng 0 + 9 chỗ điều phối sửa + phần sửa / thêm của chủ dự án). Bắt đầu từ
`main` `778e1c1`. Chia 3 phần, mỗi phần lên main riêng:

| Phần | Nội dung | SQL |
|---|---|---|
| **P-A** | Cơ sở dữ liệu: kiểu nhãn, cột nhãn của sách, bảng gợi ý, bảng chặn, RPC hạn mức + duyệt, mã lỗi | migration `20261025000000_prefs_warnings.sql`, chủ dự án chạy trước khi lên main |
| **P-B** | Cảnh báo nội dung: admin gợi ý bằng AI (Gemini, đếm chung với Mây) → sửa → duyệt; khung cảnh báo ở trang sách | không |
| **P-C** | Chặn theo sở thích: ô mờ ở mọi danh sách, dòng nhắc + nút chặn / bỏ chặn ở trang sách, trang Sở thích, Mây không gợi ý sách bị chặn, palette | không |

## Quyết định của chủ dự án (nguyên văn, 2026-10-25)

> DUYỆT KẾ HOẠCH so-thich-canh-bao: đồng ý 13 câu theo đề xuất, TRỪ / THÊM (chủ dự án + Claude chat, 25/10):
> - Câu 5 SỬA: Google tính hạn mức theo khóa API (và model), không theo tính năng. Nếu gợi ý cảnh báo dùng cùng khóa / cùng model với Mây thì mỗi lượt gợi ý PHẢI trừ vào bộ đếm chung đang bảo vệ quota 400 lượt / ngày của Mây (ngoài trần riêng 30 lượt / ngày, trần cứng 60 trong SQL). Chạy theo lô thì giãn cách giữa các lượt để không chiếm hết mốc 10 lượt / phút (VD tối đa vài lượt / phút cho gợi ý), và dừng lô sớm khi bộ đếm chung sắp chạm ngưỡng chừa cho Mây. Nêu rõ trong code + docs đang dùng khóa / model nào và tính chung ra sao; có Vitest cho phần đếm.
> - Câu 3 THÊM 2 điều kiện: (a) nội dung thẻ bị che phải ẩn thật với trình đọc màn hình và phím Tab (VD visibility: hidden cho phần nội dung, không chỉ phủ lớp mờ lên trên); chỉ ô mờ + nút "Xem" đọc được / bấm được; có e2e kiểm link của sách bị chặn không nhận focus. (b) Đoạn CSS sinh từ danh sách chặn chỉ chứa mã số và tên nhãn enum, không chứa chữ do người dùng nhập; có Vitest.
> - THÊM: khung cảnh báo khi sách có nhãn tự hại / tự tử hiện thêm một câu nhẹ nhàng (song ngữ), không kèm số điện thoại cụ thể, VD "Nếu bạn đang gặp khó khăn, hãy chia sẻ với người bạn tin tưởng hoặc tìm hỗ trợ chuyên môn."
> - Ghi toàn bộ 13 quyết định + các sửa / thêm trên vào docs/progress.md và file plan của đợt.
>
> Tạo nhánh so-thich-canh-bao-1 và chạy P-A theo prompt vòng 1 đã soạn (cập nhật theo câu 5). SQL ghi do chủ dự án chạy: khi CI xanh thì cắt file .sql ngoài repo + câu kiểm trước / sau, chụp trước bằng MCP chỉ đọc, DỪNG chờ "ĐÃ CHẠY SQL".

13 câu (theo đề xuất, câu 5 đã sửa):

1. Chia 3 phần P-A cơ sở dữ liệu → P-B cảnh báo → P-C chặn, mỗi phần lên main riêng.
2. Chặn NXB theo `publisher_id` (bảng `publishers` có sẵn).
3. Che sách chỉ bằng CSS từ server (phương án A); đo thời gian lộ trên Preview, > 0,3 giây mới hỏi lại phương án B. Kèm điều kiện (a) (b) ở trên.
4. Tối đa 50 mục chặn / tài khoản.
5. (SỬA) 12 sách / lượt, 30 lượt / ngày, trần cứng SQL 60; mỗi lượt cộng vào bộ đếm chung `gemini:minute` + `gemini:day`.
6. Request gắn nhãn của admin tắt bộ lọc an toàn Gemini (đầu ra khóa trong 5 nhãn + 1 câu lý do; Mây giữ bộ lọc); lô bị chặn → báo admin, không tự gọi lại.
7. "Ẩn các sách có cảnh báo này" = chặn mọi nhãn của cuốn đó (gỡ từng nhãn được).
8. Chặn danh mục cha = chặn mọi danh mục con.
9. Nút chặn chỉ cho tác giả vai trò `author`, không tính dịch giả.
10. Mây vẫn trả lời về cuốn đang xem dù bị chặn, nhưng không bao giờ đưa thẻ sách bị chặn vào gợi ý.
11. Palette ⌘K cũng che, làm cuối P-C; vướng điều hướng phím thì bỏ dòng bị chặn khỏi kết quả và hỏi lại.
12. Test điện thoại một lần trên Preview của P-C trước khi lên main; nút "Gợi ý bằng AI" chỉ thử trên web thật sau khi P-B lên.
13. Sách chưa xét cảnh báo: khách không thấy gì.

## P-A: cơ sở dữ liệu (mục 16 của `schema.sql`)

- `public.content_warning` enum: `violence` (bạo lực / máu me), `loss` (mất mát / tang thương), `self_harm` (tự hại / tự tử), `adult` (nội dung người lớn), `other_sensitive` (chủ đề nhạy cảm khác).
- `books.content_warnings content_warning[] not null default '{}'` (≤ 5, không phần tử null) + `books.content_warnings_reviewed_at` (null = chưa xét). Bỏ trùng + xếp theo thứ tự enum bằng trigger BEFORE (hàm `private`, security definer), **không** dùng CHECK gọi hàm `private` (authenticated không có usage trên `private` → admin sửa sách lỗi). Hai cột vào `grant update (…)` của `books`. Khách đọc nhãn như mọi cột công khai.
- `public.content_warning_suggestions` (id, book_id cascade, labels (cùng ràng buộc + trigger), reason 1–200 ký tự, status `pending | approved | dismissed`, model ≤ 80, created_at, reviewed_at; `reviewed_at` null ⇔ pending). Một `pending` / sách (partial unique index). RLS: policy select + insert chỉ `(select public.is_admin())`; authenticated chỉ có select + insert (book_id, labels, reason, model); **không** update / delete (đổi trạng thái qua RPC, dọn e2e bằng service role); anon không có quyền gì.
- `public.user_blocks` (user_id default `auth.uid()`, kind `category | author | publisher | warning`, `category_id` / `author_id` / `publisher_id` (cascade) / `warning`; check đúng một cột đích khác null và khớp kind). Chống trùng bằng 4 partial unique index `(user_id, <cột>) where kind = '<kind>'` (unique thường không chặn được vì NULL khác NULL). RLS: select / insert / delete khi `user_id = (select auth.uid())`, không update, **admin không có policy đọc** (dữ liệu nhạy cảm). Quyền: select, delete + insert (kind, category_id, author_id, publisher_id, warning). Trigger BEFORE INSERT khóa `pg_advisory_xact_lock` theo user rồi đếm: ≥ 50 → `PREFS_LIMIT` (detail `{"max": 50}`).
- `public.consume_warning_quota(p_limits)`: xem mục "Hạn mức Gemini" dưới.
- `public.review_warning_suggestion(p_id, p_labels, p_approve)` → `book_id`: admin-only (`FORBIDDEN`), khóa dòng gợi ý, không có / không còn `pending` → `SUGGESTION_STATUS_CHANGED`. Duyệt: `books.content_warnings = p_labels` (bản admin đã sửa) + `content_warnings_reviewed_at = now()`, gợi ý `approved` + `labels = p_labels`. Bỏ qua: gợi ý `dismissed`, sách thành "đã xét" (không đổi nhãn).
- Mã lỗi mới (`ERROR_CODES`, `messages/*.json → errors`): `PREFS_LIMIT` (`{max}`), `WARNING_QUOTA_EXCEEDED` (scope `warn_minute | warn_day | gemini_minute | chat_reserve`), `SUGGESTION_STATUS_CHANGED`.
- `src/types/database.ts` lấy từ artifact `database-types` của CI sau khi push (bước "Check src/types/database.ts" đỏ lần đầu là dự kiến).
- SQL ghi: chủ dự án chạy trong SQL Editor sau khi CI xanh (file cắt ngoài repo, chạy thử trên Postgres local trước, kịch bản đếm: lượt 31 / 61 bị chặn, `gemini:day` = 300 thì gợi ý bị chặn còn Mây vẫn qua; chụp trước / kiểm sau bằng MCP chỉ đọc).

## Hạn mức Gemini (câu 5 đã sửa): đếm chung với Mây

- Gợi ý cảnh báo (P-B) gọi Gemini bằng **cùng `GEMINI_API_KEY`** và **cùng model** với Mây: `resolveModel` = `GEMINI_MODEL` nếu nằm trong `ALLOWED_MODELS`, không thì `DEFAULT_MODEL` = `gemini-3.5-flash-lite`. Google tính RPM / RPD theo project của khóa + model, không theo tính năng (free tier 15 / phút, 500 / ngày, `FREE_TIER` trong `features/chat/config.ts`).
- Bộ đếm `private.chat_quota` (mục 14). Mỗi lượt gợi ý = một lời gọi `consume_warning_quota` (chỉ admin) cộng theo thứ tự, vượt bước nào → `WARNING_QUOTA_EXCEEDED` kèm scope, rollback mọi lần cộng trước đó trong lời gọi:
  1. `warn:minute` (phút UTC) ≤ `WARNING_LIMITS.callsPerMinute` = **2** (app gửi) → scope `warn_minute`;
  2. `warn:day` (ngày America/Los_Angeles) ≤ `WARNING_LIMITS.callsPerDay` = **30** (app gửi; SQL chỉ nhận 1–**60** = trần cứng `hardCallsPerDay`) → `warn_day`;
  3. bucket **chung** `gemini:minute` ≤ `CHAT_LIMITS.geminiCallsPerMinute` = 10 (app gửi) → `gemini_minute`;
  4. bucket **chung** `gemini:day` (cùng cửa sổ với `consume_chat_quota`) ≤ `private.warning_gemini_day_ceiling()` = **300** = 400 (trần ngày của Mây) − 100 (`WARNING_LIMITS.chatReserve`) → `chat_reserve`. Hằng cứng trong SQL, không nhận từ `p_limits` (phiên admin bị lộ không nâng được). Lượt đầu của ngày (có thể là gợi ý) dọn bộ đếm cũ như Mây.
- Mây vẫn dừng ở 400 / ngày, gợi ý dừng ở 300 → tổng mọi lượt gọi Gemini của web ≤ 400 < 500, Mây luôn còn ≥ 100 lượt / ngày.
- AI giả (e2e): trần phút (`warnCallsPerMinute`, `geminiCallsPerMinute`) nhân `MOCK_LIMIT_MULTIPLIER` = 100 như `quotaLimits(mock)` của chat (các project chạy song song trên một DB local); trần ngày **không** nhân. e2e không đếm vượt hạn mức (ăn hết `warn:day` trên DB của CI làm đỏ test P-B chạy cùng lượt).
- Lô ở P-B: tối đa `booksPerCall` = 12 sách / lượt; giãn ≥ 60 000 / `callsPerMinute` = **30 giây** giữa các lượt (không chiếm hết mốc 10 / phút của Mây); gặp `WARNING_QUOTA_EXCEEDED` thì dừng lô theo scope (`warn_minute` / `gemini_minute`: báo admin thử lại sau ít phút; `warn_day` / `chat_reserve`: hết lượt hôm nay), không tự gọi lại.
- Vitest: `features/chat/config.test.ts` (callsPerDay ≤ hardCallsPerDay, callsPerMinute < trần phút chung, 400 − 100 > 60, 400 < rpd mọi model), `supabase/prefs-warnings.test.ts` (đủ 4 bucket đúng thứ tự, `gemini:day` dùng ngưỡng cứng, ngưỡng = 400 − 100, cận 60 khớp `hardCallsPerDay`, FORBIDDEN, quyền bảng, search_path).
- Số lượt Gemini thật (MCP chỉ đọc, 2026-10-25, `private.chat_quota` bucket `gemini:day`, 5 dòng mới nhất): chỉ còn 1 dòng, `window_start` 2026-10-21 07:00Z (ngày LA 21/10), `used` = 1 (bộ đếm cũ hơn 3 ngày đã bị dọn; không có lượt nào sau 21/10). Mây đang dùng rất ít, xa ngưỡng 300.

## P-B: cảnh báo nội dung (app)

- `src/features/warnings/`: danh sách nhãn + key messages vi / en; zod cho kết quả Gemini (`{ books: [{ id, labels, reason }] }`, id phải trong lô, bỏ mục lạ / trùng, cắt chuỗi); prompt (nội dung sách là **dữ liệu** trong khối JSON, bỏ qua mọi chỉ dẫn trong đó; `responseJsonSchema` có enum nhãn + enum id); `consumeWarningQuota` → `GeminiTicket` (`ticket.ts` / `callGemini` mở rộng ở P-B); AI giả mở rộng `mock.ts` (cụm `[mock:warn-…]`).
- Request gắn nhãn: `safetySettings` tắt bộ lọc (câu 6), `timeoutMs` / `maxOutputTokens` riêng cho lô; Mây giữ bộ lọc.
- Admin `/admin/canh-bao`: gợi ý lô cho sách chưa xét (`content_warnings_reviewed_at is null`, không có gợi ý pending), danh sách gợi ý chờ duyệt (sửa nhãn, Duyệt / Bỏ qua), form sách có ô nhãn + "Gợi ý bằng AI" một cuốn. Mọi action `assertAdmin()`. Duyệt → `updateTag('book:{id}')` + tag danh sách + làm mới cả `chat-catalog`.
- Trang sách: khung cảnh báo trước phần mô tả (`bg-surface-raised` + viền, không màu `sale`), liệt kê nhãn; chừa chỗ không gây CLS. Sách có nhãn `self_harm`: thêm **một câu nhẹ nhàng** song ngữ trong messages (VD "Nếu bạn đang gặp khó khăn, hãy chia sẻ với người bạn tin tưởng hoặc tìm hỗ trợ chuyên môn."), **không** số điện thoại, **không** dùng lại `chat.crisis`.
- Test: Vitest parse / schema (JSON hỏng, nhãn lạ, id ngoài lô, lý do quá dài, mô tả chứa câu lệnh); test lô chỉ kiểm ≤ 12 cuốn; e2e admin (Gemini giả): gợi ý → sửa → duyệt → khách thấy khung; bỏ qua → không thấy.

## P-C: chặn theo sở thích (app)

- Thẻ sách (`BookCard`, thẻ chợ sách cũ, dòng palette) mang `data-*` (id danh mục, id tác giả vai trò `author`, id NXB, nhãn) + ô mờ cùng kích thước ("Đã ẩn theo sở thích của bạn" + nút "Xem"). Trang prerender giữ nguyên cho mọi người (không bỏ cache catalog).
- Che bằng `<style>` từ server trong Suspense của layout, sau khi đọc phiên (một query `user_blocks` của chính user; danh mục cha mở ra mọi danh mục con). **Câu 3a**: phần nội dung (link sách) `visibility: hidden` → không nhận Tab, trình đọc màn hình bỏ qua; chỉ ô mờ + nút "Xem" đọc / bấm được; e2e kiểm link sách bị chặn không nhận focus. Ô mờ **không** dùng thuộc tính `hidden` (Tailwind v4 có `[hidden] { display: none !important }`), hiện / ẩn bằng chính style sinh ra. **Câu 3b**: CSS chỉ dựng từ id số nguyên + tên nhãn enum đã kiểm, không chứa chữ người dùng nhập; Vitest (input bẩn bị loại).
- "Xem": một client leaf nhỏ ở layout bắt click ủy quyền, gắn `data-revealed` cho đúng thẻ (lần xem này). Đo thời gian lộ trên Preview (câu 3).
- Trang sách: nút "Không muốn thấy thể loại / tác giả (vai trò author) / NXB này" + "Ẩn các sách có cảnh báo này" (mọi nhãn của cuốn đó); sách bị chặn → dòng nhắc "Bạn đã chặn …" + bỏ chặn; khách chưa đăng nhập không thấy nút. Chừa chỗ để không CLS.
- Trang Sở thích (`/tai-khoan/so-thich` ↔ `/en/account/preferences`): liệt kê theo nhóm, bỏ chặn.
- Mây lọc ứng viên + thẻ trả về theo mục chặn của người hỏi (câu 10). Palette làm cuối (câu 11).
- e2e: user e2e riêng mỗi lần chạy (xóa ở `finally`), sách e2e riêng; ô mờ cùng kích thước, Xem, tải lại che lại, dòng nhắc, bỏ chặn, khách không thấy nút, người khác không đọc được danh sách chặn.

## Các chỗ đã sửa so với bản kế hoạch đầu (điều phối vòng 0 + chủ dự án)

- Tên migration 14 chữ số (`20261025000000_…`).
- Chống trùng `user_blocks` bằng unique theo từng kind (partial index), không unique trên cả bộ cột.
- Chuẩn hóa nhãn bằng trigger thay CHECK gọi hàm `private`.
- Ô mờ không dùng thuộc tính `hidden` (Tailwind v4 `[hidden]{display:none !important}`).
- User e2e riêng mỗi lần chạy cho spec chặn.
- `safetySettings` + timeout / `maxOutputTokens` riêng cho lô gợi ý.
- Trần cứng `warn:day` trong SQL (60); thêm đếm chung `gemini:minute` + `gemini:day` với ngưỡng 300 (câu 5 sửa) thay vì "không đụng 400 của Mây".
- CLS ở trang sách (khung cảnh báo, nút chặn, dòng nhắc chừa chỗ).
- Test lô chỉ kiểm ≤ 12 cuốn / lượt.
- Palette bỏ dòng bị che khỏi điều hướng phím.
- Duyệt nhãn làm mới cả `chat-catalog`.
- `ticket.ts` / `callGemini` mở rộng ở P-B (không ở P-A).
