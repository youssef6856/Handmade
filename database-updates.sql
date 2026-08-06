-- ============================================================
-- تحديثات قاعدة البيانات الكاملة لموقع Handmade (نسخة محسّنة آمنة)
-- شغّلي الكود ده من: Supabase Dashboard -> SQL Editor -> New query -> Run
-- آمن تشغّليه أكتر من مرة من غير ما يبوظ حاجة
-- ============================================================

-- 1) جدول المنتجات
create table if not exists public.products (
  id bigserial primary key,
  name_ar text not null,
  name_en text,
  category text,
  price numeric default 0,
  discount_price numeric,
  stock_count integer default 0,
  description_ar text,
  description_en text,
  images text[] default '{}',
  is_bestseller boolean default false,
  is_new boolean default false,
  is_coming_soon boolean default false,
  views integer default 0,
  created_at timestamptz default now()
);

-- 2) جدول الطلبات
create table if not exists public.orders (
  id bigserial primary key,
  order_number text,
  customer_name text,
  customer_phone text,
  customer_address text,
  items jsonb default '[]',
  total numeric default 0,
  status text default 'تم الاستلام',
  user_id uuid references auth.users(id),
  payment_method text default 'cash',
  payment_status text default 'غير مطلوب',
  created_at timestamptz default now()
);

-- 3) جدول البروفايل
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  phone text,
  email text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- قراءة كل البروفايلات للأدمن (اللوحة بتستخدم anon بعد إزالة service_role)
drop policy if exists "profiles_select_all_admin" on public.profiles;
create policy "profiles_select_all_admin" on public.profiles
  for select using (true);

-- 4) تريجر: أول ما حد يعمل حساب جديد يتضاف في profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5) أعمدة إضافية في جدول الطلبات
alter table public.orders add column if not exists user_id uuid references auth.users(id);
alter table public.orders add column if not exists payment_method text default 'cash';
alter table public.orders add column if not exists payment_status text default 'غير مطلوب';

-- 6) صلاحيات الطلبات
alter table public.orders enable row level security;

drop policy if exists "orders_insert_anyone" on public.orders;
create policy "orders_insert_anyone" on public.orders
  for insert with check (auth.uid() = user_id or user_id is null);

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

-- الأدمن يقدر يقرأ ويعدّل كل الطلبات (لوحة التحكم)
drop policy if exists "orders_select_all_admin" on public.orders;
create policy "orders_select_all_admin" on public.orders
  for select using (true);

drop policy if exists "orders_update_all_admin" on public.orders;
create policy "orders_update_all_admin" on public.orders
  for update using (true);

-- 7) دالة آمنة لزيادة عداد مشاهدات المنتج
create or replace function public.increment_product_views(p_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products set views = coalesce(views, 0) + 1 where id = p_id;
$$;

revoke all on function public.increment_product_views(bigint) from public;
grant execute on function public.increment_product_views(bigint) to anon, authenticated;

-- 8) صلاحيات المنتجات
alter table public.products enable row level security;

drop policy if exists "products_select_all" on public.products;
create policy "products_select_all" on public.products
  for select using (true);

drop policy if exists "products_insert_admin" on public.products;
create policy "products_insert_admin" on public.products
  for insert with check (true);

drop policy if exists "products_update_admin" on public.products;
create policy "products_update_admin" on public.products
  for update using (true);

drop policy if exists "products_delete_admin" on public.products;
create policy "products_delete_admin" on public.products
  for delete using (true);

-- 9) دالة تنقيص المخزون عند تأكيد الطلب
create or replace function public.decrement_stock(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  pid bigint;
  qty int;
begin
  if p_items is null then return; end if;
  for item in select * from jsonb_array_elements(p_items)
  loop
    pid := (item->>'id')::bigint;
    qty := coalesce((item->>'qty')::int, 1);
    if pid is not null and qty > 0 then
      update public.products
      set stock_count = greatest(0, coalesce(stock_count, 0) - qty)
      where id = pid;
    end if;
  end loop;
end;
$$;

revoke all on function public.decrement_stock(jsonb) from public;
grant execute on function public.decrement_stock(jsonb) to anon, authenticated;

-- 10) تفعيل Realtime على الطلبات
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
end $$;

-- 11) Storage: سياسات الـ bucket اسمه products
-- لازم تعملي الـ bucket يدويًا أول مرة لو مش موجود: Storage → New bucket → products → Public
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = true;

drop policy if exists "products_storage_public_read" on storage.objects;
create policy "products_storage_public_read" on storage.objects
  for select using (bucket_id = 'products');

drop policy if exists "products_storage_public_insert" on storage.objects;
create policy "products_storage_public_insert" on storage.objects
  for insert with check (bucket_id = 'products');

drop policy if exists "products_storage_public_update" on storage.objects;
create policy "products_storage_public_update" on storage.objects
  for update using (bucket_id = 'products');

drop policy if exists "products_storage_public_delete" on storage.objects;
create policy "products_storage_public_delete" on storage.objects
  for delete using (bucket_id = 'products');

-- ============================================================
-- 12) كوبونات الخصم
-- ============================================================
create table if not exists public.coupons (
  id bigserial primary key,
  code text not null,
  discount_type text not null default 'fixed' check (discount_type in ('fixed', 'percent')),
  discount_value numeric not null default 0,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  is_active boolean not null default true,
  expires_at timestamptz,
  note text,
  created_at timestamptz default now()
);

create unique index if not exists coupons_code_unique on public.coupons (lower(code));

alter table public.coupons enable row level security;

drop policy if exists "coupons_select_all" on public.coupons;
create policy "coupons_select_all" on public.coupons for select using (true);

drop policy if exists "coupons_insert_admin" on public.coupons;
create policy "coupons_insert_admin" on public.coupons for insert with check (true);

drop policy if exists "coupons_update_admin" on public.coupons;
create policy "coupons_update_admin" on public.coupons for update using (true);

drop policy if exists "coupons_delete_admin" on public.coupons;
create policy "coupons_delete_admin" on public.coupons for delete using (true);

-- دالة آمنة للتحقق من الكوبون واستخدامه
create or replace function public.validate_coupon(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  if p_code is null or trim(p_code) = '' then
    return jsonb_build_object('ok', false, 'error', 'أدخلي كود الخصم');
  end if;

  select * into c from public.coupons
  where lower(code) = lower(trim(p_code))
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'كود الخصم غير صحيح');
  end if;
  if not c.is_active then
    return jsonb_build_object('ok', false, 'error', 'كود الخصم غير مفعّل');
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'كود الخصم منتهي');
  end if;
  if c.used_count >= c.max_uses then
    return jsonb_build_object('ok', false, 'error', 'تم استخدام الكود بالكامل');
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', c.id,
    'code', c.code,
    'discount_type', c.discount_type,
    'discount_value', c.discount_value
  );
end;
$$;

revoke all on function public.validate_coupon(text) from public;
grant execute on function public.validate_coupon(text) to anon, authenticated;

create or replace function public.redeem_coupon(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  select * into c from public.coupons
  where lower(code) = lower(trim(p_code))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'كود غير صحيح');
  end if;
  if not c.is_active or (c.expires_at is not null and c.expires_at < now()) or c.used_count >= c.max_uses then
    return jsonb_build_object('ok', false, 'error', 'الكود غير متاح');
  end if;

  update public.coupons set used_count = used_count + 1 where id = c.id;

  return jsonb_build_object(
    'ok', true,
    'code', c.code,
    'discount_type', c.discount_type,
    'discount_value', c.discount_value
  );
end;
$$;

revoke all on function public.redeem_coupon(text) from public;
grant execute on function public.redeem_coupon(text) to anon, authenticated;

-- أعمدة الخصم في الطلبات
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_amount numeric default 0;

-- ============================================================
-- 13) إعدادات الموقع + إخفاء منتج
-- ============================================================
create table if not exists public.site_settings (
  key text primary key,
  value text
);

alter table public.site_settings enable row level security;

drop policy if exists "settings_select_all" on public.site_settings;
create policy "settings_select_all" on public.site_settings for select using (true);

drop policy if exists "settings_upsert_admin" on public.site_settings;
create policy "settings_upsert_admin" on public.site_settings for all using (true) with check (true);

insert into public.site_settings (key, value) values
  ('whatsapp_number', '01288127665'),
  ('free_shipping_min', '500'),
  ('wallet_number', '01154548913'),
  ('instapay_handle', '01288127665'),
  ('announcement', '🎁 شحن مجاني للطلبات فوق 500 جنيه'),
  ('telegram_bot_token', ''),
  ('telegram_chat_id', '')
on conflict (key) do nothing;

alter table public.products add column if not exists is_active boolean default true;

-- ============================================================
-- 14) كوبون: استخدام مرة لكل عميل (بالموبايل)
-- ============================================================
alter table public.coupons add column if not exists max_per_customer integer default 1;

create table if not exists public.coupon_redemptions (
  id bigserial primary key,
  coupon_id bigint references public.coupons(id) on delete cascade,
  customer_phone text not null,
  order_number text,
  created_at timestamptz default now()
);

create index if not exists coupon_redemptions_coupon_phone
  on public.coupon_redemptions (coupon_id, customer_phone);

alter table public.coupon_redemptions enable row level security;

drop policy if exists "redemptions_select" on public.coupon_redemptions;
create policy "redemptions_select" on public.coupon_redemptions for select using (true);

drop policy if exists "redemptions_insert" on public.coupon_redemptions;
create policy "redemptions_insert" on public.coupon_redemptions for insert with check (true);

drop policy if exists "redemptions_delete" on public.coupon_redemptions;
create policy "redemptions_delete" on public.coupon_redemptions for delete using (true);

-- تحقق من الكوبون مع رقم الموبايل
create or replace function public.validate_coupon(p_code text, p_phone text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  used_by_phone int := 0;
  phone_norm text;
begin
  if p_code is null or trim(p_code) = '' then
    return jsonb_build_object('ok', false, 'error', 'أدخلي كود الخصم');
  end if;

  select * into c from public.coupons
  where lower(code) = lower(trim(p_code))
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'كود الخصم غير صحيح');
  end if;
  if not c.is_active then
    return jsonb_build_object('ok', false, 'error', 'كود الخصم غير مفعّل');
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'كود الخصم منتهي');
  end if;
  if c.used_count >= c.max_uses then
    return jsonb_build_object('ok', false, 'error', 'تم استنفاد عدد مرات استخدام الكود');
  end if;

  phone_norm := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(phone_norm) > 0 then
    select count(*) into used_by_phone
    from public.coupon_redemptions
    where coupon_id = c.id
      and regexp_replace(customer_phone, '\D', '', 'g') = phone_norm;

    if used_by_phone >= coalesce(c.max_per_customer, 1) then
      return jsonb_build_object('ok', false, 'error', 'استخدمتِ الكود ده قبل كده');
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', c.id,
    'code', c.code,
    'discount_type', c.discount_type,
    'discount_value', c.discount_value,
    'max_per_customer', coalesce(c.max_per_customer, 1)
  );
end;
$$;

-- استخدام الكوبون + تسجيل الموبايل
create or replace function public.redeem_coupon(p_code text, p_phone text default null, p_order_number text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  used_by_phone int := 0;
  phone_norm text;
begin
  select * into c from public.coupons
  where lower(code) = lower(trim(p_code))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'كود غير صحيح');
  end if;
  if not c.is_active or (c.expires_at is not null and c.expires_at < now()) or c.used_count >= c.max_uses then
    return jsonb_build_object('ok', false, 'error', 'الكود غير متاح');
  end if;

  phone_norm := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(phone_norm) > 0 then
    select count(*) into used_by_phone
    from public.coupon_redemptions
    where coupon_id = c.id
      and regexp_replace(customer_phone, '\D', '', 'g') = phone_norm;
    if used_by_phone >= coalesce(c.max_per_customer, 1) then
      return jsonb_build_object('ok', false, 'error', 'استخدمتِ الكود ده قبل كده');
    end if;
  end if;

  update public.coupons set used_count = used_count + 1 where id = c.id;

  if length(phone_norm) > 0 then
    insert into public.coupon_redemptions (coupon_id, customer_phone, order_number)
    values (c.id, phone_norm, p_order_number);
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', c.code,
    'discount_type', c.discount_type,
    'discount_value', c.discount_value
  );
end;
$$;

revoke all on function public.validate_coupon(text, text) from public;
grant execute on function public.validate_coupon(text, text) to anon, authenticated;
revoke all on function public.redeem_coupon(text, text, text) from public;
grant execute on function public.redeem_coupon(text, text, text) to anon, authenticated;

-- توافق مع الاستدعاء القديم بباراميتر واحد
create or replace function public.validate_coupon(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.validate_coupon(p_code, null);
$$;

create or replace function public.redeem_coupon(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.redeem_coupon(p_code, null, null);
$$;

grant execute on function public.validate_coupon(text) to anon, authenticated;
grant execute on function public.redeem_coupon(text) to anon, authenticated;

-- ============================================================
-- إلغاء الطلب + تقييمات حقيقية
-- ============================================================

-- دالة إلغاء الطلب خلال 10 دقائق (للعميل المسجّل فقط)
create or replace function public.cancel_my_order(p_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'لازم تسجّلي دخول');
  end if;

  select * into o from public.orders where id = p_order_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'الطلب غير موجود');
  end if;

  if o.user_id is distinct from auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'هذا الطلب مش بتاعك');
  end if;

  if o.status = 'ملغي' then
    return jsonb_build_object('ok', false, 'error', 'الطلب ملغي بالفعل');
  end if;

  if o.status is distinct from 'تم الاستلام' then
    return jsonb_build_object('ok', false, 'error', 'لا يمكن الإلغاء بعد بدء تجهيز الطلب');
  end if;

  if o.created_at < now() - interval '10 minutes' then
    return jsonb_build_object('ok', false, 'error', 'انتهت مهلة الإلغاء (10 دقائق من وقت الطلب)');
  end if;

  update public.orders set status = 'ملغي' where id = p_order_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.cancel_my_order(bigint) from public;
grant execute on function public.cancel_my_order(bigint) to authenticated;

-- جدول التقييمات الحقيقية
create table if not exists public.product_reviews (
  id bigserial primary key,
  product_id bigint references public.products(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  order_id bigint references public.orders(id) on delete set null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text default '',
  customer_name text,
  created_at timestamptz default now()
);

create index if not exists product_reviews_product_id_idx on public.product_reviews(product_id);

alter table public.product_reviews enable row level security;

drop policy if exists "reviews_select_all" on public.product_reviews;
create policy "reviews_select_all" on public.product_reviews
  for select using (true);

drop policy if exists "reviews_insert_own" on public.product_reviews;
create policy "reviews_insert_own" on public.product_reviews
  for insert with check (auth.uid() = user_id);

drop policy if exists "reviews_delete_admin" on public.product_reviews;
create policy "reviews_delete_admin" on public.product_reviews
  for delete using (true);

-- تقييم واحد لكل مستخدم لكل منتج
create unique index if not exists product_reviews_unique_user_product
  on public.product_reviews (user_id, product_id);
