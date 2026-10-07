-- تصاویر ضمیمهٔ صفحات محتوا (مثلاً «اعتبارات و مجوزات» در صفحهٔ درباره ما) + تنظیمات تماس سایت

-- ============ تصاویر صفحات محتوا (site_pages) ============
create table if not exists site_page_images (
  id serial primary key,
  page_id integer not null references site_pages(id) on delete cascade,
  storage_key text not null,
  url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_page_images_page on site_page_images(page_id);

-- ============ اطلاعات تماس سایت (تک‌رکورد، مدیریت‌شده از پنل) ============
create table if not exists site_contact_info (
  id integer primary key default 1,
  address text,
  phone1 varchar(20),
  phone2 varchar(20),
  telegram_url text,
  instagram_url text,
  eitaa_url text,
  whatsapp_url text,
  updated_at timestamptz not null default now(),
  constraint site_contact_info_singleton check (id = 1)
);

insert into site_contact_info (id) values (1) on conflict (id) do nothing;

-- ============ تکمیل متن «درباره ما» با توضیح عملکرد سایت ============
update site_pages
set body = body || '

لوکیشن ساری چگونه کار می‌کند؟ مالکان، مشاوران املاک و آژانس‌ها با ثبت‌نام رایگان از طریق شمارهٔ موبایل، آگهی خود را
به‌همراه مشخصات کامل ملک، دسته‌بندی، منطقه/محلهٔ دقیق و تصاویر ثبت می‌کنند. هر آگهی پیش از انتشار توسط تیم بررسی
لوکیشن ساری کنترل می‌شود تا از صحت و کیفیت اطلاعات نمایش داده‌شده به کاربران اطمینان حاصل شود. کاربران می‌توانند
آگهی‌ها را بر اساس نوع معامله (خرید، رهن، اجاره، اجارهٔ کوتاه‌مدت، پیش‌فروش یا مشارکت در ساخت)، منطقه و ویژگی‌های
اختصاصی هر دسته جستجو و فیلتر کنند، آگهی‌های مورد علاقهٔ خود را ذخیره کنند و مستقیم با آگهی‌دهنده در تماس باشند.

بخشی از مشاوران و آژانس‌های فعال در پلتفرم پس از احراز هویت و تأیید توسط تیم لوکیشن ساری، با نشان «تأییدشده»
در آگهی‌های خود متمایز می‌شوند تا اعتماد بیشتری برای کاربران فراهم شود.'
where slug = 'about'
  and body not like '%لوکیشن ساری چگونه کار می‌کند؟%';
