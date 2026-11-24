# Đợt mo-ta-sach-ngan (2026-11-24)

Viết mô tả mới (tiếng Việt + tiếng Anh, giọng giới thiệu sách) cho 13 sách thiếu hoặc quá ngắn mô tả, ghi bằng file SQL
dữ liệu `supabase/data/mo-ta-sach-ngan/`. **Không đổi code ứng dụng, không thêm thư viện.** Danh sách 13 sách lấy từ mục 1
của `docs/plans/chuan-bi-demo.md` (mô tả < 80 ký tự một trong hai ngôn ngữ, hoặc trống).

Bản quay về: main `ad04ef2`, Vercel Production deployment 8027040515 (code không đổi; code gần nhất 7974629736). Quay về dữ
liệu: `supabase/data/mo-ta-sach-ngan/vong-1-hoan-tac.sql` (chủ dự án chạy, chỉ khi cần).

## 1. Cũ → mới

Quy tắc viết: chỉ dùng điều đã chắc (trường trong DB: tên, tác giả, phụ đề, NXB, năm, số trang, danh mục; ý của mô tả cũ;
điều người điều khiển đã tra web; kiến thức phổ thông chắc chắn về tác phẩm kinh điển). Không kể cốt truyện khi không chắc,
không hứa đặc điểm bản in (chữ ký, bản giới hạn, hộp, minh họa, số ảnh), không số bản bán / giải thưởng / lời khen, không ghi
tên nguồn tra cứu. Bản Việt và bản Anh cùng ý chính, viết riêng (không dịch từng chữ). 0 cụm ≥ 6 từ liên tiếp trùng mô tả cũ
(so cả hai cột cũ với cả hai bản mới, 26 / 26 bản mới).

Mức chắc chắn: **cao** = nội dung là kiến thức phổ thông về tác phẩm nổi tiếng hoặc đã xác minh nhiều nguồn; **trung bình**
= dựa vào mô tả cũ / phụ đề / một nguồn; **thấp** = gần như chỉ có tên sách và tác giả.

| id | Sách | Ngôn ngữ | Cũ có vấn đề gì (độ dài vi / en) | Mới (độ dài vi / en, tóm ý) | Mức chắc chắn, căn cứ | md5 mới vi / en |
|---|---|---|---|---|---|---|
| 2 | Làm bạn với bầu trời (Nguyễn Nhật Ánh) | vi | chữ Anh trong cột Việt, không có bản Anh (217 / trống) | 421 / 416: truyện dài cho bạn đọc trẻ, NXB Trẻ 2019 (bản Anh: Trẻ Publishing House), 249 trang; rung động đầu đời, lòng trắc ẩn; theo độc giả: cậu bé nhiều tổn thương, thông điệp biết ơn, yêu thương | trung bình: DB, mô tả cũ, nhận xét độc giả / báo chí (tra web) | `2cc75b1a…` / `e52be61a…` |
| 3 | Oxford thương yêu (Dương Thụy) | vi | chữ Anh trong cột Việt, không có bản Anh (268 / trống) | 433 / 465: truyện dài; ấn bản năm 2023 của NXB Trẻ (bản Anh: Trẻ Publishing House; không khẳng định năm ra đời đầu tiên); tình yêu sinh viên Việt Nam và trợ giảng Bồ Đào Nha ở Đại học Oxford; thiên nhiên đẹp, người trẻ trưởng thành ở nước ngoài; kết thúc nhẹ nhàng, có hậu | trung bình: DB, mô tả cũ | `11cc744e…` / `b4a9f30c…` |
| 8 | Kiến, Chuột và Ruồi (Nguyễn Quang Lập) | vi | thiếu hẳn (trống / trống) | 214 / 200 (tối thiểu): tiểu thuyết của nhà văn, nhà biên kịch Nguyễn Quang Lập, ấn bản 2019, 364 trang; một ý có rào: theo một số độc giả, bối cảnh là làng quê Việt Nam thời Cải cách ruộng đất | **thấp**: DB + vài nhận xét độc giả (tra web); không kể cốt truyện | `951ee02b…` / `5d314471…` |
| 20 | Tâm lý đàn bà, lý trí đàn ông (Bruce Bryans) | vi | chữ Anh trong cột Việt, một câu kiểu quảng cáo, không có bản Anh (122 / trống) | 430 / 463: sách tâm lý tình yêu; đàn ông và phụ nữ cảm nhận, suy nghĩ khác nhau; hiểu cảm xúc để xây quan hệ lâu bền; giọng hướng tới bạn đọc nữ trẻ; NXB Lao Động + Tsai Fong Books 2023 (bản Anh: Lao Dong Publishing House and Tsai Fong Books) | trung bình: DB (phụ đề), mô tả cũ | `99797a7b…` / `7cb9a981…` |
| 171 | Hà Nội nhớ thương của tôi (Quan Thế Dân) | vi | chữ Anh trong cột Việt, một câu (67 / trống) | 333 / 409: tập tản văn về nếp sống, phong tục, con người Hà Nội; giọng thương nhớ; NXB Hội Nhà Văn + Tsai Fong Books 2024 (bản Anh: Vietnam Writers' Association Publishing House and Tsai Fong Books) | trung bình: DB, mô tả cũ | `0c7ae994…` / `d12aa13d…` |
| 207 | Men Without Women (Ernest Hemingway) | en | một câu (bản dịch tự động) (79 / 85) | 566 / 567: tập 14 truyện ngắn, in lần đầu 1927; văn câu ngắn, thoại tiết chế, nhiều điều không nói thẳng; đàn ông đối diện thất bại, nỗi đau, cô độc (đấu bò, quyền Anh, trong và sau chiến tranh); có The Killers, Hills Like White Elephants; Simon and Schuster 1997, 160 trang | cao: mô tả cũ (14 truyện), kiến thức phổ thông | `bdeee8c6…` / `82f8c91d…` |
| 209 | F. Scott Fitzgerald: The Great Gatsby | en | một câu (bản dịch tự động) (64 / 61) | 591 / 588: tiểu thuyết 1925, Long Island và New York mùa hè 1922; Nick Carraway kể, Jay Gatsby và tiệc xa hoa, Daisy (em họ của Nick, tình cũ của Gatsby); tình yêu, tiền bạc, giai cấp, giấc mơ Mỹ; Cambridge University Press 1991 (không hứa phần chú thích) | cao: kiến thức phổ thông | `0bdabc25…` / `3cf5b3e8…` |
| 218 | Agatha Christie: Five Complete Murder Mysteries | en | một câu (bản dịch tự động) (74 / 66) | 423 / 435: gộp năm tiểu thuyết trinh thám trọn vẹn, 690 trang, 1990; lối trinh thám cổ điển (án mạng, nhóm nghi phạm, manh mối công bằng, lời giải bất ngờ); hợp người mới làm quen với truyện trinh thám phá án; **không nêu tên năm truyện** (chưa xác minh) | trung bình: tên sách, số trang, kiến thức phổ thông về Christie | `05b8583b…` / `d14acf6e…` |
| 248 | Pathways to Success in Your Professional & Private Lives (Dale Carnegie) | en | thiếu hẳn (trống / trống) | 304 / 304 (một đoạn): sách của Dale Carnegie, tác giả How to Win Friends and Influence People; theo tên sách: ứng xử, giao tiếp, phát triển bản thân trong công việc và đời sống riêng; 1998, 570 trang | **thấp**: chỉ tên sách + tác giả (nội dung chi tiết chưa xác minh) | `7287b1f4…` / `bf5c7c1c…` |
| 272 | Eric Carle's Very Little Library | en | một câu (bản dịch tự động) (44 / 52) | 468 / 513: bộ ba sách tranh nhỏ cho trẻ: The Very Hungry Caterpillar (sâu ăn dần rồi thành bướm), The Very Busy Spider (nhện chăm chỉ giăng tơ), The Very Lonely Firefly (đom đóm cô đơn tìm bạn); tranh cắt dán nhiều màu; không nhắc đèn / hộp / chất liệu bìa | cao: tra web nhiều trang bán sách, kiến thức phổ thông | `ba057649…` / `45e80907…` |
| 281 | Yuval Noah Harari Box Set | en | thiếu hẳn (trống / trống) | 535 / 591: bộ ba Sapiens (lịch sử loài người), Homo Deus (tương lai: công nghệ, dữ liệu, trí tuệ nhân tạo), 21 Lessons for the 21st Century (hiện tại: tin giả, việc làm, tự do, ý nghĩa) | cao: tên bộ sách, kiến thức phổ thông | `c2713f5a…` / `84327523…` |
| 292 | Stephen Hawking Box Set | en | thiếu hẳn (trống / trống) | 444 / 499: bộ hai cuốn A Brief History of Time (thời gian, Vụ Nổ Lớn, lỗ đen cho bạn đọc phổ thông) và The Grand Design (viết cùng Leonard Mlodinow; vì sao có vũ trụ, định luật vật lý, lý thuyết M); Bantam 2014, 512 trang; không nói "hộp", minh họa | trung bình: thành phần bộ từ một nguồn tra web (2014, 512 trang khớp DB); nội dung từng cuốn là kiến thức phổ thông | `eff3afd3…` / `9ee8add1…` |
| 302 | Murmurs of Earth (Carl Sagan và cộng sự) | en | một câu, chỉ lặp phụ đề (36 / 32) | 579 / 596: hai tàu Voyager (1977) mang đĩa mạ vàng ghi âm thanh, hình ảnh gửi nền văn minh ngoài Hệ Mặt Trời; sách 1978 kể cách nhóm của Carl Sagan chọn âm thanh tự nhiên, âm nhạc nhiều nền văn hóa, hình ảnh, lời chào nhiều thứ tiếng | cao: kiến thức phổ thông | `8ce90fe7…` / `8bb25dc5…` |

md5 đầy đủ (32 ký tự) và độ dài kỳ vọng: khối kiểm cuối `vong-1-sach-viet-lai.sql`, `vong-1-kiem.sql`, điều kiện `where`
của `vong-1-hoan-tac.sql` (kiểm nhất quán cả 3 file bằng script: 0 lỗi). md5 bản gốc (cả hai cột) khớp bảng người điều
khiển đọc từ production 2026-11-24 (MCP chỉ đọc).

## 2. Quyết định

- **Yêu cầu chủ dự án 2026-11-24**: mô tả mới cho 13 sách 8, 248, 281, 292, 2, 3, 20, 171, 207, 209, 218, 272, 302; cờ
  `description_auto_translated = false` (bản viết mới).
- **Một file ghi cho 13 sách** (`vong-1-sach-viet-lai.sql`). File lẫn trạng thái: 5 sách đang có bản dịch tự động (cờ true:
  207, 209, 218, 272, 302), 8 sách chưa có `description_en` (cờ false) → khai báo `-- data-check: che-do = viet-lai` (CI chạy
  đường CHƯA GHI cho cả file, không nhận chế độ theo cờ). Không sửa `scripts/ci/`.
- **Cột NULL**: điều kiện `where` của file ghi dùng `description is null` (8, 248, 281, 292) / `description_en is null` (2, 3, 8,
  20, 171, 248, 281, 292), cột có chữ dùng `md5(…) = '<md5 gốc>'`; thêm `language = 'vi' | 'en'` và cờ gốc. Khối kiểm file ghi
  so `is distinct from` với md5 bản mới (cột null → báo `len null/…, cr null`). File hoàn tác gán `null` cho cột trống lúc đọc,
  khối kiểm so `md5(…) is not distinct from <md5 gốc | null>`. File kiểm: cột `vi_null`, `en_null`, `vi_goc` / `en_goc` tính null
  đúng chỗ là gốc.
- Sách Việt 2, 3, 20, 171: cột `description` (tiếng Việt) đang chứa chữ Anh từ Google Books → bản mới: `description` = tiếng
  Việt mới, `description_en` = tiếng Anh mới.
- Tên sách Việt giữ nguyên trong bản Anh (không dịch tên, CLAUDE.md: tên sách không dịch). Tên NXB: bản Việt "NXB …" có dấu
  (NXB Trẻ, NXB Lao Động, NXB Hội Nhà Văn, Tsai Fong Books); bản Anh dạng tiếng Anh, không chữ "NXB" (vòng 2): Trẻ Publishing
  House, Lao Dong Publishing House (tên trong DB: "Lao Dong/Tsai Fong Books"), Vietnam Writers' Association Publishing House
  (Hội Nhà Văn), Tsai Fong Books.

## 3. Kiểm trên máy (vòng 1)

- (d) `node scripts/ci/data-check-text.mjs` file ghi: 13 câu UPDATE, 52 lần `$mota$`, 2 chuỗi / câu, 0 lỗi.
- Nhất quán md5 / độ dài / NULL giữa 3 file (script ngoài repo): 0 lỗi.
- Mô phỏng CRLF (bản sao LF → CRLF, bỏ CR như `replace`): file ghi 12 / 13 câu có CR trong chuỗi (248 một đoạn), 26 / 26 chuỗi
  khớp md5 kỳ vọng; file hoàn tác 13 / 13 câu khớp bản gốc.
- `bash -n scripts/ci/data-check.sh`: đạt. `bash scripts/ci/data-check.sh --plan`: 1 vòng
  (`supabase/data/mo-ta-sach-ngan/vong-1-sach-viet-lai.sql`; bỏ qua chuan-bi-demo, mo-ta-song-ngu vòng 3 / 4 đã chạy production).
- Cụm ≥ 6 từ trùng mô tả cũ: 0 / 26 bản mới.
- CI vòng 1 (commit `07efd3b`): data-check [45399016769](https://github.com/khangnguyen196/nha-sach-may/actions/runs/45399016769)
  xanh (viet-lai: 13 dòng đổi = 13 câu; (e) (a) (b) (f) (g) CRLF đạt); CI check
  [45399016619](https://github.com/khangnguyen196/nha-sach-may/actions/runs/45399016619) xanh.

## 3b. Vòng 2 (sửa theo code-reviewer vòng 1)

Reviewer vòng 1: 0 nghiêm trọng, 2 nên sửa, 6 gợi ý. Đã sửa (chỉ chữ trong `$mota$`; 3 file sinh lại bằng script, md5 / độ
dài bản mới cập nhật ở khối kiểm file ghi, file kiểm, `where` + khối kiểm file hoàn tác; md5 và `where` bản gốc không đổi):

1. **Sách 8** hạ xuống tối thiểu: bỏ câu cuối khẳng định ("dành cho bạn đọc muốn tìm hiểu…") và chi tiết cốt truyện "lớn lên
   từ chuồng bò"; chỉ giữ tác giả, ấn bản 2019, 364 trang và đúng một ý có rào về bối cảnh. Lý do: căn cứ chỉ là vài nhận
   xét độc giả, chi tiết cốt truyện và lời khẳng định không xác minh được nhiều nguồn.
2. **Sách 3**: "Đây là ấn bản năm 2023 của NXB Trẻ" / "This 2023 edition is published by Trẻ Publishing House" (năm trong DB
   là năm của ấn bản, không phải năm ra đời đầu tiên của truyện).
3. **Sách 207**: "trong và sau chiến tranh" / "in and after the war".
4. **Sách 218** bản Việt: "thể loại án mạng bí ẩn" (dịch sát) → "truyện trinh thám phá án".
5. **Tên NXB bản Anh** của 2, 3, 20, 171 nhất quán dạng tiếng Anh, bỏ chữ "NXB" (mục 2).

Kiểm trên máy vòng 2: (d) 0 lỗi (13 câu, 52 lần `$mota$`); nhất quán md5 / độ dài / NULL 3 file 0 lỗi; mô phỏng CRLF 26 / 26
chuỗi (12 câu có CR), hoàn tác 13 / 13; cụm ≥ 6 từ trùng 0 / 26; NFC, không ký tự ẩn, không `$`; `bash -n` đạt, `--plan` 1
vòng; lint sạch. data-check CI vòng 2: chờ push nhánh.

Gợi ý chưa làm:
- Khối kiểm file hoàn tác chỉ báo "khớp được khác 13", chưa báo id / cột lệch như file ghi (không bắt buộc: file hoàn tác chỉ
  chạy khi cần quay lại).
- 272 giữ nguyên: ISBN trong DB 9780399242045 khớp trang bán sách đã xác minh (ba cuốn Very Hungry Caterpillar, Very Busy
  Spider, Very Lonely Firefly).

## 4. Để sau

- Chủ dự án đọc lại 248 (mức chắc chắn thấp, chỉ theo tên sách), 8 (thấp, theo nhận xét độc giả), 3, 20, 171 (dựa mô tả cũ),
  2 (thông điệp theo nhận xét độc giả); sửa trong admin nếu thấy chưa đúng.
- 218: nếu biết năm truyện trong tập thì bổ sung tên truyện.
- Sau đợt này không còn sách nào trong danh sách "mô tả thiếu / quá ngắn" của `docs/plans/chuan-bi-demo.md` mục 1 (15 sách:
  217, 254 đã viết ở chuan-bi-demo, 13 sách ở đợt này); sách nạp thêm sau này có thể lại thiếu mô tả.

## 5. Trạng thái

SQL ghi `vong-1-sach-viet-lai.sql`: **CHƯA chạy production**, chờ data-check xanh và chủ dự án chạy tay.
