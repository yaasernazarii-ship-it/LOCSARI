-- فعال‌سازی بخش «درباره ما» و «تماس با ما» در سایت عمومی

-- ============ صفحهٔ «درباره ما» (از طریق CMS موجود site_pages) ============
insert into site_pages (slug, title, body, is_published, sort_order)
values (
  'about',
  'درباره ما',
  'لوکیشن ساری با یک هدف ساده شکل گرفت: پیدا کردن ملک مناسب در ساری نباید کار سخت و پر از سردرگمی باشد.
ما یک مرجع تخصصی برای خرید، فروش، رهن و اجارهٔ انواع ملک — از آپارتمان و ویلا تا زمین، مغازه، دفتر اداری و باغ‌ویلا —
هستیم که فعالیت خود را کاملاً و منحصراً روی شهر ساری متمرکز کرده‌ایم.

برخلاف سایت‌های بزرگ سراسری که آگهی‌های ده‌ها شهر را با هم قاطی می‌کنند، تمرکز ما فقط محله‌های ساری است؛
از بلوار طالقانی و خزرآباد تا فرح‌آباد و قدیم بندپی. همین تمرکز محلی باعث می‌شود دسته‌بندی‌ها، مناطق و نتایج جستجو
با واقعیت بازار همین شهر همخوانی داشته باشد.

فلسفهٔ کاری ما ساده است: شفافیت در اطلاعات ملک، سهولت ثبت آگهی برای مالکان، و جستجوی سریع و دقیق برای خریداران و مستأجران.
چه به‌دنبال اولین خانه‌تان باشید، چه بخواهید ملکی برای سرمایه‌گذاری یا کسب‌وکار در ساری پیدا کنید، لوکیشن ساری همراه شماست.',
  true,
  1
)
on conflict (slug) do nothing;

-- ============ پیام‌های تماس (فرم عمومی «تماس با ما») ============
create table if not exists contact_messages (
  id serial primary key,
  name varchar(150) not null,
  phone varchar(20) not null,
  email varchar(200),
  subject varchar(200),
  message text not null,
  status varchar(20) not null default 'new', -- new | read
  created_at timestamptz not null default now()
);

create index if not exists idx_contact_messages_status on contact_messages(status);
create index if not exists idx_contact_messages_created on contact_messages(created_at desc);

-- مجوز مشاهدهٔ پیام‌های تماس در پنل مدیریت (مطابق الگوی content.view)
insert into permissions (key, description_fa) values
  ('contact.view', 'مشاهدهٔ پیام‌های تماس')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key in ('super_admin', 'system_admin') and p.key = 'contact.view'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p on p.key = 'contact.view'
where r.key = 'content_manager'
on conflict do nothing;
