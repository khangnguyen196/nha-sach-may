-- Phase 11 (bổ sung): consume_chat_quota nhận p_visitor / p_ip / p_limits có default null.
--   Lý do: types sinh tự động (supabase gen types) coi tham số không có default là bắt buộc kiểu string, nên app không
--   truyền được null cho p_ip (khách đã đăng nhập: chỉ đếm theo user id, không theo IP) nếu không ép kiểu. Có default
--   thì types thành tùy chọn, app bỏ trường → Postgres dùng null.
--   Hành vi không đổi: thân hàm y hệt bản 20261018100000_chat_quota.sql; p_limits null vẫn bị từ chối (INVALID_INPUT).
--   Cùng kiểu tham số (text, text, text, jsonb) → create or replace giữ nguyên quyền đã cấp; vẫn grant / revoke lại cho
--   chắc chắn.
-- Chạy một lần trong SQL Editor, SAU migration 20261018100000. Idempotent.

begin;

-- Trừ lượt cho MỘT lượt gọi Gemini (bản có default; thân hàm giữ nguyên bản 20261018100000).
--   p_visitor (HMAC 32 hex) khác null = câu hỏi mới của khách: +1 visitor:hour, visitor:day (ngày VN) và, nếu có
--   p_ip (HMAC 32 hex, chỉ khách chưa đăng nhập), +1 ip:hour, ip:day. p_visitor = null: chỉ trần chung (lượt gọi lại).
--   Luôn +1 gemini:minute, gemini:day (ngày America/Los_Angeles).
--   p_limits: {"visitorPerHour","visitorPerDay","ipPerHour","ipPerDay","geminiCallsPerMinute","geminiCallsPerDay"},
--   số nguyên 1–100000 (giá trị lấy từ src/features/chat/config.ts).
--   Vượt: CHAT_QUOTA_EXCEEDED (khách / IP) hoặc CHAT_FREE_QUOTA (trần chung), detail {"scope", "resets_at"}.
--   Bucket của khách xét trước trần chung để báo đúng phạm vi. Cửa sổ tính theo múi giờ cố định, không theo
--   TimeZone của phiên.
create or replace function public.consume_chat_quota(
  p_token   text,
  p_visitor text  default null,
  p_ip      text  default null,
  p_limits  jsonb default null
)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_hash   bytea;
  v_now    timestamptz := now();
  v_minute timestamptz := date_trunc('minute', v_now at time zone 'UTC') at time zone 'UTC';
  v_hour   timestamptz := date_trunc('hour', v_now at time zone 'UTC') at time zone 'UTC';
  v_vn_day timestamp   := date_trunc('day', v_now at time zone 'Asia/Ho_Chi_Minh');
  v_la_day timestamp   := date_trunc('day', v_now at time zone 'America/Los_Angeles');
  v_key    text;
  v_limit  jsonb;
begin
  select s.token_hash into v_hash from private.chat_settings s where s.id;
  if v_hash is null then
    raise exception 'CHAT_DISABLED';
  end if;
  if p_token is null or sha256(convert_to(p_token, 'UTF8')) <> v_hash then
    raise exception 'FORBIDDEN';
  end if;

  if p_visitor is not null and p_visitor !~ '^[0-9a-f]{32}$' then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'visitor')::text;
  end if;
  if p_ip is not null and (p_visitor is null or p_ip !~ '^[0-9a-f]{32}$') then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'ip')::text;
  end if;
  foreach v_key in array array['visitorPerHour', 'visitorPerDay', 'ipPerHour', 'ipPerDay',
                               'geminiCallsPerMinute', 'geminiCallsPerDay'] loop
    v_limit := p_limits -> v_key;
    -- Hai câu if riêng: SQL không bảo đảm thứ tự của or, ép kiểu ::int chỉ chạy khi đã chắc là số nguyên
    if v_limit is null or jsonb_typeof(v_limit) <> 'number' or v_limit::text !~ '^[0-9]{1,6}$' then
      raise exception 'INVALID_INPUT'
        using detail = json_build_object('field', v_key, 'max', 100000)::text;
    end if;
    if v_limit::text::int not between 1 and 100000 then
      raise exception 'INVALID_INPUT'
        using detail = json_build_object('field', v_key, 'max', 100000)::text;
    end if;
  end loop;

  if p_visitor is not null then
    perform private.chat_quota_take('visitor:hour:' || p_visitor, v_hour, (p_limits ->> 'visitorPerHour')::int,
      'CHAT_QUOTA_EXCEEDED', 'visitor_hour', v_hour + interval '1 hour');
    perform private.chat_quota_take('visitor:day:' || p_visitor, v_vn_day at time zone 'Asia/Ho_Chi_Minh',
      (p_limits ->> 'visitorPerDay')::int,
      'CHAT_QUOTA_EXCEEDED', 'visitor_day', (v_vn_day + interval '1 day') at time zone 'Asia/Ho_Chi_Minh');
    if p_ip is not null then
      perform private.chat_quota_take('ip:hour:' || p_ip, v_hour, (p_limits ->> 'ipPerHour')::int,
        'CHAT_QUOTA_EXCEEDED', 'ip_hour', v_hour + interval '1 hour');
      perform private.chat_quota_take('ip:day:' || p_ip, v_vn_day at time zone 'Asia/Ho_Chi_Minh',
        (p_limits ->> 'ipPerDay')::int,
        'CHAT_QUOTA_EXCEEDED', 'ip_day', (v_vn_day + interval '1 day') at time zone 'Asia/Ho_Chi_Minh');
    end if;
  end if;

  perform private.chat_quota_take('gemini:minute', v_minute, (p_limits ->> 'geminiCallsPerMinute')::int,
    'CHAT_FREE_QUOTA', 'gemini_minute', v_minute + interval '1 minute');
  -- Ngày Los Angeles: cộng 1 ngày trên giờ địa phương rồi mới đổi sang timestamptz → đúng cả ngày đổi giờ (23 / 25 giờ)
  if private.chat_quota_take('gemini:day', v_la_day at time zone 'America/Los_Angeles',
       (p_limits ->> 'geminiCallsPerDay')::int,
       'CHAT_FREE_QUOTA', 'gemini_day', (v_la_day + interval '1 day') at time zone 'America/Los_Angeles') = 1 then
    -- Lượt gọi đầu tiên của ngày mới: dọn bộ đếm cũ, một lần mỗi ngày, không cần pg_cron
    delete from private.chat_quota where window_start < v_now - interval '3 days';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.consume_chat_quota(text, text, text, jsonb) from public;
grant  execute on function public.consume_chat_quota(text, text, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
