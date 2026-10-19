-- Lượt dùng chatbot Mây (bảng private.chat_quota, consume_chat_quota trong schema.sql). MỌI CÂU CHỈ ĐỌC.
-- Chạy trong SQL Editor của Supabase. Bảng chỉ giữ ~3 ngày gần nhất (consume_chat_quota xóa dòng cũ hơn 3 ngày).
-- Trần lấy từ src/features/chat/config.ts (geminiCallsPerDay 400, visitorPerDay 30, geminiCallsPerMinute 10):
-- đổi config thì sửa số ở đây.

-- Q1 lượt gọi Gemini mỗi ngày (ngày Los Angeles), trần 400
select (window_start at time zone 'America/Los_Angeles')::date as ngay_google, to_char(window_start at time zone 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI') as bat_dau_gio_vn, used as luot_goi_gemini, 400 - used as con_lai from private.chat_quota where bucket = 'gemini:day' order by window_start desc;

-- Q2 khách dùng chatbot mỗi ngày (ngày VN), mỗi khách tối đa 30 câu
select (window_start at time zone 'Asia/Ho_Chi_Minh')::date as ngay_vn, count(*) as so_khach, sum(used) as so_cau_hoi, max(used) as nhieu_nhat_1_khach, count(*) filter (where used >= 30) as khach_cham_tran_ngay from private.chat_quota where bucket like 'visitor:day:%' group by 1 order by 1 desc;

-- Q3 10 phút đông nhất, trần 10 / phút
select to_char(window_start at time zone 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI') as phut_gio_vn, used as luot_goi_gemini from private.chat_quota where bucket = 'gemini:minute' order by used desc, window_start desc limit 10;
