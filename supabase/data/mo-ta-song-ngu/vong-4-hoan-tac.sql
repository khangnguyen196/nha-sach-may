-- mo-ta-song-ngu vòng 4: HOÀN TÁC (chỉ chạy khi chủ dự án muốn quay lại trạng thái trước vòng 4).
-- data-check: cot-duoc-ghi = description, description_en, description_auto_translated
-- Bản v2 (2026-11-20, sửa theo code-reviewer): THAY bản v1 cùng tên. Khác v1: bỏ 217, 254 (không ghi SQL ở vòng 4); câu update bỏ điều kiện md5(description_en); khối kiểm báo notice thay vì lỗi khi mô tả về khác bản gốc.
-- Cột được phép đổi: description, description_en, description_auto_translated (updated_at do trigger tự đặt).
-- 112 câu, một cho mỗi sách đã dịch ở vong-4-sach-en-1.sql + vong-4-sach-en-2.sql (cả vòng 4, trừ 217, 254 không ghi SQL).
-- Mỗi câu: description ← description_en (bản Anh), description_en ← null, cờ ← false; chỉ khi language = 'en', cờ còn true
-- và md5(description) = md5 bản dịch trong file ghi (không so md5(description_en)).
-- Các trường hợp admin đã sửa trước khi hoàn tác:
-- (i) Admin sửa bản dịch (ô mô tả tiếng Việt): cờ đã tắt → câu của sách đó BỎ QUA (giữ bản admin, như thiết kế cũ); khối kiểm báo số sách bằng notice.
-- (ii) Admin sửa bản Anh gốc (ô mô tả tiếng Anh): cờ còn → VẪN hoàn tác: bản Anh đã sửa về ô description; khối kiểm báo id bằng notice (không lỗi).
-- Khối kiểm: id nào còn cờ (VD bản dịch bị đổi mà cờ không tắt) → raise → rollback cả lô; không đủ số id → raise;
-- id có description_en null mà md5(description) khác md5 bản gốc (vong-4-truoc.json) → notice (trường hợp ii), không lỗi; cờ đã tắt → ok.
-- Chạy lần 2: 0 dòng đổi, không lỗi. Gửi Claude chat chạy thử trên Postgres local trước (hoặc data-check trên CI).
begin;
set local lock_timeout = '5s';

-- 192 the-classic-george-orwell-collection
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 192 and language = 'en' and description_auto_translated and md5(description) = 'dfaf41eb1d6063b1a950ab846a2b8123';

-- 193 animal-farm
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 193 and language = 'en' and description_auto_translated and md5(description) = 'e613642e0b48ba16d4085f23e4bc9cb0';

-- 194 george-orwell-notes-on-nationalism
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 194 and language = 'en' and description_auto_translated and md5(description) = '86a997dfb5a5fdfbab225fe46306fca0';

-- 195 jane-austen-s-letters
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 195 and language = 'en' and description_auto_translated and md5(description) = '90bdca541029a7dcd26e18e1572bf334';

-- 196 jane-austen-s-pride-and-prejudice
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 196 and language = 'en' and description_auto_translated and md5(description) = 'dc2d43d52d43c1cd02b7ec4ac6b37d41';

-- 197 northanger-abbey
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 197 and language = 'en' and description_auto_translated and md5(description) = 'ac4e0e91504649393b256979765f9183';

-- 198 jane-austen
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 198 and language = 'en' and description_auto_translated and md5(description) = '6379475ddcd61c3de0d895db38deaaf1';

-- 199 warrior-of-the-light
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 199 and language = 'en' and description_auto_translated and md5(description) = 'c86ef9bd38ade7fc7407d6125a83cc3e';

-- 200 the-pilgrimage
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 200 and language = 'en' and description_auto_translated and md5(description) = 'e066d95b091447aca75b2f4c44d9cee3';

-- 201 like-the-flowing-river
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 201 and language = 'en' and description_auto_translated and md5(description) = 'b759b7402014de162de596722a84323f';

-- 202 kafka-on-the-shore
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 202 and language = 'en' and description_auto_translated and md5(description) = '9e9ff83a6228877b0e302aeaeb428231';

-- 203 hard-boiled-wonderland-and-the-end-of-the-world
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 203 and language = 'en' and description_auto_translated and md5(description) = '96acd6907dbf09f4b5d0b7032434a20f';

-- 204 first-person-singular
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 204 and language = 'en' and description_auto_translated and md5(description) = '80359b4d02745b1062a0ed19d9f4d030';

-- 205 the-wind-up-bird-chronicle
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 205 and language = 'en' and description_auto_translated and md5(description) = '5d9cff41679110071ae41e6e42462599';

-- 206 a-moveable-feast
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 206 and language = 'en' and description_auto_translated and md5(description) = 'cd6b038da7810206111b2b9e473a6901';

-- 207 men-without-women
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 207 and language = 'en' and description_auto_translated and md5(description) = 'abac60d97681962ff144731540fbfa3c';

-- 208 ernest-hemingway-selected-letters-1917-1961
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 208 and language = 'en' and description_auto_translated and md5(description) = 'a35aec223501404c83d0a62425c5a2d6';

-- 209 f-scott-fitzgerald-the-great-gatsby
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 209 and language = 'en' and description_auto_translated and md5(description) = 'b83c4bfc34d4d32a44e936f7fa08d97b';

-- 210 7-best-short-stories-by-f-scott-fitzgerald
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 210 and language = 'en' and description_auto_translated and md5(description) = '88e06932c9045c6972e0b729c5cf9c58';

-- 211 fitzgerald-the-love-of-the-last-tycoon
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 211 and language = 'en' and description_auto_translated and md5(description) = '8f39a77bc47daf69e1d7738e4c61221f';

-- 212 f-scott-fitzgerald-on-writing
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 212 and language = 'en' and description_auto_translated and md5(description) = '5905bb7285a6d9b876368a21457d57df';

-- 213 and-the-mountains-echoed
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 213 and language = 'en' and description_auto_translated and md5(description) = 'a82ce1f968cfd9148d858b933040b322';

-- 214 the-kite-runner-4054
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 214 and language = 'en' and description_auto_translated and md5(description) = '931a32084dde0c2b9d163ab3fde1f689';

-- 215 the-complete-khaled-hosseini-box-set
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 215 and language = 'en' and description_auto_translated and md5(description) = '8b3cdbe2d6c2bc65bc3ab51d08e48e54';

-- 216 death-comes-as-the-end
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 216 and language = 'en' and description_auto_translated and md5(description) = 'b8516fb1edbc2a269e5ea97b68fe70f2';

-- 218 agatha-christie
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 218 and language = 'en' and description_auto_translated and md5(description) = '3a18474d284fc0d53e850410438500bd';

-- 219 next-to-a-dog-an-agatha-christie-short-story
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 219 and language = 'en' and description_auto_translated and md5(description) = 'cd51e37d8cb92fec3d81a063b6e2526f';

-- 220 people-and-performance
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 220 and language = 'en' and description_auto_translated and md5(description) = 'd36070015060981b7249624fff7fcde5';

-- 221 peter-f-drucker-boxed-set-8-books-the-drucker-library
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 221 and language = 'en' and description_auto_translated and md5(description) = '971bce31180e047ba7b1ed009952bbf9';

-- 222 the-practice-of-management
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 222 and language = 'en' and description_auto_translated and md5(description) = 'a3a73bf43e8af88925e7f8dc139c8e9c';

-- 223 management
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 223 and language = 'en' and description_auto_translated and md5(description) = 'c21b5a0b1e23e5ad3fc11d4c6c48f157';

-- 224 the-essential-drucker
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 224 and language = 'en' and description_auto_translated and md5(description) = '41d8c7972019548130e4cdf5725af608';

-- 225 peter-f-drucker-on-business-and-society
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 225 and language = 'en' and description_auto_translated and md5(description) = 'e493c91a3642107d0bdf4b834288420c';

-- 226 classic-drucker
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 226 and language = 'en' and description_auto_translated and md5(description) = '232081bd3d8ca95d7c2d83bdbe7cb234';

-- 227 peter-f-drucker-on-management-essentials
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 227 and language = 'en' and description_auto_translated and md5(description) = '1c40ef882164cc607081831973f6459a';

-- 228 peter-f-drucker-on-technology
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 228 and language = 'en' and description_auto_translated and md5(description) = '2d7b2f7e205389fbe77428f614caaa91';

-- 229 the-peter-f-drucker-reader
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 229 and language = 'en' and description_auto_translated and md5(description) = 'cef04f8116c7740fc3f9a48808b140d0';

-- 230 the-age-of-discontinuity
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 230 and language = 'en' and description_auto_translated and md5(description) = '3b0fdd7336e545b241f594b9f95badc8';

-- 231 the-ecological-vision
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 231 and language = 'en' and description_auto_translated and md5(description) = 'bcf7102675426186ffd1a9455db8da99';

-- 232 adventures-of-a-bystander
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 232 and language = 'en' and description_auto_translated and md5(description) = 'dc389739258c25532f4e9fb9421a833b';

-- 233 great-by-choice
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 233 and language = 'en' and description_auto_translated and md5(description) = 'baa8ae6075ff77e0b5a874d86c22350e';

-- 234 built-to-last
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 234 and language = 'en' and description_auto_translated and md5(description) = '095d91fb5e46f6d3b1a0684b3dcc219d';

-- 235 beyond-entrepreneurship-2-0
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 235 and language = 'en' and description_auto_translated and md5(description) = 'a7c4956f93fec3342137952e3c0cd1ed';

-- 236 good-to-great
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 236 and language = 'en' and description_auto_translated and md5(description) = '27efb381104937832681428f713a791f';

-- 237 turning-the-flywheel
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 237 and language = 'en' and description_auto_translated and md5(description) = 'c48a56b9c76b31e32e83014d873f0765';

-- 238 what-to-make-of-a-life
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 238 and language = 'en' and description_auto_translated and md5(description) = '61aab9afef0ae0d9f44d53750d1e4f3f';

-- 239 the-infinite-game
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 239 and language = 'en' and description_auto_translated and md5(description) = '25db9fa014f6c39782c87e243300aaa3';

-- 240 together-is-better
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 240 and language = 'en' and description_auto_translated and md5(description) = '8b437fbb2541631a996753d689c3458e';

-- 241 start-with-why
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 241 and language = 'en' and description_auto_translated and md5(description) = '6372fddb48349266db35f1e6a93f03f9';

-- 242 leaders-eat-last
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 242 and language = 'en' and description_auto_translated and md5(description) = 'fd430bb8918c22c9402e5d06ce557d88';

-- 243 find-your-why
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 243 and language = 'en' and description_auto_translated and md5(description) = '3ca1a52e63abe6db8cd79ac8a67089d9';

-- 244 atomic-habits
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 244 and language = 'en' and description_auto_translated and md5(description) = 'b9caee7cc47d04e7e69a213ef57b59f9';

-- 245 leadership-mastery
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 245 and language = 'en' and description_auto_translated and md5(description) = 'c7d4954ceaab9b9e9b7fa95c2bf685a8';

-- 246 make-yourself-unforgettable
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 246 and language = 'en' and description_auto_translated and md5(description) = '0ccbb6f86990822818cb032342fd854e';

-- 247 the-essential-dale-carnegie
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 247 and language = 'en' and description_auto_translated and md5(description) = '8d40d9f2876b8536225fcc810db89a34';

-- 249 dale-carnegie-omnibus-how-to-stop-worrying-and-start-living-how-to-enjoy-your-li
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 249 and language = 'en' and description_auto_translated and md5(description) = 'f612fa02adc899b5c4732c25d0f82a9f';

-- 250 the-5-essential-people-skills
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 250 and language = 'en' and description_auto_translated and md5(description) = 'ed1e8fbf47340f33ff06072d3d979deb';

-- 251 the-leader-in-you-transform-your-life-with-dale-carnegie-s-leadership-principles
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 251 and language = 'en' and description_auto_translated and md5(description) = '6e3989bee4b382caf7316e6cc272e8e0';

-- 252 the-wisdom-and-teachings-of-stephen-r-covey
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 252 and language = 'en' and description_auto_translated and md5(description) = '31f5808d90b826653daabab7ec242e0a';

-- 253 first-things-first
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 253 and language = 'en' and description_auto_translated and md5(description) = '164124acca23b945711c6b28887307f9';

-- 255 principle-centered-leadership
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 255 and language = 'en' and description_auto_translated and md5(description) = '0e2088f836a083eed9b9796b6f76dfe8';

-- 256 the-8th-habit
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 256 and language = 'en' and description_auto_translated and md5(description) = '1ca32f5c58ab7415d4324192d95d2e34';

-- 257 the-7-habits-of-highly-effective-people-revised-and-updated
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 257 and language = 'en' and description_auto_translated and md5(description) = '422cfcf33d1a5b7bbf48e97196c1c6b6';

-- 258 how-not-to-be-a-twit-and-other-wisdom-from-roald-dahl
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 258 and language = 'en' and description_auto_translated and md5(description) = '19f195f1f63a44b41b9c774605edc9cc';

-- 259 roald-dahl-lift-the-flap-hide-and-seek
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 259 and language = 'en' and description_auto_translated and md5(description) = '7107a7fd647f3073cdaf165588cdc1b8';

-- 260 charlie-and-the-chocolate-factory-the-roald-dahl-clothbound-collection
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 260 and language = 'en' and description_auto_translated and md5(description) = '40d6f025b01b5ae6da8a402fe84d4ab1';

-- 261 roald-dahl-s-rotsome-and-repulsant-words
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 261 and language = 'en' and description_auto_translated and md5(description) = '1976ae2b8608cd2178551ecf24f61c24';

-- 262 ladybird-readers-level-4-roald-dahl-esio-trot-elt-graded-reader
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 262 and language = 'en' and description_auto_translated and md5(description) = '20546e3d3e9ac4597f955b9235818730';

-- 263 roald-dahl-s-revolting-recipes
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 263 and language = 'en' and description_auto_translated and md5(description) = 'fbe16cda741ae58fd5b3e57150529c28';

-- 264 theodor-seuss-geisel
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 264 and language = 'en' and description_auto_translated and md5(description) = '5a0620069cfac8895bee8a4bec31cf8f';

-- 265 dr-seuss-discovers-the-human-body
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 265 and language = 'en' and description_auto_translated and md5(description) = 'be200e681319950943d68c8e459431a2';

-- 266 dr-seuss-s-winter-things
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 266 and language = 'en' and description_auto_translated and md5(description) = '91e71fa64d4c620e5f513cf6e4fb9d13';

-- 267 dr-seuss-s-lovey-things
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 267 and language = 'en' and description_auto_translated and md5(description) = '00152d85bbfe5e7b5b0a4f0ad06cd0b4';

-- 268 dr-seuss-storybook
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 268 and language = 'en' and description_auto_translated and md5(description) = '013a1c63767cba9f1b443e8eb16083af';

-- 269 dr-seuss-s-sleep-softly-book
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 269 and language = 'en' and description_auto_translated and md5(description) = '9bd8e9e2f9e52ceac731b6d0442a28a6';

-- 270 dr-seuss-s-1-2-3
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 270 and language = 'en' and description_auto_translated and md5(description) = 'f3b0bbbb01b7265339de14356eaeea06';

-- 271 dr-seuss-s-sleep-book
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 271 and language = 'en' and description_auto_translated and md5(description) = '5924a254e9aa1b0d60da02d8aa068074';

-- 272 eric-carle-s-very-little-library
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 272 and language = 'en' and description_auto_translated and md5(description) = 'a9788e8a56c3dfc5f2eb15ccfb356069';

-- 273 the-art-of-eric-carle
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 273 and language = 'en' and description_auto_translated and md5(description) = '8405c41965d0df424d7f9c19730df323';

-- 274 the-eric-carle-library
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 274 and language = 'en' and description_auto_translated and md5(description) = '1eaa8565c12103369d46491aa86ad689';

-- 275 a-book-of-things
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 275 and language = 'en' and description_auto_translated and md5(description) = 'd82792bca9a686c180392652f94fbb38';

-- 276 eric-carle-s-how-things-grow
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 276 and language = 'en' and description_auto_translated and md5(description) = '60eb621cec0da784e9497dfa90f46c33';

-- 277 the-very-hungry-caterpillar-s-favorite-words
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 277 and language = 'en' and description_auto_translated and md5(description) = '6a6f2435c03461bccba6b5f74cce1180';

-- 278 the-very-eric-carle-treasury
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 278 and language = 'en' and description_auto_translated and md5(description) = '3fbd1145cc4454d58aa7e73ceb16dde6';

-- 279 money
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 279 and language = 'en' and description_auto_translated and md5(description) = 'd7ee69cd17d6279b6bd6cd1955047d92';

-- 280 sapiens
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 280 and language = 'en' and description_auto_translated and md5(description) = '81187180c2bc18fa7953a09a778726e2';

-- 282 21-lessons-for-the-21st-century
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 282 and language = 'en' and description_auto_translated and md5(description) = '7c7bc2a66f629ab45b0081f6f5fd6ca5';

-- 283 unstoppable-us-the-two-book-boxed-set
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 283 and language = 'en' and description_auto_translated and md5(description) = '50d8a2a80baa21bf702d972ab94ddc9d';

-- 284 nexus
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 284 and language = 'en' and description_auto_translated and md5(description) = 'da9d970657e4e845bd4bced4edb437a0';

-- 285 the-grand-design
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 285 and language = 'en' and description_auto_translated and md5(description) = '735489371ab20debaba863a8be0d2bdd';

-- 286 a-briefer-history-of-time
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 286 and language = 'en' and description_auto_translated and md5(description) = 'e828ca1f4abb28d2e083f02f4e365a96';

-- 287 black-holes-the-reith-lectures
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 287 and language = 'en' and description_auto_translated and md5(description) = 'de61aa765f06e62eff9b293551848ff1';

-- 288 the-illustrated-brief-history-of-time
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 288 and language = 'en' and description_auto_translated and md5(description) = '6e80c293ff269d5e8ce4d2aff910d37d';

-- 289 the-universe-in-a-nutshell
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 289 and language = 'en' and description_auto_translated and md5(description) = '72d6d3a9ba2596305e990dfcdf44a5a0';

-- 290 black-holes-and-baby-universes
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 290 and language = 'en' and description_auto_translated and md5(description) = 'b6018d5cedc5665943b3231a96887a14';

-- 291 brief-answers-to-the-big-questions
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 291 and language = 'en' and description_auto_translated and md5(description) = 'aa28325f3be5d4da7ce32404eaaf0018';

-- 293 you-and-the-universe
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 293 and language = 'en' and description_auto_translated and md5(description) = '2dca619864db3d6445f05a210c4f2e25';

-- 294 a-brief-history-of-time-6923
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 294 and language = 'en' and description_auto_translated and md5(description) = '2d45e189c03f3afe5322705a1c8506e4';

-- 295 the-large-the-small-and-the-human-mind
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 295 and language = 'en' and description_auto_translated and md5(description) = '5158a9b3f52599ef6569d623d4b35e1b';

-- 296 carl-sagan-s-cosmic-connection
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 296 and language = 'en' and description_auto_translated and md5(description) = 'd7406fdb1dae6178254f400a6c0607ab';

-- 297 billions-billions
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 297 and language = 'en' and description_auto_translated and md5(description) = '6ddf69169d1c93eb0f96b8ee3deba540';

-- 298 contact
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 298 and language = 'en' and description_auto_translated and md5(description) = '275ae265457aa907e7d584fd37d8dc02';

-- 299 broca-s-brain
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 299 and language = 'en' and description_auto_translated and md5(description) = 'a7e963e734ddb227504c8ce0b8b55b8d';

-- 300 dragons-of-eden
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 300 and language = 'en' and description_auto_translated and md5(description) = '1d1524ca3e301879116fb4be81f81c9a';

-- 301 cosmos
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 301 and language = 'en' and description_auto_translated and md5(description) = '3cde3492da573e258c10dcd74afa4c3d';

-- 302 murmurs-of-earth
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 302 and language = 'en' and description_auto_translated and md5(description) = 'cd3c74f8f1ad128eb457afb09f11b397';

-- 303 pale-blue-dot
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 303 and language = 'en' and description_auto_translated and md5(description) = 'ad94c9f2b9a52dd1cb1173149c118fcb';

-- 304 the-varieties-of-scientific-experience
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 304 and language = 'en' and description_auto_translated and md5(description) = 'e0e5a55c32926ae4329ceb375e92e043';

-- 305 at-home
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 305 and language = 'en' and description_auto_translated and md5(description) = '3f4fdf1c2552dcc9543fcfabc3012250';

-- 306 the-body
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 306 and language = 'en' and description_auto_translated and md5(description) = '4ae093336d3a37f759f9302814e5d0c9';

-- 307 the-mother-tongue
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 307 and language = 'en' and description_auto_translated and md5(description) = 'b990e37034cb782863a904ebfb56e8a0';

-- 308 made-in-america
update public.books set description = description_en, description_en = null, description_auto_translated = false
where id = 308 and language = 'en' and description_auto_translated and md5(description) = 'e5224e48cde746d9d09d75fe8590190e';


-- Kiểm cả lô (112 id).
do $$ declare v_co text; v_khac text; v_ve int; v_khac_n int; v_admin int; v_tong int; begin select string_agg(b.id::text, ',' order by b.id) filter (where b.description_auto_translated), string_agg(b.id::text, ',' order by b.id) filter (where not b.description_auto_translated and b.description_en is null and md5(b.description) is distinct from v.md5_goc), count(*) filter (where not b.description_auto_translated and b.description_en is null and md5(b.description) = v.md5_goc), count(*) filter (where not b.description_auto_translated and b.description_en is null and md5(b.description) is distinct from v.md5_goc), count(*) filter (where not b.description_auto_translated and b.description_en is not null), count(*) into v_co, v_khac, v_ve, v_khac_n, v_admin, v_tong from public.books b join (values (192, 'f6caba898bc8d35425b7c3c3b0ac3c38'), (193, '724ee94bb64e52fc630bdf464602d4db'), (194, '2839904726d806334200e0b168b47c66'), (195, 'dd7c23d62ff344318c6db4ca2633f6f0'), (196, '5b893e4831d5b42f335bfdfd5d4210c9'), (197, '01ff2b1fd26a7d000ddc6f17ba2e3e76'), (198, 'b6c29140250eda674f3588f4ece84c3a'), (199, '3758208e2d79ce88c4ee7842414a9628'), (200, 'c69acca855174ce64f8ab792b0bebb59'), (201, '7843fe8f378a0dfdc9e03ecc657af932'), (202, '9427f4906cde5aa275a7d8a0e6f663dd'), (203, '7585a00f9dcf7811ff94d5a5def5f54e'), (204, '9a4e963e86bf8c73d1ecfe2e2d2931fd'), (205, '3f7fbbcf1a3e72aa2918b51cbe5e6aad'), (206, '089a79645bdbe7885c98a9de38341684'), (207, '61926590dbffc90fd91ef2116fbba5ba'), (208, '674a22e9769b6428dc724fd5a978cf2d'), (209, '06d729398fefca6fe07b4e4259366b9c'), (210, '7e86b1666006db7fb490f1311a69752e'), (211, '2f21ebbd6b0d8c7e3599a9a3cbc1011f'), (212, '4f61fded181f5254bdb98e79df9633fc'), (213, '93eaccc1d8025c995c791853826f799c'), (214, 'fcf06b0f3f088d8f9892832e5407bf42'), (215, '41c37702930962bf9b0d85bc987cb0f6'), (216, '09e4f0fdb0044c005261a7a08a95da6c'), (218, '48c07fec30c5c1a6bab8a852b4ca10fa'), (219, 'e5b0a29888c8683e87a3f03be95d3075'), (220, '0c14a8329e99d9d3895332f652d1198c'), (221, 'ec1ff78f05f9c3ac09bc63fa11b68038'), (222, 'e57d4418ca7fbd3e7a63f0fcba11d785'), (223, 'a75c4e008a85f6e2a3cfa29adf2fc7da'), (224, '0a6e23dc11838544739a2fceb8db5ad0'), (225, 'ca3c1cfa73946e5add34d01554959573'), (226, 'a208a071a71e63e859e3a1e5be06997b'), (227, '8afa55be88e1f14edf30958fb317a30b'), (228, '0044439247662d851ef852eb0bd65db7'), (229, '0d56649dd96d68100ac35a100b882540'), (230, '461b1c0badca148cd444588d9dc3ccc6'), (231, 'dc436de9e07180abaac837f84651a3d6'), (232, 'e14876f3546544e77ad4b0f2bcc519f9'), (233, '27906f869da0f5642d4f3bb1e7f467c6'), (234, 'd5b1995e49de6c3d265786c8fa7a2c45'), (235, '6ffd752ecd028b5f2f06511be7f2eacf'), (236, '64b92a6c438b6f6f8c28d962538c395a'), (237, '7636bf16d7daf1aea122b7280a1ed6f7'), (238, 'c2207623762ba0a255c2b536a28b74c1'), (239, '5b4ac3a93f0c846471b7308331178b5f'), (240, 'b154e47913ee7ab48fd3fc35cc64d5b0'), (241, '30937fb528d3adeaf04e1e27a5fbd248'), (242, '58c3cdc278d0c40b33af6efead593682'), (243, 'd325d1db86727c92f930e00f5c6a0c7d'), (244, 'f90607930da01d8c0af6961a3b478dc8'), (245, 'ec54e0681c12eecda18ff4114618de73'), (246, '0a741575472640273ce620784c6ff2be'), (247, '4ab9d7fd81097c381c26e969e0d946f0'), (249, 'de875a802729c4472998c0a75e6c738f'), (250, '5cd5fef0b84b86fc75f3002338ce417b'), (251, 'b14209ab8961973ea68f7a1c1ae25f8b'), (252, '8dd6199c73aa728fb824241f043d0beb'), (253, '069b7b2c16c0912fd4801659df570840'), (255, '6ffcaf83c584bf9029e03b74663afe85'), (256, '9a93d9d31e6144f89f68bbb4d4a12770'), (257, 'b3b7fa55a3bd09f9cd80cdc3af91433c'), (258, 'c01a3aa854270d6c1828601e19573aa6'), (259, 'e655e395747e10e7a4f22447df6d4d4c'), (260, '575f5b670346dc64fb7bfea7c541462a'), (261, 'a6f687ad148ebd342e85f707fd89c367'), (262, '0574efc51c5458161583a61ddae68743'), (263, 'fed9b1dc622d9defe78b06ca1a8e44f1'), (264, 'df38ee8e589a9d997f2e3cdaa6c745af'), (265, 'af7b8ed333d7052f317c6cecdcff1d1d'), (266, 'f4c7fa565a797dcec2fec6f61e787f12'), (267, '64949da5a3f0e5f504a1afda3f675d44'), (268, 'c8e1430cfa2829f830b0a7cf4ea754c9'), (269, '4d21389950dd5d297e6af4940bdc0dee'), (270, '677beb2262bd7765369194d93a20d31d'), (271, '7afc36cbb41b72b5a38aa1a0fcdd042e'), (272, '114e72badfa097c19a2ed4d8a070db98'), (273, 'e779d3bb5aad8d3410fe180ca223de8b'), (274, '7b9bcee59c10685e3a603edaf9d8ab94'), (275, 'b6525752eafda27f496f28859d248769'), (276, '19723bcd5688c7ec8a1f6b16986823f5'), (277, 'e1928155412e9a42bc955653bab72a19'), (278, '23d7dedc2c921a99c7d841d6a2e08f5c'), (279, '7b5928fb378c40e6af208ff0ac32e4c2'), (280, 'a789b0f92d9f3fc37b19af87c335822c'), (282, 'bef1fcde1446dcb5ee156df8ae310fbf'), (283, '98605f5da59273ec1e24e183e4fcf58d'), (284, '73f70971629ab59a19b49ccefb52109a'), (285, '5ae590d852d205daec3f03421e80a959'), (286, 'bd763f034a9f6949e9fa99b632e8b044'), (287, '852456f79a9a3655b350999cbdc0a7e4'), (288, '2e3b6173b4b36ff4d9583dd9d4c3f08a'), (289, '53fb6d7ef7abb2ac7857111ab61835f1'), (290, '229b77b557f40115d344fb8ec9335814'), (291, 'da10f9736f47f6037ed03aa60ac4177c'), (293, '71a984dc89c648983bba9064da3aabed'), (294, 'b41891e076cef7da41a103a562c07734'), (295, '57f8df28fc501b1d41856be6578a2cbc'), (296, 'b1eaf15d918e3f7f2dac440b9d9da4fe'), (297, '524db6a5f51697555faecc979866d835'), (298, 'a256217e49a4b2fda3557784ba142d52'), (299, 'a3f23561000f41b0cbb2fafb88e44302'), (300, '793bb6d102b81337f4cc21b55a23eb2b'), (301, 'a934e16d2d3f99516d7726d5bdc8475d'), (302, 'bafd44dcdaa82cc828a0688407a8415e'), (303, 'aa30ec11d1c571a1b2bd120cd301d3e7'), (304, 'ea6acd58b7d785cf27522e7ee46d0636'), (305, 'dfb1d84aa33271ce916d6868084c8d53'), (306, '59d1f1a91f4f161bdff490c2fc0b3706'), (307, 'ba600c7f608da1377672c8d2b254597d'), (308, 'e0c72aed370179007680ac21eade3fa4')) as v(id, md5_goc) on b.id = v.id where b.language = 'en'; if v_co is not null then raise exception 'mo-ta-song-ngu vong 4 hoan tac: id con co (ban dich bi doi ma co chua tat?): %, rollback', v_co; end if; if v_tong <> 112 then raise exception 'mo-ta-song-ngu vong 4 hoan tac: ky vong 112 id, thay % (thieu sach?), rollback', v_tong; end if; if v_khac is not null then raise notice 'mo-ta-song-ngu vong 4 hoan tac: id da ve nhung description khac md5 ban goc luc doc (admin da sua ban Anh, truong hop ii): %', v_khac; end if; raise notice 'mo-ta-song-ngu vong 4 hoan tac: % sach ve ban goc, % sach ve ban Anh admin da sua, % sach admin da sua ban dich (bo qua)', v_ve, v_khac_n, v_admin; end $$;

commit;
