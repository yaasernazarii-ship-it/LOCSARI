-- فاز ۳ لوکیشن ساری: هستهٔ Property + Advertisement Engine
-- اصل معماری: Property (خود ملک) != Advertisement (آگهی منتشرشده دربارهٔ آن ملک) != User/Consultant/Agency

-- ============ Property ============

create table if not exists properties (
  id serial primary key,
  category_id int not null references categories(id),
  subcategory_id int references categories(id),
  city_id int not null references cities(id),
  district_id int references districts(id),
  market_zone_id int references market_zones(id),
  neighborhood_id int references neighborhoods(id),
  title varchar(200) not null,
  description text,
  area numeric(10,2),
  built_area numeric(10,2),
  land_area numeric(10,2),
  bedrooms smallint,
  built_year smallint,
  floor smallint,
  total_floors smallint,
  total_units smallint,
  latitude double precision,
  longitude double precision,
  location_precision varchar(20) not null default 'approximate'
    check (location_precision in ('exact','approximate','neighborhood_only')),
  -- اثرانگشت سادهٔ تشخیص تکراری (بخش ۱۶ پرامپت) — نه یک شناسهٔ قطعی، فقط برای یافتن نامزدهای مشابه
  duplicate_fingerprint varchar(80),
  created_by_user_id int not null references users(id),
  is_active boolean not null default true, -- Soft Delete، هم‌راستا با Convention دسته‌بندی‌ها
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_properties_category on properties(category_id);
create index if not exists idx_properties_city on properties(city_id);
create index if not exists idx_properties_district on properties(district_id);
create index if not exists idx_properties_market_zone on properties(market_zone_id);
create index if not exists idx_properties_neighborhood on properties(neighborhood_id);
create index if not exists idx_properties_created_by on properties(created_by_user_id);
create index if not exists idx_properties_duplicate_fingerprint on properties(duplicate_fingerprint);
create index if not exists idx_properties_active on properties(is_active);

-- ============ Dynamic Property Attributes (بخش ۴) ============
-- مقدار تک‌مقداری (text/number/boolean/date/select) — یک ردیف به‌ازای هر (property, field)
create table if not exists property_attributes (
  id serial primary key,
  property_id int not null references properties(id) on delete cascade,
  field_id int not null references category_fields(id) on delete cascade,
  value_text text,
  value_number numeric(14,2),
  value_boolean boolean,
  value_date date,
  option_id int references category_field_options(id), -- برای field_type = select
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, field_id)
);

create index if not exists idx_property_attributes_property on property_attributes(property_id);
create index if not exists idx_property_attributes_field on property_attributes(field_id);

-- مقدار چندمقداری (multi_select) — یک ردیف به‌ازای هر گزینهٔ انتخاب‌شده
create table if not exists property_attribute_options (
  property_id int not null references properties(id) on delete cascade,
  field_id int not null references category_fields(id) on delete cascade,
  option_id int not null references category_field_options(id) on delete cascade,
  primary key (property_id, field_id, option_id)
);

create index if not exists idx_property_attribute_options_property on property_attribute_options(property_id);

-- ============ Property Media (بخش ۹ تا ۱۱) ============
-- تصاویر به Property متصل‌اند (نه Advertisement)، چون توصیف‌کنندهٔ خودِ ملک فیزیکی‌اند و
-- می‌توانند بین چند آگهی که به یک ملک اشاره می‌کنند (Property Identity، بخش ۱۷) بازاستفاده شوند.
create table if not exists property_media (
  id serial primary key,
  property_id int not null references properties(id) on delete cascade,
  storage_key varchar(255) not null, -- ارجاع داخلی StorageService (مستقل از Provider)
  url varchar(500) not null,
  alt_text varchar(200),
  is_primary boolean not null default false,
  width int,
  height int,
  file_size int,
  mime_type varchar(50),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_property_media_property on property_media(property_id);

-- ============ Advertisement ============

create table if not exists advertisements (
  id serial primary key,
  property_id int not null references properties(id),
  created_by_user_id int not null references users(id),
  -- بخش ۲۲: Consultant/Agency هنوز به‌عنوان Entity مستقل وجود ندارند؛ این دو ستون فقط
  -- محل رزروشدهٔ FK آینده‌اند و در این فاز توسط API مقداردهی نمی‌شوند.
  consultant_id int,
  agency_id int,
  title varchar(200) not null,
  description text,
  slug varchar(220) not null unique, -- آماده‌سازی SEO (بخش ۲۶)
  transaction_type varchar(20) not null
    check (transaction_type in ('sale','rent','mortgage_rent','short_term_rent','pre_sale','partnership')),
  price bigint,        -- فروش/پیش‌فروش/مشارکت — تومان، بدون اعشار
  deposit bigint,       -- رهن/اجاره — تومان
  monthly_rent bigint,  -- اجارهٔ ماهانه — تومان
  status varchar(20) not null default 'draft'
    check (status in ('draft','pending_review','published','rejected','expired','sold','rented','archived')),
  rejection_reason text,
  is_potential_duplicate boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_advertisements_status on advertisements(status);
create index if not exists idx_advertisements_property on advertisements(property_id);
create index if not exists idx_advertisements_created_by on advertisements(created_by_user_id);
create index if not exists idx_advertisements_transaction_type on advertisements(transaction_type);
create index if not exists idx_advertisements_created_at on advertisements(created_at);
create index if not exists idx_advertisements_expires_at on advertisements(expires_at);

-- ============ Advertisement Status History (بخش ۷) ============
create table if not exists advertisement_status_history (
  id serial primary key,
  advertisement_id int not null references advertisements(id) on delete cascade,
  from_status varchar(20),
  to_status varchar(20) not null,
  changed_by int references users(id) on delete set null, -- null یعنی تغییر خودکار سیستم (مثلاً انقضا)
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ad_status_history_ad on advertisement_status_history(advertisement_id);

-- ============ Duplicate Detection (بخش ۱۶ و ۱۷) ============
-- هرگز به‌صورت قطعی حکم نمی‌دهد؛ فقط POTENTIAL_DUPLICATE را برای بررسی Admin ثبت می‌کند.
create table if not exists property_duplicate_matches (
  id serial primary key,
  property_id int not null references properties(id) on delete cascade,
  matched_property_id int not null references properties(id) on delete cascade,
  advertisement_id int references advertisements(id) on delete cascade,
  score int not null,
  reason text,
  status varchar(20) not null default 'pending'
    check (status in ('pending','confirmed_duplicate','not_duplicate')),
  reviewed_by int references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (property_id <> matched_property_id)
);

create index if not exists idx_dup_matches_property on property_duplicate_matches(property_id);
create index if not exists idx_dup_matches_matched on property_duplicate_matches(matched_property_id);

-- ============ Favorite (بخش ۱۸) ============
-- روی Advertisement قرار می‌گیرد نه Property: کاربر دقیقاً همان آگهی (با همان قیمت/شرایط منتشرشده)
-- را که دیده می‌خواهد دوباره ببیند؛ لیست علاقه‌مندی‌ها به‌طور طبیعی با فیلتر status='published' هم‌راستا می‌شود.
create table if not exists favorites (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  advertisement_id int not null references advertisements(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, advertisement_id)
);

create index if not exists idx_favorites_user on favorites(user_id);
create index if not exists idx_favorites_advertisement on favorites(advertisement_id);
