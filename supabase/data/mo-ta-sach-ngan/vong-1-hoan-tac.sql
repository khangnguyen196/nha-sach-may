-- mo-ta-sach-ngan vòng 1: HOÀN TÁC (chỉ chạy khi chủ dự án muốn quay lại mô tả cũ của 13 sách).
-- data-check: cot-duoc-ghi = description, description_en, description_auto_translated
-- 13 câu, id 2, 3, 8, 20, 171, 207, 209, 218, 248, 272, 281, 292, 302: đưa description, description_en, description_auto_translated về đúng bản đọc từ production 2026-11-24
-- (bản gốc chép nguyên văn; cột đang trống lúc đọc gán null: description của 8, 248, 281, 292; description_en của 2, 3, 8, 20,
-- 171, 248, 281, 292; cờ gốc: 207, 209, 218, 272, 302 true, còn lại false). Chỉ đổi khi mô tả hiện tại vẫn là bản mới của
-- vong-1-sach-viet-lai.sql (md5 cả hai cột), đúng language và cờ false: sách nào đã bị sửa tiếp trong admin thì câu của sách đó
-- bỏ qua và khối kiểm raise.
-- Bản gốc không có CR / LF / dấu đô la (đã kiểm khi sinh file), chép thẳng trong chuỗi dollar-quote (thẻ mota), bọc
-- replace(…, chr(13), '') như file ghi (supabase/data/README.md). Bản gốc là dữ liệu đã công khai trên web; không qua kiểm (d).
-- Khối kiểm cuối file: đủ 13 id có md5 bản gốc (is not distinct from: null đúng chỗ) + cờ gốc + đúng language; khác 13 →
-- raise → rollback cả file. Chạy lần 2: 0 dòng đổi, không lỗi. File sinh bằng script (không gõ tay).
begin;
set local lock_timeout = '5s';

-- 2 Làm bạn với bầu trời
update public.books set description = replace($mota$A charming and poignant story of young stirrings and lovely emotions of several youngsters who first experienced love and compassions... By a favorite writer of novels and stories for the young and the young-at-heart.$mota$, chr(13), ''), description_en = null, description_auto_translated = false
where id = 2 and language = 'vi' and md5(description) = '2cc75b1a3106995cce4e45103b8cebb5' and md5(description_en) = '8f749981b9d11175e7dcad5780375046' and description_auto_translated = false;

-- 3 Oxford thương yêu
update public.books set description = replace($mota$The love story of a Vietnamese student and a Portuguese teaching assistant at Oxford University - England is a happy ending Beautiful natural scenery, open-minded and good-natured views of a young class grown up in a foreign country have had the good life they wanted.$mota$, chr(13), ''), description_en = null, description_auto_translated = false
where id = 3 and language = 'vi' and md5(description) = '4ae8a8f059205059503f0c56945c51e6' and md5(description_en) = '438a3b46a4362046ea38c1e78deb8bc3' and description_auto_translated = false;

-- 8 Kiến, Chuột và Ruồi
update public.books set description = null, description_en = null, description_auto_translated = false
where id = 8 and language = 'vi' and md5(description) = '037290df449517ce35f239f812c1ead8' and md5(description_en) = '297a6adea0f745dc13d6f19b7870fce9' and description_auto_translated = false;

-- 20 Tâm lý đàn bà, lý trí đàn ông
update public.books set description = replace($mota$How to make him yearn to be with you. Longing to accompany you and begging for your commitment. You should read this book.$mota$, chr(13), ''), description_en = null, description_auto_translated = false
where id = 20 and language = 'vi' and md5(description) = '99797a7bc5ca472225548d8b0c1e12ab' and md5(description_en) = '57beb1b3f799a110168140f892c51839' and description_auto_translated = false;

-- 171 Hà Nội nhớ thương của tôi
update public.books set description = replace($mota$Social life and customs of people in Hanoi, the capital of Vietnam.$mota$, chr(13), ''), description_en = null, description_auto_translated = false
where id = 171 and language = 'vi' and md5(description) = '0c7ae994d94316b768b0fb8e7ee42567' and md5(description_en) = '40162af60f4c77d4e026591e3fba4fe3' and description_auto_translated = false;

-- 207 Men Without Women
update public.books set description = replace($mota$Tuyển tập 14 truyện ngắn hé lộ cảm nhận của Hemingway về cuộc đời và con người.$mota$, chr(13), ''), description_en = replace($mota$A collection of 14 short stories reveals Hemingway's impressions of life and mankind.$mota$, chr(13), ''), description_auto_translated = true
where id = 207 and language = 'en' and md5(description) = '890bf30859d9176f122049d5a12ed09f' and md5(description_en) = '3a2f09974f092f62698fd8aea278bc1d' and description_auto_translated = false;

-- 209 F. Scott Fitzgerald: The Great Gatsby
update public.books set description = replace($mota$Bức tranh kinh điển về tình yêu và bạo lực trong thập niên 1920.$mota$, chr(13), ''), description_en = replace($mota$Classical portrayal of love and violence during the Twenties.$mota$, chr(13), ''), description_auto_translated = true
where id = 209 and language = 'en' and md5(description) = '0bdabc25c116325716acc2df77baf3af' and md5(description_en) = '3cf5b3e8cc9d6ece3805e1c4d3a5617c' and description_auto_translated = false;

-- 218 Agatha Christie: Five Complete Murder Mysteries
update public.books set description = replace($mota$Tuyển tập tiểu thuyết của nữ tác giả trinh thám lừng danh Agatha Christie.$mota$, chr(13), ''), description_en = replace($mota$A collection of novels by renowned mystery author Agatha Christie.$mota$, chr(13), ''), description_auto_translated = true
where id = 218 and language = 'en' and md5(description) = '0244046b1d92c1b718767ac8c0afddde' and md5(description_en) = 'd14acf6e403fce2ae94dffdbba2c73fd' and description_auto_translated = false;

-- 248 Pathways to Success in Your Professional & Private Lives
update public.books set description = null, description_en = null, description_auto_translated = false
where id = 248 and language = 'en' and md5(description) = '7287b1f4216ad5880a24aa19f1261876' and md5(description_en) = 'bf5c7c1c6022a314213bb520ae6b4dd7' and description_auto_translated = false;

-- 272 Eric Carle's Very Little Library
update public.books set description = replace($mota$Bộ ba cuốn sách về những loài vật khác nhau.$mota$, chr(13), ''), description_en = replace($mota$A collection of three books about different animals.$mota$, chr(13), ''), description_auto_translated = true
where id = 272 and language = 'en' and md5(description) = 'ba057649e9ec4d074dbedd08b8464c17' and md5(description_en) = '45e80907914969888d439159a261e532' and description_auto_translated = false;

-- 281 Yuval Noah Harari Box Set
update public.books set description = null, description_en = null, description_auto_translated = false
where id = 281 and language = 'en' and md5(description) = 'c2713f5a99ccf8448390296552449016' and md5(description_en) = '8432752383a3b4d16f31db1a954c9643' and description_auto_translated = false;

-- 292 Stephen Hawking Box Set
update public.books set description = null, description_en = null, description_auto_translated = false
where id = 292 and language = 'en' and md5(description) = 'eff3afd3dfb96b09bdb3e3fde2ffddb8' and md5(description_en) = '9ee8add125f048d1b0508c3670d47751' and description_auto_translated = false;

-- 302 Murmurs of Earth
update public.books set description = replace($mota$Đĩa ghi âm liên sao của tàu Voyager.$mota$, chr(13), ''), description_en = replace($mota$The Voyager Interstellar Record.$mota$, chr(13), ''), description_auto_translated = true
where id = 302 and language = 'en' and md5(description) = '8ce90fe73cb0c02501c0af593bbe4faf' and md5(description_en) = '8bb25dc520200447bca0b05da5284d7c' and description_auto_translated = false;

do $$
begin
  if (select count(*) from public.books b
      join (values (2, 'vi', '3e3252cd0a9bdf57b911d5d8c361f1ed', null::text, false),
              (3, 'vi', 'a2b0b794796e7b785c7c453e9d6f20a8', null::text, false),
              (8, 'vi', null::text, null::text, false),
              (20, 'vi', '8d03cbbde38413fd7ffef4dd48ab4cdf', null::text, false),
              (171, 'vi', '6cbd516b384d509491b70d7ba061b510', null::text, false),
              (207, 'en', 'abac60d97681962ff144731540fbfa3c', '61926590dbffc90fd91ef2116fbba5ba', true),
              (209, 'en', 'b83c4bfc34d4d32a44e936f7fa08d97b', '06d729398fefca6fe07b4e4259366b9c', true),
              (218, 'en', '3a18474d284fc0d53e850410438500bd', '48c07fec30c5c1a6bab8a852b4ca10fa', true),
              (248, 'en', null::text, null::text, false),
              (272, 'en', 'a9788e8a56c3dfc5f2eb15ccfb356069', '114e72badfa097c19a2ed4d8a070db98', true),
              (281, 'en', null::text, null::text, false),
              (292, 'en', null::text, null::text, false),
              (302, 'en', 'cd3c74f8f1ad128eb457afb09f11b397', 'bafd44dcdaa82cc828a0688407a8415e', true)) as v(id, lang, md5_vi, md5_en, co)
        on b.id = v.id
      where b.id in (2, 3, 8, 20, 171, 207, 209, 218, 248, 272, 281, 292, 302) and b.language = v.lang and b.description_auto_translated = v.co
        and md5(b.description) is not distinct from v.md5_vi and md5(b.description_en) is not distinct from v.md5_en) <> 13 then
    raise exception 'mo-ta-sach-ngan vong 1 hoan tac: ky vong 13 sach ve dung ban goc (md5 + co), khop duoc khac 13, rollback';
  end if;
end $$;

commit;
