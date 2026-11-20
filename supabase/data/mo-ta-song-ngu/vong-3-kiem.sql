-- mo-ta-song-ngu vòng 3: SELECT kiểm (CHỈ ĐỌC). Chạy trước và sau vong-3-sach-viet-v3.sql.
-- Bản v3: THAY vong-3-kiem.sql và vong-3-kiem-v2.sql (nội dung = v2, chỉ đổi tên file tham chiếu; v2 so với v1: giữ mọi câu cũ, thêm câu cuối).
-- Trước: vi 72 / 71 / 0 / 0. Sau: vi co_en = co_co = 67; en không đổi (117 / 114 / 0 / 0).
select language, count(*), count(*) filter (where nullif(btrim(description),'') is not null) as co_mo_ta, count(*) filter (where description_en is not null) as co_en, count(*) filter (where description_auto_translated) as co_co from public.books group by language order by language;

-- Phải = 0: sách Việt bật cờ mà description_en trống.
select count(*) as vi_co_co_ma_en_trong from public.books where language = 'vi' and description_auto_translated and nullif(btrim(description_en),'') is null;

-- Phải = 0: vòng này không đụng sách ngoại văn.
select count(*) as en_bi_dong from public.books where language = 'en' and (description_en is not null or description_auto_translated);

-- Sách Việt có mô tả mà chưa có bản Anh. Trước khi chạy: 71 dòng. Sau khi chạy: đúng 2, 3, 20, 171 (4 cuốn mô tả gốc đã là tiếng Anh, chờ chủ dự án quyết).
select id from public.books where language='vi' and description_en is null and nullif(btrim(description),'') is not null order by id;
