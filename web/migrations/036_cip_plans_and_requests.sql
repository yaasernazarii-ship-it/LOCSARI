create table cip_plans (
  id serial primary key,
  title varchar(160) not null,
  description text not null default '',
  features text not null default '',
  price bigint not null check (price > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cip_requests (
  id serial primary key,
  user_id integer not null references users(id) on delete restrict,
  advertisement_id integer not null references advertisements(id) on delete restrict,
  plan_id integer not null references cip_plans(id) on delete restrict,
  status varchar(32) not null default 'awaiting_payment' check (status in ('awaiting_payment', 'paid', 'contacted', 'scheduled', 'filmed', 'published', 'cancelled')),
  price bigint not null check (price > 0),
  admin_note text null,
  video_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cip_payment_orders (
  id serial primary key,
  cip_request_id integer not null references cip_requests(id) on delete restrict,
  user_id integer not null references users(id) on delete restrict,
  gateway varchar(40) not null,
  authority varchar(160) not null unique,
  amount_rial bigint not null,
  status varchar(32) not null default 'awaiting_payment' check (status in ('awaiting_payment', 'paid', 'failed')),
  ref_id varchar(160) null,
  card_pan varchar(64) null,
  error_code varchar(160) null,
  callback_payload jsonb null,
  verify_payload jsonb null,
  created_at timestamptz not null default now(),
  paid_at timestamptz null,
  updated_at timestamptz not null default now()
);

create index idx_cip_requests_user_status on cip_requests(user_id, status);
create index idx_cip_requests_status on cip_requests(status);

insert into cip_plans (title, description, features, price, sort_order) values
('ویدیوی پایه', 'معرفی کوتاه و حرفه‌ای از ملک برای انتشار در آگهی CIP.', 'ضبط در محل\nتدوین حرفه‌ای\nویدیوی نهایی آمادهٔ انتشار', 2500000, 1),
('ویدیوی ویژه', 'تولید ویدیوی کامل‌تر با تمرکز بر ویژگی‌های شاخص ملک.', 'سناریوی اختصاصی\nضبط در محل\nتدوین حرفه‌ای\nویدیوی نهایی آمادهٔ انتشار', 4500000, 2),
('ویدیوی لوکس', 'تولید محتوای ویدیویی اختصاصی برای ملک‌های شاخص.', 'سناریوی اختصاصی\nتصویربرداری حرفه‌ای\nتدوین ویژه\nویدیوی نهایی آمادهٔ انتشار', 7500000, 3);
