-- mo-ta-sach-ngan vòng 1: SELECT kiểm (CHỈ ĐỌC, không select cột mô tả). Chạy trước và sau vong-1-sach-viet-lai.sql.
-- Một dòng / id (2, 3, 8, 20, 171, 207, 209, 218, 248, 272, 281, 292, 302): id, language, cờ, description null?, description_en null?, độ dài 2 cột,
-- md5 từng cột = bản gốc? (null đúng chỗ tính là gốc) = bản mới?
-- Trước khi ghi: 13 dòng vi_goc = true, en_goc = true, vi_moi = false, en_moi = false (null khi cột đang null);
--   co = true chỉ 207, 209, 218, 272, 302; vi_null = true chỉ 8, 248, 281, 292; en_null = true ở 2, 3, 8, 20, 171, 248, 281, 292.
-- Sau khi ghi: 13 dòng vi_moi = true, en_moi = true, vi_goc = false, en_goc = false, co = false, vi_null = false, en_null = false.
-- Dòng cuối (id null): tổng số id ở trạng thái gốc / mới (trước: 13 / 0; sau: 0 / 13).
with v(id, lang, goc_vi, goc_en, goc_co, moi_vi, moi_en) as (
  values (2, 'vi', '3e3252cd0a9bdf57b911d5d8c361f1ed', null::text, false, '2cc75b1a3106995cce4e45103b8cebb5', '8f749981b9d11175e7dcad5780375046'),
         (3, 'vi', 'a2b0b794796e7b785c7c453e9d6f20a8', null::text, false, '4ae8a8f059205059503f0c56945c51e6', '438a3b46a4362046ea38c1e78deb8bc3'),
         (8, 'vi', null::text, null::text, false, '037290df449517ce35f239f812c1ead8', '297a6adea0f745dc13d6f19b7870fce9'),
         (20, 'vi', '8d03cbbde38413fd7ffef4dd48ab4cdf', null::text, false, '99797a7bc5ca472225548d8b0c1e12ab', '57beb1b3f799a110168140f892c51839'),
         (171, 'vi', '6cbd516b384d509491b70d7ba061b510', null::text, false, '0c7ae994d94316b768b0fb8e7ee42567', '40162af60f4c77d4e026591e3fba4fe3'),
         (207, 'en', 'abac60d97681962ff144731540fbfa3c', '61926590dbffc90fd91ef2116fbba5ba', true, '890bf30859d9176f122049d5a12ed09f', '3a2f09974f092f62698fd8aea278bc1d'),
         (209, 'en', 'b83c4bfc34d4d32a44e936f7fa08d97b', '06d729398fefca6fe07b4e4259366b9c', true, '0bdabc25c116325716acc2df77baf3af', '3cf5b3e8cc9d6ece3805e1c4d3a5617c'),
         (218, 'en', '3a18474d284fc0d53e850410438500bd', '48c07fec30c5c1a6bab8a852b4ca10fa', true, '0244046b1d92c1b718767ac8c0afddde', 'd14acf6e403fce2ae94dffdbba2c73fd'),
         (248, 'en', null::text, null::text, false, '7287b1f4216ad5880a24aa19f1261876', 'bf5c7c1c6022a314213bb520ae6b4dd7'),
         (272, 'en', 'a9788e8a56c3dfc5f2eb15ccfb356069', '114e72badfa097c19a2ed4d8a070db98', true, 'ba057649e9ec4d074dbedd08b8464c17', '45e80907914969888d439159a261e532'),
         (281, 'en', null::text, null::text, false, 'c2713f5a99ccf8448390296552449016', '8432752383a3b4d16f31db1a954c9643'),
         (292, 'en', null::text, null::text, false, 'eff3afd3dfb96b09bdb3e3fde2ffddb8', '9ee8add125f048d1b0508c3670d47751'),
         (302, 'en', 'cd3c74f8f1ad128eb457afb09f11b397', 'bafd44dcdaa82cc828a0688407a8415e', true, '8ce90fe73cb0c02501c0af593bbe4faf', '8bb25dc520200447bca0b05da5284d7c')
), t as (
  select v.id, b.language, b.description_auto_translated as co, b.description is null as vi_null, b.description_en is null as en_null,
    length(b.description) as dai_vi, length(b.description_en) as dai_en,
    md5(b.description) is not distinct from v.goc_vi as vi_goc, md5(b.description) = v.moi_vi as vi_moi,
    md5(b.description_en) is not distinct from v.goc_en as en_goc, md5(b.description_en) = v.moi_en as en_moi,
    (b.language = v.lang and md5(b.description) is not distinct from v.goc_vi and md5(b.description_en) is not distinct from v.goc_en
      and b.description_auto_translated = v.goc_co) as la_goc,
    (b.language = v.lang and md5(b.description) = v.moi_vi and md5(b.description_en) = v.moi_en and not b.description_auto_translated) as la_moi
  from v left join public.books b on b.id = v.id
)
select id, language, co, vi_null, en_null, dai_vi, dai_en, vi_goc, vi_moi, en_goc, en_moi, null::bigint as so_goc, null::bigint as so_moi from t
union all
select null, null, null, null, null, null, null, null, null, null, null, count(*) filter (where la_goc), count(*) filter (where la_moi) from t
order by id nulls last;
