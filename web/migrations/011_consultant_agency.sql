-- فاز ۶ لوکیشن ساری: هستهٔ Consultant + Agency
-- اصل معماری (بخش ۳ پرامپت): Consultant جایگزین User نمی‌شود؛ Consultant Profile روی User سوار می‌شود.
-- عضویت در Agency (owner/manager/consultant/employee) در جدول مستقل agency_memberships نگه داشته می‌شود
-- تا هم برای Invitation و هم برای Employee Foundation آینده قابل توسعه باشد (بدون ساخت Entity موازی جدید).

-- ============ Agency ============

create table if not exists agencies (
  id serial primary key,
  owner_user_id int not null references users(id),
  name varchar(150) not null,
  slug varchar(180) not null unique,
  description text,
  phone varchar(20),
  mobile varchar(20),
  email varchar(150),
  website varchar(255),
  logo varchar(500),
  cover_image varchar(500),
  address text,
  city_id int not null references cities(id),
  district_id int references districts(id),
  market_zone_id int references market_zones(id),
  neighborhood_id int references neighborhoods(id),
  latitude double precision,
  longitude double precision,
  verification_status varchar(20) not null default 'pending'
    check (verification_status in ('pending','approved','rejected','suspended')),
  rejection_reason text,
  suspension_reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agencies_owner on agencies(owner_user_id);
create index if not exists idx_agencies_city on agencies(city_id);
create index if not exists idx_agencies_verification on agencies(verification_status);
create index if not exists idx_agencies_slug on agencies(slug);

-- ============ Consultant ============
-- یک User حداکثر یک Consultant Profile دارد (unique user_id). عضویت Agency فعلیِ او (اگر باشد)
-- برای دسترسی سریع روی خود Consultant هم نگه داشته می‌شود؛ منبع حقیقت رابطه اما agency_memberships است.

create table if not exists consultants (
  id serial primary key,
  user_id int not null unique references users(id) on delete cascade,
  agency_id int references agencies(id) on delete set null,
  display_name varchar(150) not null,
  slug varchar(180) not null unique,
  bio text,
  phone varchar(20),
  avatar varchar(500),
  license_number varchar(50),
  verification_status varchar(20) not null default 'pending'
    check (verification_status in ('pending','approved','rejected','suspended')),
  rejection_reason text,
  suspension_reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_consultants_user on consultants(user_id);
create index if not exists idx_consultants_agency on consultants(agency_id);
create index if not exists idx_consultants_verification on consultants(verification_status);
create index if not exists idx_consultants_slug on consultants(slug);

-- ============ Agency Membership ============
-- رابطهٔ User/Consultant با Agency، هم برای Invitation (Manager آغاز می‌کند) و هم Join Request
-- (خود Consultant حین Apply آغاز می‌کند) از همین یک جدول استفاده می‌شود (بدون سیستم موازی).
-- invited_by_user_id = null یعنی درخواست از سمت کاربر (Agency باید Accept/Reject کند)؛
-- invited_by_user_id ست‌شده یعنی دعوت از سمت Agency (خود کاربر باید Accept/Reject کند).

create table if not exists agency_memberships (
  id serial primary key,
  agency_id int not null references agencies(id) on delete cascade,
  user_id int not null references users(id) on delete cascade,
  consultant_id int references consultants(id) on delete set null,
  membership_role varchar(20) not null
    check (membership_role in ('owner','manager','consultant','employee')),
  status varchar(20) not null default 'pending'
    check (status in ('pending','active','suspended','removed')),
  invited_by_user_id int references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, user_id)
);

create index if not exists idx_agency_memberships_agency on agency_memberships(agency_id);
create index if not exists idx_agency_memberships_user on agency_memberships(user_id);
create index if not exists idx_agency_memberships_status on agency_memberships(status);

-- ============ Social Links (Generic، بخش ۲۵) ============
-- به‌جای محدودکردن Schema به چند Provider ثابت، owner_type/owner_id عمومی + provider/url آزاد.

create table if not exists social_links (
  id serial primary key,
  owner_type varchar(20) not null check (owner_type in ('agency','consultant')),
  owner_id int not null,
  provider varchar(30),
  url varchar(500) not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_social_links_owner on social_links(owner_type, owner_id);

-- ============ اتصال FK واقعی Advertisement <-> Consultant/Agency (بخش ۱۴) ============
-- consultant_id/agency_id از فاز ۳ به‌صورت ستون خام (بدون FK) رزرو شده بودند و همیشه NULL بوده‌اند
-- (تولید هنوز API ای برای مقداردهی آن‌ها نداشت)؛ بنابراین افزودن FK اینجا کاملاً امن است.

alter table advertisements
  add constraint advertisements_consultant_id_fkey
  foreign key (consultant_id) references consultants(id) on delete set null;

alter table advertisements
  add constraint advertisements_agency_id_fkey
  foreign key (agency_id) references agencies(id) on delete set null;

create index if not exists idx_advertisements_consultant on advertisements(consultant_id);
create index if not exists idx_advertisements_agency on advertisements(agency_id);

-- ============ Permissions جدید (بخش ۳۳) ============

insert into permissions (key, description_fa) values
  ('agency.view',      'مشاهده آژانس'),
  ('agency.create',    'درخواست ثبت آژانس'),
  ('agency.edit',      'ویرایش آژانس'),
  ('agency.approve',   'تأیید/رد آژانس'),
  ('agency.suspend',   'تعلیق آژانس'),
  ('consultant.view',   'مشاهده مشاور'),
  ('consultant.create', 'درخواست تبدیل به مشاور'),
  ('consultant.edit',   'ویرایش پروفایل مشاور'),
  ('consultant.approve','تأیید/رد مشاور'),
  ('consultant.suspend','تعلیق مشاور'),
  ('membership.view',   'مشاهده عضویت آژانس'),
  ('membership.invite', 'دعوت عضو به آژانس'),
  ('membership.manage', 'مدیریت عضویت آژانس')
on conflict (key) do nothing;

-- مدیر کل و مدیر سیستم: دسترسی کامل بر Agency/Consultant/Membership
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key in ('super_admin', 'system_admin')
  and (p.key like 'agency.%' or p.key like 'consultant.%' or p.key like 'membership.%')
on conflict do nothing;

-- کاربر عادی: می‌تواند درخواست ثبت آژانس/تبدیل به مشاور بدهد و پروفایل خودش را ببیند/ویرایش کند
-- (مالکیت دقیق در لایهٔ API بررسی می‌شود؛ approve/suspend هرگز به این نقش داده نمی‌شود)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.key in ('agency.create', 'agency.view', 'agency.edit', 'consultant.create', 'consultant.view', 'consultant.edit')
where r.key = 'user'
on conflict do nothing;

-- مدیر آژانس: مدیریت آژانس خودش و اعضای آن
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.key in ('agency.view', 'agency.edit', 'membership.view', 'membership.invite', 'membership.manage')
where r.key = 'agency_manager'
on conflict do nothing;

-- مشاور: مدیریت پروفایل خودش
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.key in ('consultant.view', 'consultant.edit', 'membership.view')
where r.key = 'consultant'
on conflict do nothing;
