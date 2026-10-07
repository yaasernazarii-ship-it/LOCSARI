-- نقش‌های پیش‌فرض (بخش ۹ پرامپت)
insert into roles (key, title_fa) values
  ('super_admin',     'مدیر کل'),
  ('system_admin',    'مدیر سیستم'),
  ('content_manager', 'مدیر محتوا'),
  ('crm_manager',     'مدیر CRM'),
  ('agency_manager',  'مدیر آژانس'),
  ('consultant',      'مشاور املاک'),
  ('employee',        'کارمند'),
  ('user',            'کاربر عادی')
on conflict (key) do nothing;

-- مجوزهای پایه (طبق نمونهٔ بخش ۹؛ برای دامنه‌های آیندهٔ Property/Advertisement/CRM/Agency/Content از هم‌اکنون رزرو می‌شوند)
insert into permissions (key, description_fa) values
  ('property.create',   'ثبت ملک جدید'),
  ('property.edit',     'ویرایش ملک'),
  ('property.delete',   'حذف ملک'),
  ('property.approve',  'تأیید ملک/آگهی'),
  ('lead.view',         'مشاهده سرنخ'),
  ('lead.create',       'ثبت سرنخ'),
  ('lead.edit',         'ویرایش سرنخ'),
  ('lead.assign',       'واگذاری سرنخ'),
  ('customer.view',     'مشاهده مشتری'),
  ('customer.edit',     'ویرایش مشتری'),
  ('employee.create',   'ایجاد کارمند'),
  ('employee.edit',     'ویرایش کارمند'),
  ('content.create',    'ایجاد محتوا'),
  ('content.edit',      'ویرایش محتوا'),
  ('user.manage',       'مدیریت کاربران'),
  ('agency.manage',     'مدیریت آژانس'),
  ('admin.dashboard.view', 'دسترسی به داشبورد مدیریت')
on conflict (key) do nothing;

-- مدیر کل: تمام مجوزها (به‌صورت صریح، نه Bypass کدنویسی‌شده — همچنان Permission-based)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p where r.key = 'super_admin'
on conflict do nothing;

-- مدیر سیستم: همه مجوزها به‌جز مدیریت آژانس و تأیید ملک (نمونهٔ تفکیک نقش)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key = 'system_admin' and p.key not in ('agency.manage')
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key in ('content.create','content.edit')
where r.key = 'content_manager'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key in ('lead.view','lead.create','lead.edit','lead.assign','customer.view','customer.edit')
where r.key = 'crm_manager'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key in ('agency.manage','employee.create','employee.edit','property.create','property.edit')
where r.key = 'agency_manager'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key in ('property.create','property.edit','lead.view','customer.view')
where r.key = 'consultant'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key in ('lead.view','customer.view')
where r.key = 'employee'
on conflict do nothing;

-- کاربر عادی هیچ مجوز مدیریتی‌ای ندارد (فقط از طریق APIهای عمومی که نیاز به Permission خاص ندارند عمل می‌کند)
