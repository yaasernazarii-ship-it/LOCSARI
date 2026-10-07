-- مجوزهای جدید فاز ۲: مدیریت دسته‌بندی‌ها، فیلدهای اختصاصی و مناطق جغرافیایی (بخش ۱۴ پرامپت)

insert into permissions (key, description_fa) values
  ('category.view',         'مشاهده دسته‌بندی‌ها (مدیریت)'),
  ('category.create',       'ایجاد دسته‌بندی'),
  ('category.edit',         'ویرایش دسته‌بندی'),
  ('category.delete',       'حذف دسته‌بندی'),
  ('category.field.view',   'مشاهده فیلدهای اختصاصی دسته‌بندی'),
  ('category.field.create', 'ایجاد فیلد اختصاصی'),
  ('category.field.edit',   'ویرایش فیلد اختصاصی'),
  ('category.field.delete', 'حذف فیلد اختصاصی'),
  ('location.view',         'مشاهده استان/شهر/منطقه (مدیریت)'),
  ('location.create',       'ایجاد استان/شهر/منطقه'),
  ('location.edit',         'ویرایش استان/شهر/منطقه'),
  ('location.delete',       'حذف استان/شهر/منطقه'),
  ('neighborhood.view',     'مشاهده محله‌ها (مدیریت)'),
  ('neighborhood.create',   'ایجاد محله'),
  ('neighborhood.edit',     'ویرایش محله'),
  ('neighborhood.delete',   'حذف محله')
on conflict (key) do nothing;

-- مدیر کل: همهٔ مجوزهای جدید فاز ۲
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key = 'super_admin'
  and (p.key like 'category.%' or p.key like 'location.%' or p.key like 'neighborhood.%')
on conflict do nothing;

-- مدیر سیستم: طبق سیاست فاز ۱ (همه به‌جز agency.manage) — همهٔ مجوزهای جدید فاز ۲ نیز به او تعلق می‌گیرد
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key = 'system_admin'
  and (p.key like 'category.%' or p.key like 'location.%' or p.key like 'neighborhood.%')
on conflict do nothing;

-- مدیر محتوا: مشاهده و ویرایش محتوا/SEO دسته‌بندی و محله (بدون ایجاد/حذف ساختاری)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.key in ('category.view','category.edit','category.field.view','location.view','neighborhood.view','neighborhood.edit')
where r.key = 'content_manager'
on conflict do nothing;

-- نقش‌های عملیاتی: فقط مشاهده (برای انتخاب دسته‌بندی/منطقه هنگام ثبت ملک در فازهای بعدی)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.key in ('category.view','category.field.view','location.view','neighborhood.view')
where r.key in ('crm_manager','agency_manager','consultant','employee')
on conflict do nothing;
