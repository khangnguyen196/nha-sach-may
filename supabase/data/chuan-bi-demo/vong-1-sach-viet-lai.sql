-- chuan-bi-demo vòng 1: viết lại mô tả song ngữ cho 7 sách ngoại văn (language = 'en') trước buổi demo (docs/plans/chuan-bi-demo.md).
-- data-check: cot-duoc-ghi = description, description_en, description_auto_translated
-- data-check: che-do = viet-lai
-- Mục đích: bản cũ có lỗi khi đem ra demo (hứa đặc điểm bản in như chữ ký / bản giới hạn / hộp, quảng cáo hết hạn, chép lời khen,
-- bị cắt giữa câu, tiểu sử tác giả thay cho mô tả sách, chỉ là ghi chú thư viện). Bản mới viết mới cả hai ngôn ngữ (không dịch blurb).
-- 7 câu update, id 213, 216, 217, 234, 244, 254, 280. Mỗi câu: description ← bản Việt mới, description_en ← bản Anh mới, description_auto_translated ← false
-- (bản viết mới, không phải bản dịch); chỉ đổi khi đúng id, language = 'en', md5(description) = md5 bản gốc, description_en đúng
-- bản gốc (md5; 217, 254: null) và cờ đúng như lúc đọc production 2026-11-24 (213, 216, 234, 244, 280: true; 217, 254: false).
-- Mỗi chuỗi mô tả mới bọc replace(…, chr(13), ''): dán vào SQL Editor trên Windows, xuống dòng giữa các đoạn thành CRLF
-- (sự cố 2026-11-24, supabase/data/README.md); bỏ CR khi ghi → DB luôn nhận bản LF, md5 kỳ vọng tính trên bản LF.
-- Khối kiểm cuối file: đủ 7 id có md5 bản mới (cả hai cột) + cờ false; khác 7 → raise (P0001) → rollback cả file.
-- Câu báo lỗi kèm id lệch và cột lệch (vi = description, en = description_en, co = cờ, khong-co-sach = không có id hoặc language khác 'en'), không kèm mô tả.
-- Chạy lần 2: 0 dòng đổi, không lỗi (chỉ đúng khi chưa ai sửa mô tả 7 sách này trong admin).
-- Thứ tự chủ dự án chạy (SQL Editor), sau khi data-check xanh: vong-1-kiem.sql → vong-1-sach-viet-lai.sql → vong-1-kiem.sql.
-- Quay lại (chỉ khi cần): vong-1-hoan-tac.sql.
begin;
set local lock_timeout = '5s';

-- 213 And the Mountains Echoed
update public.books set description = replace($mota$Năm 1952, ở một ngôi làng nghèo của Afghanistan, cậu bé Abdullah gần như thay cha mẹ chăm sóc cô em gái nhỏ Pari. Hai anh em gắn bó không rời, cho tới chuyến đi theo cha băng qua sa mạc tới Kabul, nơi một quyết định của người lớn chia cắt họ.

Từ cuộc chia ly ấy, Khaled Hosseini mở rộng câu chuyện qua nhiều thế hệ và nhiều người kể: họ hàng, người quen và cả những người xa lạ, mỗi người giữ một phần sợi dây nối hai anh em. Bối cảnh trải từ Kabul tới Paris, California và một hòn đảo của Hy Lạp.

Cuốn tiểu thuyết nói về tình thân, sự hy sinh, những lựa chọn khó khăn và ký ức theo con người suốt cả đời, kể cả khi họ đã đi rất xa nơi mình sinh ra.$mota$, chr(13), ''), description_en = replace($mota$In 1952, in a poor village in Afghanistan, young Abdullah all but raises his little sister Pari himself. The two are inseparable until their father sets out for Kabul with both children. At the end of that long desert crossing, a decision made by the adults pulls them apart.

From that separation, Khaled Hosseini widens the story across generations and many narrators: relatives, acquaintances and strangers, each holding a thread of the bond between the siblings. The settings move from Kabul to Paris, California and a Greek island.

The novel is about family, sacrifice, hard choices and the memories that follow people for the rest of their lives, even after they have travelled far from where they were born.$mota$, chr(13), ''), description_auto_translated = false
where id = 213 and language = 'en' and md5(description) = 'a82ce1f968cfd9148d858b933040b322' and md5(description_en) = '93eaccc1d8025c995c791853826f799c' and description_auto_translated = true;

-- 216 Death Comes as the End
update public.books set description = replace($mota$Death Comes as the End là một truyện trinh thám của Agatha Christie đặt ở Ai Cập cổ đại, bên bờ sông Nile, cách nay khoảng bốn nghìn năm. Renisenb, góa chồng khi còn trẻ, trở về sống trong gia đình người cha Imhotep, một tư tế giàu có và nhiều ruộng đất, giữa các anh em trai, chị dâu, người bà và những người làm công.

Sự yên ổn của gia đình bị phá vỡ khi Imhotep đưa về Nofret, một người vợ lẽ trẻ đẹp và đanh đá. Những ghen ghét, nghi kỵ lâu nay bùng lên, rồi cái chết đầu tiên xảy ra, kéo theo những cái chết khác.

Không có thám tử nổi tiếng nào ở đây: người đọc theo chân Renisenb đoán xem kẻ gây án là ai trong chính những người thân của cô.$mota$, chr(13), ''), description_en = replace($mota$Death Comes as the End is an Agatha Christie mystery set in ancient Egypt, on the banks of the Nile, some four thousand years ago. Renisenb, widowed while still young, returns to the household of her father Imhotep, a prosperous priest and landowner, living among her brothers, their wives, her grandmother and the family's servants.

The household's fragile peace breaks when Imhotep brings home Nofret, a beautiful and sharp-tongued young concubine. Old jealousies and suspicions flare up, and then the first death comes, followed by others.

There is no famous detective here: the reader follows Renisenb as she tries to work out which member of her own family is the killer.$mota$, chr(13), ''), description_auto_translated = false
where id = 216 and language = 'en' and md5(description) = 'b8516fb1edbc2a269e5ea97b68fe70f2' and md5(description_en) = '09e4f0fdb0044c005261a7a08a95da6c' and description_auto_translated = true;

-- 217 The Agatha Christie Collection
update public.books set description = replace($mota$Cuốn sách gộp hai tiểu thuyết đầu tay của Agatha Christie. The Mysterious Affair at Styles là lần đầu thám tử người Bỉ Hercule Poirot xuất hiện. Đại úy Hastings, về nước dưỡng thương sau mặt trận Thế chiến thứ nhất, đang ở dinh thự Styles thì bà chủ nhà bị đầu độc. Hastings kể lại vụ án, còn Poirot, người quen cũ đang tị nạn gần đó, lần theo từng chi tiết nhỏ để tìm ra sự thật.

The Secret Adversary đưa người đọc tới London sau chiến tranh, với Tommy và Tuppence, hai người bạn trẻ đang thiếu tiền và thèm phiêu lưu. Họ bị cuốn vào cuộc săn tìm một văn bản mật bị thất lạc và một cô gái mất tích, đối đầu với kẻ chủ mưu chỉ được biết qua cái tên Mr. Brown.

Hai câu chuyện cho thấy nét quen thuộc của Christie ngay từ đầu: manh mối giấu khéo, nhiều nghi phạm và cái kết khó đoán.$mota$, chr(13), ''), description_en = replace($mota$This volume brings together Agatha Christie's first two novels. The Mysterious Affair at Styles marks the first appearance of the Belgian detective Hercule Poirot. Captain Hastings, sent home to recover from a wound received in the First World War, is staying at Styles Court when the lady of the house is poisoned. Hastings tells the story, while Poirot, an old acquaintance living nearby as a refugee, follows the smallest details to the truth.

The Secret Adversary moves to post-war London with Tommy and Tuppence, two young friends short of money and eager for adventure. They are drawn into the hunt for a missing secret document and a vanished girl, against a mastermind known only as Mr. Brown.

Together the two stories show Christie's trademarks from the very start: carefully hidden clues, plenty of suspects and endings that are hard to guess.$mota$, chr(13), ''), description_auto_translated = false
where id = 217 and language = 'en' and md5(description) = '20d02ad1e1de6b61fa04fd06207c7c45' and description_en is null and description_auto_translated = false;

-- 234 Built to Last
update public.books set description = replace($mota$Built to Last là kết quả một nghiên cứu kéo dài nhiều năm của Jim Collins và Jerry Porras tại Đại học Stanford. Hai tác giả chọn 18 công ty “có tầm nhìn”, đã dẫn đầu ngành qua nhiều thế hệ lãnh đạo, rồi đặt mỗi công ty cạnh một đối thủ cùng thời để tìm xem điều gì thật sự tạo ra khác biệt.

Kết luận chính: công ty bền vững giữ chặt một cốt lõi gồm giá trị và mục đích, đồng thời không ngừng thúc đẩy tiến bộ. Họ đặt những mục tiêu lớn và táo bạo, thử nhiều hướng rồi giữ lại cái hiệu quả, và chú trọng “xây đồng hồ” (xây một tổ chức tự vận hành tốt) thay vì chỉ “xem giờ” (dựa vào một ý tưởng hay hoặc một người lãnh đạo tài giỏi).

Cuốn sách hữu ích cho người quản lý, người khởi nghiệp và bất kỳ ai muốn hiểu vì sao có những tổ chức tồn tại lâu dài.$mota$, chr(13), ''), description_en = replace($mota$Built to Last grew out of a multi-year research project by Jim Collins and Jerry Porras at Stanford University. The authors chose 18 “visionary” companies that had led their industries through several generations of leaders, and set each one beside a contemporary rival to see what really made the difference.

The central finding: enduring companies hold firmly to a core of values and purpose while constantly stimulating progress. They set big, bold goals, try many things and keep what works, and focus on clock building (creating an organization that runs well on its own) rather than time telling (relying on one great idea or one brilliant leader).

The book is useful for managers, founders and anyone who wants to understand why some organizations last.$mota$, chr(13), ''), description_auto_translated = false
where id = 234 and language = 'en' and md5(description) = '095d91fb5e46f6d3b1a0684b3dcc219d' and md5(description_en) = 'd5b1995e49de6c3d265786c8fa7a2c45' and description_auto_translated = true;

-- 244 Atomic Habits
update public.books set description = replace($mota$Atomic Habits của James Clear bắt đầu từ một ý đơn giản: những cải thiện rất nhỏ, lặp lại mỗi ngày, cộng dồn theo thời gian thành thay đổi lớn. Thay vì chỉ đặt mục tiêu, tác giả khuyên xây dựng hệ thống, tức những việc nhỏ ta làm hằng ngày, và gắn thói quen với bản sắc: nghĩ về con người mình muốn trở thành, chứ không chỉ kết quả muốn đạt.

Phần chính của sách là bốn quy luật thay đổi hành vi, dùng để tạo thói quen tốt: làm cho nó rõ ràng, hấp dẫn, dễ dàng và thỏa mãn. Đảo ngược bốn quy luật này giúp bỏ thói quen xấu: làm cho nó khó thấy, kém hấp dẫn, khó làm và không thỏa mãn.

Sách viết dễ đọc, có nhiều ví dụ đời thường và gợi ý áp dụng được ngay cho việc học, công việc và sức khỏe.$mota$, chr(13), ''), description_en = replace($mota$James Clear's Atomic Habits starts from a simple idea: very small improvements, repeated every day, compound over time into big change. Rather than relying on goals alone, the author recommends building systems, the small things we do daily, and tying habits to identity: thinking about the person you want to become, not just the result you want.

The core of the book is the Four Laws of Behavior Change for building good habits: make them obvious, attractive, easy and satisfying. Turning the laws around helps break bad habits: make them invisible, unattractive, difficult and unsatisfying.

It is easy to read, full of everyday examples and practical suggestions for study, work and health.$mota$, chr(13), ''), description_auto_translated = false
where id = 244 and language = 'en' and md5(description) = 'b9caee7cc47d04e7e69a213ef57b59f9' and md5(description_en) = 'f90607930da01d8c0af6961a3b478dc8' and description_auto_translated = true;

-- 254 The SPEED of Trust
update public.books set description = replace($mota$The SPEED of Trust của Stephen M. R. Covey cho rằng niềm tin không chỉ là một đức tính mà là yếu tố đo được trong công việc. Khi niềm tin thấp, mọi việc chậm lại và tốn kém hơn; khi niềm tin cao, tốc độ tăng và chi phí giảm.

Tác giả phân tích bốn yếu tố làm nên sự đáng tin: chính trực, ý định, năng lực và kết quả. Từ đó, sách đưa ra 13 hành vi giúp xây dựng niềm tin, như nói thẳng, minh bạch, sửa sai, giữ cam kết, lắng nghe trước và trao niềm tin cho người khác.

Niềm tin được xem xét ở nhiều tầng: với chính mình, trong các mối quan hệ, trong tổ chức, trên thị trường và trong xã hội. Cuốn sách phù hợp với người lãnh đạo, người quản lý và bất kỳ ai làm việc cùng người khác.$mota$, chr(13), ''), description_en = replace($mota$In The SPEED of Trust, Stephen M. R. Covey argues that trust is not just a virtue but a measurable factor in how work gets done. When trust is low, everything slows down and costs more; when trust is high, speed goes up and costs come down.

The author examines four cores of credibility: integrity, intent, capabilities and results. Building on them, the book describes 13 behaviors that build trust, such as talking straight, creating transparency, righting wrongs, keeping commitments, listening first and extending trust to others.

Trust is explored at several levels: with yourself, in relationships, within organizations, in the market and in society. The book suits leaders, managers and anyone who works with other people.$mota$, chr(13), ''), description_auto_translated = false
where id = 254 and language = 'en' and md5(description) = 'd5ab6c37ab7b22c7a805d92141301932' and description_en is null and description_auto_translated = false;

-- 280 Sapiens
update public.books set description = replace($mota$Sapiens của Yuval Noah Harari kể lại lịch sử loài người qua bốn bước ngoặt lớn. Cách mạng nhận thức giúp Homo sapiens dùng ngôn ngữ để kể chuyện và cùng tin vào những điều như thần linh, quốc gia hay luật lệ, nhờ đó hợp tác được với rất nhiều người lạ. Cách mạng nông nghiệp đưa con người tới cuộc sống định cư, nhưng tác giả đặt câu hỏi liệu nó có làm đời sống của từng người tốt hơn.

Tiếp đó là quá trình loài người dần hợp nhất nhờ tiền tệ, các đế quốc và tôn giáo, rồi cách mạng khoa học, khi con người thừa nhận những điều mình chưa biết và bắt đầu tìm hiểu thế giới một cách có hệ thống.

Sách viết dễ hiểu, gợi nhiều câu hỏi về hạnh phúc và tương lai của chính chúng ta.$mota$, chr(13), ''), description_en = replace($mota$Yuval Noah Harari's Sapiens retells the history of humankind through four great turning points. The Cognitive Revolution let Homo sapiens use language to tell stories and believe together in things such as gods, nations and laws, which made cooperation among large numbers of strangers possible. The Agricultural Revolution led people to settle down, though the author questions whether it made individual lives better.

Next comes the gradual unification of humankind through money, empires and religions, followed by the Scientific Revolution, when people admitted what they did not know and began to investigate the world systematically.

Written in clear language, the book raises many questions about happiness and our own future.$mota$, chr(13), ''), description_auto_translated = false
where id = 280 and language = 'en' and md5(description) = '81187180c2bc18fa7953a09a778726e2' and md5(description_en) = 'a789b0f92d9f3fc37b19af87c335822c' and description_auto_translated = true;

do $$
declare
  khop integer;
  lech text;
begin
  -- Một dòng mỗi id kỳ vọng (left join: sách không có / không phải 'en' vẫn hiện); loi = '' khi khớp cả 3 điều kiện
  select count(*) filter (where t.loi = ''), string_agg(t.id || ' (' || t.loi || ')', ', ' order by t.id) filter (where t.loi <> '')
    into khop, lech
    from (select v.id, concat_ws(' ',
                   case when b.id is null then 'khong-co-sach' end,
                   case when b.id is not null and md5(b.description) is distinct from v.md5_vi then 'vi' end,
                   case when b.id is not null and md5(b.description_en) is distinct from v.md5_en then 'en' end,
                   case when b.id is not null and b.description_auto_translated is distinct from false then 'co' end) as loi
            from (values (213, 'ec5468a3c5ca2e6e8c0dc9e5ce987241', '11fae57670c7782f53dae76ea9d2c4dc'), (216, '82b636283af77f3456a4a9cacb6c4af9', 'd90f221662e95d4b75a59ae3e160adf7'), (217, 'e80f3a817820b29d48a05546094667bc', 'c94e3dfca4505c596a80f74691e8b1f1'), (234, '975cd1348585a2b043e7da8921b22d99', '2c1df8ad29104f81b8313198ef84ab6e'), (244, '225a543fc53af19641bc9ff9c4d88371', '96c7c1079c6bd2e3d93e237fe806ca1f'), (254, '5df472ba35cd37e4e9194d29e1c556e5', 'f69f07f6e395efcbef5b763386b718e1'), (280, '7d45f338363afcd1db4e687a9e5700f9', 'd98195bb84e3f6e83be3cab91b919e74')) as v(id, md5_vi, md5_en)
            left join public.books b on b.id = v.id and b.language = 'en'
           where v.id in (213, 216, 217, 234, 244, 254, 280)) t;
  if khop <> 7 then
    raise exception 'chuan-bi-demo vong 1: ky vong 7 sach co mo ta moi (md5 ca hai cot) + co false, khop duoc % / 7, rollback; lech: %', khop, coalesce(lech, 'khong ro');
  end if;
end $$;

commit;
