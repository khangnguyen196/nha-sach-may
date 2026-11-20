-- mo-ta-song-ngu vòng 3: HOÀN TÁC bản dịch Anh của sách tiếng Việt (chỉ chạy khi chủ dự án muốn quay lại trạng thái trước vòng 3).
-- data-check: cot-duoc-ghi = description_en, description_auto_translated
-- Bản v2 (2026-11-20, sửa theo code-reviewer): THAY bản v1 cùng tên. Khác v1: khối kiểm không đọc / so md5 mô tả Việt nữa; cờ còn mà bản Anh khác bản dịch → notice thay vì lỗi. Câu update giữ nguyên.
-- Cột được phép đổi: description_en, description_auto_translated (updated_at do trigger tự đặt). description (tiếng Việt gốc) không đụng, không đọc.
-- 67 câu, một cho mỗi sách của vong-3-sach-viet.sql (cùng thư mục, bản đã chạy production). 4 cuốn 2, 3, 20, 171 không có trong vòng 3.
-- Mỗi câu: description_en ← null, cờ ← false; chỉ khi language = 'vi', cờ còn true và md5(description_en) = md5 bản dịch Anh trong vong-3-sach-viet.sql
-- (tính trên đúng chuỗi UTF-8 NFC giữa hai $mota$; đã đối chiếu md5(description_en) trên production qua MCP chỉ đọc 2026-11-20: khớp 67 / 67).
-- Sách admin đã sửa tay bản dịch Anh (cờ đã về false, hoặc cờ còn mà md5(description_en) khác bản dịch): câu của sách đó không khớp, BỎ QUA (giữ bản admin), khối kiểm báo bằng notice.
-- Khối kiểm: id còn cờ mà md5(description_en) = bản dịch (bỏ sót) → raise → rollback; không đủ 67 id → raise; cờ còn mà md5 khác → notice (không lỗi).
-- Chạy lần 2: 0 dòng đổi, không lỗi. Gửi Claude chat chạy thử trên Postgres local trước (hoặc data-check trên CI).
begin;
set local lock_timeout = '5s';

-- 1 ban-van
update public.books set description_en = null, description_auto_translated = false
where id = 1 and language = 'vi' and description_auto_translated and md5(description_en) = '2edd8c2bbd8d06204b671f38bfe18cd1';

-- 4 cam-thu-quan
update public.books set description_en = null, description_auto_translated = false
where id = 4 and language = 'vi' and description_auto_translated and md5(description_en) = '883cd0c897a3df68543d3200f0afe32a';

-- 5 tu-lieu-van-hien-thang-long-ha-noi
update public.books set description_en = null, description_auto_translated = false
where id = 5 and language = 'vi' and description_auto_translated and md5(description_en) = '8085aca4178180376c8a3f249f4390b8';

-- 6 vong-buom
update public.books set description_en = null, description_auto_translated = false
where id = 6 and language = 'vi' and description_auto_translated and md5(description_en) = '04082be9126221c9c9edf4092eca8fe2';

-- 7 muoi-chin-chan-dung-nha-van-cung-thoi
update public.books set description_en = null, description_auto_translated = false
where id = 7 and language = 'vi' and description_auto_translated and md5(description_en) = '4c60cc237949d25548e67c001e6c134f';

-- 9 van-thi-si-tien-chien
update public.books set description_en = null, description_auto_translated = false
where id = 9 and language = 'vi' and description_auto_translated and md5(description_en) = 'ec84d7f29777f3c24ef2d66aa57276d6';

-- 10 suong-khoi-que-nha
update public.books set description_en = null, description_auto_translated = false
where id = 10 and language = 'vi' and description_auto_translated and md5(description_en) = '1957fd68ed05c1f937e7bce7bce0f212';

-- 11 khac-hoa-buc-tranh-lich-su-nam-ky
update public.books set description_en = null, description_auto_translated = false
where id = 11 and language = 'vi' and description_auto_translated and md5(description_en) = '1f652badd87e8b3e94bdacfe2e198cdf';

-- 12 buoc-qua-nuoc-mat-tu-khac-truong-thanh
update public.books set description_en = null, description_auto_translated = false
where id = 12 and language = 'vi' and description_auto_translated and md5(description_en) = '9678cf14898cb984183ac2ede50a7769';

-- 13 ngon-ngu-tuyen-tap-truyen-ngan-chon-loc-2025-hardcover
update public.books set description_en = null, description_auto_translated = false
where id = 13 and language = 'vi' and description_auto_translated and md5(description_en) = '33374c54375ca43fb8de6cd15bda8798';

-- 14 nhung-truyen-ngan-hay-nhat-cua-que-huong-chung-ta-soft-cover-groundwood-paper-ne
update public.books set description_en = null, description_auto_translated = false
where id = 14 and language = 'vi' and description_auto_translated and md5(description_en) = 'b801b9dd39fc2b6baae607beb8bd08a2';

-- 15 ky-mong
update public.books set description_en = null, description_auto_translated = false
where id = 15 and language = 'vi' and description_auto_translated and md5(description_en) = '92c9e2e3fdc47bdb8f26de55413cca63';

-- 16 truyen-kieu
update public.books set description_en = null, description_auto_translated = false
where id = 16 and language = 'vi' and description_auto_translated and md5(description_en) = '47e34ce211e18b913685331ce1ad5a05';

-- 17 bi-quyet-xay-dung-va-quan-tri-thanh-cong-chuoi-cua-hang-dich-vu-sua-chua-xe-may
update public.books set description_en = null, description_auto_translated = false
where id = 17 and language = 'vi' and description_auto_translated and md5(description_en) = 'cc3ddecd12f65e677a7847548c096c2d';

-- 18 nghe-thuat-song
update public.books set description_en = null, description_auto_translated = false
where id = 18 and language = 'vi' and description_auto_translated and md5(description_en) = '9a8ecc63d14e6d5647a5aa64fc7f61ce';

-- 19 cach-mang-phap-va-tam-ly-hoc-cua-cac-cuoc-cach-mang
update public.books set description_en = null, description_auto_translated = false
where id = 19 and language = 'vi' and description_auto_translated and md5(description_en) = '138ac1a5fd0b5ba02b8a205294a3881a';

-- 21 truyen-kieu-tu-ke
update public.books set description_en = null, description_auto_translated = false
where id = 21 and language = 'vi' and description_auto_translated and md5(description_en) = 'dfd74353a2d6a5d2af55dad04d82a38d';

-- 22 tuyen-tap-van-hoc-viet-cho-thieu-nhi-to-hoai-1-truyen-dong-thoai-kich
update public.books set description_en = null, description_auto_translated = false
where id = 22 and language = 'vi' and description_auto_translated and md5(description_en) = 'd9e3509538e1b818420f8d9cba7eaf90';

-- 23 animation-artist
update public.books set description_en = null, description_auto_translated = false
where id = 23 and language = 'vi' and description_auto_translated and md5(description_en) = '0dbaef732ac64864f0f0355c40c171eb';

-- 24 cao-thom-lan-gio-quyen-2
update public.books set description_en = null, description_auto_translated = false
where id = 24 and language = 'vi' and description_auto_translated and md5(description_en) = 'd2665771e6631b74bbd91e3875ea83cf';

-- 25 tu-dien-van-hoa-co-truyen-viet-nam
update public.books set description_en = null, description_auto_translated = false
where id = 25 and language = 'vi' and description_auto_translated and md5(description_en) = 'afb3b72196529c4e63020651fb6282f3';

-- 26 nhung-guong-mat
update public.books set description_en = null, description_auto_translated = false
where id = 26 and language = 'vi' and description_auto_translated and md5(description_en) = 'db076ee6b6949e8601fb099d032c9f57';

-- 27 travel-blogger
update public.books set description_en = null, description_auto_translated = false
where id = 27 and language = 'vi' and description_auto_translated and md5(description_en) = '6f6921af98675618eeab8c1975f6b50c';

-- 28 ngam-chuyen-xua-nay
update public.books set description_en = null, description_auto_translated = false
where id = 28 and language = 'vi' and description_auto_translated and md5(description_en) = '8c095f44b77fd82d8e7642c56a8ecde5';

-- 29 tay-chi-tay-em
update public.books set description_en = null, description_auto_translated = false
where id = 29 and language = 'vi' and description_auto_translated and md5(description_en) = '314b706e077d710acd8b60549a5db5b1';

-- 30 podcaster
update public.books set description_en = null, description_auto_translated = false
where id = 30 and language = 'vi' and description_auto_translated and md5(description_en) = 'a1042f4b9af7ecd6464615e39cb0f89c';

-- 31 freelance-writer
update public.books set description_en = null, description_auto_translated = false
where id = 31 and language = 'vi' and description_auto_translated and md5(description_en) = '630e1d291d0d8810dfadec8f9cad2318';

-- 32 lang-du-trong-van-hoa-viet-nam-tap-3-van-hoa-ban-sac-dan-toc-van-hoc-nghe-thuat
update public.books set description_en = null, description_auto_translated = false
where id = 32 and language = 'vi' and description_auto_translated and md5(description_en) = 'e37d1ed87cbc1698f022912b4ae61e49';

-- 33 nang-cao-von-tu-vung-tieng-nhat-theo-chu-de-bang-hinh-anh
update public.books set description_en = null, description_auto_translated = false
where id = 33 and language = 'vi' and description_auto_translated and md5(description_en) = '76c2e126946a337418e0d7f21415a7dd';

-- 34 lich-su-viet-nam-thoi-tu-chu-tap-mot-hard-cover-groundwood
update public.books set description_en = null, description_auto_translated = false
where id = 34 and language = 'vi' and description_auto_translated and md5(description_en) = 'cb76d7da8a0af09cc8d884f87c0f98d3';

-- 35 lao-dong-di-cu-trong-lich-su-viet-nam-thoi-phap-thuoc
update public.books set description_en = null, description_auto_translated = false
where id = 35 and language = 'vi' and description_auto_translated and md5(description_en) = '7ad64826c543fea1603120e55661bd5e';

-- 36 lich-su-bi-mat-cua-vang
update public.books set description_en = null, description_auto_translated = false
where id = 36 and language = 'vi' and description_auto_translated and md5(description_en) = '25c69e2fa3a756016b74f669e3677d6e';

-- 37 lich-su-chu-quoc-ngu-1615-1919
update public.books set description_en = null, description_auto_translated = false
where id = 37 and language = 'vi' and description_auto_translated and md5(description_en) = '05c5c8548d4cf2f9e4e2ac6e80494a52';

-- 38 100-cau-hoi-ve-lich-su-chu-quoc-ngu
update public.books set description_en = null, description_auto_translated = false
where id = 38 and language = 'vi' and description_auto_translated and md5(description_en) = '488515ea6a386630dc5bb7aa47a50878';

-- 39 lich-su-viet-nam-thoi-tu-chu-tap-hai-hard-cover-groundwood
update public.books set description_en = null, description_auto_translated = false
where id = 39 and language = 'vi' and description_auto_translated and md5(description_en) = 'cb76d7da8a0af09cc8d884f87c0f98d3';

-- 40 dao-giao
update public.books set description_en = null, description_auto_translated = false
where id = 40 and language = 'vi' and description_auto_translated and md5(description_en) = '37a2c527407fefb1c88f1f307e99142f';

-- 41 su-ky-giao-khoa-thu
update public.books set description_en = null, description_auto_translated = false
where id = 41 and language = 'vi' and description_auto_translated and md5(description_en) = '6ffa4be8ce01f08ba2e98e989c48478e';

-- 42 luan-ly-giao-khoa-thu
update public.books set description_en = null, description_auto_translated = false
where id = 42 and language = 'vi' and description_auto_translated and md5(description_en) = '3e84e93a788e7d08910efab86b9f0b70';

-- 43 dat-nuoc-viet-nam-qua-cac-doi
update public.books set description_en = null, description_auto_translated = false
where id = 43 and language = 'vi' and description_auto_translated and md5(description_en) = '040408e2621ab076a471b4e2095b0fe8';

-- 44 van-hoa-la-gi
update public.books set description_en = null, description_auto_translated = false
where id = 44 and language = 'vi' and description_auto_translated and md5(description_en) = '68ed601e4887343db843bb6450552d5d';

-- 45 nguon-goc-dan-toc-viet-nam
update public.books set description_en = null, description_auto_translated = false
where id = 45 and language = 'vi' and description_auto_translated and md5(description_en) = '2e5b19b2b50b26bceb2bd22b1cfcbbfc';

-- 46 cao-thom-lan-gio-quyen-1
update public.books set description_en = null, description_auto_translated = false
where id = 46 and language = 'vi' and description_auto_translated and md5(description_en) = 'd2665771e6631b74bbd91e3875ea83cf';

-- 47 lang-du-trong-van-hoa-viet-nam-tap-1-dat-viet
update public.books set description_en = null, description_auto_translated = false
where id = 47 and language = 'vi' and description_auto_translated and md5(description_en) = 'e84c1b4ab3e31a92fcc7b24409143e17';

-- 48 lang-du-trong-van-hoa-viet-nam-tap-2-lich-su-truyen-thong
update public.books set description_en = null, description_auto_translated = false
where id = 48 and language = 'vi' and description_auto_translated and md5(description_en) = '30ec3b62cdccd1ca67eb3b09fba7c4a1';

-- 49 su-tra-thu-cua-dia-ly
update public.books set description_en = null, description_auto_translated = false
where id = 49 and language = 'vi' and description_auto_translated and md5(description_en) = 'e5132d2ac6f77dd5370dd6a0dc21a5f0';

-- 169 hien-phap-my-duoc-lam-ra-nhu-the-nao
update public.books set description_en = null, description_auto_translated = false
where id = 169 and language = 'vi' and description_auto_translated and md5(description_en) = '9d4d9b965f264f3603c87b0c3dcf190c';

-- 170 cay-but-doi-nguoi
update public.books set description_en = null, description_auto_translated = false
where id = 170 and language = 'vi' and description_auto_translated and md5(description_en) = '7265bffb7f8b6475a464dd65616fa7d3';

-- 172 cau-chuyen-khoi-nghiep-tu-duy-hanh-dong-buc-pha
update public.books set description_en = null, description_auto_translated = false
where id = 172 and language = 'vi' and description_auto_translated and md5(description_en) = '95a92a74fa38e68bcc44a7cfae0160a6';

-- 173 giao-duc-ky-nang-song-cho-thanh-nien-sinh-vien-trong-nha-truong
update public.books set description_en = null, description_auto_translated = false
where id = 173 and language = 'vi' and description_auto_translated and md5(description_en) = '09fd290052fb45494d011d6a470c5c13';

-- 174 rich-habits-thoi-quen-thanh-cong-cua-nhung-trieu-phu-tu-than
update public.books set description_en = null, description_auto_translated = false
where id = 174 and language = 'vi' and description_auto_translated and md5(description_en) = 'b6a4fc98266798b3afa501d86569dc3e';

-- 175 chuyen-cu-ha-noi-phan-2
update public.books set description_en = null, description_auto_translated = false
where id = 175 and language = 'vi' and description_auto_translated and md5(description_en) = '63b0cde19ef3427abb68d260819bf2bf';

-- 176 to-hoai-tu-truyen
update public.books set description_en = null, description_auto_translated = false
where id = 176 and language = 'vi' and description_auto_translated and md5(description_en) = '23e73b9718abcad3d0d46d599a4feecf';

-- 177 ky-uc-phien-lang
update public.books set description_en = null, description_auto_translated = false
where id = 177 and language = 'vi' and description_auto_translated and md5(description_en) = 'aeea6396370fb80584cf11b661960209';

-- 178 tuyen-tap-van-hoc-viet-cho-thieu-nhi-to-hoai-tap-4-mot-tram-co-tich-chuyen-ngay
update public.books set description_en = null, description_auto_translated = false
where id = 178 and language = 'vi' and description_auto_translated and md5(description_en) = '28bc6e287871a7e21b0978dfd0b92706';

-- 179 la-thu-tinh-dau-tien
update public.books set description_en = null, description_auto_translated = false
where id = 179 and language = 'vi' and description_auto_translated and md5(description_en) = 'a5fba504670a0e85cb2633dec14e68de';

-- 180 chuyen-cu-ha-noi-phan-1
update public.books set description_en = null, description_auto_translated = false
where id = 180 and language = 'vi' and description_auto_translated and md5(description_en) = '63b0cde19ef3427abb68d260819bf2bf';

-- 181 thanh-pho-guong-mat-con-nguoi
update public.books set description_en = null, description_auto_translated = false
where id = 181 and language = 'vi' and description_auto_translated and md5(description_en) = '030ab25cd40005cafc05780efbe19dbb';

-- 182 giang-the
update public.books set description_en = null, description_auto_translated = false
where id = 182 and language = 'vi' and description_auto_translated and md5(description_en) = '9622e3f00e8b35cf6912092d73a8ae79';

-- 183 cha-me-5-0
update public.books set description_en = null, description_auto_translated = false
where id = 183 and language = 'vi' and description_auto_translated and md5(description_en) = 'eb16b43e033783e0241e337b44decd2b';

-- 184 21-cach-hoc-tieng-anh-du-kich-song-ngu
update public.books set description_en = null, description_auto_translated = false
where id = 184 and language = 'vi' and description_auto_translated and md5(description_en) = '782ee9d497276481d93c7e42768dc12b';

-- 185 van-pham-tieng-anh-thuc-hanh-practical-english-grammar-course
update public.books set description_en = null, description_auto_translated = false
where id = 185 and language = 'vi' and description_auto_translated and md5(description_en) = '36d0c20c8444f53c24c19193cc2fd8dc';

-- 186 coding-6-lap-trinh-voi-scratch-3
update public.books set description_en = null, description_auto_translated = false
where id = 186 and language = 'vi' and description_auto_translated and md5(description_en) = '277e921ae3e47de2343b0eebb42e9ace';

-- 187 ngoai-ngu-kho-day-nhung-ban-tu-hoc-duoc
update public.books set description_en = null, description_auto_translated = false
where id = 187 and language = 'vi' and description_auto_translated and md5(description_en) = '5ca53249485f3bd7b0d3229d6afd7b91';

-- 188 lich-su-viet-nam-qua-tu-lieu-nuoc-ngoai
update public.books set description_en = null, description_auto_translated = false
where id = 188 and language = 'vi' and description_auto_translated and md5(description_en) = '13914922dc46447a66fd01df65a46a39';

-- 189 lich-su-viet-nam-thoi-tu-chu-tap-hai
update public.books set description_en = null, description_auto_translated = false
where id = 189 and language = 'vi' and description_auto_translated and md5(description_en) = 'cb76d7da8a0af09cc8d884f87c0f98d3';

-- 190 viet-nam-lich-su-khong-bien-gioi
update public.books set description_en = null, description_auto_translated = false
where id = 190 and language = 'vi' and description_auto_translated and md5(description_en) = 'ea80329acf7abce2544079e4ab3895c7';

-- 191 phat-giao-vung-nam-bo-trong-the-ky-xx
update public.books set description_en = null, description_auto_translated = false
where id = 191 and language = 'vi' and description_auto_translated and md5(description_en) = '1615c4e9d51d5064481a82ff1777f51d';


-- Kiểm cả lô (67 id).
do $$ declare v_sot text; v_sua text; v_ve int; v_sua_n int; v_admin int; v_tong int; begin select string_agg(b.id::text, ',' order by b.id) filter (where b.description_auto_translated and md5(b.description_en) = v.md5_en), string_agg(b.id::text, ',' order by b.id) filter (where b.description_auto_translated and md5(b.description_en) is distinct from v.md5_en), count(*) filter (where not b.description_auto_translated and b.description_en is null), count(*) filter (where b.description_auto_translated and md5(b.description_en) is distinct from v.md5_en), count(*) filter (where not b.description_auto_translated and b.description_en is not null), count(*) into v_sot, v_sua, v_ve, v_sua_n, v_admin, v_tong from public.books b join (values (1, '2edd8c2bbd8d06204b671f38bfe18cd1'), (4, '883cd0c897a3df68543d3200f0afe32a'), (5, '8085aca4178180376c8a3f249f4390b8'), (6, '04082be9126221c9c9edf4092eca8fe2'), (7, '4c60cc237949d25548e67c001e6c134f'), (9, 'ec84d7f29777f3c24ef2d66aa57276d6'), (10, '1957fd68ed05c1f937e7bce7bce0f212'), (11, '1f652badd87e8b3e94bdacfe2e198cdf'), (12, '9678cf14898cb984183ac2ede50a7769'), (13, '33374c54375ca43fb8de6cd15bda8798'), (14, 'b801b9dd39fc2b6baae607beb8bd08a2'), (15, '92c9e2e3fdc47bdb8f26de55413cca63'), (16, '47e34ce211e18b913685331ce1ad5a05'), (17, 'cc3ddecd12f65e677a7847548c096c2d'), (18, '9a8ecc63d14e6d5647a5aa64fc7f61ce'), (19, '138ac1a5fd0b5ba02b8a205294a3881a'), (21, 'dfd74353a2d6a5d2af55dad04d82a38d'), (22, 'd9e3509538e1b818420f8d9cba7eaf90'), (23, '0dbaef732ac64864f0f0355c40c171eb'), (24, 'd2665771e6631b74bbd91e3875ea83cf'), (25, 'afb3b72196529c4e63020651fb6282f3'), (26, 'db076ee6b6949e8601fb099d032c9f57'), (27, '6f6921af98675618eeab8c1975f6b50c'), (28, '8c095f44b77fd82d8e7642c56a8ecde5'), (29, '314b706e077d710acd8b60549a5db5b1'), (30, 'a1042f4b9af7ecd6464615e39cb0f89c'), (31, '630e1d291d0d8810dfadec8f9cad2318'), (32, 'e37d1ed87cbc1698f022912b4ae61e49'), (33, '76c2e126946a337418e0d7f21415a7dd'), (34, 'cb76d7da8a0af09cc8d884f87c0f98d3'), (35, '7ad64826c543fea1603120e55661bd5e'), (36, '25c69e2fa3a756016b74f669e3677d6e'), (37, '05c5c8548d4cf2f9e4e2ac6e80494a52'), (38, '488515ea6a386630dc5bb7aa47a50878'), (39, 'cb76d7da8a0af09cc8d884f87c0f98d3'), (40, '37a2c527407fefb1c88f1f307e99142f'), (41, '6ffa4be8ce01f08ba2e98e989c48478e'), (42, '3e84e93a788e7d08910efab86b9f0b70'), (43, '040408e2621ab076a471b4e2095b0fe8'), (44, '68ed601e4887343db843bb6450552d5d'), (45, '2e5b19b2b50b26bceb2bd22b1cfcbbfc'), (46, 'd2665771e6631b74bbd91e3875ea83cf'), (47, 'e84c1b4ab3e31a92fcc7b24409143e17'), (48, '30ec3b62cdccd1ca67eb3b09fba7c4a1'), (49, 'e5132d2ac6f77dd5370dd6a0dc21a5f0'), (169, '9d4d9b965f264f3603c87b0c3dcf190c'), (170, '7265bffb7f8b6475a464dd65616fa7d3'), (172, '95a92a74fa38e68bcc44a7cfae0160a6'), (173, '09fd290052fb45494d011d6a470c5c13'), (174, 'b6a4fc98266798b3afa501d86569dc3e'), (175, '63b0cde19ef3427abb68d260819bf2bf'), (176, '23e73b9718abcad3d0d46d599a4feecf'), (177, 'aeea6396370fb80584cf11b661960209'), (178, '28bc6e287871a7e21b0978dfd0b92706'), (179, 'a5fba504670a0e85cb2633dec14e68de'), (180, '63b0cde19ef3427abb68d260819bf2bf'), (181, '030ab25cd40005cafc05780efbe19dbb'), (182, '9622e3f00e8b35cf6912092d73a8ae79'), (183, 'eb16b43e033783e0241e337b44decd2b'), (184, '782ee9d497276481d93c7e42768dc12b'), (185, '36d0c20c8444f53c24c19193cc2fd8dc'), (186, '277e921ae3e47de2343b0eebb42e9ace'), (187, '5ca53249485f3bd7b0d3229d6afd7b91'), (188, '13914922dc46447a66fd01df65a46a39'), (189, 'cb76d7da8a0af09cc8d884f87c0f98d3'), (190, 'ea80329acf7abce2544079e4ab3895c7'), (191, '1615c4e9d51d5064481a82ff1777f51d')) as v(id, md5_en) on b.id = v.id where b.language = 'vi'; if v_sot is not null then raise exception 'mo-ta-song-ngu vong 3 hoan tac: id con co va ban dich chua bi go (bo sot): %, rollback', v_sot; end if; if v_tong <> 67 then raise exception 'mo-ta-song-ngu vong 3 hoan tac: ky vong 67 id, thay % (thieu sach?), rollback', v_tong; end if; if v_sua is not null then raise notice 'mo-ta-song-ngu vong 3 hoan tac: id con co ma description_en khac ban dich (admin sua tay, bo qua): %', v_sua; end if; raise notice 'mo-ta-song-ngu vong 3 hoan tac: % sach ve trang thai truoc vong 3, % sach admin da sua ban dich (co da tat, bo qua), % sach con co ma ban Anh khac (bo qua)', v_ve, v_admin, v_sua_n; end $$;

commit;
