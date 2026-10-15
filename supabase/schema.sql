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
  created_at       timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100)
);

-- Kiểm tra voucher và trả về số tiền giảm. p_voucher toàn null = không tìm thấy mã.
create or replace function private.voucher_discount(p_voucher public.vouchers, p_subtotal int)
returns int language plpgsql stable set search_path = '' as $$
declare
  v_discount bigint;
begin
  if p_voucher.id is null
     or not p_voucher.is_active
     or (p_voucher.starts_at   is not null and now() < p_voucher.starts_at)
     or (p_voucher.ends_at     is not null and now() > p_voucher.ends_at)
     or (p_voucher.usage_limit is not null and p_voucher.used_count >= p_voucher.usage_limit)
  then
    raise exception 'INVALID_VOUCHER';
  end if;

  if p_subtotal < p_voucher.min_order_value then
    raise exception 'VOUCHER_MIN_ORDER'
      using detail = json_build_object('min_order_value', p_voucher.min_order_value)::text;
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
  line_total  int generated always as (unit_price * quantity) stored
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_book_idx  on public.order_items (book_id);

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

-- Hủy → hoàn tồn kho và lượt dùng voucher; COD giao xong → đã thanh toán.
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
     where oi.order_id = new.id and oi.book_id = b.id;

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

  select count(*)::int, coalesce(sum(b.price * c.quantity), 0)::int
    into v_count, v_subtotal
    from public.cart_items c
    join public.books b on b.id = c.book_id and b.is_active
   where c.user_id = v_user;

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

-- Khách tự hủy đơn (chỉ khi đơn còn 'pending')
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

  update public.orders
     set status = 'cancelled',
         cancelled_reason = v_reason
   where id = p_order_id
     and user_id = auth.uid()
     and status = 'pending'
  returning * into v_order;

  if not found then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;

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
  price, original_price, stock, cover_url, page_count, format, language, published_year,
  weight_grams, dimensions, is_active, is_featured
) on public.books to authenticated;

-- VOUCHERS: chỉ admin xem/sửa (khách kiểm tra mã qua quote_order / place_order)
create policy "vouchers_admin_all" on public.vouchers
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

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

revoke execute on function public.quote_items(jsonb) from public;
grant  execute on function public.quote_items(jsonb) to anon, authenticated;

revoke execute on function public.set_default_address(bigint) from public, anon;
grant  execute on function public.set_default_address(bigint) to authenticated;

revoke execute on function public.merge_cart(jsonb) from public, anon;
grant  execute on function public.merge_cart(jsonb) to authenticated;

-- Chỉ dùng làm default của orders.order_code; gọi qua RPC sẽ đốt số thứ tự đơn
revoke execute on function public.generate_order_code() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 13. STORAGE: nơi lưu ảnh bìa sách (bucket public, chỉ admin upload)
-- ---------------------------------------------------------------------
-- Server chỉ upload WebP đã xử lý (rộng 600px ≈ 30–120KB): bucket từ chối mọi thứ khác, kể cả khi gọi thẳng Storage API
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('book-covers', 'book-covers', true, array['image/webp'], 1048576)
on conflict (id) do nothing;

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


-- =====================================================================
-- RPC cho app (supabase.rpc):
--   search_books(q)                         — anon + authenticated
--   quote_order(p_voucher_code)             — tiền tạm tính ở giỏ / checkout
--   quote_items(p_items jsonb)              — tạm tính giỏ khách (anon + authenticated)
--   place_order(p_address_id, p_payment_method, p_voucher_code, p_note,
--               p_idempotency_key, p_expected_total)
--   cancel_order(p_order_id, p_reason)
--   set_default_address(p_address_id)
--   merge_cart(p_items jsonb)               — gộp giỏ localStorage khi đăng nhập
--
-- MÃ LỖI do các hàm trả về (map sang messages/{vi,en}.json → errors.*):
--   AUTH_REQUIRED, INVALID_ADDRESS, BOOK_UNAVAILABLE, OUT_OF_STOCK, CART_EMPTY,
--   INVALID_VOUCHER, VOUCHER_MIN_ORDER, ORDER_NOT_CANCELLABLE, ORDER_REOPEN_FORBIDDEN,
--   ORDER_INVALID_TRANSITION (trigger trạng thái đơn; detail: {"from": ..., "to": ...}),
--   INVALID_INPUT (detail: {"field": ..., "max": ...}),
--   CART_CHANGED (place_order, p_expected_total khác tổng thật; detail: {"total": ...})
--
-- SAU KHI CHẠY XONG:
-- 1. Chạy seed.sql để có dữ liệu mẫu.
-- 2. Đăng ký 1 tài khoản trên web của bạn, rồi biến nó thành admin:
--      update public.profiles set role = 'admin'
--       where id = (select id from auth.users where email = 'email-cua-ban@gmail.com');
-- =====================================================================
