-- Phase 11: bộ đếm lượt của chatbot "Mây" (docs/plans/phase-11.md, mục DB / migration).
--   1. private.chat_quota: bộ đếm theo cửa sổ thời gian (khách theo giờ / ngày VN, IP băm, trần chung lượt gọi Gemini
--      theo phút / ngày America/Los_Angeles: Google reset RPD lúc 0h giờ Thái Bình Dương). Không lưu nội dung chat,
--      không lưu IP thô (app gửi HMAC).
--   2. private.chat_settings: sha256 của CHAT_QUOTA_TOKEN (token chỉ ở server web). Không có token đúng thì
--      consume_chat_quota không ghi gì: khóa publishable nằm trên trình duyệt, ai cũng gọi được RPC này.
--   3. RPC consume_chat_quota (anon + authenticated, server web gọi bằng khóa publishable), set_chat_quota_token
--      (chỉ service_role: e2e local), private.new_chat_quota_token() (chủ dự án chạy trong SQL Editor).
-- Chạy một lần trong SQL Editor. Idempotent (if not exists, create or replace, revoke / grant). Chỉ thêm bảng / hàm
-- mới, không đổi bảng / hàm / dữ liệu có sẵn. Không cần extension: sha256() và gen_random_uuid() có sẵn (Postgres 13+).

begin;

-- 1. Bộ đếm. Schema private: PostgREST không lộ ra; RLS bật, không policy → anon / authenticated không đọc / ghi được
create table if not exists private.chat_quota (
  bucket       text        not null check (char_length(bucket) <= 80),  -- 'visitor:hour:<hmac>', 'gemini:day'…
  window_start timestamptz not null,
  used         int         not null default 0 check (used >= 0),
  primary key (bucket, window_start)
);

create index if not exists chat_quota_window_idx on private.chat_quota (window_start);

alter table private.chat_quota enable row level security;

-- 2. Token của server web: một dòng, chỉ lưu sha256
create table if not exists private.chat_settings (
  id          boolean primary key default true check (id),
  token_hash  bytea not null,
  updated_at  timestamptz not null default now()
);

alter table private.chat_settings enable row level security;

revoke all on table private.chat_quota, private.chat_settings from public, anon, authenticated;

-- Cộng 1 vào một bucket; vượt p_limit → exception (rollback mọi lần cộng trước đó trong cùng lời gọi RPC)
create or replace function private.chat_quota_take(
  p_bucket    text,
  p_window    timestamptz,
  p_limit     int,
  p_error     text,
  p_scope     text,
  p_resets_at timestamptz
)
returns int
language plpgsql set search_path = '' as $$
declare
  v_used int;
begin
  insert into private.chat_quota as q (bucket, window_start, used)
  values (p_bucket, p_window, 1)
  on conflict (bucket, window_start) do update set used = q.used + 1
  returning q.used into v_used;

  if v_used > p_limit then
    raise exception '%', p_error
      using detail = json_build_object('scope', p_scope, 'resets_at', p_resets_at)::text;
  end if;

  return v_used;
end;
$$;

-- 3. Trừ lượt cho MỘT lượt gọi Gemini.
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
  p_visitor text,
  p_ip      text,
  p_limits  jsonb
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

-- Đặt token (lưu sha256). Chỉ service_role (e2e local đặt token cố định); production dùng private.new_chat_quota_token()
create or replace function public.set_chat_quota_token(p_token text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'token')::text;
  end if;

  insert into private.chat_settings (id, token_hash)
  values (true, sha256(convert_to(p_token, 'UTF8')))
  on conflict (id) do update set token_hash = excluded.token_hash, updated_at = now();
end;
$$;

-- Sinh token mới (64 hex từ 2 UUID v4 = 244 bit ngẫu nhiên của pg_strong_random), lưu hash, trả token để đặt vào
-- CHAT_QUOTA_TOKEN. Chạy lại = đổi token: server đang dùng token cũ bị từ chối (FORBIDDEN) tới khi cập nhật env.
create or replace function private.new_chat_quota_token()
returns text
language plpgsql set search_path = '' as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  perform public.set_chat_quota_token(v_token);
  return v_token;
end;
$$;

revoke execute on function private.chat_quota_take(text, timestamptz, int, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function private.new_chat_quota_token() from public, anon, authenticated;

revoke execute on function public.consume_chat_quota(text, text, text, jsonb) from public;
grant  execute on function public.consume_chat_quota(text, text, text, jsonb) to anon, authenticated;

revoke execute on function public.set_chat_quota_token(text) from public, anon, authenticated;
grant  execute on function public.set_chat_quota_token(text) to service_role;

notify pgrst, 'reload schema';

commit;
