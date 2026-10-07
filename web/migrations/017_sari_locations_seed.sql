-- تکمیل داده‌های واقعی مناطق شهرداری (رسمی)، مناطق عرفی بازار ملک، و محلات شهر ساری
-- قبلاً فقط یک ردیف نمونه/تستی برای هرکدام وجود داشت که برای فرم ثبت آگهی کافی نبود.
-- این Migration داده‌های ردیف‌های موجود را با نام واقعی جایگزین می‌کند (به‌جای حذف، برای
-- حفظ یکپارچگی ارجاعی آگهی‌های موجود) و ردیف‌های واقعی باقی‌مانده را اضافه می‌کند.
-- منبع: تقسیم‌بندی رسمی ۴ منطقه/۲۰ ناحیهٔ شهرداری ساری + نام‌های عرفی رایج در معاملات ملکی.
-- تمام ردیف‌ها is_active=true هستند تا در فرم ثبت آگهی/فیلترهای جستجو کامل نمایش داده شوند.
-- مدیر سایت می‌تواند هر زمان از پنل (بخش «مناطق») نام‌ها را ویرایش یا موارد جدید اضافه کند.

-- ============ منطقه یک (اصلاح ردیف موجود + افزودن مناطق ۲ تا ۴) ============
update districts set name = 'منطقه یک شهرداری', is_active = true, sort_order = 1 where id = 1 and city_id = 1;

insert into districts (city_id, name, slug, is_active, sort_order) values
  (1, 'منطقه دو شهرداری', 'mantaghe-2', true, 2),
  (1, 'منطقه سه شهرداری', 'mantaghe-3', true, 3),
  (1, 'منطقه چهار شهرداری (بافت تاریخی)', 'mantaghe-4', true, 4)
on conflict (city_id, slug) do update set is_active = true;

-- ============ مناطق عرفی بازار ملک (اصلاح ردیف موجود + افزودن موارد رایج) ============
update market_zones set name = 'خیابان قارن', slug = 'khiaban-gharan', is_active = true, sort_order = 1 where id = 1 and city_id = 1;

insert into market_zones (city_id, name, slug, is_active, sort_order) values
  (1, 'پارک ملل', 'park-melal', true, 2),
  (1, 'بلوار طالقانی', 'boulevard-taleghani', true, 3),
  (1, 'بلوار کشاورز', 'boulevard-keshavarz', true, 4),
  (1, 'بلوار خزر', 'boulevard-khazar', true, 5),
  (1, 'خیابان فرهنگ', 'khiaban-farhang', true, 6),
  (1, 'خیابان پیروزی', 'khiaban-pirouzi', true, 7),
  (1, 'کوی پیوندی', 'kooye-peyvandi', true, 8),
  (1, 'میدان امام (مرکز شهر)', 'meydan-emam', true, 9),
  (1, '۱۵ خرداد', 'panzdah-khordad', true, 10),
  (1, 'ششصد دستگاه', 'shishsad-dastgah', true, 11),
  (1, 'خیابان سلمان فارسی', 'khiaban-salman-farsi', true, 12)
on conflict (city_id, slug) do update set is_active = true;

-- ============ محلات منطقه یک (اصلاح ردیف موجود «محله تست» + افزودن بقیه) ============
update neighborhoods
  set name = 'میرزمانی', slug = 'mirzamani', district_id = 1, market_zone_id = null, is_active = true, sort_order = 1
  where id = 1 and city_id = 1;

insert into neighborhoods (city_id, district_id, name, slug, is_active, sort_order) values
  (1, 1, 'پیوندی', 'peyvandi', true, 2),
  (1, 1, 'پیام نور', 'payame-noor', true, 3),
  (1, 1, 'سلمان فارسی', 'salman-farsi', true, 4),
  (1, 1, 'مهیار', 'mahyar', true, 5),
  (1, 1, 'دانش', 'danesh', true, 6),
  (1, 1, 'لاله', 'laleh', true, 7),
  (1, 1, 'معلم', 'moallem', true, 8),
  (1, 1, 'امام رضا', 'emam-reza', true, 9),
  (1, 1, 'شهابی', 'shahabi', true, 10),
  (1, 1, 'امامزاده عباس', 'emamzadeh-abbas', true, 11),
  (1, 1, 'ششصد دستگاه', 'shishsad-dastgah-n1', true, 12),
  (1, 1, 'هولا', 'hoola', true, 13),
  (1, 1, 'ذغال‌چال', 'zoghalchal', true, 14),

  -- ============ محلات منطقه دو ============
  (1, 2, 'طبرستان', 'tabarestan', true, 1),
  (1, 2, 'گلستان', 'golestan', true, 2),
  (1, 2, 'سیدالشهدا', 'seyed-al-shohada', true, 3),
  (1, 2, 'باهنر', 'bahonar', true, 4),
  (1, 2, 'جهاد', 'jahad', true, 5),
  (1, 2, 'امیر مازندرانی', 'amir-mazandarani', true, 6),
  (1, 2, 'شاهبند', 'shahband', true, 7),
  (1, 2, 'اصحاب', 'ashab', true, 8),
  (1, 2, 'کارمندان', 'karmandan', true, 9),
  (1, 2, 'آزادی', 'azadi', true, 10),
  (1, 2, 'پاسداران', 'pasdaran', true, 11),
  (1, 2, '۲۲ بهمن', '22-bahman', true, 12),
  (1, 2, 'امام حسین', 'emam-hossein', true, 13),
  (1, 2, 'جام جم', 'jame-jam', true, 14),
  (1, 2, 'دولت', 'dolat', true, 15),
  (1, 2, 'هفت تیر', 'haft-tir', true, 16),
  (1, 2, 'قروق', 'ghorough', true, 17),

  -- ============ محلات منطقه سه ============
  (1, 3, 'کشاورز', 'keshavarz', true, 1),
  (1, 3, 'لسانی', 'lesani', true, 2),
  (1, 3, 'پل گردن', 'pole-gardan', true, 3),
  (1, 3, 'لاکدشت', 'lakdasht', true, 4),
  (1, 3, 'مه‌دشت', 'mahdasht', true, 5),
  (1, 3, 'آهی‌دشت', 'ahidasht', true, 6),
  (1, 3, 'بالا دزا', 'bala-deza', true, 7),
  (1, 3, 'پایین دزا', 'paeen-deza', true, 8),
  (1, 3, 'دخانیات', 'dokhaniat', true, 9),
  (1, 3, 'کارگران', 'kargaran', true, 10),
  (1, 3, 'شهرداری', 'shahrdari', true, 11),
  (1, 3, 'اتحاد', 'etehad', true, 12),
  (1, 3, 'سپاه', 'sepah', true, 13),

  -- ============ محلات منطقه چهار (بافت تاریخی) ============
  (1, 4, 'شیخ طبرسی', 'sheikh-tabarsi', true, 1),
  (1, 4, 'جمهوری', 'jomhoori', true, 2),
  (1, 4, 'بازار', 'bazaar', true, 3),
  (1, 4, 'قارن', 'gharan', true, 4),
  (1, 4, 'انقلاب', 'enghelab', true, 5),
  (1, 4, 'مدرس', 'modares', true, 6),
  (1, 4, '۱۸ دی', '18-dey', true, 7),
  (1, 4, 'فردوسی', 'ferdowsi', true, 8),
  (1, 4, 'آب‌انبار نو', 'abanbar-no', true, 9)
on conflict (city_id, slug) do update set is_active = true;
