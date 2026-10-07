-- فاز ۷.۳ لوکیشن ساری: تکمیل افزایشی Schema فاز ۷.۲ (کشف‌شده حین طراحی API)
-- سه نیاز واقعی: (۱) Requirement علاوه‌بر بازهٔ قیمت فروش (min_price/max_price) به بازهٔ رهن/اجارهٔ ماهانهٔ جداگانه
-- نیاز دارد (دقیقاً مثل الگوی price/deposit/monthly_rent در advertisements، فقط این‌بار به‌صورت بازه) + یک فیلد
-- اولویت (priority)؛ (۲) مدیریت لیست Customer Type (بخش ۶ پرامپت ۷.۳) نیاز به یک Permission اختصاصی دارد که در
-- فاز ۷.۲ پیش‌بینی نشده بود؛ (۳) نقش agency_manager هرگز lead.view/customer.view نگرفته بود (نه در فاز ۱، نه در
-- فاز ۷.۲) — یعنی طبق Schema موجود مدیر آژانس اصلاً نمی‌توانست GET /api/crm/leads یا /api/crm/customers را صدا بزند،
-- که با الزام صریح بخش ۱۸ پرامپت ۷.۳ («مدیر آژانس فقط دادهٔ آژانس خودش را ببیند») در تناقض است. این یک نقص واقعیِ
-- کشف‌شدهٔ حین طراحی API است، نه تصمیم معماری جدید؛ فقط دو Grant افزایشی روی همان دو Permission موجود اضافه می‌شود
-- (هیچ Permission جدیدی برای این مورد ساخته نمی‌شود و lead.create/lead.delete/lead.assign/customer.delete عمداً
-- به agency_manager داده نمی‌شود — این تصمیم‌ها به دامنهٔ این نقص محدود نبود).

alter table customer_requirements
  add column if not exists min_deposit bigint,
  add column if not exists max_deposit bigint,
  add column if not exists min_monthly_rent bigint,
  add column if not exists max_monthly_rent bigint,
  add column if not exists priority varchar(10) not null default 'normal' check (priority in ('low','normal','high','urgent'));

insert into permissions (key, description_fa) values
  ('customer_type.manage', 'مدیریت انواع مشتری (تعریف Type ها)')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key in ('super_admin', 'system_admin')
  and p.key = 'customer_type.manage'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key = 'customer_type.manage'
where r.key = 'crm_manager'
on conflict do nothing;

-- رفع نقص: agency_manager باید بتواند سرنخ/مشتریِ دامنهٔ آژانس خودش را ببیند (Scope دقیق در لایهٔ API اعمال می‌شود)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key in ('lead.view', 'customer.view')
where r.key = 'agency_manager'
on conflict do nothing;
