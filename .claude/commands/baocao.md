---
description: Soạn báo cáo việc vừa làm (kết quả, kế hoạch hoặc câu hỏi) theo khung cố định để gửi sang phiên review
---
Mục đích: người đọc báo cáo là một phiên review KHÔNG xem được cuộc trò chuyện này. Báo cáo phải tự đủ.

Cú pháp (tham số nằm ở dòng cuối, `$ARGUMENTS`):
- `/baocao`: review từ `git merge-base HEAD origin/main` đến HEAD, không có ghi chú.
- `/baocao <commit>`: review từ `<commit>` đến HEAD.
- `/baocao -- <ghi chú>`: khoảng diff mặc định, kèm ghi chú.
- `/baocao <commit> -- <ghi chú>`: cả hai.
Cách tách: phần trước ` -- ` (hoặc cả chuỗi nếu không có ` -- ` và không bắt đầu bằng `--`) là commit; phần sau ` -- ` là ghi chú.
Chuỗi bắt đầu bằng `--` thì không có commit, ghi chú là phần sau `--` đầu chuỗi. Phần commit phải là một ref git có thật (`git rev-parse --verify <ref>^{commit}`);
không phải thì DỪNG và hỏi lại, không đoán, không coi nó là ghi chú.

Quy tắc chung:
- Xuất đúng khung bên dưới, đủ mọi mục, đúng thứ tự, trong MỘT khối code duy nhất để mình copy.
- Ghi đầy đủ, không tóm tắt, không viết "như đã báo ở trên / tin nhắn trước": chép lại nội dung vào đây.
- Mục nào không có gì thì ghi "Không có".
- Chỉ ghi điều đã kiểm thật (lệnh đã chạy, kết quả đã thấy). Chưa kiểm thì ghi rõ "chưa kiểm".
- KHÔNG sửa code, không commit trong lúc soạn báo cáo.

Bước làm:
1. Chạy `git status`, `git log -1`, `git status -sb` (đã push chưa), và xem nhánh đã merge vào `origin/main` chưa.
2. Xác định khoảng diff để review:
   - Có commit (`/baocao <commit>` hoặc `/baocao <commit> -- <ghi chú>`): từ `<commit>` đến HEAD.
   - Không có commit (`/baocao`, `/baocao -- <ghi chú>`): từ `git merge-base HEAD origin/main` đến HEAD.
   - Cộng thêm file đang sửa chưa commit (nếu có).
3. Nếu khoảng diff hoặc file chưa commit có thay đổi: ghi diff ra một file trong scratchpad
   (`git diff <base>..HEAD > …` và `git diff >> …`; file mới chưa track không có trong `git diff`: liệt kê từ `git status --porcelain` và đưa đường dẫn cho reviewer đọc thẳng). Gọi subagent `code-reviewer` (nó chỉ có Read / Grep / Glob, không chạy được git):
   đưa đường dẫn file diff, danh sách file đổi, file kế hoạch đang làm trong `docs/plans/`, và các điểm cần xem kỹ nếu prompt gần nhất có nêu.
   Yêu cầu báo cáo tiếng Việt, chia 3 mức NGHIÊM TRỌNG / NÊN SỬA / GỢI Ý. Không có thay đổi nào thì không gọi, mục reviewer ghi "Không có".
4. Chọn LOẠI:
   - KẾT QUẢ: đã làm xong (một phần) việc được giao.
   - KẾ HOẠCH: chưa sửa code, đang chờ duyệt kế hoạch (chép NGUYÊN VĂN kế hoạch gần nhất vào mục "Đã làm").
   - CÂU HỎI: đang bị chặn, cần chủ dự án quyết trước khi làm tiếp.

Khung (dòng đầu là một trong ba dòng LOẠI):

LOẠI: KẾT QUẢ. Hãy xem báo cáo (cả phần code-reviewer) và viết prompt bước tiếp theo.
LOẠI: KẾ HOẠCH (chưa sửa code). Hãy review kế hoạch, nếu ổn thì viết prompt để Claude Code bắt đầu làm, có 'xong khi nào' và 'phạm vi sửa'.
LOẠI: CÂU HỎI. Hãy giúp mình quyết các câu hỏi ở mục "Chưa xong / chưa chắc / cần quyết".

== Bối cảnh ==
Dự án, nhánh, worktree (đường dẫn), commit cuối (hash + tiêu đề), đã push chưa, đã merge vào main chưa.

== Đã làm ==
Từng việc theo prompt gần nhất (giữ số / tên việc của prompt): làm gì, file nào đổi, commit nào (hash + tiêu đề).
Có danh sách commit của cả đợt thì liệt kê mỗi commit 1 dòng. Với KẾ HOẠCH: chép nguyên văn kế hoạch.

== Kết quả kiểm tra ==
- typecheck, lint: sạch / lỗi (kèm lỗi).
- Vitest: số qua / tổng (số file).
- e2e CI: qua / skip / fail / flaky, kèm link run. Có test fail thì chép tên test + thông báo lỗi.
- measure:js (nếu có đo): bảng trước / sau từng route, chênh lệch, ngân sách của route.

== Test ==
- Test mới (tên test, file).
- Test đổi chuỗi expected: cũ → mới, từng dòng.
- Xác nhận không xóa / skip / nới test nào (nếu có thì ghi rõ và lý do).

== SQL / dữ liệu ==
File SQL mới hoặc đã đổi, kèm link raw GitHub theo nhánh
(`https://raw.githubusercontent.com/<owner>/<repo>/<nhánh>/<đường dẫn>`).
Mỗi file ghi rõ "CHƯA chạy, chờ người duyệt" (hoặc đã chạy khi nào, ai chạy, kết quả câu kiểm tra).

== Người cần làm ==
- Test tay trên web: URL, thao tác, kết quả mong đợi (từng mục).
- SQL cần chạy (thứ tự, câu kiểm tra đi kèm).
- Quyết định cần đưa ra.

== Dọn dẹp / an toàn ==
- Hard link `.env.local`: có tạo không; đã xóa chưa (`fsutil hardlink list` trên file gốc chỉ còn 1 đường dẫn).
- `git status` sạch (worktree và thư mục chính).
- Diff không có key / token / mật khẩu (đã grep).
- Nhánh tạm / file tạm đã xóa chưa (local + remote).

== Chưa xong / chưa chắc / cần quyết ==

== Báo cáo code-reviewer ==
Chép NGUYÊN VĂN báo cáo của subagent, giữ 3 mức NGHIÊM TRỌNG / NÊN SỬA / GỢI Ý. Ghi khoảng diff đã review.

Ghi chú (nếu có) đưa vào mục phù hợp của báo cáo; yêu cầu thêm trong ghi chú thì làm theo, nhưng không vượt "Quy tắc chung" (vẫn không sửa code, không commit).

Tham số: $ARGUMENTS
