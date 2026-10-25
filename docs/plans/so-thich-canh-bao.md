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
- `books.content_warnings content_warning[] not null default '{}'` (≤ 5, không phần tử null) + `books.content_warnings_reviewed_at` (null = chưa xét). Check `books_content_warnings_reviewed_check`: có nhãn thì `content_warnings_reviewed_at` khác null (câu 13: chưa xét thì khách không thấy gì → hai cột không được lệch); form admin (P-B) đổi nhãn gửi kèm `content_warnings_reviewed_at = now()`. Trong `schema.sql` là câu `alter table … add constraint` ngay sau `create table books` (giống hệt câu của migration, `supabase/migrations.test.ts` so từng câu). Bỏ trùng + xếp theo thứ tự enum bằng trigger BEFORE (hàm `private`, security definer), **không** dùng CHECK gọi hàm `private` (authenticated không có usage trên `private` → admin sửa sách lỗi). Hai cột vào `grant update (…)` của `books`. Khách đọc nhãn như mọi cột công khai.
- `public.content_warning_suggestions` (id, book_id cascade, labels (cùng ràng buộc + trigger), reason 1–200 ký tự, status `pending | approved | dismissed`, model ≤ 80, created_at, reviewed_at; `reviewed_at` null ⇔ pending). Một `pending` / sách (partial unique index). RLS: policy select + insert chỉ `(select public.is_admin())`; authenticated chỉ có select + insert (book_id, labels, reason, model); **không** update / delete (đổi trạng thái qua RPC, dọn e2e bằng service role); anon không có quyền gì.
- `public.user_blocks` (user_id default `auth.uid()`, kind `category | author | publisher | warning`, `category_id` / `author_id` / `publisher_id` (cascade) / `warning`; check đúng một cột đích khác null và khớp kind). Chống trùng bằng 4 partial unique index `(user_id, <cột>) where kind = '<kind>'` (unique thường không chặn được vì NULL khác NULL). RLS: select / insert / delete khi `user_id = (select auth.uid())`, không update, **admin không có policy đọc** (dữ liệu nhạy cảm). Quyền: select, delete + insert (kind, category_id, author_id, publisher_id, warning). Trigger BEFORE INSERT `user_blocks_check_limit` khóa `pg_advisory_xact_lock` theo user rồi đếm: ≥ 50 → `PREFS_LIMIT` (detail `{"max": 50}`).
- `public.consume_warning_quota(p_limits)`: xem mục "Hạn mức Gemini" dưới.
- `public.review_warning_suggestion(p_id, p_labels, p_approve, p_expected_reviewed_at)` → `book_id`: admin-only (`FORBIDDEN`), khóa dòng gợi ý, không có / không còn `pending` → `SUGGESTION_STATUS_CHANGED`; rồi khóa dòng sách (`for update`), `content_warnings_reviewed_at` **is distinct from** `p_expected_reviewed_at` (giá trị lúc admin mở gợi ý, null nếu sách chưa xét) → `SUGGESTION_STATUS_CHANGED` (admin vừa sửa tay nhãn ở form sách: không ghi đè), áp cho cả duyệt lẫn bỏ qua. **Không** so `books.updated_at` (đổi mỗi khi đặt / hủy đơn đổi tồn kho → báo lệch giả). App truyền lại nguyên chuỗi timestamptz đọc từ PostgREST, không qua `Date` của JS (mất phần micro giây → luôn lệch). Duyệt: `books.content_warnings = p_labels` (bản admin đã sửa) + `content_warnings_reviewed_at = now()`, gợi ý `approved` + `labels = p_labels`. Bỏ qua: gợi ý `dismissed`, sách thành "đã xét" (không đổi nhãn).
- Mã lỗi mới (`ERROR_CODES`, `messages/*.json → errors`): `PREFS_LIMIT` (`{max}`), `WARNING_QUOTA_EXCEEDED` (scope `warn_minute | warn_day | gemini_minute | chat_reserve`), `SUGGESTION_STATUS_CHANGED`.
- `src/types/database.ts` lấy từ artifact `database-types` của CI sau khi push (bước "Check src/types/database.ts" đỏ lần đầu là dự kiến).
- SQL ghi: chủ dự án chạy trong SQL Editor sau khi CI xanh (file cắt ngoài repo, chạy thử trên Postgres local trước theo kịch bản dưới; chụp trước / kiểm sau bằng MCP chỉ đọc).

### SQL ghi: kịch bản chạy thử trên Postgres local (Claude chat chạy trước khi chủ dự án chạy trên production)

CI chỉ dựng DB từ `schema.sql`, **file migration chưa từng chạy** → phải chạy thử đúng file sẽ cắt. Môi trường: Postgres giống Supabase (role `anon` / `authenticated` / `service_role`, `auth.uid()` đọc `request.jwt.claims`, `auth.users` + trigger tạo `profiles`, `storage`). Dữ liệu thử chỉ tạo trên DB local: admin A (`profiles.role = 'admin'`), user thường U và V, vài danh mục / tác giả / NXB / sách. Đổi vai trò: `begin; set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'; …; rollback;` (anon: `set local role anon`, claims `{"role":"anon"}`). Mỗi ca ghi: câu chạy, mã lỗi / số dòng nhận được, khớp / không khớp.

0. **Dựng + chạy migration**: dựng `schema.sql` bản `778e1c1` (`git show 778e1c1:supabase/schema.sql`) → chạy file `20261025000000_prefs_warnings.sql` → kiểm: 2 cột mới của `books` + 2 constraint (`books_content_warnings_check`, `books_content_warnings_reviewed_check`); 2 bảng (RLS bật, policy: `user_blocks` 3, `content_warning_suggestions` 2); 8 hàm (search_path rỗng); 3 trigger (`books_content_warnings`, `content_warning_suggestions_labels`, `user_blocks_check_limit`); quyền bảng / cột (`information_schema.role_table_grants`, `column_privileges`); `has_function_privilege('anon', 'public.review_warning_suggestion(bigint, public.content_warning[], boolean, timestamptz)', 'execute')` = false, `authenticated` = true (tương tự `consume_warning_quota(jsonb)`). Chạy migration **lần 2** → lỗi ở `create type` (`type "content_warning" already exists`), kiểm lại: không đổi gì (cả file là một transaction). Tùy chọn: so `pg_dump --schema-only` của DB này với DB dựng từ `schema.sql` HEAD (chỉ được khác thứ tự).
1. **Đếm** (`consume_warning_quota` với phiên admin A, mỗi lời gọi một transaction; đọc `private.chat_quota` bằng superuser):
   - `{"geminiCallsPerMinute":100000,"warnCallsPerMinute":100000,"warnCallsPerDay":30}`: lượt 1–30 qua, lượt **31** → `WARNING_QUOTA_EXCEEDED` scope `warn_day`; sau đó `warn:day` = 30, `warn:minute` / `gemini:minute` / `gemini:day` mỗi bucket +30 (lượt 31 không để lại lần cộng `warn:minute`).
   - `warnCallsPerDay` = 61 → `INVALID_INPUT` (detail `{"field":"warnCallsPerDay","max":60}`); 0, 1.5, `"30"` (chuỗi), thiếu khóa → `INVALID_INPUT`; không bucket nào đổi.
   - Đặt `gemini:day` của ngày LA hiện tại = 300 (superuser): gợi ý → `WARNING_QUOTA_EXCEEDED` scope `chat_reserve`, `warn:minute` / `warn:day` / `gemini:minute` không đổi; `consume_chat_quota` (Mây, token đặt bằng `set_chat_quota_token` với token thử 64 hex) **vẫn qua** (`gemini:day` → 301). `gemini:day` = 299 → gợi ý qua (→ 300), lượt sau bị `chat_reserve`.
   - `geminiCallsPerMinute` = 1 khi `gemini:minute` của phút hiện tại đã ≥ 1 → scope `gemini_minute`, `warn:minute` / `warn:day` không đổi.
2. **Vai trò thật**:
   - (a) Admin A: `update books set content_warnings = '{adult,violence,violence}', content_warnings_reviewed_at = now() where id = …` → đọc lại `'{violence,adult}'`; `update books set content_warnings = '{loss}'` trên sách có `content_warnings_reviewed_at` null → `23514`; `set content_warnings_reviewed_at = null` trên sách có nhãn → `23514`; `'{adult,null}'` → `23514`.
   - (b) User U: `insert into user_blocks (kind, category_id) values ('category', …)` → qua, `user_id` = uid của U; insert có cột `user_id` (kể cả = uid của U) → `42501`; mục thứ **51** → `PREFS_LIMIT` (detail `{"max":50}`); thêm trùng → `23505`; `update user_blocks …` → `42501`.
   - (c) User U `select * from user_blocks where user_id = <V>` → 0 dòng; admin A → 0 dòng; anon → `42501`.
   - (d) Admin A: insert gợi ý có cột `status` → `42501`; gợi ý `pending` thứ hai cùng sách → `23505`; `update` / `delete` gợi ý → `42501`. User U: insert gợi ý → `42501` (RLS), select → 0 dòng.
   - (e) anon gọi `consume_warning_quota` / `review_warning_suggestion` → `42501`; user U → `FORBIDDEN`. Admin A, sách chưa xét (`reviewed_at` null): review với `p_expected_reviewed_at` = null → duyệt được (nhãn = `p_labels` đã chuẩn hóa, `reviewed_at` có giá trị, gợi ý `approved`); sách đã xét: admin sửa tay nhãn (`reviewed_at` = now()) sau khi "mở" gợi ý rồi review với giá trị cũ → `SUGGESTION_STATUS_CHANGED`, nhãn không đổi, gợi ý vẫn `pending`; đổi `stock` của sách (đổi `updated_at`) rồi review với `reviewed_at` đúng → qua; bỏ qua (`p_approve` = false) với giá trị lệch → `SUGGESTION_STATUS_CHANGED`, khớp → `dismissed` + sách đã xét, nhãn không đổi; duyệt lần 2 cùng gợi ý → `SUGGESTION_STATUS_CHANGED`; `p_approve` = true, `p_labels` null → `INVALID_INPUT`.

Vòng 3 (sau khi có `src/types/database.ts` từ CI) viết spec e2e `admin-*.spec.ts` chạy các ca (a)–(e) bằng phiên user thật trên Supabase local của CI (user riêng mỗi lần chạy, xóa ở `finally`; `consume_warning_quota` tối đa 1 lượt hợp lệ, còn lại là ca lỗi: ăn `warn:day` trên DB của CI làm đỏ test khác chạy cùng lượt).

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
- Vitest: `features/chat/config.test.ts` (callsPerDay ≤ hardCallsPerDay, callsPerMinute < trần phút chung, 400 − 100 > 60, 400 < rpd mọi model), `supabase/prefs-warnings.test.ts` (đủ 4 bucket đúng thứ tự, `gemini:day` dùng ngưỡng cứng, ngưỡng = 400 − 100, cận 60 khớp `hardCallsPerDay`, FORBIDDEN, quyền bảng so cả danh sách (bắt `grant all`, insert cả bảng, update / delete, anon), 3 trigger, check có nhãn ⇒ đã xét ở cả `schema.sql` lẫn migration, `p_expected_reviewed_at` so bằng `is distinct from` sau khi khóa sách, search_path).
- Số lượt Gemini thật (MCP chỉ đọc, 2026-10-25, `private.chat_quota` bucket `gemini:day`, 5 dòng mới nhất): chỉ còn 1 dòng, `window_start` 2026-10-21 07:00Z (ngày LA 21/10), `used` = 1 (bộ đếm cũ hơn 3 ngày đã bị dọn; không có lượt nào sau 21/10). Mây đang dùng rất ít, xa ngưỡng 300.

## P-B: cảnh báo nội dung (app)

- `src/features/warnings/`: danh sách nhãn + key messages vi / en; zod cho kết quả Gemini (`{ books: [{ id, labels, reason }] }`, id phải trong lô, bỏ mục lạ / trùng, cắt chuỗi); prompt (nội dung sách là **dữ liệu** trong khối JSON, bỏ qua mọi chỉ dẫn trong đó; `responseJsonSchema` có enum nhãn + enum id); `consumeWarningQuota` → `GeminiTicket` (`ticket.ts` / `callGemini` mở rộng ở P-B); AI giả mở rộng `mock.ts` (cụm `[mock:warn-…]`).
- Request gắn nhãn: `safetySettings` tắt bộ lọc (câu 6), `timeoutMs` / `maxOutputTokens` riêng cho lô; Mây giữ bộ lọc.
- Admin `/admin/canh-bao`: gợi ý lô cho sách chưa xét (`content_warnings_reviewed_at is null`, không có gợi ý pending), danh sách gợi ý chờ duyệt (sửa nhãn, Duyệt / Bỏ qua), form sách có ô nhãn + "Gợi ý bằng AI" một cuốn. Mọi action `assertAdmin()`. Duyệt → `updateTag('book:{id}')` + tag danh sách + làm mới cả `chat-catalog`.
- Trang sách: khung cảnh báo trước phần mô tả (`bg-surface-raised` + viền, không màu `sale`), liệt kê nhãn; chừa chỗ không gây CLS. Sách có nhãn `self_harm`: thêm **một câu nhẹ nhàng** song ngữ trong messages (VD "Nếu bạn đang gặp khó khăn, hãy chia sẻ với người bạn tin tưởng hoặc tìm hỗ trợ chuyên môn."), **không** số điện thoại, **không** dùng lại `chat.crisis`.
- Test: Vitest parse / schema (JSON hỏng, nhãn lạ, id ngoài lô, lý do quá dài, mô tả chứa câu lệnh); test lô chỉ kiểm ≤ 12 cuốn; e2e admin (Gemini giả): gợi ý → sửa → duyệt → khách thấy khung; bỏ qua → không thấy.
- Ghi chú từ review P-A (vòng 2):
  - Nút "Gợi ý bằng AI" một cuốn: sách đã có gợi ý `pending` → mở gợi ý đó, không gọi Gemini. Lô chỉ chọn sách `content_warnings_reviewed_at is null` **và** không có gợi ý `pending`.
  - "Bỏ qua" = sách thành đã xét (không lên lô nữa); muốn gợi ý lại thì dùng nút một cuốn.
  - Form duyệt gửi `p_expected_reviewed_at` = `content_warnings_reviewed_at` lúc mở gợi ý (nguyên chuỗi từ PostgREST); form sách đổi nhãn gửi kèm `content_warnings_reviewed_at = now()` (check của bảng bắt buộc khi có nhãn).
  - Hằng trần token đầu vào cho một lượt gợi ý (như `GEMINI.maxPromptTokens` của Mây) + Vitest: tổng token / phút (Mây `geminiCallsPerMinute × targetPromptTokens` + gợi ý `callsPerMinute × trần token gợi ý`) < `tpm` của mọi model trong `ALLOWED_MODELS`.
  - e2e: `warn:day` 60 và ngưỡng `gemini:day` 300 **không** nhân 100 khi mock, và `gemini:day` dùng chung với spec chat trên cùng DB của CI → khi có spec gợi ý thì thêm bất biến (tổng lượt gợi ý hợp lệ + lượt chat của mọi spec trong một lượt CI < 300; spec gợi ý chỉ vài lượt hợp lệ).
  - Câu `WARNING_QUOTA_EXCEEDED` theo scope: phút (`warn_minute` / `gemini_minute`: thử lại sau ít phút) khác ngày (`warn_day` / `chat_reserve`: hết lượt hôm nay, kèm giờ reset).

## P-C: chặn theo sở thích (app)

- Thẻ sách (`BookCard`, thẻ chợ sách cũ, dòng palette) mang `data-*` (id danh mục, id tác giả vai trò `author`, id NXB, nhãn) + ô mờ cùng kích thước ("Đã ẩn theo sở thích của bạn" + nút "Xem"). Trang prerender giữ nguyên cho mọi người (không bỏ cache catalog).
- Che bằng `<style>` từ server trong Suspense của layout, sau khi đọc phiên (một query `user_blocks` của chính user; danh mục cha mở ra mọi danh mục con). **Câu 3a**: phần nội dung (link sách) `visibility: hidden` → không nhận Tab, trình đọc màn hình bỏ qua; chỉ ô mờ + nút "Xem" đọc / bấm được; e2e kiểm link sách bị chặn không nhận focus. Ô mờ **không** dùng thuộc tính `hidden` (Tailwind v4 có `[hidden] { display: none !important }`), hiện / ẩn bằng chính style sinh ra. **Câu 3b**: CSS chỉ dựng từ id số nguyên + tên nhãn enum đã kiểm, không chứa chữ người dùng nhập; Vitest (input bẩn bị loại).
- "Xem": một client leaf nhỏ ở layout bắt click ủy quyền, gắn `data-revealed` cho đúng thẻ (lần xem này). Đo thời gian lộ trên Preview (câu 3).
- Trang sách: nút "Không muốn thấy thể loại / tác giả (vai trò author) / NXB này" + "Ẩn các sách có cảnh báo này" (mọi nhãn của cuốn đó); sách bị chặn → dòng nhắc "Bạn đã chặn …" + bỏ chặn; khách chưa đăng nhập không thấy nút. Chừa chỗ để không CLS.
- Trang Sở thích (`/tai-khoan/so-thich` ↔ `/en/account/preferences`): liệt kê theo nhóm, bỏ chặn.
- Mây lọc ứng viên + thẻ trả về theo mục chặn của người hỏi (câu 10). Palette làm cuối (câu 11).
- e2e: user e2e riêng mỗi lần chạy (xóa ở `finally`), sách e2e riêng; ô mờ cùng kích thước, Xem, tải lại che lại, dòng nhắc, bỏ chặn, khách không thấy nút, người khác không đọc được danh sách chặn.
- Ghi chú từ review P-A (vòng 2): thống nhất thuật ngữ chặn / ẩn ở mọi chỗ: nút "Không muốn thấy …" (hành động), ô mờ "Đã ẩn theo sở thích của bạn" (kết quả), trang "Sở thích" và dòng nhắc "Bạn đã chặn …" dùng cùng một bộ từ trong cả vi / en; rà lại messages trước khi lên main.

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
