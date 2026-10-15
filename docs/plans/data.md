# Dữ liệu sách: trạng thái và việc còn lại

## Đã có (2026-10-15)

- **189 sách** = 49 (lượt C, `scripts/out/preview-approved.json`) + 140 (lượt A + D, `scripts/out/preview-approved-ad.json`).
- Bìa lượt C: 22 rộng 128px (12 fallback ảnh nhỏ + 10 "ảnh lớn" mà Google chỉ có 128px), 27 WebP 600px.
- Bìa lượt A + D (đo chiều rộng thật của object trong Storage): 78 × 600px, 54 × 128px, 8 cỡ giữa (300–575px). Script báo 131 "ảnh lớn" + 9 fallback ảnh nhỏ, nhưng nhiều "ảnh lớn" của sách tiếng Anh cũng chỉ 128px.

## Lượt A + D (2026-10-15)

`npm run import:books -- --dry-run --hires-covers --max-requests 950`: 387 request Books API (search + 223 ảnh lớn). 328 sách → bỏ 33 đã có trong DB → gộp ấn bản 285 → giới hạn 40/danh mục 223. Duyệt tay: **giữ 140, loại 83**, chuyển danh mục 12, sửa tên 5, thêm tác giả 1. `--from-preview`: thêm 140 sách, 62 tác giả, 52 NXB, 0 lỗi bìa.

| Danh mục | Trước | Sau | Bìa 600px | Bìa 128px | Cỡ giữa |
|---|---:|---:|---:|---:|---:|
| tieu-thuyet | 4 | 4 | | | |
| truyen-ngan-tan-van | 11 | 20 | 8 | 1 | |
| tho | 2 | 2 | | | |
| quan-tri-lanh-dao | 1 | 2 | | | 1 |
| marketing-ban-hang | 0 | 0 | | | |
| tai-chinh-ca-nhan | 0 | 1 | 1 | | |
| ky-nang-song | 2 | 4 | 1 | 1 | |
| tam-ly-hoc | 1 | 1 | | | |
| truyen-tranh | 3 | 4 | 1 | | |
| kien-thuc-bach-khoa | 4 | 5 | 1 | | |
| tieng-anh | 0 | 3 | 2 | 1 | |
| tieng-nhat | 1 | 1 | | | |
| lich-su-dia-ly | 20 | 25 | 1 | 4 | |
| ngoai-van-van-hoc | 0 | 29 | 14 | 14 | 1 |
| ngoai-van-kinh-doanh | 0 | 24 | 17 | 5 | 2 |
| ngoai-van-ky-nang-song | 0 | 14 | 9 | 4 | 1 |
| ngoai-van-thieu-nhi | 0 | 21 | 4 | 17 | |
| ngoai-van-lich-su-khoa-hoc | 0 | 29 | 19 | 7 | 3 |
| **Tổng** | **49** | **189** | **78** | **54** | **8** |

Cột bìa chỉ tính sách của lượt này. Kiểm tra sau import: `/danh-muc/sach-ngoai-van` (117 sách), `/en/categories/sach-ngoai-van`, `/sach/sapiens`, `/en/books/sapiens`, `/sach/contact`, `/sach/hien-phap-my-duoc-lam-ra-nhu-the-nao`, `/sach/chuyen-cu-ha-noi-phan-1`, `/en/books/george-orwell-notes-on-nationalism`: HTTP 200, bìa từ `book-covers/<isbn>.webp`.

### Đã loại (83)

Số là chỉ mục trong `scripts/out/preview-hires.json` của lượt này.

- **Báo cáo chính sách** (2): 0 Báo cáo Kinh tế của OECD: Việt Nam 2023; 13 Đánh giá của OECD về Quản trị Công ty trong DNNN.
- **Nghiên cứu / phê bình, không phải tác phẩm** (7): 1 Phong Hóa thời hiện đại; 3 Hậu khoa cử; 4 Sáng Tạo Trong Tình Thế Chuyển Đổi; 10 Đọc truyện ngắn; 12 Để gió cuốn đi (Trịnh Công Sơn & Bob Dylan); 54 The Talk in Jane Austen; 57 Duologues and Scenes from the Novels of Jane Austen (chuyển thể của người khác).
- **Tên không dấu, tự xuất bản Lulu / MintRight** (8): 2 Tu Luc Van Doan Ca Cac Cay But Hau Due; 7 Truyen ngan - Nguoi me tot hon la nguoi thay tot; 8 Tan van Bong Oi Gio Bay; 11 Hen Nhau truoc Giao Thua; 24 Truyen ngan - Nu hoang va ke cuop; 25 Truyen ngan - Me luon dong hanh cung con; 35 Truyen ngon tinh - Cau chu ho do; 42 SIEU QUOC GIA VIET NAM.
- **Lạc chủ đề** (14): 14 Nghệ Thuật Lãnh Đạo (sách truyền giáo); 16 Phương Pháp Hẹn Hò Nammolla 82 (tài chính cá nhân); 18, 19 kỷ yếu Phật học (kỹ năng sống); 20 Rien c'est quelque chose ? (tiếng Pháp); 23 Vi Diệu Pháp (tâm lý học); 37 Welcome to the United States (tài liệu nhập cư, không tác giả); 217, 222 hai từ điển cho người viết của Bill Bryson; 219 Bill Bryson the Complete Notes, 221 The Lost Continent (du ký, không phải lịch sử / khoa học); 76 The Professor's House / the Great Gatsby (so sánh, tự xuất bản); 77 The Kite Runner: A Portrait of the Marc Forster Film (sách về phim); 137 Quotes & Quips.
- **Lỗi mã hóa / tên không phải tiếng Anh** (6): 21 ÐẠo PhẬt CỦa TuỔi TrẺ (tác giả "Thích Nh¿t H¿nh"); 174–177, 180 các bản dịch máy "C. S. Lewis (1898-1963) - …" (Thổ Nhĩ Kỳ, Yoruba, Croatia, Litva, Phần Lan).
- **Study guide / companion / workbook / sách viết về tác giả** (9): 51 Nineteen Eighty-four Guide; 82 Bookclub-in-a-box Discussion Companion (The Kite Runner); 93 Peter F Drucker: The Landmarks of His Ideas; 121 James Clear Memoir; 135 The 7 Habits Journal; 141 Focus (tài liệu khóa học); 149 Roald Dahl Creative Writing with the Twits; 153 A Literature Kit for James and the Giant Peach; 198 A Brief History of Time (Spark Publishing = SparkNotes).
- **Ebook / audio, không phải sách in** (10): 47 The George Orwell Collection (eBook Bundle); 60 The Paulo Coelho Collection; 80 The Complete Khaled Hosseini (Digital box set); 131 Dale Carnegie's Radio Program; 139 Stephen Covey Masterclass; 154, 163 Dr. Seuss "Read & Listen Edition"; 189 Sapiens and Homo Deus: The E-book Collection; 195 Brief History of Time (Kindle); 214 Bill Bryson the Complete (CCV Digital).
- **Không phải sách đọc** (4): 152 Roald Dahl Address Book; 164 Eric Carle Animal Family, 2000 (lịch); 169 The Eric Carle Diary 2009; 173 Eric Carle Color Me Puzzle.
- **Sách người lớn trong danh mục thiếu nhi** (6): 147 An African Story; 150 The Roald Dahl Omnibus; 178 All My Road Before Me; 179 The C. S. Lewis Signature Classics; 181 Mere Christianity; 182 The Collected Letters of C.S. Lewis, Vol. 3.
- **Trùng tên tác giả khác** (5, "inauthor:Jim Collins"): 107 The Strange Story of Uri Geller; 108 Uncommon Cultures; 109 Architectures of Excess; 112 Unidentified Flying Objects; 113 Fallen.
- **Trùng tác phẩm với ấn bản khác trong lượt** (12, giữ bản trong ngoặc): 38 21 Cách Học Tiếng Anh Du Kích (#36 bản song ngữ); 48 Keep the Aspiridistra Flying (tên sai chính tả, bản in lại); 70 MEN WITHOUT WOMEN (#68); 75 The Great Gatsby (English Edition) (#71); 97 The Practice Of Management 1975 (#89); 102 Management Rev Ed (#90); 117 Leaders Eat Last Deluxe (#118); 119 Start with Why 15th Anniversary (#116); 123 "Atomic Habits … by James Clear" (#122, tên dạng bản tóm tắt); 136 The 7 Habits (Mango Media) (#142); 187, 188 hai bộ Harari trùng (#185).

### Đã sửa trong file duyệt

- Chuyển danh mục (12): 7 sách Tô Hoài (Chuyện cũ Hà Nội 1–2, Tô Hoài tự truyện, Ký ức phiên lãng, Lá thư tình đầu tiên, Thành phố gương mặt con người, Giăng thề) `truyen-tranh` → `truyen-ngan-tan-van` (truy vấn "Tô Hoài" kéo về sách văn xuôi cho người lớn); Hiến Pháp Mỹ Được Làm Ra Như Thế Nào? → `lich-su-dia-ly`; Cha Mẹ 5.0 → `tai-chinh-ca-nhan`; Coding 6 Lập trình với Scratch 3 → `kien-thuc-bach-khoa`; Ngoại ngữ khó đấy, nhưng bạn tự học được (`tieng-nhat`, nội dung Anh / Trung) → `tieng-anh`; Contact (Carl Sagan, tiểu thuyết) → `ngoai-van-van-hoc`.
- Sửa tên (5): bỏ hậu tố tác giả / quy cách in ("- Nguyễn Cảnh Bình", "(softcover)", "(lightweight paper - soft cover)", "George Orwell: … (English Edition)"), tên viết HOA toàn bộ → viết thường. Slug bỏ hậu tố theo.
- Dr. Seuss's Sleep Book: Google không có tác giả → thêm "Dr. Seuss".

### Bìa cần thay trong admin (soát bằng ảnh lưới 140 bìa)

- Trang lót toàn chữ (JPEG, bộ lọc PNG < 40KB không bắt được): **The SPEED of Trust**, **The 8th Habit**, **Contact**.
- Sai sách: **Yuval Noah Harari Box Set (Sapiens, Homo Deus, 21 Lessons…)** hiện bìa hộp "HBR's 10 Must Reads".
- Ảnh lạ, không giống bìa: **Ngoại ngữ khó đấy, nhưng bạn tự học được**.

### Gợi ý cho lượt sau (chưa làm)

- `inauthor:Jim Collins` trả nhiều tác giả trùng tên → thêm từ khóa ("inauthor:Jim Collins good to great" hoặc tên sách). `inauthor:C.S. Lewis` toàn sách thần học / bản dịch máy → "inauthor:C.S. Lewis Narnia". 0 kết quả: J.K. Rowling, Jeff Kinney, Daniel Kahneman, Morgan Housel, Robert Kiyosaki, Mark Manson, Brené Brown, Cal Newport, Jared Diamond, Siddhartha Mukherjee.
- Mở rộng `isDerivativeTitle` (chỉ áp cho `en`): guide, companion, literature kit, journal, diary, address book, "Read & Listen Edition", Kindle, eBook, "Digital box set". Lọc `¿` cả ở tên tác giả (hiện chỉ lọc tên sách).
- Sách tiếng Việt: kết quả từ Lulu.com / MintRight Inc gần như luôn không dấu → có thể lọc theo NXB.
- `marketing-ban-hang` vẫn 0 sách, `tieu-thuyet` / `tho` / `tam-ly-hoc` / `tieng-nhat` không thêm được sách nào dùng được.

## Việc tiếp theo

- [x] **Tôi (chủ dự án)**: chạy `supabase/seed-foreign-books.sql` trên Supabase TRƯỚC lượt A + D.
- [x] Lượt A + D (2026-10-15): dry-run → duyệt → `--from-preview` (xem trên).
- [ ] **Chủ dự án**: thay 5 bìa trong admin (`/admin/sach`, tìm theo tên → "Ảnh bìa"):
  - [ ] The SPEED of Trust (trang lót toàn chữ)
  - [ ] The 8th Habit (trang lót toàn chữ)
  - [ ] Contact (trang lót toàn chữ)
  - [ ] Yuval Noah Harari Box Set (Sapiens, Homo Deus, 21 Lessons…) (bìa của sách khác: hộp "HBR's 10 Must Reads")
  - [ ] Ngoại ngữ khó đấy, nhưng bạn tự học được (ảnh lạ, không giống bìa)
- [x] Phase 7: thay bìa trang lót của "100 câu hỏi về lịch sử chữ Quốc ngữ" (ảnh JPEG nên bộ lọc PNG < 40KB không bắt được).
- [x] Lọc tên summary / workbook / study guide / analysis of cho danh mục `en` (`isDerivativeTitle`, commit D).
