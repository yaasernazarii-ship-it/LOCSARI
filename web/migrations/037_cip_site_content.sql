-- بلوک‌های محتوایی صفحهٔ آگهی‌های CIP.
insert into site_content_blocks (content_key, page_key, section_key, label_fa, value) values
  ('cip.hero_title', 'cip', 'hero', 'تیتر اصلی', 'آگهی‌های CIP'),
  ('cip.hero_description', 'cip', 'hero', 'متن زیر تیتر', 'آگهی‌هایی که برای آن‌ها ویدیوی اختصاصی و باکیفیت ساخته شده است. برای ملک خود هم می‌توانید سفارش ویدیو ثبت کنید.'),
  ('cip.videos_title', 'cip', 'videos', 'تیتر فهرست ویدیوها', 'آگهی‌های دارای ویدیوی اختصاصی'),
  ('cip.empty_message', 'cip', 'videos', 'پیام خالی بودن فهرست', 'هنوز ویدیوی CIP منتشرشده‌ای وجود ندارد.'),
  ('cip.plans_title', 'cip', 'plans', 'تیتر بخش پلن‌ها', 'پلن‌های تولید ویدیوی CIP'),
  ('cip.plans_description', 'cip', 'plans', 'متن معرفی پلن‌ها', 'برای ملک خود ویدیوی حرفه‌ای سفارش دهید. پس از پرداخت، تیم ما برای هماهنگی تصویربرداری با شما تماس می‌گیرد.')
on conflict (content_key) do nothing;
