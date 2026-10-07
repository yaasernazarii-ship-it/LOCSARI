-- بخش آگهی VIP: پلن‌های اشتراک + درخواست/تأیید اشتراک + پرچم VIP روی آگهی
-- ثبت آگهی در بخش VIP فقط برای کاربری ممکن است که یک اشتراک VIP «فعال» داشته باشد؛
-- تأیید نهایی خرید (چون درگاه پرداختی متصل نیست) دستی و توسط ادمین انجام می‌شود.

create table if not exists vip_plans (
  id serial primary key,
  title varchar(120) not null,
  description text,
  duration_days int not null check (duration_days > 0),
  price bigint not null check (price >= 0), -- تومان
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vip_plans_active on vip_plans(is_active);

create table if not exists vip_subscriptions (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  plan_id int not null references vip_plans(id),
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'expired', 'cancelled')),
  price bigint not null, -- عکس‌برداری از قیمت پلن در لحظهٔ درخواست
  starts_at timestamptz,
  ends_at timestamptz,
  admin_note text,
  reviewed_by int references users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vip_subscriptions_user on vip_subscriptions(user_id);
create index if not exists idx_vip_subscriptions_status on vip_subscriptions(status);

alter table advertisements add column if not exists is_vip boolean not null default false;
alter table advertisements add column if not exists vip_expires_at timestamptz;

create index if not exists idx_advertisements_is_vip on advertisements(is_vip);

-- مجوز مدیریتی جدید: مدیریت پلن‌های VIP و تأیید/رد درخواست اشتراک
insert into permissions (key, description_fa) values
  ('vip.manage', 'مدیریت پلن‌ها و اشتراک‌های آگهی VIP')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key in ('super_admin', 'system_admin') and p.key = 'vip.manage'
on conflict do nothing;

-- پلن‌های پیش‌فرض نمونه — ادمین می‌تواند بعداً از پنل ویرایش/غیرفعال کند
insert into vip_plans (title, description, duration_days, price, sort_order)
select * from (values
  ('یک هفته', 'نمایش ویژهٔ آگهی در بخش آگهی‌های VIP به مدت ۷ روز', 7, 200000, 1),
  ('یک ماه', 'نمایش ویژهٔ آگهی در بخش آگهی‌های VIP به مدت ۳۰ روز', 30, 600000, 2),
  ('سه ماه', 'نمایش ویژهٔ آگهی در بخش آگهی‌های VIP به مدت ۹۰ روز', 90, 1500000, 3)
) as seed(title, description, duration_days, price, sort_order)
where not exists (select 1 from vip_plans);
