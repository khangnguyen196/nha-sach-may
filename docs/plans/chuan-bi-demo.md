# Đợt chuan-bi-demo (2026-11-24)

Chuẩn bị web để demo trước lớp. **Không đổi code tính năng, không thêm thư viện.** Đợt gồm: kiểm production chỉ đọc,
viết lại mô tả 7 sách bằng file SQL dữ liệu, mở rộng CI data-check cho trường hợp "viết lại", kịch bản demo (`docs/demo.md`),
kiểm web thật chỉ đọc.

Bản quay về: main `0a209ad`, Vercel Production deployment 7974629736 (code `0180410`). Quay về dữ liệu:
`supabase/data/chuan-bi-demo/vong-1-hoan-tac.sql` (chủ dự án chạy, chỉ khi cần).

## 1. Kiểm production (MCP supabase chỉ đọc, 2026-11-24, không có dữ liệu cá nhân)

Tổng: 189 sách đang bán (72 Việt + 117 Anh), 24 danh mục, 0 sách thiếu bìa, 0 bìa chưa đo.

| Mục | Kết quả | Việc trước demo |
|---|---|---|
| Bìa mờ (`cover_width` < 300) | 63 sách (29 Việt + 34 Anh), rộng 128px (riêng id 38: 180px); danh sách ở dưới | thay bìa trong admin, ưu tiên sách trong kịch bản / trang chủ |
| Mô tả thiếu / quá ngắn (< 80 ký tự một trong hai ngôn ngữ) | 15 sách. Thiếu hẳn: 8 Kiến, Chuột và Ruồi; 248 Pathways to Success; 281 Yuval Noah Harari Box Set; 292 Stephen Hawking Box Set. Ngắn: 2, 3, 20, 171 (Việt); 207, 209, 218, 272, 302 (Anh). 217, 254: viết lại ở đợt này | để sau (mục Để sau) |
| Giá 0 / giá gốc thấp hơn giá bán | không có | — |
| Hết hàng (stock 0) | 10 sách: 12, 15, 18, 20, 171 (Việt); 231, 244 Atomic Habits, 245, 256, 286 (Anh) | không dùng 244 khi đặt hàng, hoặc nạp tồn trước |
| Danh mục đang hiện mà 0 cuốn | 1: Marketing - Bán hàng (`marketing-ban-hang`, con của Kinh tế) | ẩn hoặc để nguyên |
| Mã giảm giá công khai trong gợi ý | 3: GIAM20K (giảm 20.000₫, đơn từ 200.000₫, mã thật); TEST10 (giảm 10%, **trông như mã thử**); MCKKKKKKK (giảm 50% tối đa 5.000.000₫, không điều kiện, **mã thử, rủi ro cao**). Cả 3 không hạn dùng | tắt MCKKKKKKK; TEST10 giữ (quyết định đã chốt, chủ dự án có thể quyết lại) |
| Kệ Nổi bật | 8 sách, **0 sách Việt**: 295, 299, 303, 304, 305 At Home (bìa mờ), 306, 307, 308 | đánh dấu vài sách Việt Nổi bật |
| Chợ sách cũ | 0 tin đang bán; 1 chờ duyệt, 1 đã bán, 3 đã rút | đăng 2–3 tin thật rồi duyệt |

Bìa mờ, sách Việt (29): 2 Làm bạn với bầu trời · 3 Oxford thương yêu · 4 Cầm Thư quán · 5 Tư liệu văn hiến Thăng Long - Hà
Nội · 8 Kiến, Chuột và Ruồi · 11 Khắc họa bức tranh lịch sử Nam Kỳ · 12 Bước Qua Nước Mắt, Tự Khắc Trưởng Thành · 13 Ngôn
Ngữ - Tuyển Tập Truyện Ngắn Chọn Lọc 2025 · 14 Những Truyện Ngắn Hay Nhất Của Quê Hương Chúng Ta · 16 Truyện Kiều · 17 Bí
quyết xây dựng và quản trị thành công chuỗi cửa hàng dịch vụ sửa chữa xe máy · 19 Cách Mạng Pháp Và Tâm Lý Học Của Các Cuộc
Cách Mạng · 20 Tâm lý đàn bà, lý trí đàn ông · 34 Lịch Sử Việt Nam Thời Tự Chủ - Tập Một · 35 Lao động di cư trong lịch sử
Việt Nam thời Pháp thuộc · 37 Lịch sử chữ quốc ngữ (1615-1919) · 38 100 câu hỏi về lịch sử chữ Quốc ngữ (180px) · 39 Lịch Sử
Việt Nam Thời Tự Chủ - Tập Hai (bìa cứng) · 40 Đạo giáo · 43 Đất nước Việt Nam qua các đời · 44 Văn hóa là gì? · 45 Nguồn
gốc dân tộc Việt Nam · 49 Sự Trả Thù Của Địa Lý · 169 Hiến Pháp Mỹ Được Làm Ra Như Thế Nào? · 171 Hà Nội nhớ thương của tôi ·
174 Rich Habits – Thói quen thành công của những triệu phú tự thân · 188 Lịch Sử Việt Nam Qua Tư Liệu Nước Ngoài · 189 Lịch
Sử Việt Nam Thời Tự Chủ - Tập Hai · 190 Việt Nam: Lịch sử không biên giới.

Bìa mờ, sách Anh (34): 193 Animal Farm · 198 Jane Austen · 203 Hard-Boiled Wonderland and the End of the World · 205 The
Wind-Up Bird Chronicle · 206 A Moveable Feast · 207 Men Without Women · 212 F. Scott Fitzgerald On Writing · 215 The Complete
Khaled Hosseini Box Set · 216 Death Comes as the End · 217 The Agatha Christie Collection · 221 Peter F. Drucker Boxed Set (8
Books) · 225 Peter F. Drucker on Business and Society · 227 Peter F. Drucker on Management Essentials · 228 Peter F. Drucker
on Technology · 234 Built to Last · 245 Leadership Mastery · 248 Pathways to Success in Your Professional & Private Lives ·
249 Dale Carnegie Omnibus Vol. 2 · 258 How Not to Be a Twit and Other Wisdom from Roald Dahl · 259 Roald Dahl: Lift-The-Flap
Hide and Seek · 260 Charlie and the Chocolate Factory: The Roald Dahl Clothbound Collection · 261 Roald Dahl's Rotsome and
Repulsant Words · 265 Dr. Seuss Discovers: The Human Body · 269 Dr. Seuss's Sleep Softly Book · 270 Dr. Seuss's 1 2 3 · 272
Eric Carle's Very Little Library · 276 Eric Carle's How Things Grow · 277 The Very Hungry Caterpillar's Favorite Words · 278
The Very Eric Carle Treasury · 285 The Grand Design · 288 The Illustrated Brief History of Time · 290 Black Holes and Baby
Universes · 292 Stephen Hawking Box Set · 305 At Home (kệ Nổi bật).

## 2. Viết lại mô tả 7 sách (`supabase/data/chuan-bi-demo/`, CHƯA chạy production)

Cả 7 là sách ngoại văn (`language = 'en'`). Bản mới viết mới cả hai ngôn ngữ (không dịch blurb của nhà phát hành), 2–3
đoạn, chỉ nêu điều chắc chắn về nội dung (chủ đề, nhân vật, bố cục); không chữ ký / bản giới hạn / hộp / minh họa / số ảnh,
không ngày ra mắt / đặt trước, không số bản đã bán, không trích lời khen. Cờ `description_auto_translated = false` (bản viết
mới, không phải bản dịch tự động, nên trang không hiện dòng "Bản dịch tự động").

| id | Sách | Bản cũ có vấn đề gì | Bản mới (độ dài vi / en, ký tự) |
|---|---|---|---|
| 213 | And the Mountains Echoed (Khaled Hosseini) | blurb nhà phát hành (dịch tự động), hứa "ấn bản giới hạn có chữ ký, hộp bìa vải" | Afghanistan 1952, anh em Abdullah và Pari, cuộc chia ly ở Kabul, câu chuyện nhiều thế hệ, nhiều người kể, từ Kabul tới Paris, California, một hòn đảo Hy Lạp (651 / 715; vòng 2: câu Abdullah thay cha mẹ chăm em, viết lại câu chuyến đi tới Kabul) |
| 216 | Death Comes as the End (Agatha Christie) | chép blurb, hứa "ấn bản giới hạn 800 bản", số tập trong bộ sưu tập | trinh thám ở Ai Cập cổ đại, Renisenb, gia đình Imhotep, người vợ lẽ Nofret, những cái chết nối tiếp, không có thám tử nổi tiếng (649 / 678; vòng 2: "anh em trai", "đanh đá") |
| 217 | The Agatha Christie Collection | cột tiếng Việt là tiểu sử Wikipedia tiếng Anh + mục lục (2878 ký tự), không nói gì về 2 truyện; không có bản tiếng Anh | tuyển tập 2 tiểu thuyết đầu tay: The Mysterious Affair at Styles (Poirot lần đầu xuất hiện, Hastings kể) và The Secret Adversary (Tommy và Tuppence, Mr. Brown) (783 / 855) |
| 234 | Built to Last (Jim Collins, Jerry Porras) | cả hai bản bị cắt giữa câu, mở đầu bằng phủ định, không nói sách là gì | nghiên cứu ở Stanford, 18 công ty có tầm nhìn so với đối thủ cùng thời; giữ cốt lõi / thúc đẩy tiến bộ, mục tiêu lớn táo bạo, "xây đồng hồ thay vì xem giờ" (753 / 762) |
| 244 | Atomic Habits (James Clear) | quảng cáo hết hạn (workbook, đặt trước), chép lời khen kèm tên người khen, số bản đã bán; 2011 ký tự | cải thiện nhỏ cộng dồn, hệ thống hơn mục tiêu, thói quen gắn với bản sắc, bốn quy luật thay đổi hành vi / Four Laws of Behavior Change (rõ ràng, hấp dẫn, dễ dàng, thỏa mãn) và cách đảo ngược (693 / 695; vòng 2: dùng thuật ngữ của sách) |
| 254 | The SPEED of Trust (Stephen M. R. Covey) | chỉ là ghi chú thư viện (45 ký tự), không có bản tiếng Anh | niềm tin ảnh hưởng tốc độ và chi phí, 4 yếu tố đáng tin (chính trực, ý định, năng lực, kết quả), 13 hành vi, các tầng của niềm tin (682 / 731) |
| 280 | Sapiens (Yuval Noah Harari) | chép blurb, hứa "ấn bản chính thức Mỹ, minh họa màu", số ảnh / bản đồ, lời chọn đọc của người nổi tiếng | cách mạng nhận thức, nông nghiệp, sự hợp nhất loài người (tiền, đế quốc, tôn giáo), cách mạng khoa học (678 / 735) |

md5 bản gốc (cả hai cột) khớp bảng kiểm production 2026-11-24; md5 bản mới ghi trong khối kiểm của file ghi, trong
`vong-1-kiem.sql` và điều kiện `where` của `vong-1-hoan-tac.sql` (vòng 2 tính lại cho 213, 216, 244 và kiểm nhất quán
cả 3 file bằng script). Vòng 2 rà bản mới với bản gốc: 0 cụm ≥ 6 từ liên tiếp trùng (cả vi lẫn en, 7 sách).

## 3. Quyết định

- **Quyết định chủ dự án 2026-11-24** (yêu cầu đợt này): viết lại mô tả cả 7 sách bằng file SQL dữ liệu, thay quyết định
  2026-11-20 "giữ 217, 254 (không ghi SQL ở vòng 4); 5 cuốn còn lại sửa trong admin để sau".
- **Một file ghi cho 7 sách** (`vong-1-sach-viet-lai.sql`): mỗi câu điều kiện md5 bản gốc cả hai cột + cờ gốc, khối kiểm đủ
  7 id. 5 sách đang có bản dịch tự động (cờ true) và 2 sách chưa có (`description_en` null, cờ false) nằm chung một file.
- **data-check chế độ `viet-lai`** (khai báo `-- data-check: che-do = viet-lai` trong file ghi): CI cũ nhận chế độ theo cờ
  (CHƯA GHI / ĐÃ GHI), file này "lẫn lộn" nên sẽ đỏ, và chế độ ĐÃ GHI kỳ vọng ghi 0 dòng. Khai báo viet-lai bỏ bước nhận chế độ,
  cả vòng chạy đường CHƯA GHI (không dựa vào cờ): (e) sửa mô tả gốc → lỗi P0001, 0 dòng → ghi = 7 → lần 2 = 0 → hoàn tác về
  đúng bản chụp production → hoàn tác lần 2 = 0 → ghi lại → lần 2 = 0.
- **Danh sách đã chạy production** (`supabase/data/da-chay-production.txt`): CI chạy lại mọi vòng dưới `supabase/data/` mỗi
  lần push. Vòng 3 / 4 của mo-ta-song-ngu đã chạy production 2026-11-20; sau khi chủ dự án chạy file của đợt này, 5 sách của
  vòng 4 (213, 216, 234, 244 ở `vong-4-sach-en-1.sql`, 280 ở `vong-4-sach-en-2.sql`) bị viết lại → data-check vòng 4 sẽ đỏ
  mãi (khối kiểm md5 của file vòng 4). Push nay bỏ qua vòng có mọi file ghi trong danh sách; chạy tay một file vẫn kiểm,
  kèm cảnh báo. Sau khi chạy file ghi của đợt này, thêm `vong-1-sach-viet-lai.sql` vào danh sách (commit docs cuối).
- **Hoàn tác chứa bản gốc** (chép nguyên văn, sinh bằng script từ bản đọc production): CI kiểm được hoàn tác về đúng bản
  chụp production. Đổi lại, bản gốc (blurb nhà phát hành, tiểu sử Wikipedia) nằm trong repo công khai; đây là dữ liệu đang /
  đã hiện công khai trên web, chấp nhận. Bản gốc không có CR / LF / `$$` nên chép thẳng trong `$mota$…$mota$` (từ vòng 3
  bọc `replace(…, chr(13), '')` như file ghi, mục 7).
- Mô tả tiếng Việt cho sách Anh viết thẳng bằng tiếng Việt (cùng ý chính với bản Anh), không dịch máy.

## 4. Để sau

- Mô tả thiếu / quá ngắn của 13 sách còn lại ở mục 1 (8, 248, 281, 292 thiếu hẳn; 2, 3, 20, 171, 207, 209, 218, 272, 302
  ngắn).
- 63 bìa mờ: chủ dự án thay dần trong admin (quyết định đã chốt "làm từ từ").
- `import:books` vẫn ghi sách ngoại văn theo kiểu cũ (CLAUDE.md mục Dữ liệu): sửa trước khi nạp thêm sách ngoại văn.
- Bước 2 (Supabase local) của data-check vẫn chạy khi 0 vòng cần kiểm (tốn ~2–3 phút CI); có thể bỏ qua bằng điều kiện
  `if` sau này nếu thấy cần.
- Cân nhắc thêm sha256 vào mỗi dòng `supabase/data/da-chay-production.txt` để data-check phát hiện file đã chạy production
  bị sửa nhầm sau đó.

## 5. Kết quả kiểm web thật (chỉ đọc)

2026-11-24, production https://nha-sach-may.vercel.app (deployment 7974629736, trước khi chạy SQL của đợt này). Khách, không
đăng nhập, không thêm giỏ. Công cụ: `curl` GET (không theo chuyển hướng) + script Playwright (thư viện, đặt ngoài repo),
viewport 390 và 1440, giao diện sáng; mỗi trang chờ tải xong, cuộn hết trang cho ảnh lười tải rồi đo.

| Trang | curl | Trình duyệt (390 / 1440) | h1 | Console lỗi | Tràn ngang (390 / 1440) | Ảnh lỗi |
|---|---|---|---|---|---|---|
| `/` | 200 | 200 / 200 | Nhà Sách Mây — … | 0 | không / không | 0 / 97 |
| `/tim-kiem?q=nguyen+nhat+anh` | 200 | 200 / 200 | Tìm kiếm (2 cuốn: Sương Khói Quê Nhà, Làm bạn với bầu trời) | 0 | không / không | 0 |
| `/sach/sapiens` | 200 | 200 / 200 | Sapiens | 0 | không / không | 0 / 13 |
| `/en/books/sapiens` | 200 | 200 / 200 | Sapiens | 0 | không / không | 0 / 13 |
| `/gio-hang` | 200 | 200 / 200 | Giỏ hàng (trống) | 0 | không / không | 0 |
| `/thanh-toan` | 307 → `/dang-nhap?next=%2Fthanh-toan` | về `/dang-nhap?next=%2Fthanh-toan`, 200 | Đăng nhập | 0 | không / không | 0 |
| `/cho-sach-cu` | 200 | 200 / 200 | Chợ sách cũ (0 ảnh: chưa có tin đang bán) | 0 | không / không | 0 |
| `/danh-muc/kinh-te` | 200 | 200 / 200 | Kinh tế | 0 | không / không | 0 / 3 |
| `/dang-nhap` | 200 | 200 / 200 | Đăng nhập | 0 | không / không | 0 |
| `/en` | 200 | 200 / 200 | Nhà Sách Mây — … | 0 | không / không | 0 / 97 |

Ảnh chụp (màn hình đầu, 20 ảnh `<trang>-<390|1440>.png`): `D:\Bán sách-backup\chuan-bi-demo\`. Trang cần đăng nhập
(`/tai-khoan/…`, `/admin/…`) và bong bóng Mây: chủ dự án tự kiểm tay (không đăng nhập, không mở chatbot khi kiểm tự động).
Còn phải kiểm lại `/sach/<slug>` 7 sách sau khi chạy file SQL.

## 6. data-check

- data-check 45373856244 (nhánh tạm `chuan-bi-demo-red` @`5f28ded`, file ghi chưa bọc `replace`): ĐỎ đúng ở "(g) CRLF ghi"
  (tái hiện sự cố).
- data-check 45374123528 (@`cb1f018`): xanh đủ (e)(a)(b)(f)(g).
- data-check 45375804103 (@`6f748e2`, khối kiểm mới báo len / cr): xanh, KẾT QUẢ ĐẠT, (g) CRLF ghi 7 dòng = 7 câu.
- CI check 45375803708 (@`6f748e2`): xanh.

Trên máy: `--plan` bỏ qua vòng 3 / 4, ra đúng 1 vòng
(`supabase/data/chuan-bi-demo/vong-1-sach-viet-lai.sql`); (d) 0 lỗi (7 câu, 2 chuỗi / câu, 28 lần `$mota$`).

## 7. Sự cố CRLF khi chạy production (2026-11-24, vòng 3)

- **Chuyện gì xảy ra**: chủ dự án chạy `vong-1-sach-viet-lai.sql` (main `b114aea`, data-check xanh) trong SQL Editor, chép
  file bằng `Get-Content -Raw | Set-Clipboard` (theo tóm tắt của chủ dự án; lệnh người điều khiển đưa có `-Encoding UTF8`,
  chưa rõ lệnh thật đã chạy) rồi Ctrl+V. Khối kiểm cuối file báo P0001 "khop duoc khac 7" → cả file
  rollback, DB không đổi (người điều khiển kiểm lại bằng MCP chỉ đọc: 7 sách còn đúng md5 / cờ bản gốc, không có CR).
- **Nghi nguyên nhân** (suy ra, khớp mô phỏng; chưa xác nhận, còn khả năng lỗi bảng mã: chủ dự án tóm tắt lệnh chép không
  có `-Encoding utf8`, Windows PowerShell 5.1 thiếu tham số này đọc UTF-8 không BOM theo bảng mã ANSI → chữ Việt hỏng → md5
  cũng lệch ở cả 7 sách; câu lỗi lúc đó không phân biệt được hai khả năng): mô tả mới có 3 đoạn (LF giữa đoạn); đường clipboard Windows / ô soạn của SQL
  Editor đổi xuống dòng thành CRLF, kể cả trong chuỗi `$mota$` → giá trị ghi vào có CR → md5 lệch md5 kỳ vọng (tính trên
  bản LF). Điều kiện `where` (md5 bản gốc) không bị ảnh hưởng vì bản gốc không xuống dòng. CI đọc file LF nên xanh.
  Mô phỏng trên máy (node, bản sao `sed 's/$/\r/'` ngoài repo): bản `b114aea` → 7 câu có CR trong chuỗi, khớp md5 kỳ vọng
  0 / 7 (khối kiểm raise); bản vòng 3 (bọc `replace`) → khớp 7 / 7.
- **Sửa (vòng 3)**: 14 chuỗi mô tả mới của file ghi và 12 chuỗi gốc của file hoàn tác bọc `replace(…, chr(13), '')`; md5
  kỳ vọng, điều kiện `where` và ý nghĩa khối kiểm giữ nguyên. Khối kiểm của file ghi tính thêm danh sách id + cột lệch
  (`vi` / `en` / `co` / `khong-co-sach`) vào câu báo lỗi, không in mô tả. data-check thêm bước **(g) CRLF** (đường CHƯA
  GHI): bản sao CRLF của file hoàn tác (về đúng bản chụp đầu, lần 2 = 0) và file ghi (= 7 dòng, cùng md5 từng dòng với lần
  ghi LF, lần 2 = 0). (d) không đổi (bọc `replace` không ảnh hưởng (d)).
- **Bài học**: CI phải chạy file theo đúng đường chủ dự án chạy (dán trên Windows), không chỉ đọc file trong repo. Quy ước
  chung cho mọi file SQL dữ liệu sau này: `supabase/data/README.md` (một câu ở CLAUDE.md mục Database).
- Thử đỏ / xanh của (g) trên CI: nhánh tạm `chuan-bi-demo-red` @`5f28ded` (file ghi chưa bọc): data-check 45373856244
  ĐỎ đúng ở "(g) CRLF ghi" (tái hiện sự cố); @`cb1f018`: data-check 45374123528 xanh đủ (e)(a)(b)(f)(g); nhánh tạm đã xóa.
- **Vòng 4** (theo code-reviewer vòng 3): bọc `replace` chỉ chữa CRLF, không chữa lỗi bảng mã. (a) Khối kiểm file ghi báo
  mỗi cột lệch kèm độ dài thực / kỳ vọng và số CR, VD `213:vi(len 655/651, cr 4)` (độ dài kỳ vọng là hằng trong `values`,
  số ký tự bản LF; tính bằng node từ chính chuỗi trong file, NFC, không ký tự ngoài BMP nên trùng `length()` của Postgres):
  len = kỳ vọng + cr, cr > 0 → CRLF; len lệch, cr = 0 → bảng mã / ký tự; bằng nhau → lý do khác. Mô phỏng node: CRLF không
  bọc → 14 cột `len +4, cr 4`; đọc sai bảng mã windows-1252 → 7 cột `vi` (+ `234:en`, có ngoặc kép cong) `len` lớn hơn,
  `cr 0`. Khối kiểm của file hoàn tác giữ nguyên (khối đơn giản, không có chuỗi lech). (b) Lệnh chép luôn có
  `-Encoding utf8` (BẮT BUỘC với Windows PowerShell 5.1) + bước thử đường chép bằng file chỉ đọc
  `D:\Bán sách-backup\chuan-bi-demo\paste-test.sql` trước khi chạy file ghi (`supabase/data/README.md`).
