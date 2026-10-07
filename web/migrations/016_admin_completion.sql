-- تکمیل داشبورد مدیریت: رفع مشکل مناطق غیرفعال، مجوزهای جدید حذف آژانس/محتوا، و مدل محتوای سایت (CMS ساده)

-- ============ رفع باگ: مناطق رسمی/عرفی/محله در فرم ثبت آگهی غیرفعال بودند ============
-- این ردیف‌های اولیه به‌اشتباه is_active=false مانده بودند؛ از این پس مدیریت کامل آن‌ها از
-- پنل مدیریت (/admin/locations) در دسترس است و ادمین می‌تواند به‌دلخواه فعال/غیرفعال کند.
update districts set is_active = true where is_active = false;
update market_zones set is_active = true where is_active = false;
update neighborhoods set is_active = true where is_active = false;

-- ============ مجوز حذف کامل آژانس (مشابه advertisement.delete) ============
insert into permissions (key, description_fa) values
  ('agency.delete', 'حذف کامل آژانس')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key in ('super_admin', 'system_admin') and p.key = 'agency.delete'
on conflict do nothing;

-- ============ تکمیل مجوزهای محتوا (مشاهده/حذف — create/edit از قبل در ۰۰۲ موجودند) ============
insert into permissions (key, description_fa) values
  ('content.view',   'مشاهده محتوای سایت'),
  ('content.delete', 'حذف محتوای سایت')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key in ('super_admin', 'system_admin') and p.key in ('content.view', 'content.delete')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key in ('content.view', 'content.delete')
where r.key = 'content_manager'
on conflict do nothing;

-- ============ صفحات محتوای سایت (درباره ما، قوانین، تماس با ما و ...) ============
create table if not exists site_pages (
  id serial primary key,
  slug varchar(150) not null unique,
  title varchar(200) not null,
  body text not null default '',
  is_published boolean not null default false,
  sort_order int not null default 0,
  created_by_user_id int references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_site_pages_slug on site_pages(slug);
create index if not exists idx_site_pages_published on site_pages(is_published);
