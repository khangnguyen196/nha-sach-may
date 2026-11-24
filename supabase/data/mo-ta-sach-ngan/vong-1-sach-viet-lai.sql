-- mo-ta-sach-ngan vòng 1: viết mô tả song ngữ mới cho 13 sách thiếu hoặc quá ngắn mô tả (docs/plans/mo-ta-sach-ngan.md).
-- data-check: cot-duoc-ghi = description, description_en, description_auto_translated
-- data-check: che-do = viet-lai
-- Mục đích: 13 sách có mô tả trống (8, 248, 281, 292), mô tả tiếng Anh nằm trong cột tiếng Việt (2, 3, 20, 171) hoặc chỉ một
-- câu ngắn (207, 209, 218, 272, 302). Bản mới viết mới cả hai ngôn ngữ (không dịch, không chép nguồn ngoài).
-- 13 câu update, id 2, 3, 8, 20, 171, 207, 209, 218, 248, 272, 281, 292, 302. Mỗi câu: description ← bản Việt mới, description_en ← bản Anh mới,
-- description_auto_translated ← false (bản viết mới, không phải bản dịch tự động). Chỉ đổi khi đúng id, đúng language
-- (2, 3, 8, 20, 171: 'vi'; còn lại 'en'), hai cột mô tả đúng bản gốc đọc production 2026-11-24 (md5; null với cột đang
-- trống: description của 8, 248, 281, 292; description_en của 2, 3, 8, 20, 171, 248, 281, 292) và cờ đúng như lúc đọc
-- (207, 209, 218, 272, 302: true; còn lại false). File lẫn sách đã có bản dịch (cờ true) và sách chưa có, nên khai báo
-- che-do = viet-lai (CI chạy đường CHƯA GHI, không nhận chế độ theo cờ).
-- Mỗi chuỗi mô tả mới bọc replace(…, chr(13), ''): dán vào SQL Editor trên Windows có thể đổi xuống dòng giữa các đoạn thành
-- CRLF (supabase/data/README.md); bỏ CR khi ghi → DB luôn nhận bản LF, md5 kỳ vọng tính trên bản LF.
-- Khối kiểm cuối file: đủ 13 id có md5 bản mới (cả hai cột) + cờ false + đúng language; khác 13 → raise (P0001) → rollback cả file.
-- Câu báo lỗi kèm id lệch và cột lệch (vi = description, en = description_en, co = cờ, khong-co-sach = không có id hoặc
-- language khác), không kèm mô tả. Cột md5 lệch kèm độ dài thực / kỳ vọng (ký tự, bản LF) và số CR, VD "2:vi(len 425/421, cr 4)".
-- Đọc: len thực = kỳ vọng + cr và cr > 0 → lỗi CRLF; len thực khác kỳ vọng mà cr = 0 → lỗi bảng mã / ký tự khi chép
-- (thiếu -Encoding utf8?); len bằng và cr = 0 → md5 lệch vì lý do khác. Cột đang null báo "len null/…, cr null".
-- Chạy lần 2: 0 dòng đổi, không lỗi (chỉ đúng khi chưa ai sửa mô tả 13 sách này trong admin).
-- Thứ tự chủ dự án chạy (SQL Editor), sau khi data-check xanh: thử đường chép (paste-test.sql) → vong-1-kiem.sql →
-- vong-1-sach-viet-lai.sql → vong-1-kiem.sql. Quay lại (chỉ khi cần): vong-1-hoan-tac.sql.
begin;
set local lock_timeout = '5s';

-- 2 Làm bạn với bầu trời
update public.books set description = replace($mota$Làm bạn với bầu trời là truyện dài của Nguyễn Nhật Ánh, nhà văn quen thuộc với nhiều thế hệ bạn đọc thiếu niên và người trẻ. Sách do NXB Trẻ phát hành năm 2019, dày 249 trang.

Đây là một câu chuyện giản dị, trong trẻo về những rung động đầu đời và lòng trắc ẩn giữa vài người trẻ. Theo cảm nhận của nhiều độc giả, truyện xoay quanh một cậu bé mang nhiều tổn thương và gửi gắm thông điệp về lòng biết ơn, tình yêu thương.$mota$, chr(13), ''), description_en = replace($mota$Làm bạn với bầu trời is a novel by Nguyễn Nhật Ánh, a writer well known to several generations of teenage and young readers. It was published by Trẻ Publishing House in 2019 and runs to 249 pages.

It is a simple, gentle tale of first feelings and of the compassion a few young people show one another. Many readers describe it as centred on a boy who carries deep hurts, with a message about gratitude and kindness.$mota$, chr(13), ''), description_auto_translated = false
where id = 2 and language = 'vi' and md5(description) = '3e3252cd0a9bdf57b911d5d8c361f1ed' and description_en is null and description_auto_translated = false;

-- 3 Oxford thương yêu
update public.books set description = replace($mota$Oxford thương yêu là truyện dài của Dương Thụy. Đây là ấn bản năm 2023 của NXB Trẻ. Truyện kể về mối tình giữa một sinh viên Việt Nam và một trợ giảng người Bồ Đào Nha tại Đại học Oxford, nước Anh.

Bên cạnh chuyện tình là khung cảnh thiên nhiên đẹp và đời sống của lớp người trẻ trưởng thành ở nước ngoài, với cách nhìn cởi mở, tử tế. Truyện có kết thúc nhẹ nhàng, có hậu, hợp với bạn đọc thích những câu chuyện tình cảm trong trẻo.$mota$, chr(13), ''), description_en = replace($mota$Oxford thương yêu is a novel by Dương Thụy. This 2023 edition is published by Trẻ Publishing House. It follows a romance between a student from Vietnam and a teaching assistant from Portugal, set at the University of Oxford in England.

Alongside the romance, the book offers lovely natural scenery and a portrait of young people who came of age abroad, with a warm and open outlook. The story ends gently and happily, suiting readers who enjoy a tender love story.$mota$, chr(13), ''), description_auto_translated = false
where id = 3 and language = 'vi' and md5(description) = 'a2b0b794796e7b785c7c453e9d6f20a8' and description_en is null and description_auto_translated = false;

-- 8 Kiến, Chuột và Ruồi
update public.books set description = replace($mota$Kiến, Chuột và Ruồi là tiểu thuyết của Nguyễn Quang Lập, nhà văn và nhà biên kịch. Ấn bản năm 2019 dày 364 trang.

Theo cảm nhận của một số độc giả, bối cảnh của truyện là làng quê Việt Nam thời Cải cách ruộng đất.$mota$, chr(13), ''), description_en = replace($mota$Kiến, Chuột và Ruồi is a novel by Nguyễn Quang Lập, a Vietnamese writer and screenwriter. The 2019 edition runs to 364 pages.

Some readers say it is set in rural Vietnam during the land-reform years.$mota$, chr(13), ''), description_auto_translated = false
where id = 8 and language = 'vi' and description is null and description_en is null and description_auto_translated = false;

-- 20 Tâm lý đàn bà, lý trí đàn ông
update public.books set description = replace($mota$Tâm lý đàn bà, lý trí đàn ông của Bruce Bryans là cuốn sách tâm lý về tình yêu. Sách bàn về những khác biệt trong cách đàn ông và phụ nữ cảm nhận, suy nghĩ khi yêu, và gợi ý cách hiểu tâm lý, cảm xúc của người kia để cùng xây dựng một mối quan hệ lâu bền.

Giọng sách hướng nhiều tới bạn đọc nữ trẻ đang băn khoăn làm sao để người mình yêu muốn gắn bó lâu dài. Bản tiếng Việt do NXB Lao Động và Tsai Fong Books phát hành năm 2023.$mota$, chr(13), ''), description_en = replace($mota$Tâm lý đàn bà, lý trí đàn ông is a Vietnamese edition of a relationship book by Bruce Bryans. It looks at how men and women feel and think differently when they are in love, and suggests ways to understand a partner's mind and emotions so that the two can build a lasting relationship.

The book speaks mostly to young women wondering how to make the man they love want to stay. This edition was published by Lao Dong Publishing House and Tsai Fong Books in 2023.$mota$, chr(13), ''), description_auto_translated = false
where id = 20 and language = 'vi' and md5(description) = '8d03cbbde38413fd7ffef4dd48ab4cdf' and description_en is null and description_auto_translated = false;

-- 171 Hà Nội nhớ thương của tôi
update public.books set description = replace($mota$Hà Nội nhớ thương của tôi là tập tản văn của Quan Thế Dân, do NXB Hội Nhà Văn và Tsai Fong Books phát hành năm 2024. Những trang viết hướng về Hà Nội, với nếp sống, phong tục và con người của thủ đô.

Đúng như tên sách, giọng văn đầy thương nhớ. Sách hợp với những ai yêu Hà Nội hoặc muốn hiểu thêm về đời sống thường ngày ở nơi này.$mota$, chr(13), ''), description_en = replace($mota$Hà Nội nhớ thương của tôi is a collection of essays by Quan Thế Dân, published by Vietnam Writers' Association Publishing House and Tsai Fong Books in 2024. The pieces turn to Hanoi, Vietnam's capital: its way of life, its customs and its people.

As the title suggests, the writing is full of affection and longing. The book suits anyone who loves Hanoi or wants to know more about everyday life in the city.$mota$, chr(13), ''), description_auto_translated = false
where id = 171 and language = 'vi' and md5(description) = '6cbd516b384d509491b70d7ba061b510' and description_en is null and description_auto_translated = false;

-- 207 Men Without Women
update public.books set description = replace($mota$Men Without Women là tập truyện ngắn của Ernest Hemingway, in lần đầu năm 1927, gồm 14 truyện. Các truyện viết theo lối văn quen thuộc của ông: câu ngắn, lời thoại tiết chế, nhiều điều quan trọng không nói thẳng mà để người đọc tự cảm nhận.

Nhân vật phần lớn là những người đàn ông đối diện thất bại, nỗi đau và sự cô độc, ở đấu trường bò tót, trên võ đài quyền Anh hay trong và sau chiến tranh. Tập sách có những truyện ngắn nổi tiếng của Hemingway như The Killers và Hills Like White Elephants.

Ấn bản này do Simon and Schuster phát hành năm 1997, dày 160 trang.$mota$, chr(13), ''), description_en = replace($mota$Men Without Women is a collection of fourteen short stories by Ernest Hemingway, first published in 1927. The stories are written in his familiar style: short sentences, spare dialogue, and much of what matters left unsaid for the reader to sense.

Most of the characters are men facing defeat, pain and loneliness, in the bullring, in the boxing ring or in and after the war. The book includes some of Hemingway's best-known stories, such as The Killers and Hills Like White Elephants.

This edition was published by Simon and Schuster in 1997 and runs to 160 pages.$mota$, chr(13), ''), description_auto_translated = false
where id = 207 and language = 'en' and md5(description) = 'abac60d97681962ff144731540fbfa3c' and md5(description_en) = '61926590dbffc90fd91ef2116fbba5ba' and description_auto_translated = true;

-- 209 F. Scott Fitzgerald: The Great Gatsby
update public.books set description = replace($mota$The Great Gatsby là tiểu thuyết của F. Scott Fitzgerald, xuất bản năm 1925, lấy bối cảnh Long Island và New York mùa hè năm 1922. Người kể chuyện là Nick Carraway, một chàng trai từ miền Trung Tây thuê nhà cạnh dinh thự của Jay Gatsby, một người giàu có bí ẩn nổi tiếng với những bữa tiệc xa hoa.

Dần dần Nick hiểu ra mọi hào nhoáng ấy đều hướng về Daisy, cô em họ của anh và là mối tình cũ của Gatsby. Cuốn tiểu thuyết ngắn nói về tình yêu, tiền bạc, giai cấp và giấc mơ Mỹ, về sự xa hoa và cái giá phải trả khi giấc mơ sụp đổ.

Ấn bản này do Cambridge University Press phát hành năm 1991.$mota$, chr(13), ''), description_en = replace($mota$The Great Gatsby is F. Scott Fitzgerald's novel of 1925, set on Long Island and in New York during the summer of 1922. It is narrated by Nick Carraway, a young man from the Midwest who rents a house next to the mansion of Jay Gatsby, a mysterious rich man famous for his lavish parties.

Nick gradually learns that all this glamour is aimed at Daisy, his cousin and Gatsby's former love. The short novel is about love, money, class and the American Dream, about extravagance and the price paid when the dream falls apart.

This edition was published by Cambridge University Press in 1991.$mota$, chr(13), ''), description_auto_translated = false
where id = 209 and language = 'en' and md5(description) = 'b83c4bfc34d4d32a44e936f7fa08d97b' and md5(description_en) = '06d729398fefca6fe07b4e4259366b9c' and description_auto_translated = true;

-- 218 Agatha Christie: Five Complete Murder Mysteries
update public.books set description = replace($mota$Cuốn sách gộp năm tiểu thuyết trinh thám trọn vẹn của Agatha Christie trong một tập dày 690 trang, in năm 1990.

Truyện của Christie theo lối trinh thám cổ điển: một vụ án mạng, một nhóm nghi phạm ai cũng có điều giấu giếm, các manh mối được bày ra trước mắt người đọc một cách công bằng, và lời giải thường bất ngờ. Tập sách hợp với người muốn đọc liền nhiều truyện của bà, hoặc muốn làm quen với truyện trinh thám phá án.$mota$, chr(13), ''), description_en = replace($mota$This volume brings together five complete detective novels by Agatha Christie in a single 690-page book, published in 1990.

Christie's stories follow the classic mystery pattern: a murder, a group of suspects who all have something to hide, clues laid out fairly before the reader, and a solution that is often a surprise. The book suits readers who want several of her novels in one place, or who are new to the murder mystery genre.$mota$, chr(13), ''), description_auto_translated = false
where id = 218 and language = 'en' and md5(description) = '3a18474d284fc0d53e850410438500bd' and md5(description_en) = '48c07fec30c5c1a6bab8a852b4ca10fa' and description_auto_translated = true;

-- 248 Pathways to Success in Your Professional & Private Lives
update public.books set description = replace($mota$Pathways to Success in Your Professional & Private Lives là sách của Dale Carnegie, tác giả cuốn How to Win Friends and Influence People. Đúng như tên sách, nội dung xoay quanh cách ứng xử, giao tiếp và phát triển bản thân để thành công trong công việc lẫn đời sống riêng. Ấn bản năm 1998, dày 570 trang.$mota$, chr(13), ''), description_en = replace($mota$Pathways to Success in Your Professional & Private Lives is a book by Dale Carnegie, author of How to Win Friends and Influence People. As the title says, it deals with getting along with people, communicating well and growing as a person, at work and in private life. The 1998 edition runs to 570 pages.$mota$, chr(13), ''), description_auto_translated = false
where id = 248 and language = 'en' and description is null and description_en is null and description_auto_translated = false;

-- 272 Eric Carle's Very Little Library
update public.books set description = replace($mota$Bộ sách nhỏ gồm ba cuốn sách tranh của Eric Carle dành cho trẻ nhỏ: The Very Hungry Caterpillar, The Very Busy Spider và The Very Lonely Firefly. Cả ba mang phong cách tranh cắt dán nhiều màu sắc quen thuộc của ông.

Trong The Very Hungry Caterpillar, chú sâu nhỏ đói bụng ăn mỗi ngày một nhiều rồi hóa thành bướm. The Very Busy Spider kể về một con nhện chăm chỉ giăng tơ. The Very Lonely Firefly theo chân chú đom đóm cô đơn đi tìm bạn. Lời văn ngắn, dễ đọc cùng bé.$mota$, chr(13), ''), description_en = replace($mota$This small set brings together three picture books by Eric Carle for young children: The Very Hungry Caterpillar, The Very Busy Spider and The Very Lonely Firefly. All three feature his familiar, colourful collage artwork.

In The Very Hungry Caterpillar, a tiny caterpillar eats more and more each day and then becomes a butterfly. The Very Busy Spider follows a spider hard at work spinning her web. The Very Lonely Firefly sets out in search of friends. The short texts are easy to read aloud with little ones.$mota$, chr(13), ''), description_auto_translated = false
where id = 272 and language = 'en' and md5(description) = 'a9788e8a56c3dfc5f2eb15ccfb356069' and md5(description_en) = '114e72badfa097c19a2ed4d8a070db98' and description_auto_translated = true;

-- 281 Yuval Noah Harari Box Set
update public.books set description = replace($mota$Bộ sách gồm ba cuốn của nhà sử học Yuval Noah Harari, đọc liền nhau như một hành trình từ quá khứ tới tương lai của loài người.

Sapiens kể lại lịch sử loài người, từ khi Homo sapiens xuất hiện tới thế giới hiện đại. Homo Deus nhìn về tương lai, khi công nghệ, dữ liệu và trí tuệ nhân tạo có thể thay đổi chính con người. 21 Lessons for the 21st Century quay về hiện tại với những câu hỏi như tin giả, việc làm, tự do và ý nghĩa cuộc sống.

Văn phong dễ hiểu, hợp với bạn đọc muốn nhìn các vấn đề lớn của thời đại qua góc nhìn lịch sử.$mota$, chr(13), ''), description_en = replace($mota$This set gathers three books by the historian Yuval Noah Harari, which read together as a journey from humanity's past to its possible future.

Sapiens retells the story of humankind, from the appearance of Homo sapiens to the modern world. Homo Deus looks ahead to a time when technology, data and artificial intelligence may reshape humans themselves. 21 Lessons for the 21st Century returns to the present, with questions about fake news, work, freedom and meaning.

Written in clear language, the books suit readers who want to see the big issues of our time through the lens of history.$mota$, chr(13), ''), description_auto_translated = false
where id = 281 and language = 'en' and description is null and description_en is null and description_auto_translated = false;

-- 292 Stephen Hawking Box Set
update public.books set description = replace($mota$Bộ sách gồm hai cuốn nổi tiếng của nhà vật lý Stephen Hawking. A Brief History of Time giải thích cho bạn đọc phổ thông những câu hỏi lớn về vũ trụ: thời gian là gì, vũ trụ bắt đầu từ Vụ Nổ Lớn ra sao, lỗ đen là gì.

The Grand Design, viết cùng Leonard Mlodinow, đặt câu hỏi vì sao có vũ trụ và vì sao các định luật vật lý lại như vậy, rồi giới thiệu lý thuyết M như một ứng viên cho lời giải.

Ấn bản của Bantam, năm 2014, tổng cộng 512 trang.$mota$, chr(13), ''), description_en = replace($mota$This set brings together two well-known books by the physicist Stephen Hawking. A Brief History of Time explains the big questions about the universe for general readers: what time is, how the universe began with the Big Bang, and what black holes are.

The Grand Design, written with Leonard Mlodinow, asks why there is a universe at all and why the laws of physics are the way they are, and presents M-theory as a candidate answer.

This Bantam edition was published in 2014 and runs to 512 pages.$mota$, chr(13), ''), description_auto_translated = false
where id = 292 and language = 'en' and description is null and description_en is null and description_auto_translated = false;

-- 302 Murmurs of Earth
update public.books set description = replace($mota$Năm 1977, hai tàu vũ trụ Voyager rời Trái Đất, mỗi tàu mang theo một chiếc đĩa mạ vàng chứa âm thanh và hình ảnh về hành tinh của chúng ta, gửi tới bất kỳ nền văn minh nào có thể bắt gặp nó ngoài Hệ Mặt Trời.

Murmurs of Earth, in năm 1978, là câu chuyện về chiếc Đĩa Vàng ấy, do Carl Sagan cùng các cộng sự trong nhóm thực hiện kể lại. Sách kể cách nhóm chọn từng phần của đĩa: âm thanh của thiên nhiên và đời sống, các bản nhạc từ nhiều nền văn hóa, hình ảnh về con người và Trái Đất, cùng lời chào bằng nhiều thứ tiếng. Sách hợp với bạn đọc yêu thiên văn, khoa học và âm nhạc.$mota$, chr(13), ''), description_en = replace($mota$In 1977 the two Voyager spacecraft left Earth, each carrying a gold-plated record of sounds and images from our planet, addressed to any civilization that might one day find it beyond the Solar System.

Murmurs of Earth, published in 1978, tells the story of that Golden Record as recounted by Carl Sagan and his colleagues on the team that made it. The book describes how they chose each part of the record: the sounds of nature and everyday life, music from many cultures, pictures of people and of Earth, and greetings in many languages. It suits readers who love astronomy, science and music.$mota$, chr(13), ''), description_auto_translated = false
where id = 302 and language = 'en' and md5(description) = 'cd3c74f8f1ad128eb457afb09f11b397' and md5(description_en) = 'bafd44dcdaa82cc828a0688407a8415e' and description_auto_translated = true;

do $$
declare
  khop integer;
  lech text;
begin
  -- Một dòng mỗi id kỳ vọng (left join: sách không có / language khác vẫn hiện); loi = '' khi khớp cả 3 điều kiện.
  -- len_vi / len_en: length() kỳ vọng của bản mới (bản LF, NFC, không ký tự ngoài BMP); cr = số CR trong cột. Chỉ in số, không in mô tả.
  select count(*) filter (where t.loi = ''), string_agg(t.loi, ', ' order by t.id) filter (where t.loi <> '')
    into khop, lech
    from (select v.id, concat_ws(', ',
                   case when b.id is null then v.id || ':khong-co-sach' end,
                   case when b.id is not null and md5(b.description) is distinct from v.md5_vi
                        then format('%s:vi(len %s/%s, cr %s)', v.id, coalesce(length(b.description)::text, 'null'), v.len_vi,
                                    coalesce((length(b.description) - length(replace(b.description, chr(13), '')))::text, 'null')) end,
                   case when b.id is not null and md5(b.description_en) is distinct from v.md5_en
                        then format('%s:en(len %s/%s, cr %s)', v.id, coalesce(length(b.description_en)::text, 'null'), v.len_en,
                                    coalesce((length(b.description_en) - length(replace(b.description_en, chr(13), '')))::text, 'null')) end,
                   case when b.id is not null and b.description_auto_translated is distinct from false then v.id || ':co' end) as loi
            from (values (2, 'vi', '2cc75b1a3106995cce4e45103b8cebb5', 'e52be61a5616c12b93242f31f8f9a3ee', 421, 416),
                    (3, 'vi', '11cc744e23f2c54ac63072fa12336645', 'b4a9f30c3ed1a4506ccd9a58d03b34fd', 433, 465),
                    (8, 'vi', '951ee02b93411d39295e135f259808b9', '5d3144718b05b21bd8e823f21da72d6f', 214, 200),
                    (20, 'vi', '99797a7bc5ca472225548d8b0c1e12ab', '7cb9a98117c5693717a54defa803188a', 430, 463),
                    (171, 'vi', '0c7ae994d94316b768b0fb8e7ee42567', 'd12aa13d0c0ca05dc1a0152c3a5aec75', 333, 409),
                    (207, 'en', 'bdeee8c678be7ac6c0ce5e0af01f8cc4', '82f8c91d4efece2896f6832cac09a62e', 566, 567),
                    (209, 'en', '0bdabc25c116325716acc2df77baf3af', '3cf5b3e8cc9d6ece3805e1c4d3a5617c', 591, 588),
                    (218, 'en', '05b8583ba62465ebf8cdfbafcdc90048', 'd14acf6e403fce2ae94dffdbba2c73fd', 423, 435),
                    (248, 'en', '7287b1f4216ad5880a24aa19f1261876', 'bf5c7c1c6022a314213bb520ae6b4dd7', 304, 304),
                    (272, 'en', 'ba057649e9ec4d074dbedd08b8464c17', '45e80907914969888d439159a261e532', 468, 513),
                    (281, 'en', 'c2713f5a99ccf8448390296552449016', '8432752383a3b4d16f31db1a954c9643', 535, 591),
                    (292, 'en', 'eff3afd3dfb96b09bdb3e3fde2ffddb8', '9ee8add125f048d1b0508c3670d47751', 444, 499),
                    (302, 'en', '8ce90fe73cb0c02501c0af593bbe4faf', '8bb25dc520200447bca0b05da5284d7c', 579, 596)) as v(id, lang, md5_vi, md5_en, len_vi, len_en)
            left join public.books b on b.id = v.id and b.language = v.lang
           where v.id in (2, 3, 8, 20, 171, 207, 209, 218, 248, 272, 281, 292, 302)) t;
  if khop <> 13 then
    raise exception 'mo-ta-sach-ngan vong 1: ky vong 13 sach co mo ta moi (md5 ca hai cot) + co false, khop duoc % / 13, rollback; lech: %', khop, coalesce(lech, 'khong ro');
  end if;
end $$;

commit;
