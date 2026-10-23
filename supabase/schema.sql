-- =====================================================================
-- NHÀ SÁCH ONLINE — DATABASE SCHEMA (Supabase / PostgreSQL)
-- Cách dùng: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run.
-- Chạy MỘT lần trên project mới. Sau đó chạy tiếp file seed.sql.
--
-- Quy ước:
--   • Tiền tệ lưu bằng số nguyên, đơn vị VND (không dùng số thập phân).
--   • Bảo mật dựa vào Row Level Security (RLS): mỗi bảng đều bật RLS.
--   • Đơn hàng CHỈ được tạo qua hàm place_order() — client không tự tính giá.
--   • Song ngữ: nội dung tiếng Việt ở cột gốc, tiếng Anh ở cột *_en (null → fallback về tiếng Việt).
--   • Lỗi nghiệp vụ trả về MÃ LỖI (VD: 'OUT_OF_STOCK'), app tự dịch theo ngôn ngữ.
--     Chi tiết kèm theo (nếu có) nằm trong DETAIL dạng JSON.
--   • Hàm nội bộ nằm trong schema "private": PostgREST không public chúng thành RPC.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists unaccent with schema extensions;  -- bỏ dấu tiếng Việt khi tìm kiếm
create extension if not exists pg_trgm  with schema extensions;  -- tăng tốc tìm kiếm LIKE '%...%'


-- ---------------------------------------------------------------------
-- 1. KIỂU DỮ LIỆU (ENUM)
-- ---------------------------------------------------------------------
create type public.user_role      as enum ('customer', 'admin');
create type public.book_format    as enum ('paperback', 'hardcover', 'boxset');  -- bìa mềm / bìa cứng / hộp
create type public.order_status   as enum ('pending', 'confirmed', 'shipping', 'delivered', 'cancelled');
create type public.payment_method as enum ('cod', 'bank_transfer');
create type public.payment_status as enum ('unpaid', 'paid', 'refunded');
create type public.discount_type  as enum ('percent', 'fixed');
-- Chợ sách cũ (mục 15)
create type public.used_condition      as enum ('like_new', 'good', 'fair', 'worn');  -- Như mới / Tốt / Khá / Cũ nhiều
create type public.used_listing_status as enum ('pending', 'approved', 'rejected', 'sold', 'withdrawn');


-- ---------------------------------------------------------------------
-- 2. HÀM TIỆN ÍCH
-- ---------------------------------------------------------------------

-- Tự cập nhật cột updated_at mỗi khi sửa dòng
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Chuẩn hóa chữ để tìm kiếm: "Đắc Nhân Tâm" → "dac nhan tam"
create or replace function public.normalize_vi(txt text)
returns text language sql immutable set search_path = '' as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(txt, '')));
$$;

-- Schema nội bộ: hàm trong đây KHÔNG bị PostgREST public thành RPC
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Hằng số phí ship: sửa ở đây, place_order, quote_order và quote_items cùng dùng
create or replace function private.flat_shipping_fee()
returns int language sql immutable set search_path = '' as $$ select 30000 $$;

create or replace function private.free_ship_from()
returns int language sql immutable set search_path = '' as $$ select 300000 $$;

create or replace function private.shipping_fee(p_subtotal int)
returns int language sql immutable set search_path = '' as $$
  select case when p_subtotal >= private.free_ship_from() then 0 else private.flat_shipping_fee() end;
$$;

-- Hằng số chợ sách cũ (mục 15): sửa ở đây. Phí sàn tính trên numeric: round() của double precision làm tròn nửa về
-- số chẵn (5.000₫ → phí 0), numeric làm tròn nửa lên (5.000₫ → 1.000₫, 25.000₫ → 3.000₫). Đơn sách cũ luôn ship
-- private.flat_shipping_fee() (không freeship, không voucher).
create or replace function private.used_fee_percent()
returns int language sql immutable set search_path = '' as $$ select 10 $$;

create or replace function private.used_platform_fee(p_price int)
returns int language sql immutable set search_path = '' as $$
  select (round(p_price::numeric * private.used_fee_percent() / 100 / 1000) * 1000)::int;
$$;

create or replace function private.used_pending_limit()
returns int language sql immutable set search_path = '' as $$ select 10 $$;

create or replace function private.used_photo_limit()
returns int language sql immutable set search_path = '' as $$ select 30 $$;


-- ---------------------------------------------------------------------
-- 3. NGƯỜI DÙNG
-- ---------------------------------------------------------------------

-- Thông tin thêm cho mỗi tài khoản (auth.users do Supabase quản lý)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  avatar_url  text,
  locale      text not null default 'vi' check (locale in ('vi', 'en')),  -- ngôn ngữ ưa thích (email…)
  role        public.user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Kiểm tra người đang đăng nhập có phải admin không (dùng trong RLS)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Khi có người đăng ký → tự tạo profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'vi' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Địa chỉ giao hàng (2 cấp hành chính: Tỉnh/Thành phố → Phường/Xã)
create table public.addresses (
  id              bigint generated by default as identity primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  recipient_name  text not null,
  phone           text not null,
  province        text not null,   -- Tỉnh / Thành phố
  ward            text not null,   -- Phường / Xã
  street          text not null,   -- Số nhà, tên đường
  is_default      boolean not null default false,
  created_at      timestamptz not null default now()
);

create index addresses_user_idx on public.addresses (user_id);
-- Mỗi người chỉ có tối đa 1 địa chỉ mặc định
create unique index addresses_one_default on public.addresses (user_id) where is_default;


-- ---------------------------------------------------------------------
-- 4. DANH MỤC SÁCH
-- ---------------------------------------------------------------------

-- Danh mục cha–con. VD: Văn học (parent_id = null) → Tiểu thuyết (parent_id = id của Văn học)
create table public.categories (
  id           bigint generated by default as identity primary key,
  parent_id    bigint references public.categories(id) on delete set null,
  name            text not null,
  name_en         text,
  slug            text not null unique,
  description     text,
  description_en  text,
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index categories_parent_idx on public.categories (parent_id);

create table public.authors (
  id          bigint generated by default as identity primary key,
  name        text not null,
  slug        text not null unique,
  bio         text,
  bio_en      text,
  photo_url   text,
  created_at  timestamptz not null default now()
);

create table public.publishers (
  id          bigint generated by default as identity primary key,
  name        text not null,
  slug        text not null unique,
  description text,
  description_en text,
  logo_url    text,
  created_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 5. SÁCH
-- ---------------------------------------------------------------------
create table public.books (
  id              bigint generated by default as identity primary key,
  title           text not null,
  slug            text not null unique,                 -- dùng cho URL: /sach/<slug>
  subtitle        text,
  description     text,
  description_en  text,                                 -- tên sách KHÔNG dịch, chỉ dịch mô tả
  category_id     bigint references public.categories(id) on delete set null,
  publisher_id    bigint references public.publishers(id) on delete set null,
  isbn            text unique,

  price           integer not null check (price >= 0),  -- giá bán (VND)
  original_price  integer check (original_price is null or original_price >= price),  -- giá gốc, để hiện % giảm
  stock           integer not null default 0 check (stock >= 0),

  cover_url       text,
  cover_width     smallint constraint books_cover_width_check check (cover_width between 1 and 10000),  -- chiều rộng thật (px) của bìa; null = chưa đo
  page_count      int check (page_count > 0),
  format          public.book_format not null default 'paperback',
  language        text not null default 'vi',
  published_year  int check (published_year between 1800 and 2100),
  weight_grams    int check (weight_grams > 0),
  dimensions      text,                                 -- VD: "13 x 20.5 cm"

  sold_count      int not null default 0,               -- tự cập nhật khi có đơn
  avg_rating      numeric(2,1) not null default 0,      -- tự cập nhật khi có đánh giá
  review_count    int not null default 0,

  is_active       boolean not null default true,        -- false = ẩn khỏi cửa hàng
  is_featured     boolean not null default false,       -- hiện ở trang chủ

  search_text     text,                                 -- tự sinh, KHÔNG sửa tay
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index books_category_idx   on public.books (category_id);
create index books_publisher_idx  on public.books (publisher_id);
create index books_created_idx    on public.books (created_at desc);
create index books_sold_idx       on public.books (sold_count desc);
create index books_search_idx     on public.books using gin (search_text extensions.gin_trgm_ops);

-- Sách ↔ tác giả (nhiều–nhiều). role = 'author' (tác giả) hoặc 'translator' (dịch giả)
create table public.book_authors (
  book_id    bigint not null references public.books(id) on delete cascade,
  author_id  bigint not null references public.authors(id) on delete cascade,
  role       text not null default 'author' check (role in ('author', 'translator', 'illustrator')),
  primary key (book_id, author_id, role)
);

create index book_authors_author_idx on public.book_authors (author_id);

-- Ảnh phụ của sách (ảnh bìa sau, ảnh trang trong…)
create table public.book_images (
  id          bigint generated by default as identity primary key,
  book_id     bigint not null references public.books(id) on delete cascade,
  url         text not null,
  sort_order  int not null default 0
);

create index book_images_book_idx on public.book_images (book_id);

-- Tự sinh search_text = tên sách + phụ đề + ISBN + tên tác giả (đã bỏ dấu)
create or replace function public.books_build_search_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := public.normalize_vi(concat_ws(' ',
    new.title,
    new.subtitle,
    new.isbn,
    (select string_agg(a.name, ' ')
       from public.book_authors ba
       join public.authors a on a.id = ba.author_id
      where ba.book_id = new.id)
  ));
  return new;
end;
$$;

create trigger books_search_text before insert or update on public.books
  for each row execute function public.books_build_search_text();

create trigger books_updated_at before update on public.books
  for each row execute function public.set_updated_at();

-- Khi thêm/xóa tác giả của sách → tính lại search_text của sách đó
create or replace function public.book_authors_touch_book()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.books set updated_at = now()
   where id = coalesce(new.book_id, old.book_id);
  return null;
end;
$$;

create trigger book_authors_refresh after insert or update or delete on public.book_authors
  for each row execute function public.book_authors_touch_book();

-- Đổi tên tác giả → tính lại search_text của các sách liên quan
create or replace function public.authors_touch_books()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.books set updated_at = now()
   where id in (select book_id from public.book_authors where author_id = new.id);
  return null;
end;
$$;

create trigger authors_name_refresh after update of name on public.authors
  for each row when (old.name is distinct from new.name)
  execute function public.authors_touch_books();

-- Tìm kiếm sách không dấu: search_books('dac nhan tam'), search_books('Tâm Đắc Nhân')
--   • Không có limit cứng → phân trang bằng .range(), đếm bằng { count: 'exact' }
--     (count 'estimated' trên RPC chỉ là ước lượng của planner, không dùng được)
--   • Tách theo khoảng trắng, mọi từ phải khớp, không cần đúng thứ tự
--   • Escape % _ \ trong từ khóa
--   • Từ dài nhất dùng làm điều kiện chính để index trigram được dùng
create or replace function public.search_books(q text)
returns setof public.books
language plpgsql stable set search_path = '' as $$
declare
  v_patterns text[];
begin
  select array_agg(
           '%' || replace(replace(replace(t.term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
           order by char_length(t.term) desc
         )
    into v_patterns
    from unnest(regexp_split_to_array(public.normalize_vi(btrim(coalesce(q, ''))), '\s+')) as t(term)
   where t.term <> '';

  if v_patterns is null then
    return;
  end if;

  return query
    select b.*
      from public.books b
     where b.is_active
       and b.search_text like v_patterns[1]
       and b.search_text like all (v_patterns)
     order by b.sold_count desc, b.created_at desc, b.id;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. GIỎ HÀNG (chỉ cho người đã đăng nhập; khách vãng lai lưu ở trình duyệt)
-- ---------------------------------------------------------------------
create table public.cart_items (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  book_id     bigint not null references public.books(id) on delete cascade,
  quantity    int not null check (quantity between 1 and 99),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, book_id)
);

create trigger cart_items_updated_at before update on public.cart_items
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 7. MÃ GIẢM GIÁ
-- ---------------------------------------------------------------------
create table public.vouchers (
  id               bigint generated by default as identity primary key,
  code             text not null unique check (code = upper(code)),  -- luôn viết HOA
  description      text,
  description_en   text,
  discount_type    public.discount_type not null,
  discount_value   int not null check (discount_value > 0),   -- % hoặc số tiền VND
  max_discount     int check (max_discount > 0),              -- trần giảm (cho loại %)
  min_order_value  int not null default 0,
  usage_limit      int check (usage_limit > 0),               -- null = không giới hạn
  used_count       int not null default 0,
  starts_at        timestamptz,
  ends_at          timestamptz,
  is_active        boolean not null default true,
  is_public        boolean not null default false,             -- hiện trong gợi ý ở trang thanh toán
  created_at       timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100)
);

-- Kiểm tra voucher và trả về số tiền giảm. p_voucher toàn null = không tìm thấy mã.
create or replace function private.voucher_discount(p_voucher public.vouchers, p_subtotal int)
returns int language plpgsql stable set search_path = '' as $$
declare
  v_discount bigint;
begin
  if p_voucher.id is null then
    raise exception 'VOUCHER_NOT_FOUND';
  end if;

  if not p_voucher.is_active then
    raise exception 'VOUCHER_INACTIVE';
  end if;

  if p_voucher.starts_at is not null and now() < p_voucher.starts_at then
    raise exception 'VOUCHER_NOT_STARTED'
      using detail = json_build_object('starts_at', p_voucher.starts_at)::text;
  end if;

  if p_voucher.ends_at is not null and now() > p_voucher.ends_at then
    raise exception 'VOUCHER_EXPIRED'
      using detail = json_build_object('ends_at', p_voucher.ends_at)::text;
  end if;

  if p_voucher.usage_limit is not null and p_voucher.used_count >= p_voucher.usage_limit then
    raise exception 'VOUCHER_EXHAUSTED';
  end if;

  if p_subtotal < p_voucher.min_order_value then
    raise exception 'VOUCHER_MIN_ORDER'
      using detail = json_build_object(
        'min_order_value', p_voucher.min_order_value,
        'shortfall', p_voucher.min_order_value - p_subtotal
      )::text;
  end if;

  if p_voucher.discount_type = 'percent' then
    -- bigint: subtotal lớn × % có thể tràn int
    v_discount := p_subtotal::bigint * p_voucher.discount_value / 100;
    if p_voucher.max_discount is not null then
      v_discount := least(v_discount, p_voucher.max_discount);
    end if;
  else
    v_discount := p_voucher.discount_value;
  end if;

  return least(v_discount, p_subtotal)::int;
end;
$$;


-- ---------------------------------------------------------------------
-- 8. ĐƠN HÀNG
-- ---------------------------------------------------------------------
create sequence public.order_code_seq;

-- Mã đơn dạng NS + YYMMDD + số thứ tự. VD: NS26101400001
create or replace function public.generate_order_code()
returns text language sql set search_path = '' as $$
  select 'NS'
      || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD')
      || lpad(nextval('public.order_code_seq')::text, 5, '0');
$$;

create table public.orders (
  id               bigint generated by default as identity primary key,
  order_code       text not null unique default public.generate_order_code(),
  user_id          uuid references public.profiles(id) on delete set null,
  status           public.order_status   not null default 'pending',
  payment_method   public.payment_method not null default 'cod',
  payment_status   public.payment_status not null default 'unpaid',

  -- Lưu bản sao địa chỉ tại thời điểm đặt (người dùng sửa địa chỉ sau này không ảnh hưởng đơn cũ)
  recipient_name   text not null,
  phone            text not null,
  province         text not null,
  ward             text not null,
  street           text not null,
  note             text,

  subtotal         int not null check (subtotal >= 0),
  shipping_fee     int not null default 0 check (shipping_fee >= 0),
  discount         int not null default 0 check (discount >= 0),
  total            int not null check (total >= 0),
  voucher_id       bigint references public.vouchers(id) on delete set null,
  voucher_code     text,

  cancelled_reason text,
  -- Chống đặt trùng: place_order gửi lại cùng key trả đúng đơn đã tạo
  idempotency_key  uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (total = subtotal + shipping_fee - discount),
  -- RPC gọi thẳng được từ client nên không chỉ dựa vào zod
  constraint orders_note_length check (note is null or char_length(note) <= 500),
  constraint orders_cancelled_reason_length check (cancelled_reason is null or char_length(cancelled_reason) <= 500)
);

create index orders_user_idx   on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status);
-- Chốt cuối ở mức DB: một key chỉ gắn với một đơn của mỗi user (key null không bị ràng buộc)
create unique index orders_user_idempotency_key on public.orders (user_id, idempotency_key);

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Từng cuốn sách trong đơn. Lưu bản sao tên + giá lúc mua.
create table public.order_items (
  id          bigint generated by default as identity primary key,
  order_id    bigint not null references public.orders(id) on delete cascade,
  book_id     bigint references public.books(id) on delete set null,
  title       text not null,
  cover_url   text,
  unit_price  int not null check (unit_price >= 0),
  quantity    int not null check (quantity > 0),
  line_total  int generated always as (unit_price * quantity) stored,
  -- Đơn sách cũ: một dòng (quantity 1, bìa catalog) trỏ tới tin; khóa ngoại tới used_listings thêm ở mục 15
  used_listing_id bigint
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_book_idx  on public.order_items (book_id);
create index order_items_used_listing_idx on public.order_items (used_listing_id) where used_listing_id is not null;

-- Luồng trạng thái đơn (mọi role, kể cả service role): pending → confirmed → shipping → delivered, hủy được từ
-- pending / confirmed / shipping; delivered và cancelled là trạng thái cuối. App có bản trùng (nextStatuses) → sửa cả hai chỗ.
create or replace function private.order_status_transition_allowed(
  p_from public.order_status,
  p_to   public.order_status
)
returns boolean language sql immutable set search_path = '' as $$
  select case p_from
    when 'pending'   then p_to in ('confirmed', 'cancelled')
    when 'confirmed' then p_to in ('shipping', 'cancelled')
    when 'shipping'  then p_to in ('delivered', 'cancelled')
    else false
  end;
$$;

-- Hủy → hoàn tồn kho (chỉ sách mới: sách cũ không trừ kho khi đặt) và lượt dùng voucher; COD giao xong → đã thanh toán.
-- Tin sách cũ của đơn bị hủy về approved ở trigger AFTER (orders_used_market, mục 15): ở đây đơn chưa thành cancelled.
create or replace function public.handle_order_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Câu update có cột status nhưng không đổi giá trị: không phải chuyển trạng thái
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'cancelled' then
    raise exception 'ORDER_REOPEN_FORBIDDEN';
  end if;

  if not private.order_status_transition_allowed(old.status, new.status) then
    raise exception 'ORDER_INVALID_TRANSITION'
      using detail = json_build_object('from', old.status, 'to', new.status)::text;
  end if;

  if new.status = 'cancelled' then
    update public.books b
       set stock      = b.stock + oi.quantity,
           sold_count = greatest(b.sold_count - oi.quantity, 0)
      from public.order_items oi
     where oi.order_id = new.id and oi.book_id = b.id and oi.used_listing_id is null;

    if new.voucher_id is not null then
      update public.vouchers
         set used_count = greatest(used_count - 1, 0)
       where id = new.voucher_id;
    end if;
  end if;

  if new.status = 'delivered' and new.payment_method = 'cod' then
    new.payment_status := 'paid';
  end if;

  return new;
end;
$$;

create trigger orders_status_change before update of status on public.orders
  for each row execute function public.handle_order_status_change();


-- ---------------------------------------------------------------------
-- 9. RPC GIỎ HÀNG, ĐẶT HÀNG, HỦY ĐƠN (gọi từ app bằng supabase.rpc(...))
-- ---------------------------------------------------------------------

-- Phí ship: xem private.shipping_fee() ở đầu file
create or replace function public.place_order(
  p_address_id      bigint,
  p_payment_method  public.payment_method default 'cod',
  p_voucher_code    text default null,
  p_note            text default null,
  p_idempotency_key uuid default null,
  p_expected_total  int default null
)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_user      uuid := auth.uid();
  v_note      text := nullif(btrim(p_note), '');
  v_addr      public.addresses;
  v_voucher   public.vouchers;
  v_item      record;
  v_book_ids  bigint[] := '{}';
  v_qtys      int[]    := '{}';
  v_subtotal  int := 0;
  v_shipping  int;
  v_discount  int := 0;
  v_total     int;
  v_order     public.orders;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- (a) Gửi lại cùng key (bấm 2 lần, mất phản hồi rồi gửi lại) → trả đúng đơn đã tạo, kể cả khi
  -- giỏ đã rỗng hay địa chỉ đã đổi. Khóa theo (user, key): request song song cùng key chờ ở đây
  -- tới khi request đầu commit, rồi thấy đơn của nó (mỗi câu lệnh plpgsql đọc snapshot mới).
  if p_idempotency_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_idempotency_key::text, 0));

    select * into v_order from public.orders
     where user_id = v_user and idempotency_key = p_idempotency_key;
    if found then
      return v_order;
    end if;
  end if;

  if char_length(v_note) > 500 then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'note', 'max', 500)::text;
  end if;

  select * into v_addr from public.addresses
   where id = p_address_id and user_id = v_user;
  if not found then
    raise exception 'INVALID_ADDRESS';
  end if;

  -- (b) Khóa CẢ dòng giỏ lẫn dòng sách. Nếu chỉ khóa sách, request thứ hai (bấm đặt hàng 2 lần)
  -- vẫn thấy dòng giỏ cũ trong snapshot, tính ra tiền, rồi tạo một đơn không có sách nào.
  for v_item in
    select c.book_id, c.quantity, b.title, b.price, b.stock, b.is_active
      from public.cart_items c
      join public.books b on b.id = c.book_id
     where c.user_id = v_user
     order by b.id
       for update of c, b
  loop
    if not v_item.is_active then
      raise exception 'BOOK_UNAVAILABLE'
        using detail = json_build_object('book_id', v_item.book_id, 'title', v_item.title)::text;
    end if;
    if v_item.stock < v_item.quantity then
      raise exception 'OUT_OF_STOCK'
        using detail = json_build_object('book_id', v_item.book_id, 'title', v_item.title, 'stock', v_item.stock)::text;
    end if;
    v_book_ids := v_book_ids || v_item.book_id;
    v_qtys     := v_qtys || v_item.quantity;
    v_subtotal := v_subtotal + v_item.price * v_item.quantity;
  end loop;

  if cardinality(v_book_ids) = 0 then
    raise exception 'CART_EMPTY';
  end if;

  v_shipping := private.shipping_fee(v_subtotal);

  if nullif(btrim(p_voucher_code), '') is not null then
    select * into v_voucher from public.vouchers
     where code = upper(btrim(p_voucher_code))
       for update;
    v_discount := private.voucher_discount(v_voucher, v_subtotal);
  end if;

  v_total := v_subtotal + v_shipping - v_discount;

  -- (c) Tổng người dùng đang thấy khác tổng thật (giỏ sửa ở tab khác, admin đổi giá) → không đặt.
  -- So sau khi đã khóa giỏ nên không còn khe hở giữa lúc so và lúc đặt.
  if p_expected_total is not null and p_expected_total <> v_total then
    raise exception 'CART_CHANGED'
      using detail = json_build_object('total', v_total)::text;
  end if;

  -- (d) Đặt hàng
  if v_voucher.id is not null then
    update public.vouchers set used_count = used_count + 1 where id = v_voucher.id;
  end if;

  insert into public.orders (
    user_id, payment_method,
    recipient_name, phone, province, ward, street, note,
    subtotal, shipping_fee, discount, total,
    voucher_id, voucher_code, idempotency_key
  ) values (
    v_user, p_payment_method,
    v_addr.recipient_name, v_addr.phone, v_addr.province, v_addr.ward, v_addr.street, v_note,
    v_subtotal, v_shipping, v_discount, v_total,
    v_voucher.id, v_voucher.code, p_idempotency_key
  )
  returning * into v_order;

  -- Chỉ dùng đúng các dòng đã khóa và kiểm tra ở trên (sách thêm vào giỏ song song không lọt vào đơn)
  insert into public.order_items (order_id, book_id, title, cover_url, unit_price, quantity)
  select v_order.id, b.id, b.title, b.cover_url, b.price, x.quantity
    from unnest(v_book_ids, v_qtys) as x(book_id, quantity)
    join public.books b on b.id = x.book_id;

  update public.books b
     set stock      = b.stock - x.quantity,
         sold_count = b.sold_count + x.quantity
    from unnest(v_book_ids, v_qtys) as x(book_id, quantity)
   where b.id = x.book_id;

  delete from public.cart_items
   where user_id = v_user and book_id = any(v_book_ids);

  return v_order;
end;
$$;

-- Tạm tính giỏ của một user: chỉ cộng sách đang bán. Dùng chung cho quote_order và checkout_vouchers.
create or replace function private.cart_subtotal(p_user uuid, out item_count int, out subtotal int)
language sql stable set search_path = '' as $$
  select count(*)::int, coalesce(sum(b.price * c.quantity), 0)::int
    from public.cart_items c
    join public.books b on b.id = c.book_id and b.is_active
   where c.user_id = p_user;
$$;

-- Tiền tạm tính cho checkout (không khóa, không tăng used_count).
-- Giỏ trống → trả về toàn 0 để trang giỏ vẫn hiển thị được mốc freeship.
-- Chỉ cộng sách đang bán: sách đã ẩn hiện "Ngừng bán" ở trang giỏ, place_order chặn bằng BOOK_UNAVAILABLE.
create or replace function public.quote_order(p_voucher_code text default null)
returns table (
  item_count     int,
  subtotal       int,
  shipping_fee   int,
  discount       int,
  total          int,
  free_ship_from int
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user      uuid := auth.uid();
  v_count     int;
  v_subtotal  int;
  v_shipping  int;
  v_discount  int := 0;
  v_voucher   public.vouchers;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select s.item_count, s.subtotal into v_count, v_subtotal from private.cart_subtotal(v_user) s;

  if v_count = 0 then
    return query select 0, 0, 0, 0, 0, private.free_ship_from();
    return;
  end if;

  v_shipping := private.shipping_fee(v_subtotal);

  if nullif(btrim(p_voucher_code), '') is not null then
    select * into v_voucher from public.vouchers
     where code = upper(btrim(p_voucher_code));
    v_discount := private.voucher_discount(v_voucher, v_subtotal);
  end if;

  return query select v_count, v_subtotal, v_shipping, v_discount,
                      v_subtotal + v_shipping - v_discount, private.free_ship_from();
end;
$$;

-- Mã gợi ý ở trang thanh toán: public, đang bật, đã tới ngày, chưa hết hạn, còn lượt.
--    discount: mức giảm với giỏ hiện tại (null khi chưa đủ đơn tối thiểu); shortfall: số tiền còn thiếu (0 = đủ).
--    Biên thời gian khớp private.voucher_discount (now() < starts_at hoặc now() > ends_at mới bị từ chối).
--    Giỏ trống → không trả dòng nào. Tối đa 20 mã, giảm nhiều nhất lên đầu.
create or replace function public.checkout_vouchers()
returns table (
  code            text,
  description     text,
  description_en  text,
  discount_type   public.discount_type,
  discount_value  int,
  max_discount    int,
  min_order_value int,
  ends_at         timestamptz,
  discount        int,
  shortfall       int
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user     uuid := auth.uid();
  v_count    int;
  v_subtotal int;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select s.item_count, s.subtotal into v_count, v_subtotal from private.cart_subtotal(v_user) s;

  if v_count = 0 then
    return;
  end if;

  return query
    select v.code, v.description, v.description_en, v.discount_type, v.discount_value, v.max_discount,
           v.min_order_value, v.ends_at,
           case when v_subtotal >= v.min_order_value then private.voucher_discount(v, v_subtotal) end,
           greatest(v.min_order_value - v_subtotal, 0)
      from public.vouchers v
     where v.is_public
       and v.is_active
       and (v.starts_at is null or v.starts_at <= now())
       and (v.ends_at is null or v.ends_at >= now())
       and (v.usage_limit is null or v.used_count < v.usage_limit)
     order by 9 desc nulls last, 10, 1
     limit 20;
end;
$$;

-- Giỏ khách vãng lai: cùng công thức với quote_order, nhận giỏ từ localStorage.
-- security definer vì anon không có quyền trên schema private (shipping_fee, free_ship_from);
-- chỉ đọc books và tự lọc is_active nên không lộ thêm dữ liệu.
create or replace function public.quote_items(p_items jsonb)
returns table (
  item_count     int,
  subtotal       int,
  shipping_fee   int,
  total          int,
  free_ship_from int
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_count     int;
  v_subtotal  int;
  v_shipping  int;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'items', 'max', 100)::text;
  end if;

  -- Gộp trùng book_id và chặn 99 giống merge_cart, để khách thấy đúng số tiền sẽ có sau khi gộp
  select count(*)::int, coalesce(sum(b.price * q.quantity), 0)::int
    into v_count, v_subtotal
    from (
      select x.book_id, least(sum(x.quantity), 99)::int as quantity
        from jsonb_to_recordset(p_items) as x(book_id bigint, quantity int)
       where x.quantity > 0
       group by x.book_id
    ) q
    join public.books b on b.id = q.book_id and b.is_active;

  if v_count = 0 then
    return query select 0, 0, 0, 0, private.free_ship_from();
    return;
  end if;

  v_shipping := private.shipping_fee(v_subtotal);

  return query select v_count, v_subtotal, v_shipping,
                      v_subtotal + v_shipping, private.free_ship_from();
end;
$$;

-- Khách tự hủy đơn: chỉ khi đơn còn 'pending' và chưa thanh toán (đơn chuyển khoản đã trả phải qua cửa hàng:
-- chưa có quy trình hoàn tiền). Đơn COD luôn 'unpaid' tới khi giao. Không hủy được thì báo đúng lý do; đơn không có /
-- của tài khoản khác cùng một mã ORDER_NOT_CANCELLABLE (không lộ đơn nào tồn tại).
create or replace function public.cancel_order(p_order_id bigint, p_reason text default null)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(btrim(p_reason), '');
  v_order  public.orders;
begin
  if char_length(v_reason) > 500 then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'reason', 'max', 500)::text;
  end if;

  select * into v_order
    from public.orders
   where id = p_order_id
     and user_id = auth.uid()
     for update;

  -- Không có hoặc của tài khoản khác: cùng một mã, không lộ đơn nào tồn tại
  if not found then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'ORDER_ALREADY_CANCELLED';
  end if;

  if v_order.status = 'delivered' then
    raise exception 'ORDER_DELIVERED';
  end if;

  if v_order.status <> 'pending' then
    raise exception 'ORDER_IN_PROGRESS'
      using detail = json_build_object('status', v_order.status)::text;
  end if;

  if v_order.payment_status = 'paid' then
    raise exception 'ORDER_PAID';
  end if;

  update public.orders
     set status = 'cancelled',
         cancelled_reason = v_reason
   where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

-- Đặt địa chỉ mặc định. Unique index chỉ cho 1 địa chỉ mặc định, nên phải
-- bỏ mặc định cũ trước rồi mới đặt cái mới — trong cùng một transaction.
create or replace function public.set_default_address(p_address_id bigint)
returns void
language plpgsql set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform 1 from public.addresses where id = p_address_id and user_id = v_user;
  if not found then
    raise exception 'INVALID_ADDRESS';
  end if;

  update public.addresses set is_default = false
   where user_id = v_user and is_default and id <> p_address_id;
  update public.addresses set is_default = true
   where id = p_address_id and user_id = v_user;
end;
$$;

-- Gộp giỏ khách vãng lai (localStorage) vào giỏ tài khoản khi đăng nhập.
-- p_items = [{"book_id": 1, "quantity": 2}, ...]. Cộng dồn, chặn ở 99,
-- bỏ qua sách không tồn tại / đã ẩn / số lượng không hợp lệ.
create or replace function public.merge_cart(p_items jsonb)
returns void
language plpgsql set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'items', 'max', 100)::text;
  end if;

  insert into public.cart_items (user_id, book_id, quantity)
  select v_user, b.id, least(sum(x.quantity), 99)::int
    from jsonb_to_recordset(p_items) as x(book_id bigint, quantity int)
    join public.books b on b.id = x.book_id and b.is_active
   where x.quantity > 0
   group by b.id
  on conflict (user_id, book_id)
  do update set quantity = least(public.cart_items.quantity + excluded.quantity, 99);
end;
$$;


-- Email + ngôn ngữ email của người đặt (email báo trạng thái đơn). security definer: đọc auth.users.
-- Chỉ trả khi đơn của chính user hoặc người gọi là admin; ngược lại 0 dòng.
create or replace function public.order_contact(p_order_id bigint)
returns table (email text, locale text)
language sql stable security definer set search_path = '' as $$
  select u.email::text, p.locale
    from public.orders o
    join auth.users u on u.id = o.user_id
    join public.profiles p on p.id = o.user_id
   where o.id = p_order_id
     and (o.user_id = (select auth.uid()) or (select public.is_admin()));
$$;


-- ---------------------------------------------------------------------
-- 10. ĐÁNH GIÁ SÁCH (chỉ người đã nhận hàng mới được đánh giá)
-- ---------------------------------------------------------------------
create table public.reviews (
  id            bigint generated by default as identity primary key,
  book_id       bigint not null references public.books(id) on delete cascade,
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  display_name  text,                     -- tự điền từ profile (null → app hiện "Khách hàng"/"Customer")
  rating        int not null check (rating between 1 and 5),
  content       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (book_id, user_id),              -- mỗi người đánh giá 1 lần / sách
  constraint reviews_content_length check (content is null or char_length(content) <= 2000)
);

create index reviews_book_idx on public.reviews (book_id, created_at desc);

create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

create or replace function public.reviews_set_display_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select nullif(btrim(full_name), '') into new.display_name
    from public.profiles where id = new.user_id;
  return new;
end;
$$;

create trigger reviews_display_name before insert on public.reviews
  for each row execute function public.reviews_set_display_name();

-- Tính lại điểm trung bình và số đánh giá của sách
create or replace function public.refresh_book_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_book bigint := coalesce(new.book_id, old.book_id);
begin
  update public.books
     set avg_rating   = coalesce((select round(avg(rating)::numeric, 1) from public.reviews where book_id = v_book), 0),
         review_count = (select count(*) from public.reviews where book_id = v_book)
   where id = v_book;
  return null;
end;
$$;

create trigger reviews_refresh_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_book_rating();


-- ---------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS)
--   • Luôn viết (select auth.uid()) / (select public.is_admin()): Postgres tính 1 lần
--     cho cả câu truy vấn thay vì gọi lại ở từng dòng.
--   • Quyền ghi của admin tách thành insert / update / delete, KHÔNG dùng "for all":
--     "for all" gồm cả select, chồng lên policy đọc công khai → câu SELECT nào cũng phải chạy cả hai.
-- ---------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.addresses    enable row level security;
alter table public.categories   enable row level security;
alter table public.authors      enable row level security;
alter table public.publishers   enable row level security;
alter table public.books        enable row level security;
alter table public.book_authors enable row level security;
alter table public.book_images  enable row level security;
alter table public.cart_items   enable row level security;
alter table public.vouchers     enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.reviews      enable row level security;

-- PROFILES: xem/sửa của chính mình; admin xem tất cả
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Người dùng chỉ được sửa vài cột, KHÔNG được tự đổi role thành admin
revoke update on public.profiles from anon, authenticated;
grant  update (full_name, phone, avatar_url, locale) on public.profiles to authenticated;

-- ADDRESSES & CART: chỉ chủ sở hữu
create policy "addresses_own" on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "cart_items_own" on public.cart_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- DỮ LIỆU CỬA HÀNG: ai cũng xem được, chỉ admin sửa
create policy "categories_public_read" on public.categories
  for select to anon, authenticated using (is_active or (select public.is_admin()));

create policy "authors_public_read" on public.authors
  for select to anon, authenticated using (true);

create policy "publishers_public_read" on public.publishers
  for select to anon, authenticated using (true);

create policy "books_public_read" on public.books
  for select to anon, authenticated using (is_active or (select public.is_admin()));

create policy "book_authors_public_read" on public.book_authors
  for select to anon, authenticated using (true);

create policy "book_images_public_read" on public.book_images
  for select to anon, authenticated using (true);

-- Tạo <bảng>_admin_insert / _admin_update / _admin_delete cho 6 bảng catalog
do $$
declare
  t text;
begin
  foreach t in array array['categories', 'authors', 'publishers', 'books', 'book_authors', 'book_images'] loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select public.is_admin()))',
      t || '_admin_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      t || '_admin_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))',
      t || '_admin_delete', t);
  end loop;
end;
$$;

-- Sách: admin chỉ sửa được cột sửa trong admin, không sửa cột do DB quản lý (sold_count, avg_rating, review_count,
-- search_text, created_at, updated_at). Trigger BEFORE ghi search_text / updated_at vẫn chạy (quyền cột chỉ xét cột
-- có trong câu UPDATE); các hàm security definer (place_order, *_touch_book*, refresh_book_rating) chạy bằng quyền owner.
revoke update on public.books from anon, authenticated;
grant  update (
  title, slug, subtitle, description, description_en, category_id, publisher_id, isbn,
  price, original_price, stock, cover_url, cover_width, page_count, format, language, published_year,
  weight_grams, dimensions, is_active, is_featured
) on public.books to authenticated;

-- VOUCHERS: chỉ admin xem/sửa (khách kiểm tra mã qua quote_order / place_order)
create policy "vouchers_admin_all" on public.vouchers
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Quyền cột: admin chỉ sửa cột của form admin; used_count do place_order / trigger hủy đơn quản lý (security definer)
revoke update on public.vouchers from anon, authenticated;
grant  update (
  code, description, description_en, discount_type, discount_value, max_discount,
  min_order_value, usage_limit, starts_at, ends_at, is_active, is_public
) on public.vouchers to authenticated;

-- ORDERS: khách xem đơn của mình; chỉ admin cập nhật. Tạo đơn qua place_order().
create policy "orders_select_own_or_admin" on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "orders_admin_update" on public.orders
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Quyền cột: admin chỉ sửa được trạng thái đơn, không sửa tiền / địa chỉ / dòng sách. Postgres chỉ xét cột có trong
-- câu UPDATE: cột do trigger BEFORE ghi (updated_at, payment_status khi giao COD) không bị chặn.
revoke update on public.orders from anon, authenticated;
grant  update (status, payment_status, cancelled_reason) on public.orders to authenticated;

create policy "order_items_select_own_or_admin" on public.order_items
  for select to authenticated
  using (
    (select public.is_admin()) or exists (
      select 1 from public.orders o
       where o.id = order_items.order_id and o.user_id = (select auth.uid())
    )
  );

-- REVIEWS: ai cũng đọc được; chỉ người đã nhận sách mới được viết
create policy "reviews_public_read" on public.reviews
  for select to anon, authenticated using (true);

create policy "reviews_insert_if_purchased" on public.reviews
  for insert to authenticated
  with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.orders o
        join public.order_items oi on oi.order_id = o.id
       where o.user_id = (select auth.uid())
         and o.status = 'delivered'
         and oi.book_id = reviews.book_id
    )
  );

create policy "reviews_update_own" on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "reviews_delete_own_or_admin" on public.reviews
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Chỉ ghi được rating, content. Không cho đổi book_id (lách điều kiện "đã mua")
-- hay tự đặt display_name (giả danh). user_id có default = auth.uid().
revoke insert, update on public.reviews from anon, authenticated;
grant  insert (book_id, user_id, rating, content) on public.reviews to authenticated;
grant  update (rating, content)                   on public.reviews to authenticated;


-- ---------------------------------------------------------------------
-- 12. QUYỀN GỌI HÀM
-- ---------------------------------------------------------------------
revoke execute on function public.place_order(bigint, public.payment_method, text, text, uuid, int) from public, anon;
grant  execute on function public.place_order(bigint, public.payment_method, text, text, uuid, int) to authenticated;

revoke execute on function public.cancel_order(bigint, text) from public, anon;
grant  execute on function public.cancel_order(bigint, text) to authenticated;

revoke execute on function public.quote_order(text) from public, anon;
grant  execute on function public.quote_order(text) to authenticated;

revoke execute on function public.checkout_vouchers() from public, anon;
grant  execute on function public.checkout_vouchers() to authenticated;

revoke execute on function public.quote_items(jsonb) from public;
grant  execute on function public.quote_items(jsonb) to anon, authenticated;

revoke execute on function public.set_default_address(bigint) from public, anon;
grant  execute on function public.set_default_address(bigint) to authenticated;

revoke execute on function public.merge_cart(jsonb) from public, anon;
grant  execute on function public.merge_cart(jsonb) to authenticated;

revoke execute on function public.order_contact(bigint) from public, anon;
grant  execute on function public.order_contact(bigint) to authenticated;

-- Chỉ dùng làm default của orders.order_code; gọi qua RPC sẽ đốt số thứ tự đơn
revoke execute on function public.generate_order_code() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 13. STORAGE: nơi lưu ảnh bìa sách (bucket public, chỉ admin upload)
-- ---------------------------------------------------------------------
-- Server chỉ upload WebP đã xử lý (rộng 600px ≈ 30–120KB): bucket từ chối mọi thứ khác, kể cả khi gọi thẳng Storage API
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('book-covers', 'book-covers', true, array['image/webp'], 1048576)
on conflict (id) do nothing;

-- Storage API chỉ xóa object mà phiên đọc được: thiếu select thì remove() trả về rỗng, không báo lỗi
create policy "book_covers_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'book-covers' and (select public.is_admin()));

create policy "book_covers_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'book-covers' and (select public.is_admin()));

create policy "book_covers_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'book-covers' and (select public.is_admin()))
  with check (bucket_id = 'book-covers' and (select public.is_admin()));

create policy "book_covers_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'book-covers' and (select public.is_admin()));


-- ---------------------------------------------------------------------
-- 14. CHATBOT "MÂY": bộ đếm lượt (khách, IP băm, trần chung lượt gọi Gemini) + token của server web
--     Không lưu nội dung chat, không lưu IP thô. Chi tiết: docs/plans/phase-11.md.
-- ---------------------------------------------------------------------
-- 1. Bộ đếm. Schema private: PostgREST không lộ ra; RLS bật, không policy → anon / authenticated không đọc / ghi được
create table private.chat_quota (
  bucket       text        not null check (char_length(bucket) <= 80),  -- 'visitor:hour:<hmac>', 'gemini:day'…
  window_start timestamptz not null,
  used         int         not null default 0 check (used >= 0),
  primary key (bucket, window_start)
);

create index chat_quota_window_idx on private.chat_quota (window_start);

alter table private.chat_quota enable row level security;

-- 2. Token của server web: một dòng, chỉ lưu sha256
create table private.chat_settings (
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


-- ---------------------------------------------------------------------
-- 15. CHỢ SÁCH CŨ (docs/plans/cho-sach-cu.md): thành viên đăng bán sách cũ (1 tin = 1 cuốn có trong catalog),
--     admin duyệt, người mua đặt riêng từng tin (đơn thường, không qua giỏ), sổ tiền người bán MÔ PHỎNG.
--     Kiểu ở mục 1, hằng ở mục 2, hoàn kho khi hủy đơn (bỏ dòng sách cũ) ở mục 8.
--     Không thu, không lưu tài khoản ngân hàng hay thông tin thanh toán của người bán.
-- ---------------------------------------------------------------------
-- 1. Tin bán sách cũ
create table public.used_listings (
  id             bigint generated by default as identity primary key,
  seller_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  seller_name    text,                     -- tự điền từ profile (null → app hiện "Thành viên"/"Member")
  book_id        bigint not null references public.books(id) on delete restrict,
  condition      public.used_condition not null,
  price          int not null check (price > 0),
  fee            int not null,             -- phí sàn chụp lúc đăng / sửa (RPC ghi = used_platform_fee(price))
  description    text,
  photos         text[] not null,          -- đường dẫn trong bucket used-listing-photos: <seller_id>/<uuid>.webp
  status         public.used_listing_status not null default 'pending',
  reject_reason  text,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint used_listings_fee_check check (fee >= 0 and fee <= price),
  constraint used_listings_description_length check (description is null or char_length(description) <= 500),
  constraint used_listings_photos_count check (cardinality(photos) between 1 and 3),
  constraint used_listings_reject_reason_length check (reject_reason is null or char_length(reject_reason) <= 500)
);

create index used_listings_status_idx        on public.used_listings (status, created_at desc);
create index used_listings_book_approved_idx on public.used_listings (book_id) where status = 'approved';
create index used_listings_seller_idx        on public.used_listings (seller_id, created_at desc);
-- Policy đọc ảnh tìm tin chứa ảnh: photos @> array[name]
create index used_listings_photos_idx        on public.used_listings using gin (photos);

create trigger used_listings_updated_at before update on public.used_listings
  for each row execute function public.set_updated_at();

create or replace function public.used_listings_set_seller_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select nullif(btrim(p.full_name), '') into new.seller_name
    from public.profiles p where p.id = new.seller_id;
  return new;
end;
$$;

-- Lúc đăng và lúc người bán sửa (update_used_listing ghi các cột này); admin duyệt / đơn đổi trạng thái không đụng tới
create trigger used_listings_seller_name before insert or update of condition, price, description, photos
  on public.used_listings
  for each row execute function public.used_listings_set_seller_name();

-- Luồng trạng thái tin (mọi role, kể cả service role): pending → approved | rejected | withdrawn;
-- approved → pending (sửa) | sold | withdrawn | rejected (admin gỡ); rejected → pending (sửa) | withdrawn;
-- sold → approved (đơn bị hủy); withdrawn là trạng thái cuối. App có bản trùng (nextListingStatuses) → sửa cả hai chỗ.
create or replace function private.used_listing_transition_allowed(
  p_from public.used_listing_status,
  p_to   public.used_listing_status
)
returns boolean language sql immutable set search_path = '' as $$
  select case p_from
    when 'pending'  then p_to in ('approved', 'rejected', 'withdrawn')
    when 'approved' then p_to in ('pending', 'sold', 'withdrawn', 'rejected')
    when 'rejected' then p_to in ('pending', 'withdrawn')
    when 'sold'     then p_to in ('approved')
    else false
  end;
$$;

-- → sold chỉ khi có đơn chưa hủy chứa tin; sold → approved chỉ khi không còn đơn chưa hủy chứa tin (tin không bao
-- giờ "đang bán" trong lúc còn một đơn đang giao). security definer: authenticated không vào được schema private.
create or replace function public.used_listings_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_open_order boolean;
begin
  if new.status = old.status then
    return new;
  end if;

  if not private.used_listing_transition_allowed(old.status, new.status) then
    raise exception 'LISTING_INVALID_TRANSITION'
      using detail = json_build_object('from', old.status, 'to', new.status)::text;
  end if;

  if new.status = 'sold' or old.status = 'sold' then
    select exists (
      select 1 from public.order_items oi
        join public.orders o on o.id = oi.order_id
       where oi.used_listing_id = new.id and o.status <> 'cancelled'
    ) into v_open_order;

    if (new.status = 'sold') <> v_open_order then
      raise exception 'LISTING_INVALID_TRANSITION'
        using detail = json_build_object('from', old.status, 'to', new.status)::text;
    end if;
  end if;

  return new;
end;
$$;

create trigger used_listings_status_change before update of status on public.used_listings
  for each row execute function public.used_listings_status_change();

-- Mọi tên ảnh đã từng gắn vào tin (mọi trạng thái, kể cả ảnh đã bỏ khỏi tin khi sửa; giữ cả khi xóa tin):
-- can_upload_used_photo chặn tải lên lại đúng tên đó. Chỉ xét tên đang gắn tin thì: tin đã duyệt đổi ảnh X → Y, xóa
-- X, tải lại tên X với ảnh khác → link ký cũ của X (hạn 7 ngày) hiện ảnh chưa duyệt. Schema private, RLS bật, không
-- policy (như private.chat_quota): PostgREST không lộ ra, chỉ hàm security definer đọc / ghi.
create table private.used_photo_names (
  name        text primary key,
  created_at  timestamptz not null default now()
);

alter table private.used_photo_names enable row level security;

revoke all on table private.used_photo_names from public, anon, authenticated;

create or replace function private.used_listings_remember_photos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into private.used_photo_names (name)
  select x.name from unnest(new.photos) as x(name)
  on conflict (name) do nothing;
  return null;
end;
$$;

create trigger used_listings_remember_photos after insert or update of photos on public.used_listings
  for each row execute function private.used_listings_remember_photos();

-- 2. Khóa ngoại dòng đơn → tin (cột order_items.used_listing_id ở mục 8; bảng used_listings tạo sau order_items)
-- restrict: tin nằm trong một đơn (kể cả đơn đã hủy) không xóa được → tài khoản người bán có tin trong đơn không xóa
-- được (profiles xóa dây chuyền tin), như seller_payouts. set null từng biến dòng sách cũ thành dòng sách mới: hủy đơn
-- sau đó hoàn kho nhầm cho sách catalog.
alter table public.order_items add constraint order_items_used_listing_id_fkey
  foreign key (used_listing_id) references public.used_listings(id) on delete restrict;

-- 3. Sổ tiền người bán: MÔ PHỎNG. Chỉ số tiền + trạng thái; không thu, không lưu tài khoản ngân hàng hay thông tin
-- thanh toán của người bán. "paid" do admin đánh dấu (mark_payout_paid), không có chuyển tiền thật.
-- restrict ở cả 3 khóa: sổ tiền không xóa được, tài khoản người bán đã có khoản tiền không xóa được.
create table public.seller_payouts (
  id          bigint generated by default as identity primary key,
  order_id    bigint not null references public.orders(id) on delete restrict,
  listing_id  bigint not null references public.used_listings(id) on delete restrict,
  seller_id   uuid not null references public.profiles(id) on delete restrict,
  title       text not null,
  price       int not null check (price > 0),
  fee         int not null,
  amount      int not null,
  status      text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (order_id, listing_id),
  constraint seller_payouts_fee_check check (fee >= 0 and fee <= price),
  constraint seller_payouts_amount_check check (amount = price - fee),
  constraint seller_payouts_paid_at_check check ((status = 'paid') = (paid_at is not null))
);

comment on table public.seller_payouts is 'Sổ tiền mô phỏng: chỉ số tiền và trạng thái. Không thu, không lưu tài khoản ngân hàng hay thông tin thanh toán của người bán. paid do admin đánh dấu, không có chuyển tiền thật. Tài khoản đã có khoản tiền không xóa được (restrict).';

create index seller_payouts_seller_idx on public.seller_payouts (seller_id, created_at desc);
create index seller_payouts_status_idx on public.seller_payouts (status, created_at);

-- Đơn có tin sách cũ: hủy → tin về approved; lần đầu đạt đã giao + đã thanh toán → khoản chờ trả người bán
-- (giá bán lúc đặt − phí sàn chụp ở tin). AFTER: lúc này đơn đã thành cancelled nên chốt chặn sold → approved qua được.
create or replace function public.handle_used_order_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.used_listings l
       set status = 'approved'
      from public.order_items oi
     where oi.order_id = new.id and oi.used_listing_id = l.id and l.status = 'sold';
  end if;

  if new.status = 'delivered' and new.payment_status = 'paid'
     and (old.status is distinct from 'delivered' or old.payment_status is distinct from 'paid') then
    insert into public.seller_payouts (order_id, listing_id, seller_id, title, price, fee, amount)
    select new.id, l.id, l.seller_id, oi.title, oi.unit_price, l.fee, oi.unit_price - l.fee
      from public.order_items oi
      join public.used_listings l on l.id = oi.used_listing_id
     where oi.order_id = new.id
    on conflict (order_id, listing_id) do nothing;
  end if;

  return null;
end;
$$;

create trigger orders_used_market after update of status, payment_status on public.orders
  for each row execute function public.handle_used_order_change();

-- 4. RLS + quyền: không ai ghi thẳng (mọi ghi qua RPC security definer)
alter table public.used_listings  enable row level security;
alter table public.seller_payouts enable row level security;

create policy "used_listings_public_read" on public.used_listings
  for select to anon, authenticated using (status in ('approved', 'sold'));

create policy "used_listings_select_own_or_admin" on public.used_listings
  for select to authenticated
  using (seller_id = (select auth.uid()) or (select public.is_admin()));

-- revoke all = bỏ insert / update / delete và quyền select cả bảng; chỉ cấp lại select theo cột
revoke all on table public.used_listings from anon, authenticated;
grant  select (
  id, seller_name, book_id, condition, price, description, photos, status, approved_at, created_at, updated_at
) on public.used_listings to anon;
grant  select (
  id, seller_id, seller_name, book_id, condition, price, fee, description, photos, status, reject_reason,
  approved_at, created_at, updated_at
) on public.used_listings to authenticated;

create policy "seller_payouts_select_own_or_admin" on public.seller_payouts
  for select to authenticated
  using (seller_id = (select auth.uid()) or (select public.is_admin()));

-- Quyền cột: không có order_id (người bán không lần ra đơn / người mua). Admin cũng là authenticated nên cũng không đọc
-- được order_id qua bảng: trang khoản tiền admin (P-C) tìm đơn qua listing_id hoặc RPC có kiểm admin.
revoke all on table public.seller_payouts from anon, authenticated;
grant  select (id, listing_id, seller_id, title, price, fee, amount, status, paid_at, created_at)
  on public.seller_payouts to authenticated;

-- 5. RPC
-- Kiểm tra dùng chung khi đăng / sửa / duyệt
create or replace function private.used_check_pending_limit(p_user uuid)
returns void language plpgsql stable set search_path = '' as $$
begin
  if (select count(*) from public.used_listings
       where seller_id = p_user and status = 'pending') >= private.used_pending_limit() then
    raise exception 'LISTING_PENDING_LIMIT'
      using detail = json_build_object('max', private.used_pending_limit())::text;
  end if;
end;
$$;

-- Sách đang bán; giá trong (0, trần], trần = giá gốc của sách (coalesce(original_price, price))
create or replace function private.used_check_book_price(p_book_id bigint, p_price int)
returns void language plpgsql stable set search_path = '' as $$
declare
  v_title  text;
  v_active boolean;
  v_max    int;
begin
  select b.title, b.is_active, coalesce(b.original_price, b.price)
    into v_title, v_active, v_max
    from public.books b
   where b.id = p_book_id;

  -- Sách không có = dữ liệu nhập sai (form chỉ cho chọn sách có thật); sách ngừng bán thì có tên để báo
  if not found then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'book_id')::text;
  end if;

  if not v_active then
    raise exception 'BOOK_UNAVAILABLE'
      using detail = json_build_object('book_id', p_book_id, 'title', v_title)::text;
  end if;

  if p_price is null or p_price <= 0 or p_price > v_max then
    raise exception 'LISTING_PRICE_INVALID'
      using detail = json_build_object('max', v_max)::text;
  end if;
end;
$$;

-- Mọi ảnh của tin đã có trong bucket với mimetype image/webp và ≤ 1MB (như file_size_limit của bucket). Chỉ ĐỌC
-- storage.objects. Dùng khi đăng / sửa (false → LISTING_PHOTOS_INVALID) và khi admin duyệt (false →
-- LISTING_PHOTOS_MISSING: ảnh có thể đã mất ngoài policy: service role, xóa tay). Tên trùng trong p_photos → đếm
-- thiếu → false.
create or replace function private.used_photos_stored(p_photos text[])
returns boolean language sql stable set search_path = '' as $$
  select count(*) = cardinality(p_photos)
    from storage.objects o
   where o.bucket_id = 'used-listing-photos'
     and o.name = any(p_photos)
     and o.metadata ->> 'mimetype' = 'image/webp'
     and (o.metadata ->> 'size')::bigint <= 1048576;
$$;

-- Tình trạng, mô tả ≤ 500, ảnh: 1–3 đường dẫn khác nhau, đúng mẫu <seller_id>/<uuid>.webp, đã có trong bucket
-- (used_photos_stored).
create or replace function private.used_check_listing_input(
  p_user        uuid,
  p_condition   public.used_condition,
  p_description text,
  p_photos      text[]
)
returns void language plpgsql stable set search_path = '' as $$
begin
  if p_condition is null then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'condition')::text;
  end if;

  if char_length(p_description) > 500 then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'description', 'max', 500)::text;
  end if;

  if p_photos is null
     or cardinality(p_photos) not between 1 and 3
     or array_ndims(p_photos) <> 1
     or array_position(p_photos, null) is not null
     or (select count(distinct x.path) from unnest(p_photos) as x(path)) <> cardinality(p_photos)
     or exists (
       select 1 from unnest(p_photos) as x(path)
        where x.path !~ ('^' || p_user::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$')
     )
     or not private.used_photos_stored(p_photos)
  then
    raise exception 'LISTING_PHOTOS_INVALID'
      using detail = json_build_object('max', 3)::text;
  end if;
end;
$$;

-- Phí sàn + số tiền người bán nhận cho một mức giá (form đăng tin hiện "bạn nhận được X ₫": số lấy từ đây)
create or replace function public.used_listing_quote(p_price int)
returns table (fee int, payout int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_price is null or p_price <= 0 then
    raise exception 'LISTING_PRICE_INVALID';
  end if;

  return query select private.used_platform_fee(p_price), p_price - private.used_platform_fee(p_price);
end;
$$;

-- Đăng tin (chờ duyệt). Khóa theo người bán: hai lần đăng song song không vượt giới hạn tin chờ duyệt.
create or replace function public.create_used_listing(
  p_book_id     bigint,
  p_condition   public.used_condition,
  p_price       int,
  p_description text,
  p_photos      text[]
)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_user        uuid := auth.uid();
  v_description text := nullif(btrim(p_description), '');
  v_id          bigint;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('used_listing:' || v_user::text, 0));
  perform private.used_check_pending_limit(v_user);
  perform private.used_check_book_price(p_book_id, p_price);
  perform private.used_check_listing_input(v_user, p_condition, v_description, p_photos);

  insert into public.used_listings (seller_id, book_id, condition, price, fee, description, photos)
  values (v_user, p_book_id, p_condition, p_price, private.used_platform_fee(p_price), v_description, p_photos)
  returning id into v_id;

  return v_id;
end;
$$;

-- Sửa tin của mình (chưa bán, chưa rút) → về chờ duyệt. Tin không có / của người khác / đã bán / đã rút: cùng một mã
-- LISTING_NOT_EDITABLE (không lộ tin nào tồn tại).
create or replace function public.update_used_listing(
  p_id          bigint,
  p_condition   public.used_condition,
  p_price       int,
  p_description text,
  p_photos      text[]
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user        uuid := auth.uid();
  v_description text := nullif(btrim(p_description), '');
  v_listing     public.used_listings;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('used_listing:' || v_user::text, 0));

  select * into v_listing
    from public.used_listings
   where id = p_id and seller_id = v_user
     for update;

  if not found or v_listing.status in ('sold', 'withdrawn') then
    raise exception 'LISTING_NOT_EDITABLE';
  end if;

  -- Tin đang chờ duyệt sửa tiếp không tăng số tin chờ duyệt
  if v_listing.status <> 'pending' then
    perform private.used_check_pending_limit(v_user);
  end if;
  perform private.used_check_book_price(v_listing.book_id, p_price);
  perform private.used_check_listing_input(v_user, p_condition, v_description, p_photos);

  update public.used_listings
     set condition     = p_condition,
         price         = p_price,
         fee           = private.used_platform_fee(p_price),
         description   = v_description,
         photos        = p_photos,
         status        = 'pending',
         reject_reason = null
   where id = v_listing.id;
end;
$$;

-- Người bán rút tin chưa bán
create or replace function public.withdraw_used_listing(p_id bigint)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user    uuid := auth.uid();
  v_listing public.used_listings;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_listing
    from public.used_listings
   where id = p_id and seller_id = v_user
     for update;

  if not found or v_listing.status in ('sold', 'withdrawn') then
    raise exception 'LISTING_NOT_EDITABLE';
  end if;

  update public.used_listings set status = 'withdrawn' where id = v_listing.id;
end;
$$;

-- Admin duyệt (pending → approved, kiểm lại sách đang bán + giá trần) hoặc từ chối / gỡ (pending | approved →
-- rejected, bắt buộc lý do). p_expected_status = trạng thái admin đang thấy: khác → LISTING_STATUS_CHANGED.
create or replace function public.review_used_listing(
  p_id              bigint,
  p_expected_status public.used_listing_status,
  p_approve         boolean,
  p_reason          text default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_reason  text := nullif(btrim(p_reason), '');
  v_listing public.used_listings;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  if p_approve is null then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'approve')::text;
  end if;

  select * into v_listing from public.used_listings where id = p_id for update;

  if not found or v_listing.status is distinct from p_expected_status then
    raise exception 'LISTING_STATUS_CHANGED';
  end if;

  if p_approve then
    if v_listing.status <> 'pending' then
      raise exception 'LISTING_INVALID_TRANSITION'
        using detail = json_build_object('from', v_listing.status, 'to', 'approved')::text;
    end if;

    perform private.used_check_book_price(v_listing.book_id, v_listing.price);
    -- Chốt cuối: không công khai tin thiếu ảnh (người bán không xóa được ảnh của tin chờ duyệt, nhưng service role /
    -- xóa tay trong Storage thì được). Mã riêng cho admin (người bán không làm gì sai): từ chối tin kèm lý do.
    if not private.used_photos_stored(v_listing.photos) then
      raise exception 'LISTING_PHOTOS_MISSING';
    end if;

    update public.used_listings
       set status = 'approved', approved_at = now(), reject_reason = null
     where id = v_listing.id;
    return;
  end if;

  if v_listing.status not in ('pending', 'approved') then
    raise exception 'LISTING_INVALID_TRANSITION'
      using detail = json_build_object('from', v_listing.status, 'to', 'rejected')::text;
  end if;

  if v_reason is null or char_length(v_reason) > 500 then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'reason', 'max', 500)::text;
  end if;

  update public.used_listings
     set status = 'rejected', reject_reason = v_reason
   where id = v_listing.id;
end;
$$;

-- Tiền của đơn sách cũ (trang thanh toán): giá tin + ship cố định (không freeship, không voucher). Chỉ tin approved /
-- sold; available = tin đang bán và sách còn bán.
create or replace function public.quote_used_order(p_listing_id bigint)
returns table (price int, shipping_fee int, total int, available boolean)
language sql stable security definer set search_path = '' as $$
  select l.price, private.flat_shipping_fee(), l.price + private.flat_shipping_fee(),
         l.status = 'approved' and b.is_active
    from public.used_listings l
    join public.books b on b.id = l.book_id
   where l.id = p_listing_id
     and l.status in ('approved', 'sold');
$$;

-- Mua một tin (đơn riêng, không qua giỏ): idempotency như place_order (cùng key → trả đúng đơn đã tạo), khóa tin,
-- client không gửi giá (p_expected_total chỉ để so). Không đụng books.stock / sold_count.
-- Key dùng chung không gian với place_order (orders_user_idempotency_key: user_id + key): key của place_order gửi vào
-- đây trả đơn sách mới đó. Không trùng trong thực tế vì key sinh mới mỗi lần mở trang thanh toán.
create or replace function public.place_used_order(
  p_listing_id      bigint,
  p_address_id      bigint,
  p_payment_method  public.payment_method default 'cod',
  p_note            text default null,
  p_idempotency_key uuid default null,
  p_expected_total  int default null
)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  v_user     uuid := auth.uid();
  v_note     text := nullif(btrim(p_note), '');
  v_addr     public.addresses;
  v_listing  public.used_listings;
  v_book     public.books;
  v_shipping int := private.flat_shipping_fee();
  v_total    int;
  v_order    public.orders;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_idempotency_key is null then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'idempotency_key')::text;
  end if;

  if p_expected_total is null then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'expected_total')::text;
  end if;

  -- Cùng khóa với place_order: request song song cùng key chờ ở đây rồi thấy đơn của request đầu
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_idempotency_key::text, 0));

  select * into v_order from public.orders
   where user_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    return v_order;
  end if;

  if p_payment_method is null then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'payment_method')::text;
  end if;

  if char_length(v_note) > 500 then
    raise exception 'INVALID_INPUT'
      using detail = json_build_object('field', 'note', 'max', 500)::text;
  end if;

  select * into v_addr from public.addresses
   where id = p_address_id and user_id = v_user;
  if not found then
    raise exception 'INVALID_ADDRESS';
  end if;

  select * into v_listing from public.used_listings where id = p_listing_id for update;
  if not found or v_listing.status <> 'approved' then
    raise exception 'LISTING_UNAVAILABLE';
  end if;

  if v_listing.seller_id = v_user then
    raise exception 'LISTING_OWN';
  end if;

  select * into v_book from public.books where id = v_listing.book_id;
  if not found or not v_book.is_active then
    raise exception 'BOOK_UNAVAILABLE'
      using detail = json_build_object('book_id', v_listing.book_id, 'title', v_book.title)::text;
  end if;

  v_total := v_listing.price + v_shipping;

  if p_expected_total <> v_total then
    raise exception 'LISTING_CHANGED'
      using detail = json_build_object('total', v_total)::text;
  end if;

  insert into public.orders (
    user_id, payment_method,
    recipient_name, phone, province, ward, street, note,
    subtotal, shipping_fee, discount, total, idempotency_key
  ) values (
    v_user, p_payment_method,
    v_addr.recipient_name, v_addr.phone, v_addr.province, v_addr.ward, v_addr.street, v_note,
    v_listing.price, v_shipping, 0, v_total, p_idempotency_key
  )
  returning * into v_order;

  insert into public.order_items (order_id, book_id, title, cover_url, unit_price, quantity, used_listing_id)
  values (v_order.id, v_book.id, v_book.title, v_book.cover_url, v_listing.price, 1, v_listing.id);

  update public.used_listings set status = 'sold' where id = v_listing.id;

  return v_order;
end;
$$;

-- Đơn đã bán của người gọi (đơn chưa hủy) + tiền sẽ nhận. Không trả mã đơn, tên / địa chỉ / điện thoại người mua.
create or replace function public.my_used_sales()
returns table (
  listing_id     bigint,
  title          text,
  price          int,
  fee            int,
  amount         int,
  order_status   public.order_status,
  payment_status public.payment_status,
  payout_status  text,
  sold_at        timestamptz
)
language sql stable security definer set search_path = '' as $$
  select l.id, oi.title, oi.unit_price, coalesce(p.fee, l.fee), coalesce(p.amount, oi.unit_price - l.fee),
         o.status, o.payment_status, p.status, o.created_at
    from public.used_listings l
    join public.order_items oi on oi.used_listing_id = l.id
    join public.orders o on o.id = oi.order_id
    left join public.seller_payouts p on p.order_id = o.id and p.listing_id = l.id
   where l.seller_id = (select auth.uid())
     and o.status <> 'cancelled'
   order by o.created_at desc, l.id;
$$;

-- Admin đánh dấu đã trả người bán (mô phỏng, không chuyển tiền). Chỉ từ pending và khi đơn của khoản còn đã giao + đã
-- thanh toán (phòng sửa tay / gọi thẳng API): 0 dòng → PAYOUT_STATUS_CHANGED. Khóa dòng đơn (for share) trước khi
-- kiểm: câu đổi trạng thái / thanh toán của đơn chạy song song chờ tới khi đánh dấu xong, không lọt vào giữa.
create or replace function public.mark_payout_paid(p_id bigint)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  perform 1
     from public.orders o
     join public.seller_payouts p on p.order_id = o.id
    where p.id = p_id
      for share of o;

  update public.seller_payouts p
     set status = 'paid', paid_at = now()
   where p.id = p_id and p.status = 'pending'
     and exists (
       select 1 from public.orders o
        where o.id = p.order_id and o.status = 'delivered' and o.payment_status = 'paid'
     );

  if not found then
    raise exception 'PAYOUT_STATUS_CHANGED';
  end if;
end;
$$;

-- Policy upload ảnh:
-- (1) người gọi còn dưới used_photo_limit() ảnh trong thư mục của mình. Trần chống lạm dụng kho ảnh (quyết định 7),
--     KHÔNG đếm ảnh của tin đã bán: đếm cả thì bán 10 tin (3 ảnh / tin) là khóa đăng tin vĩnh viễn. Đếm không khóa:
--     tải song song có thể vượt trần một chút (chấp nhận).
-- (2) tên chưa từng gắn vào tin nào: tên đã từng gắn vào tin (mọi trạng thái, kể cả đã bỏ khỏi tin khi sửa) nằm trong
--     private.used_photo_names. Xóa ảnh rồi tải lại đúng tên đó là đổi được ảnh của tin mà không qua duyệt (link ký
--     cũ của tên đó còn hạn thì hiện ảnh mới).
-- (3) tên trong thư mục của người gọi (policy cũng kiểm; gọi thẳng như RPC thì không dò được tên ảnh của người khác).
create or replace function public.can_upload_used_photo(p_name text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and (storage.foldername(p_name))[1] = auth.uid()::text
     and (
       select count(*) from storage.objects o
        where o.bucket_id = 'used-listing-photos'
          and (storage.foldername(o.name))[1] = auth.uid()::text
          and not exists (
            select 1 from public.used_listings l
             where l.status = 'sold' and l.photos @> array[o.name]
          )
     ) < private.used_photo_limit()
     and not exists (
       select 1 from private.used_photo_names n where n.name = p_name
     );
$$;

-- Policy xóa ảnh: chỉ ảnh trong thư mục của người gọi (policy cũng kiểm; gọi thẳng như RPC thì không dò được tên ảnh
-- của người khác); ảnh gắn tin chờ duyệt / đã duyệt / đã bán không xóa được (giữ ảnh của tin đúng như lúc duyệt). Ảnh
-- chưa gắn tin, của tin bị từ chối / đã rút, đã bỏ khỏi tin khi sửa: xóa được (dọn ảnh tải lên bỏ dở); tên đó không
-- tải lên lại được (can_upload_used_photo).
create or replace function public.can_delete_used_photo(p_name text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and (storage.foldername(p_name))[1] = auth.uid()::text
     and not exists (
       select 1 from public.used_listings l
        where l.status in ('pending', 'approved', 'sold') and l.photos @> array[p_name]
     );
$$;

revoke execute on function public.used_listing_quote(int) from public, anon;
grant  execute on function public.used_listing_quote(int) to authenticated;

revoke execute on function public.create_used_listing(bigint, public.used_condition, int, text, text[]) from public, anon;
grant  execute on function public.create_used_listing(bigint, public.used_condition, int, text, text[]) to authenticated;

revoke execute on function public.update_used_listing(bigint, public.used_condition, int, text, text[]) from public, anon;
grant  execute on function public.update_used_listing(bigint, public.used_condition, int, text, text[]) to authenticated;

revoke execute on function public.withdraw_used_listing(bigint) from public, anon;
grant  execute on function public.withdraw_used_listing(bigint) to authenticated;

revoke execute on function public.review_used_listing(bigint, public.used_listing_status, boolean, text) from public, anon;
grant  execute on function public.review_used_listing(bigint, public.used_listing_status, boolean, text) to authenticated;

revoke execute on function public.quote_used_order(bigint) from public, anon;
grant  execute on function public.quote_used_order(bigint) to authenticated;

revoke execute on function public.place_used_order(bigint, bigint, public.payment_method, text, uuid, int) from public, anon;
grant  execute on function public.place_used_order(bigint, bigint, public.payment_method, text, uuid, int) to authenticated;

revoke execute on function public.my_used_sales() from public, anon;
grant  execute on function public.my_used_sales() to authenticated;

revoke execute on function public.mark_payout_paid(bigint) from public, anon;
grant  execute on function public.mark_payout_paid(bigint) to authenticated;

revoke execute on function public.can_upload_used_photo(text) from public, anon;
grant  execute on function public.can_upload_used_photo(text) to authenticated;

revoke execute on function public.can_delete_used_photo(text) from public, anon;
grant  execute on function public.can_delete_used_photo(text) to authenticated;

-- 6. Storage: ảnh tin sách cũ, bucket KHÔNG công khai (app hiện bằng link ký có hạn). Server nén về WebP trước khi
-- tải lên; bucket từ chối mọi thứ khác, kể cả khi gọi thẳng Storage API. Không có policy update (tên mới mỗi lần).
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('used-listing-photos', 'used-listing-photos', false, array['image/webp'], 1048576)
on conflict (id) do nothing;

-- Đọc / ký link: chủ thư mục, admin, hoặc ảnh thuộc tin đang công khai (approved / sold). Storage API chỉ xóa object
-- mà phiên đọc được → chủ thư mục phải đọc được ảnh của mình. Xóa bị policy chặn: Storage không báo lỗi, chỉ trả mảng
-- rỗng.
create policy "used_listing_photos_select" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'used-listing-photos' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_admin())
      or exists (
        select 1 from public.used_listings l
         where l.status in ('approved', 'sold')
           and l.photos @> array[objects.name]
      )
    )
  );

create policy "used_listing_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'used-listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
    and public.can_upload_used_photo(name)
  );

create policy "used_listing_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'used-listing-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_delete_used_photo(name)
  );


-- =====================================================================
-- RPC cho app (supabase.rpc):
--   search_books(q)                         — anon + authenticated
--   quote_order(p_voucher_code)             — tiền tạm tính ở giỏ / checkout
--   quote_items(p_items jsonb)              — tạm tính giỏ khách (anon + authenticated)
--   checkout_vouchers()                     — mã public dùng được + mức giảm / số tiền còn thiếu với giỏ hiện tại
--   place_order(p_address_id, p_payment_method, p_voucher_code, p_note,
--               p_idempotency_key, p_expected_total)
--   cancel_order(p_order_id, p_reason)
--   set_default_address(p_address_id)
--   merge_cart(p_items jsonb)               — gộp giỏ localStorage khi đăng nhập
--   order_contact(p_order_id)               — email + locale người đặt (chủ đơn hoặc admin), dùng gửi email
--   consume_chat_quota(p_token, p_visitor, p_ip, p_limits) — trừ lượt chatbot cho một lượt gọi Gemini
--                                           (anon + authenticated, cần CHAT_QUOTA_TOKEN của server web)
--   set_chat_quota_token(p_token)           — chỉ service_role (e2e local); production: private.new_chat_quota_token()
--   Chợ sách cũ (mục 15, chỉ authenticated):
--   used_listing_quote(p_price)             — phí sàn + số tiền người bán nhận
--   create_used_listing(p_book_id, p_condition, p_price, p_description, p_photos) — đăng tin (chờ duyệt), trả id
--   update_used_listing(p_id, p_condition, p_price, p_description, p_photos)      — sửa tin → về chờ duyệt
--   withdraw_used_listing(p_id)             — người bán rút tin chưa bán
--   review_used_listing(p_id, p_expected_status, p_approve, p_reason)              — admin duyệt / từ chối / gỡ
--   quote_used_order(p_listing_id)          — giá + ship cố định + tổng của đơn sách cũ
--   place_used_order(p_listing_id, p_address_id, p_payment_method, p_note,
--                    p_idempotency_key, p_expected_total)                          — mua một tin
--   my_used_sales()                         — đơn đã bán + tiền sẽ nhận của người gọi (không có thông tin người mua)
--   mark_payout_paid(p_id)                  — admin đánh dấu đã trả người bán (mô phỏng)
--   can_upload_used_photo(p_name)           — dùng trong policy upload ảnh (≤ used_photo_limit() = 30 ảnh / người,
--                                           không đếm ảnh của tin đã bán; tên chưa từng gắn tin, tên ảnh đã từng
--                                           gắn tin lưu ở private.used_photo_names; thư mục của người gọi)
--   can_delete_used_photo(p_name)           — dùng trong policy xóa ảnh (thư mục của người gọi; ảnh gắn tin chờ duyệt /
--                                           đã duyệt / đã bán: không)
--
-- MÃ LỖI do các hàm trả về (map sang messages/{vi,en}.json → errors.*):
--   AUTH_REQUIRED, INVALID_ADDRESS, BOOK_UNAVAILABLE, OUT_OF_STOCK, CART_EMPTY,
--   VOUCHER_NOT_FOUND, VOUCHER_INACTIVE, VOUCHER_NOT_STARTED (detail: {"starts_at": ...}),
--   VOUCHER_EXPIRED (detail: {"ends_at": ...}), VOUCHER_EXHAUSTED,
--   VOUCHER_MIN_ORDER (detail: {"min_order_value": ..., "shortfall": ...}),
--   ORDER_NOT_CANCELLABLE (đơn không có / của tài khoản khác), ORDER_ALREADY_CANCELLED, ORDER_DELIVERED,
--   ORDER_IN_PROGRESS (detail: {"status": ...}), ORDER_PAID, ORDER_REOPEN_FORBIDDEN,
--   ORDER_INVALID_TRANSITION (trigger trạng thái đơn; detail: {"from": ..., "to": ...}),
--   INVALID_INPUT (detail: {"field": ..., "max": ...}),
--   CART_CHANGED (place_order, p_expected_total khác tổng thật; detail: {"total": ...})
--   CHAT_QUOTA_EXCEEDED, CHAT_FREE_QUOTA (consume_chat_quota; detail: {"scope": ..., "resets_at": ...}),
--   CHAT_DISABLED (chưa đặt token), FORBIDDEN (token sai; RPC admin của chợ sách cũ: không phải admin)
--   Chợ sách cũ: LISTING_PENDING_LIMIT (detail: {"max": ...}), LISTING_PRICE_INVALID (detail: {"max": ...} khi có sách),
--   LISTING_PHOTOS_INVALID (đăng / sửa), LISTING_PHOTOS_MISSING (admin duyệt: ảnh của tin không còn đủ),
--   LISTING_NOT_EDITABLE (tin không có / của người khác / đã bán / đã rút),
--   LISTING_STATUS_CHANGED, LISTING_UNAVAILABLE, LISTING_OWN, LISTING_CHANGED (detail: {"total": ...}),
--   LISTING_INVALID_TRANSITION (trigger trạng thái tin; detail: {"from": ..., "to": ...}), PAYOUT_STATUS_CHANGED
--
-- SAU KHI CHẠY XONG:
-- 1. Chạy seed.sql để có dữ liệu mẫu.
-- 2. Đăng ký 1 tài khoản trên web của bạn, rồi biến nó thành admin:
--      update public.profiles set role = 'admin'
--       where id = (select id from auth.users where email = 'email-cua-ban@gmail.com');
-- =====================================================================
