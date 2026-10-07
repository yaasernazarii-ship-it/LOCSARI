-- مجوزهای جدید فاز ۳: Property + Advertisement Engine (بخش ۲۰ پرامپت)
-- توجه: property.create/edit/delete/approve از فاز ۱ (002) از قبل وجود دارند؛ اینجا فقط property.view
-- و کل خانوادهٔ advertisement.*/media.* که تازه‌اند اضافه می‌شوند.

insert into permissions (key, description_fa) values
  ('property.view',          'مشاهده ملک'),
  ('advertisement.view',     'مشاهده آگهی'),
  ('advertisement.create',   'ایجاد آگهی'),
  ('advertisement.edit',     'ویرایش آگهی'),
  ('advertisement.delete',   'حذف آگهی'),
  ('advertisement.submit',   'ارسال آگهی برای بررسی'),
  ('advertisement.approve',  'تأیید آگهی (دسترسی بازبین مرکزی)'),
  ('advertisement.reject',   'رد آگهی'),
  ('advertisement.publish',  'انتشار آگهی'),
  ('advertisement.archive',  'آرشیو آگهی'),
  ('media.upload',           'بارگذاری/مدیریت تصویر ملک'),
  ('media.delete',           'حذف تصویر ملک')
on conflict (key) do nothing;

-- مدیر کل و مدیر سیستم: کل دامنهٔ property/advertisement/media (شامل مجوزهای از قبل موجود فاز ۱)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key in ('super_admin', 'system_admin')
  and (p.key like 'property.%' or p.key like 'advertisement.%' or p.key like 'media.%')
on conflict do nothing;

-- آژانس و مشاور: می‌توانند ملک/آگهی خودشان را کامل مدیریت کنند اما بازبینی مرکزی (approve/reject/publish)
-- در اختیار ادمین می‌ماند (بخش ۸: «Review مرکزی حفظ شود»). مالکیت دقیق در لایهٔ API بررسی می‌شود.
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.key in (
    'property.view',
    'advertisement.view', 'advertisement.create', 'advertisement.edit',
    'advertisement.delete', 'advertisement.submit', 'advertisement.archive',
    'media.upload', 'media.delete'
  )
where r.key in ('agency_manager', 'consultant')
on conflict do nothing;

-- مدیر CRM و کارمند: فقط مشاهده (برای کار روی سرنخ‌های مرتبط با ملک/آگهی در فازهای بعدی)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.key in ('property.view', 'advertisement.view')
where r.key in ('crm_manager', 'employee')
on conflict do nothing;

-- کاربر عادی: می‌تواند ملک/آگهی خودش را بسازد، ببیند، ویرایش، حذف و آرشیو کند و برای بررسی ارسال کند؛
-- اما هرگز approve/reject/publish که فقط برای بازبین مرکزی (ادمین) است.
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.key in (
    'property.create', 'property.view', 'property.edit', 'property.delete',
    'advertisement.create', 'advertisement.view', 'advertisement.edit',
    'advertisement.delete', 'advertisement.submit', 'advertisement.archive',
    'media.upload', 'media.delete'
  )
where r.key = 'user'
on conflict do nothing;
