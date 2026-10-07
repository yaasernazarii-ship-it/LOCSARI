-- بلوک‌های محتوایی صفحات اصلی؛ هر کلید تنها یک‌بار تعریف می‌شود.
create table if not exists site_content_blocks (
  id serial primary key,
  content_key varchar(120) not null unique,
  page_key varchar(60) not null,
  section_key varchar(80) not null,
  label_fa varchar(160) not null,
  value text not null default '',
  updated_by_user_id int references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_site_content_blocks_page on site_content_blocks(page_key);

insert into site_content_blocks (content_key, page_key, section_key, label_fa, value) values
  ('header.site_name', 'global', 'header', 'نام سایت در هدر', 'لوکیشن ساری'),
  ('footer.description', 'global', 'footer', 'متن معرفی در فوتر', 'پلتفرم تخصصی املاک شهر ساری'),
  ('home.hero_title', 'home', 'hero', 'تیتر اصلی', 'خرید، رهن و اجارهٔ ملک در ساری'),
  ('home.hero_description', 'home', 'hero', 'متن زیر تیتر', 'جستجوی سریع در آگهی‌های ثبت‌شدهٔ املاک شهر ساری — مستقیم از صاحب ملک، مشاوران و آژانس‌های معتبر.'),
  ('home.search_placeholder', 'home', 'hero', 'متن راهنمای جستجو', 'جستجو در عنوان آگهی، منطقه یا محله…'),
  ('home.latest_title', 'home', 'latest_ads', 'تیتر جدیدترین آگهی‌ها', 'جدیدترین آگهی‌ها'),
  ('home.cta_title', 'home', 'cta', 'تیتر دعوت به ثبت آگهی', 'می‌خواهید ملکتان را سریع بفروشید یا اجاره دهید؟'),
  ('home.cta_description', 'home', 'cta', 'متن دعوت به ثبت آگهی', 'ثبت آگهی رایگان است. کافی است ثبت‌نام کنید و مشخصات ملک را وارد کنید تا بعد از بررسی منتشر شود.'),
  ('vip.hero_title', 'vip', 'hero', 'تیتر اصلی', 'آگهی‌های VIP'),
  ('vip.hero_description', 'vip', 'hero', 'متن زیر تیتر', 'آگهی‌های ویژه با اولویت نمایش، متعلق به کاربرانی که اشتراک VIP فعال تهیه کرده‌اند.'),
  ('vip.empty_message', 'vip', 'list', 'پیام خالی بودن فهرست', 'در حال حاضر آگهی VIP فعالی وجود ندارد.'),
  ('vip.cta_title', 'vip', 'cta', 'تیتر دعوت به VIP', 'می‌خواهید آگهی‌تان اینجا نمایش داده شود؟'),
  ('vip.cta_description', 'vip', 'cta', 'متن دعوت به VIP', 'با تهیهٔ اشتراک VIP، آگهی شما در این بخش با اولویت نمایش داده می‌شود.'),
  ('contact.intro', 'contact', 'intro', 'متن معرفی صفحه', 'برای مشاوره خرید، فروش، رهن یا اجاره ملک، از راه‌های زیر با تیم لوکیشن ساری در ارتباط باشید.')
on conflict (content_key) do nothing;
