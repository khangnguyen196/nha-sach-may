-- chuan-bi-demo vòng 1: SELECT kiểm (CHỈ ĐỌC, không select cột mô tả). Chạy trước và sau vong-1-sach-viet-lai.sql.
-- Một dòng / id (213, 216, 217, 234, 244, 254, 280): id, language, cờ, description_en null?, độ dài 2 cột, md5 từng cột = bản gốc? = bản mới?
-- Trước khi ghi: 7 dòng vi_goc = true, en_goc = true, vi_moi = false, en_moi = false (null với 217, 254); co = true trừ 217, 254 (false);
--   en_null = true chỉ 217, 254.
-- Sau khi ghi: 7 dòng vi_moi = true, en_moi = true, vi_goc = false, en_goc = false, co = false, en_null = false.
-- Dòng cuối (id null): tổng số id ở trạng thái gốc / mới (trước: 7 / 0; sau: 0 / 7).
with v(id, goc_vi, goc_en, goc_co, moi_vi, moi_en) as (
  values (213, 'a82ce1f968cfd9148d858b933040b322', '93eaccc1d8025c995c791853826f799c', true, 'ec5468a3c5ca2e6e8c0dc9e5ce987241', '11fae57670c7782f53dae76ea9d2c4dc'),
         (216, 'b8516fb1edbc2a269e5ea97b68fe70f2', '09e4f0fdb0044c005261a7a08a95da6c', true, '82b636283af77f3456a4a9cacb6c4af9', 'd90f221662e95d4b75a59ae3e160adf7'),
         (217, '20d02ad1e1de6b61fa04fd06207c7c45', null::text, false, 'e80f3a817820b29d48a05546094667bc', 'c94e3dfca4505c596a80f74691e8b1f1'),
         (234, '095d91fb5e46f6d3b1a0684b3dcc219d', 'd5b1995e49de6c3d265786c8fa7a2c45', true, '975cd1348585a2b043e7da8921b22d99', '2c1df8ad29104f81b8313198ef84ab6e'),
         (244, 'b9caee7cc47d04e7e69a213ef57b59f9', 'f90607930da01d8c0af6961a3b478dc8', true, '225a543fc53af19641bc9ff9c4d88371', '96c7c1079c6bd2e3d93e237fe806ca1f'),
         (254, 'd5ab6c37ab7b22c7a805d92141301932', null::text, false, '5df472ba35cd37e4e9194d29e1c556e5', 'f69f07f6e395efcbef5b763386b718e1'),
         (280, '81187180c2bc18fa7953a09a778726e2', 'a789b0f92d9f3fc37b19af87c335822c', true, '7d45f338363afcd1db4e687a9e5700f9', 'd98195bb84e3f6e83be3cab91b919e74')
), t as (
  select v.id, b.language, b.description_auto_translated as co, b.description_en is null as en_null,
    length(b.description) as dai_vi, length(b.description_en) as dai_en,
    md5(b.description) = v.goc_vi as vi_goc, md5(b.description) = v.moi_vi as vi_moi,
    md5(b.description_en) is not distinct from v.goc_en as en_goc, md5(b.description_en) = v.moi_en as en_moi,
    (md5(b.description) = v.goc_vi and md5(b.description_en) is not distinct from v.goc_en and b.description_auto_translated = v.goc_co) as la_goc,
    (md5(b.description) = v.moi_vi and md5(b.description_en) = v.moi_en and not b.description_auto_translated) as la_moi
  from v left join public.books b on b.id = v.id
)
select id, language, co, en_null, dai_vi, dai_en, vi_goc, vi_moi, en_goc, en_moi, null::bigint as so_goc, null::bigint as so_moi from t
union all
select null, null, null, null, null, null, null, null, null, null, count(*) filter (where la_goc), count(*) filter (where la_moi) from t
order by id nulls last;
