-- فرم ثبت و جستجوی ملک یک فهرست موقعیت واحد دارد؛ مناطق رسمی/عرفی و محله‌ها
-- به گزینه‌های همان فهرست منتقل می‌شوند تا داده‌های آگهی‌های موجود هم حفظ شود.

-- «سند» از ورودی متنی به انتخاب دارد/ندارد تبدیل می‌شود.
update category_fields
set field_type = 'boolean'
where key = 'sanad' and field_type <> 'boolean';

-- نام مناطق رسمی و عرفی را نیز به عنوان موقعیت مستقل قابل انتخاب می‌کنیم.
insert into neighborhoods (city_id, district_id, market_zone_id, name, slug, is_active, sort_order)
select city_id, null, null, name, 'unified-district-' || slug, true, sort_order
from districts
where city_id = 1
on conflict (city_id, slug) do update
set name = excluded.name, is_active = true, sort_order = excluded.sort_order;

insert into neighborhoods (city_id, district_id, market_zone_id, name, slug, is_active, sort_order)
select city_id, null, null, name, 'unified-market-zone-' || slug, true, sort_order + 100
from market_zones
where city_id = 1
on conflict (city_id, slug) do update
set name = excluded.name, is_active = true, sort_order = excluded.sort_order;

-- محله‌های قبلی هم در فهرست یکپارچه مستقل می‌شوند.
update neighborhoods
set district_id = null, market_zone_id = null, is_active = true
where city_id = 1;

-- روستاها و محدوده‌های پرکاربرد پیرامون ساری.
insert into neighborhoods (city_id, name, slug, is_active, sort_order) values
  (1, 'جاده دریا', 'jade-darya', true, 200),
  (1, 'فرح‌آباد', 'farah-abad', true, 201),
  (1, 'دشت‌ناز', 'dasht-naz', true, 202),
  (1, 'اسرم', 'asram', true, 203),
  (1, 'سورک', 'sorkh', true, 204),
  (1, 'سمسکنده', 'samskandeh', true, 205),
  (1, 'پنبه‌چوله', 'panbeh-chuleh', true, 206),
  (1, 'قره‌خیل', 'ghareh-kheil', true, 207),
  (1, 'هولار', 'hular', true, 208),
  (1, 'لاریم', 'larim', true, 209),
  (1, 'میاندرود', 'miandorud', true, 210),
  (1, 'سیدمحله', 'seyed-mahalleh', true, 211),
  (1, 'تجن', 'tajen', true, 212),
  (1, 'سلیمان‌تنگه', 'soleyman-tangeh', true, 213)
on conflict (city_id, slug) do update
set name = excluded.name, is_active = true, sort_order = excluded.sort_order;

-- آگهی‌های قبلی که فقط منطقهٔ اصلی/فرعی داشتند به موقعیت متناظر منتقل می‌شوند.
update properties p
set neighborhood_id = n.id
from districts d
join neighborhoods n on n.city_id = d.city_id and n.slug = 'unified-district-' || d.slug
where p.district_id = d.id and p.neighborhood_id is null;

update properties p
set neighborhood_id = n.id
from market_zones mz
join neighborhoods n on n.city_id = mz.city_id and n.slug = 'unified-market-zone-' || mz.slug
where p.market_zone_id = mz.id and p.neighborhood_id is null;

update properties
set district_id = null, market_zone_id = null
where city_id = 1;
