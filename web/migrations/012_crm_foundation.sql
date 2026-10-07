-- فاز ۷.۲ لوکیشن ساری: زیرساخت دیتابیس CRM (فقط Schema — بدون UI/API عمومی)
-- زنجیرهٔ هدف در فازهای بعدی: Lead -> Qualification -> Customer -> Requirement -> Matching -> Follow-up -> Visit -> Negotiation -> Deal
-- این فاز فقط پایهٔ رابطه‌ای را می‌سازد؛ Deal به‌عمد کامل مدل نشده تا طراحی محصول‌محورِ فاز بعد آن را دیکته کند.

-- ============ Customer (پیش از Lead ساخته می‌شود؛ FK دوطرفهٔ Lead<->Customer در پایان همین فایل با ALTER وصل می‌شود) ============
-- user_id nullable: مشتری می‌تواند یک حساب کاربری مرتبط در پلتفرم داشته باشد یا صرفاً یک مخاطبِ ثبت‌شده توسط تیم CRM باشد (بخش ۹).

create table if not exists customers (
  id serial primary key,
  user_id int references users(id) on delete set null,
  source_lead_id int, -- FK واقعی در پایان این فایل، بعد از ساخت جدول leads، اضافه می‌شود
  agency_id int references agencies(id) on delete set null,
  assigned_to_user_id int references users(id) on delete set null,
  name varchar(150) not null,
  mobile varchar(20) not null unique, -- کلید اصلی جلوگیری از تکرار مشتری (بخش ۱۳)
  email varchar(150),
  national_id varchar(20),
  status varchar(20) not null default 'active' check (status in ('active','inactive','blacklisted')),
  notes text,
  created_by_user_id int not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_user on customers(user_id);
create index if not exists idx_customers_agency on customers(agency_id);
create index if not exists idx_customers_assigned_to on customers(assigned_to_user_id);
create index if not exists idx_customers_status on customers(status);
create index if not exists idx_customers_created_by on customers(created_by_user_id);

-- ============ Customer Type (چندبه‌چند — بخش ۹: مشتری می‌تواند هم‌زمان خریدار و فروشنده باشد) ============

create table if not exists customer_types (
  id serial primary key,
  key varchar(30) not null unique,
  label_fa varchar(50) not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists customer_type_assignments (
  customer_id int not null references customers(id) on delete cascade,
  customer_type_id int not null references customer_types(id) on delete cascade,
  primary key (customer_id, customer_type_id)
);

create index if not exists idx_customer_type_assignments_type on customer_type_assignments(customer_type_id);

-- ============ Lead ============

create table if not exists leads (
  id serial primary key,
  name varchar(150) not null,
  mobile varchar(20) not null,
  source varchar(20) not null default 'other'
    check (source in ('website','phone','referral','social','advertisement','walk_in','other')),
  status varchar(20) not null default 'new'
    check (status in ('new','contacted','qualified','unqualified','converted','lost')),
  agency_id int references agencies(id) on delete set null,
  assigned_to_user_id int references users(id) on delete set null,
  notes text,
  -- تبدیل Lead به Customer: خودِ Lead هرگز حذف نمی‌شود (حفظ تاریخچه، بخش ۱۳)
  converted_customer_id int references customers(id) on delete set null,
  converted_at timestamptz,
  created_by_user_id int not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_leads_mobile on leads(mobile);
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_agency on leads(agency_id);
create index if not exists idx_leads_assigned_to on leads(assigned_to_user_id);
create index if not exists idx_leads_converted_customer on leads(converted_customer_id);
create index if not exists idx_leads_created_by on leads(created_by_user_id);

-- اتصال FK واقعی customers.source_lead_id -> leads(id) (همان الگوی بخش ۱۴ فاز ۶ برای رفع وابستگی دوطرفه)
alter table customers
  add constraint customers_source_lead_id_fkey
  foreign key (source_lead_id) references leads(id) on delete set null;

create index if not exists idx_customers_source_lead on customers(source_lead_id);

-- ============ Customer Requirement (بخش ۱۰: هر مشتری N نیازمندی می‌تواند داشته باشد) ============

create table if not exists customer_requirements (
  id serial primary key,
  customer_id int not null references customers(id) on delete cascade,
  category_id int not null references categories(id),
  transaction_type varchar(20) not null
    check (transaction_type in ('sale','rent','mortgage_rent','short_term_rent','pre_sale','partnership')),
  min_price bigint,
  max_price bigint,
  min_area numeric(10,2),
  max_area numeric(10,2),
  bedrooms smallint,
  status varchar(20) not null default 'open' check (status in ('open','matched','closed','cancelled')),
  notes text,
  assigned_to_user_id int references users(id) on delete set null,
  created_by_user_id int not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_requirements_customer on customer_requirements(customer_id);
create index if not exists idx_customer_requirements_category on customer_requirements(category_id);
create index if not exists idx_customer_requirements_status on customer_requirements(status);
create index if not exists idx_customer_requirements_assigned_to on customer_requirements(assigned_to_user_id);

-- ============ Requirement Location (بخش ۱۱: چند محدودهٔ جغرافیایی برای هر نیازمندی — نه Comma-Separated) ============

create table if not exists requirement_locations (
  id serial primary key,
  requirement_id int not null references customer_requirements(id) on delete cascade,
  city_id int not null references cities(id),
  district_id int references districts(id),
  market_zone_id int references market_zones(id),
  neighborhood_id int references neighborhoods(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_requirement_locations_requirement on requirement_locations(requirement_id);
create index if not exists idx_requirement_locations_city on requirement_locations(city_id);

-- ============ Requirement Attributes (بخش ۱۲: بازاستفادهٔ کامل از category_fields/category_field_options فاز ۲ — بدون فیلد Hard-code جدید) ============
-- دقیقاً هم‌ساختار property_attributes / property_attribute_options (فاز ۳)، فقط با کلید requirement_id.

create table if not exists requirement_attributes (
  id serial primary key,
  requirement_id int not null references customer_requirements(id) on delete cascade,
  field_id int not null references category_fields(id) on delete cascade,
  value_text text,
  value_number numeric(14,2),
  value_boolean boolean,
  value_date date,
  option_id int references category_field_options(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requirement_id, field_id)
);

create index if not exists idx_requirement_attributes_requirement on requirement_attributes(requirement_id);
create index if not exists idx_requirement_attributes_field on requirement_attributes(field_id);

create table if not exists requirement_attribute_options (
  requirement_id int not null references customer_requirements(id) on delete cascade,
  field_id int not null references category_fields(id) on delete cascade,
  option_id int not null references category_field_options(id) on delete cascade,
  primary key (requirement_id, field_id, option_id)
);

create index if not exists idx_requirement_attribute_options_requirement on requirement_attribute_options(requirement_id);

-- ============ Follow-up (بخش ۱۵) ============
-- به‌جای مرجع Polymorphic آزاد، دو FK واقعی nullable با Check «دقیقاً یکی» — چون فقط دو نوع موجودیت (Lead/Customer) هدف است
-- و ارجاع واقعی FK (نه فقط entity_type/entity_id خام) یکپارچگی داده را قوی‌تر تضمین می‌کند.

create table if not exists crm_follow_ups (
  id serial primary key,
  lead_id int references leads(id) on delete cascade,
  customer_id int references customers(id) on delete cascade,
  type varchar(20) not null default 'call' check (type in ('call','message','meeting','email','other')),
  status varchar(20) not null default 'pending' check (status in ('pending','done','cancelled')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  notes text,
  assigned_to_user_id int references users(id) on delete set null,
  created_by_user_id int not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lead_id is not null and customer_id is null) or (lead_id is null and customer_id is not null))
);

create index if not exists idx_crm_follow_ups_lead on crm_follow_ups(lead_id);
create index if not exists idx_crm_follow_ups_customer on crm_follow_ups(customer_id);
create index if not exists idx_crm_follow_ups_assigned_to on crm_follow_ups(assigned_to_user_id);
create index if not exists idx_crm_follow_ups_status on crm_follow_ups(status);

-- ============ Activity / Interaction Timeline (بخش ۱۶) ============
-- جدول مستقل از admin_audit_logs: admin_audit_logs برای Compliance/سیستم است، crm_activities برای Timeline کسب‌وکاری CRM
-- (تصمیم طراحی، در گزارش نهایی توضیح داده می‌شود). الگوی Polymorphic دقیقاً مطابق admin_audit_logs (entity_type/entity_id بدون FK
-- چون به چند جدول هدف اشاره می‌کند: lead/customer/customer_requirement/crm_visit/crm_task/crm_follow_up).

create table if not exists crm_activities (
  id serial primary key,
  entity_type varchar(30) not null,
  entity_id int not null,
  activity_type varchar(30) not null,
  description text,
  meta text,
  created_by_user_id int references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_activities_entity on crm_activities(entity_type, entity_id);
create index if not exists idx_crm_activities_created_by on crm_activities(created_by_user_id);

-- ============ Visit (بخش ۱۷) ============
-- عمداً ستون property_id مستقل ندارد: ملک از طریق advertisement_id -> advertisements.property_id قابل استخراج است
-- تا رابطهٔ تکراری (Duplicate Relation) که خود پرامپت هشدار داده بود شکل نگیرد.

create table if not exists crm_visits (
  id serial primary key,
  customer_id int not null references customers(id) on delete cascade,
  advertisement_id int not null references advertisements(id) on delete cascade,
  requirement_id int references customer_requirements(id) on delete set null,
  assigned_to_user_id int references users(id) on delete set null,
  status varchar(20) not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  scheduled_at timestamptz not null,
  completed_at timestamptz,
  feedback text,
  created_by_user_id int not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_visits_customer on crm_visits(customer_id);
create index if not exists idx_crm_visits_advertisement on crm_visits(advertisement_id);
create index if not exists idx_crm_visits_requirement on crm_visits(requirement_id);
create index if not exists idx_crm_visits_assigned_to on crm_visits(assigned_to_user_id);
create index if not exists idx_crm_visits_status on crm_visits(status);

-- ============ Customer <-> Advertisement Interest ============

create table if not exists customer_property_interests (
  id serial primary key,
  customer_id int not null references customers(id) on delete cascade,
  advertisement_id int not null references advertisements(id) on delete cascade,
  interest_level varchar(20) not null default 'interested'
    check (interest_level in ('interested','very_interested','not_interested','rejected')),
  notes text,
  created_by_user_id int not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, advertisement_id)
);

create index if not exists idx_customer_property_interests_customer on customer_property_interests(customer_id);
create index if not exists idx_customer_property_interests_advertisement on customer_property_interests(advertisement_id);

-- ============ Task (بخش ۱۸) ============
-- related_entity_type/id: مرجع سبک اختیاری (Polymorphic بدون FK، هم‌سبک admin_audit_logs) — یک Task می‌تواند
-- به هیچ موجودیتی وصل نباشد (کار عمومی تیم) یا به Lead/Customer/Requirement/Visit وصل باشد.

create table if not exists crm_tasks (
  id serial primary key,
  title varchar(200) not null,
  description text,
  related_entity_type varchar(30),
  related_entity_id int,
  status varchar(20) not null default 'pending' check (status in ('pending','in_progress','done','cancelled')),
  priority varchar(10) not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_at timestamptz,
  completed_at timestamptz,
  assigned_to_user_id int references users(id) on delete set null,
  created_by_user_id int not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_tasks_assigned_to on crm_tasks(assigned_to_user_id);
create index if not exists idx_crm_tasks_status on crm_tasks(status);
create index if not exists idx_crm_tasks_due_at on crm_tasks(due_at);
create index if not exists idx_crm_tasks_related_entity on crm_tasks(related_entity_type, related_entity_id);

-- ============ Pipeline (بخش ۲۰: کاملاً Database-Driven، بدون Hard-code مراحل) ============

create table if not exists crm_pipelines (
  id serial primary key,
  key varchar(50) not null unique,
  title_fa varchar(150) not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crm_pipeline_stages (
  id serial primary key,
  pipeline_id int not null references crm_pipelines(id) on delete cascade,
  key varchar(50) not null,
  title_fa varchar(150) not null,
  sort_order int not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (pipeline_id, key)
);

create index if not exists idx_crm_pipeline_stages_pipeline on crm_pipeline_stages(pipeline_id);

-- کارت Pipeline: جایگاه فعلی یک Lead یا یک Customer در یک مرحله از یک Pipeline (بخش Deal عمداً کامل مدل نشده،
-- طبق تصریح پرامپت — این کارت صرفاً موقعیت را در قیف فروش نگه می‌دارد، نه خودِ معاملهٔ نهایی).

create table if not exists crm_pipeline_cards (
  id serial primary key,
  pipeline_id int not null references crm_pipelines(id) on delete cascade,
  stage_id int not null references crm_pipeline_stages(id) on delete cascade,
  lead_id int references leads(id) on delete cascade,
  customer_id int references customers(id) on delete cascade,
  assigned_to_user_id int references users(id) on delete set null,
  sort_order int not null default 0,
  entered_stage_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lead_id is not null and customer_id is null) or (lead_id is null and customer_id is not null)),
  unique (pipeline_id, lead_id),
  unique (pipeline_id, customer_id)
);

create index if not exists idx_crm_pipeline_cards_pipeline on crm_pipeline_cards(pipeline_id);
create index if not exists idx_crm_pipeline_cards_stage on crm_pipeline_cards(stage_id);
create index if not exists idx_crm_pipeline_cards_lead on crm_pipeline_cards(lead_id);
create index if not exists idx_crm_pipeline_cards_customer on crm_pipeline_cards(customer_id);
create index if not exists idx_crm_pipeline_cards_assigned_to on crm_pipeline_cards(assigned_to_user_id);

-- ============ Seed: Customer Types ============

insert into customer_types (key, label_fa, sort_order) values
  ('buyer',       'خریدار',      1),
  ('seller',      'فروشنده',     2),
  ('tenant',      'مستأجر',      3),
  ('landlord',    'موجر',        4),
  ('investor',    'سرمایه‌گذار', 5),
  ('partnership', 'مشارکت در ساخت', 6),
  ('other',       'سایر',        7)
on conflict (key) do nothing;

-- ============ Seed: Pipeline پیش‌فرض + مراحل ============

insert into crm_pipelines (key, title_fa, is_default) values
  ('default_sales', 'قیف فروش پیش‌فرض', true)
on conflict (key) do nothing;

insert into crm_pipeline_stages (pipeline_id, key, title_fa, sort_order, is_won, is_lost)
select p.id, s.key, s.title_fa, s.sort_order, s.is_won, s.is_lost
from crm_pipelines p
cross join (values
  ('new',               'جدید',                1, false, false),
  ('contacted',         'تماس گرفته‌شده',       2, false, false),
  ('qualified',         'واجدشرایط',           3, false, false),
  ('property_matching', 'تطبیق ملک',           4, false, false),
  ('visit',             'بازدید',              5, false, false),
  ('negotiation',       'مذاکره',              6, false, false),
  ('won',               'موفق',                7, true,  false),
  ('lost',              'ناموفق',              8, false, true)
) as s(key, title_fa, sort_order, is_won, is_lost)
where p.key = 'default_sales'
on conflict (pipeline_id, key) do nothing;

-- ============ Permissions جدید CRM (بخش ۲۳ تا ۲۵) ============
-- توجه: lead.view/create/edit/assign و customer.view/edit از فاز ۱ (مهاجرت ۰۰۲) از قبل رزرو شده بودند؛
-- اینجا فقط مجوزهای ناموجودِ همان خانواده‌ها اضافه می‌شوند تا هیچ کلید تکراری ساخته نشود.

insert into permissions (key, description_fa) values
  ('lead.delete',        'حذف سرنخ'),
  ('lead.convert',       'تبدیل سرنخ به مشتری'),
  ('customer.create',    'ثبت مشتری'),
  ('customer.delete',    'حذف مشتری'),
  ('requirement.view',   'مشاهده نیازمندی مشتری'),
  ('requirement.create', 'ثبت نیازمندی مشتری'),
  ('requirement.edit',   'ویرایش نیازمندی مشتری'),
  ('requirement.delete', 'حذف نیازمندی مشتری'),
  ('followup.view',      'مشاهده پیگیری'),
  ('followup.create',    'ثبت پیگیری'),
  ('followup.edit',      'ویرایش پیگیری'),
  ('followup.delete',    'حذف پیگیری'),
  ('visit.view',         'مشاهده بازدید'),
  ('visit.create',       'ثبت بازدید'),
  ('visit.edit',         'ویرایش بازدید'),
  ('visit.delete',       'حذف بازدید'),
  ('task.view',          'مشاهده وظیفه'),
  ('task.create',        'ثبت وظیفه'),
  ('task.edit',          'ویرایش وظیفه'),
  ('task.delete',        'حذف وظیفه'),
  ('pipeline.view',      'مشاهده قیف فروش CRM'),
  ('pipeline.manage',    'مدیریت قیف فروش CRM'),
  ('crm.activity.view',  'مشاهده تاریخچه فعالیت CRM'),
  ('crm.activity.create','ثبت فعالیت CRM'),
  ('crm.report.view',    'مشاهده گزارش‌های CRM')
on conflict (key) do nothing;

-- مدیر کل و مدیر سیستم: تمام مجوزهای خانواده‌های CRM (قدیمی + جدید)، طبق الگوی تکرارشونده در هر مهاجرت قبلی
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key in ('super_admin', 'system_admin')
  and (
    p.key like 'lead.%' or p.key like 'customer.%' or p.key like 'requirement.%' or
    p.key like 'followup.%' or p.key like 'visit.%' or p.key like 'task.%' or
    p.key like 'pipeline.%' or p.key like 'crm.%'
  )
on conflict do nothing;

-- مدیر CRM: دسترسی کامل به تمام خانواده‌های CRM
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.key in (
    'lead.delete','lead.convert','customer.create','customer.delete',
    'requirement.view','requirement.create','requirement.edit','requirement.delete',
    'followup.view','followup.create','followup.edit','followup.delete',
    'visit.view','visit.create','visit.edit','visit.delete',
    'task.view','task.create','task.edit','task.delete',
    'pipeline.view','pipeline.manage',
    'crm.activity.view','crm.activity.create','crm.report.view'
  )
where r.key = 'crm_manager'
on conflict do nothing;

-- مدیر آژانس: دسترسی CRM محدود به دامنهٔ آژانس خودش (اجرای دقیق Scope در لایهٔ API فاز بعد)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.key in (
    'lead.convert','customer.create',
    'requirement.view','requirement.create','requirement.edit',
    'followup.view','followup.create','followup.edit',
    'visit.view','visit.create','visit.edit',
    'task.view','task.create','task.edit',
    'pipeline.view','crm.activity.view','crm.activity.create','crm.report.view'
  )
where r.key = 'agency_manager'
on conflict do nothing;

-- مشاور: فقط Lead/Customerِ واگذارشده به خودش (اجرای دقیق Assignment Scoping در لایهٔ API فاز بعد)
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.key in (
    'requirement.view',
    'followup.view','followup.create',
    'visit.view','visit.create',
    'task.view','task.create',
    'crm.activity.view','crm.activity.create'
  )
where r.key = 'consultant'
on conflict do nothing;

-- کارمند: محدودتر از مشاور (بدون مشاهدهٔ نیازمندی)، فقط از طریق Assignment
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.key in (
    'followup.view','followup.create',
    'visit.view','visit.create',
    'task.view','task.create',
    'crm.activity.view','crm.activity.create'
  )
where r.key = 'employee'
on conflict do nothing;

-- کاربر عادی: هیچ مجوز CRM ای ندارد (بدون تغییر)
