-- mo-ta-song-ngu vòng 4: SELECT kiểm (CHỈ ĐỌC). Chạy trước, giữa và sau 2 file ghi:
-- vong-4-kiem.sql → vong-4-sach-en-1.sql → vong-4-kiem.sql → vong-4-sach-en-2.sql → vong-4-kiem.sql.

-- (1) Đếm theo ngôn ngữ. Trước: en 117 / 114 / 0 / 0; vi 72 / 71 / 67 / 67 (đã chạy vòng 3).
--     Sau sach-en-1: en 117 / 114 / 56 / 56. Sau sach-en-2: en 117 / 114 / 112 / 112. vi luôn 72 / 71 / 67 / 67.
select language, count(*), count(*) filter (where nullif(btrim(description),'') is not null) as co_mo_ta, count(*) filter (where description_en is not null) as co_en, count(*) filter (where description_auto_translated) as co_co from public.books group by language order by language;

-- (2) Phải = 0 (trước và sau): sách en bật cờ mà description (bản dịch) hoặc description_en (bản gốc) trống.
select count(*) as en_co_co_ma_trong from public.books where language = 'en' and description_auto_translated and (nullif(btrim(description),'') is null or nullif(btrim(description_en),'') is null);

-- (3) Phải = 0 (trước và sau, tới khi admin sửa tay bản dịch): sách en có description_en mà cờ false.
select count(*) as en_co_ban_goc_ma_khong_co from public.books where language = 'en' and description_en is not null and not description_auto_translated;

-- (4) Sách en có mô tả mà description_en còn null. Trước: 114 dòng (id 192–308, trừ 3 cuốn không có mô tả 248, 281, 292).
--     Sau sach-en-1: 58 dòng = 56 id của file 2 (250–308) + 217, 254. Sau sach-en-2: đúng 2 dòng 217, 254.
--     Ghi chú: 217, 254 không ghi SQL ở vòng 4 (giữ bản gốc tiếng Anh, chủ dự án tự viết trong admin); 248, 281, 292 không có mô tả nên không hiện ở câu này.
select id from public.books where language = 'en' and description_en is null and nullif(btrim(description),'') is not null order by id;
