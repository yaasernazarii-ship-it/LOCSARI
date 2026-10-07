-- فاز ۲ لوکیشن ساری: دسته‌بندی‌ها (+ فیلدهای اختصاصی) و مدل جغرافیایی (استان/شهر/منطقه/محله)
-- طراحی برای آماده‌بودن Phaseهای بعدی: Category -> Subcategory -> Category Fields -> Property -> Advertisement
--                                        Province -> City -> District/MarketZone -> Neighborhood -> Property

-- ============ دسته‌بندی‌ها ============

create table if not exists categories (
  id serial primary key,
  parent_id int references categories(id) on delete set null,
  name varchar(150) not null,
  slug varchar(150) not null unique,
  description text,
  icon varchar(100),
  image varchar(255),
  sort_order int not null default 0,
  is_active boolean not null default true,
  seo_title varchar(200),
  seo_description varchar(300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_categories_parent on categories(parent_id);
create index if not exists idx_categories_active on categories(is_active);
create index if not exists idx_categories_sort on categories(sort_order);

-- فیلدهای اختصاصی هر دسته‌بندی (Dynamic Category Fields) — هیچ‌کدام Hard-code نیستند
create table if not exists category_fields (
  id serial primary key,
  category_id int not null references categories(id) on delete cascade,
  key varchar(80) not null,
  label_fa varchar(150) not null,
  field_type varchar(20) not null check (field_type in ('text','number','boolean','select','multi_select','date')),
  is_required boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, key)
);

create index if not exists idx_category_fields_category on category_fields(category_id);

-- گزینه‌های فیلدهای نوع select/multi_select
create table if not exists category_field_options (
  id serial primary key,
  field_id int not null references category_fields(id) on delete cascade,
  value varchar(80) not null,
  label_fa varchar(150) not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (field_id, value)
);

create index if not exists idx_category_field_options_field on category_field_options(field_id);

-- ============ مدل جغرافیایی ============

create table if not exists provinces (
  id serial primary key,
  name varchar(100) not null,
  slug varchar(100) not null unique,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cities (
  id serial primary key,
  province_id int not null references provinces(id) on delete cascade,
  name varchar(100) not null,
  slug varchar(100) not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (province_id, slug)
);

create index if not exists idx_cities_province on cities(province_id);

-- مناطق رسمی تقسیمات شهرداری
create table if not exists districts (
  id serial primary key,
  city_id int not null references cities(id) on delete cascade,
  name varchar(100) not null,
  slug varchar(100) not null,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create index if not exists idx_districts_city on districts(city_id);

-- مناطق عرفی بازار املاک — ممکن است با تقسیم‌بندی رسمی شهرداری یکسان نباشد؛
-- به همین دلیل یک سلسله‌مراتب کاملاً مستقل و قابل‌مدیریت جداگانه است.
create table if not exists market_zones (
  id serial primary key,
  city_id int not null references cities(id) on delete cascade,
  name varchar(100) not null,
  slug varchar(100) not null,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create index if not exists idx_market_zones_city on market_zones(city_id);

-- محله؛ می‌تواند هم‌زمان زیرمجموعهٔ یک منطقهٔ رسمی و یک منطقهٔ عرفی باشد (هر دو اختیاری و مستقل)
create table if not exists neighborhoods (
  id serial primary key,
  city_id int not null references cities(id) on delete cascade,
  district_id int references districts(id) on delete set null,
  market_zone_id int references market_zones(id) on delete set null,
  name varchar(100) not null,
  slug varchar(100) not null,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  latitude double precision,
  longitude double precision,
  seo_title varchar(200),
  seo_description varchar(300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create index if not exists idx_neighborhoods_city on neighborhoods(city_id);
create index if not exists idx_neighborhoods_district on neighborhoods(district_id);
create index if not exists idx_neighborhoods_market_zone on neighborhoods(market_zone_id);
create index if not exists idx_neighborhoods_active on neighborhoods(is_active);

-- ============ Audit Log پایه (زیرساخت برای CRUDهای Admin) ============

create table if not exists admin_audit_logs (
  id serial primary key,
  user_id int references users(id) on delete set null,
  action varchar(20) not null,
  entity_type varchar(50) not null,
  entity_id int not null,
  meta text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_entity on admin_audit_logs(entity_type, entity_id);
create index if not exists idx_admin_audit_logs_user on admin_audit_logs(user_id);
