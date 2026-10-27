-- ویژگی‌های اختصاصی فرم ثبت آگهی بر اساس دسته‌بندی ملک.
-- ویژگی‌های قبلی نگه‌داری می‌شوند تا دادهٔ آگهی‌های موجود حذف نشود؛ فقط گزینه‌های فعال جایگزین می‌شوند.

update category_fields
set is_active = false
where category_id in (
  select id from categories where slug in (
    'kharid-forosh-vila', 'rahn-ejare-vila',
    'rahn-ejare-khane-apartman', 'kharid-forosh-khane-apartman',
    'ejare-kutahmoddat-vila-suite',
    'rahn-ejare-edari-tejari-sanati', 'kharid-forosh-edari-tejari-sanati',
    'zamin-bagh', 'pishforosh-mosharekat-sakht', 'saeer-amlak'
  )
);

with field_definitions(category_slug, key, label_fa, field_type, is_required, sort_order) as (
  values
    ('kharid-forosh-vila', 'estakhr', 'استخر', 'boolean', false, 1),
    ('kharid-forosh-vila', 'jacuzzi', 'جکوزی', 'boolean', false, 2),
    ('kharid-forosh-vila', 'parking', 'پارکینگ', 'boolean', false, 3),
    ('kharid-forosh-vila', 'hayat', 'حیاط', 'boolean', false, 4),
    ('kharid-forosh-vila', 'balkon', 'بالکن', 'boolean', false, 5),
    ('kharid-forosh-vila', 'negahbani', 'نگهبانی', 'boolean', false, 6),
    ('kharid-forosh-vila', 'sanad_type', 'نوع سند', 'select', false, 7),

    ('rahn-ejare-vila', 'estakhr', 'استخر', 'boolean', false, 1),
    ('rahn-ejare-vila', 'jacuzzi', 'جکوزی', 'boolean', false, 2),
    ('rahn-ejare-vila', 'parking', 'پارکینگ', 'boolean', false, 3),
    ('rahn-ejare-vila', 'hayat', 'حیاط', 'boolean', false, 4),
    ('rahn-ejare-vila', 'balkon', 'بالکن', 'boolean', false, 5),
    ('rahn-ejare-vila', 'furnished', 'مبله', 'boolean', false, 6),
    ('rahn-ejare-vila', 'sanad_type', 'نوع سند', 'select', false, 7),

    ('rahn-ejare-khane-apartman', 'parking', 'پارکینگ', 'boolean', false, 1),
    ('rahn-ejare-khane-apartman', 'asansor', 'آسانسور', 'boolean', false, 2),
    ('rahn-ejare-khane-apartman', 'anbari', 'انباری', 'boolean', false, 3),
    ('rahn-ejare-khane-apartman', 'balkon', 'بالکن', 'boolean', false, 4),
    ('rahn-ejare-khane-apartman', 'lobby', 'لابی', 'boolean', false, 5),
    ('rahn-ejare-khane-apartman', 'negahbani', 'نگهبانی', 'boolean', false, 6),

    ('kharid-forosh-khane-apartman', 'parking', 'پارکینگ', 'boolean', false, 1),
    ('kharid-forosh-khane-apartman', 'asansor', 'آسانسور', 'boolean', false, 2),
    ('kharid-forosh-khane-apartman', 'anbari', 'انباری', 'boolean', false, 3),
    ('kharid-forosh-khane-apartman', 'balkon', 'بالکن', 'boolean', false, 4),
    ('kharid-forosh-khane-apartman', 'lobby', 'لابی', 'boolean', false, 5),
    ('kharid-forosh-khane-apartman', 'negahbani', 'نگهبانی', 'boolean', false, 6),
    ('kharid-forosh-khane-apartman', 'sanad_type', 'نوع سند', 'select', false, 7),

    ('ejare-kutahmoddat-vila-suite', 'capacity', 'ظرفیت مهمان', 'number', false, 1),
    ('ejare-kutahmoddat-vila-suite', 'furnished', 'مبله', 'boolean', false, 2),
    ('ejare-kutahmoddat-vila-suite', 'estakhr', 'استخر', 'boolean', false, 3),
    ('ejare-kutahmoddat-vila-suite', 'parking', 'پارکینگ', 'boolean', false, 4),
    ('ejare-kutahmoddat-vila-suite', 'internet', 'اینترنت', 'boolean', false, 5),
    ('ejare-kutahmoddat-vila-suite', 'pet_allowed', 'پذیرش حیوان خانگی', 'boolean', false, 6),

    ('rahn-ejare-edari-tejari-sanati', 'property_type', 'نوع ملک', 'select', true, 1),
    ('rahn-ejare-edari-tejari-sanati', 'arz_melk', 'عرض ملک', 'number', false, 2),
    ('rahn-ejare-edari-tejari-sanati', 'ertefa', 'ارتفاع سقف', 'number', false, 3),
    ('rahn-ejare-edari-tejari-sanati', 'bar_khiaban', 'بر خیابان', 'boolean', false, 4),
    ('rahn-ejare-edari-tejari-sanati', 'anbari', 'انباری', 'boolean', false, 5),
    ('rahn-ejare-edari-tejari-sanati', 'asansor', 'آسانسور', 'boolean', false, 6),
    ('rahn-ejare-edari-tejari-sanati', 'parking', 'پارکینگ', 'boolean', false, 7),

    ('kharid-forosh-edari-tejari-sanati', 'property_type', 'نوع ملک', 'select', true, 1),
    ('kharid-forosh-edari-tejari-sanati', 'arz_melk', 'عرض ملک', 'number', false, 2),
    ('kharid-forosh-edari-tejari-sanati', 'ertefa', 'ارتفاع سقف', 'number', false, 3),
    ('kharid-forosh-edari-tejari-sanati', 'bar_khiaban', 'بر خیابان', 'boolean', false, 4),
    ('kharid-forosh-edari-tejari-sanati', 'anbari', 'انباری', 'boolean', false, 5),
    ('kharid-forosh-edari-tejari-sanati', 'asansor', 'آسانسور', 'boolean', false, 6),
    ('kharid-forosh-edari-tejari-sanati', 'parking', 'پارکینگ', 'boolean', false, 7),

    ('zamin-bagh', 'noe_karbari', 'نوع کاربری', 'select', true, 1),
    ('zamin-bagh', 'sanad_type', 'نوع سند', 'select', false, 2),
    ('zamin-bagh', 'arz_zamin', 'عرض زمین', 'number', false, 3),
    ('zamin-bagh', 'bar_khiaban', 'بر خیابان', 'boolean', false, 4),
    ('zamin-bagh', 'ab', 'آب', 'boolean', false, 5),
    ('zamin-bagh', 'bargh', 'برق', 'boolean', false, 6),
    ('zamin-bagh', 'gaz', 'گاز', 'boolean', false, 7),
    ('zamin-bagh', 'divarkeshi', 'دیوارکشی', 'boolean', false, 8),

    ('pishforosh-mosharekat-sakht', 'vaziat_sakht', 'وضعیت ساخت', 'select', true, 1),
    ('pishforosh-mosharekat-sakht', 'delivery_date', 'تاریخ تحویل', 'date', false, 2),
    ('pishforosh-mosharekat-sakht', 'parking', 'پارکینگ', 'boolean', false, 3),
    ('pishforosh-mosharekat-sakht', 'asansor', 'آسانسور', 'boolean', false, 4),
    ('pishforosh-mosharekat-sakht', 'anbari', 'انباری', 'boolean', false, 5),
    ('pishforosh-mosharekat-sakht', 'balkon', 'بالکن', 'boolean', false, 6),

    ('saeer-amlak', 'property_type', 'نوع ملک', 'select', true, 1),
    ('saeer-amlak', 'sanad_type', 'نوع سند', 'select', false, 2),
    ('saeer-amlak', 'parking', 'پارکینگ', 'boolean', false, 3),
    ('saeer-amlak', 'anbari', 'انباری', 'boolean', false, 4)
)
insert into category_fields (category_id, key, label_fa, field_type, is_required, sort_order, is_active)
select c.id, d.key, d.label_fa, d.field_type, d.is_required, d.sort_order, true
from field_definitions d
join categories c on c.slug = d.category_slug
on conflict (category_id, key) do update
set label_fa = excluded.label_fa,
    field_type = excluded.field_type,
    is_required = excluded.is_required,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

with option_definitions(field_key, value, label_fa, sort_order) as (
  values
    ('sanad_type', 'official', 'سند رسمی', 1),
    ('sanad_type', 'vakil', 'وکالتی', 2),
    ('sanad_type', 'gholnamei', 'قولنامه‌ای', 3),
    ('sanad_type', 'other', 'سایر', 4),
    ('property_type', 'office', 'اداری', 1),
    ('property_type', 'shop', 'مغازه', 2),
    ('property_type', 'warehouse', 'انبار', 3),
    ('property_type', 'workshop', 'کارگاه', 4),
    ('property_type', 'industrial', 'صنعتی', 5),
    ('property_type', 'other', 'سایر', 6),
    ('noe_karbari', 'residential', 'مسکونی', 1),
    ('noe_karbari', 'agricultural', 'کشاورزی', 2),
    ('noe_karbari', 'commercial', 'تجاری', 3),
    ('noe_karbari', 'industrial', 'صنعتی', 4),
    ('noe_karbari', 'garden', 'باغی', 5),
    ('vaziat_sakht', 'preparation', 'در حال آماده‌سازی', 1),
    ('vaziat_sakht', 'foundation', 'فونداسیون', 2),
    ('vaziat_sakht', 'skeleton', 'اسکلت', 3),
    ('vaziat_sakht', 'finishing', 'نازک‌کاری', 4),
    ('vaziat_sakht', 'completed', 'تکمیل‌شده', 5)
)
insert into category_field_options (field_id, value, label_fa, sort_order, is_active)
select cf.id, d.value, d.label_fa, d.sort_order, true
from option_definitions d
join category_fields cf on cf.key = d.field_key and cf.is_active
on conflict (field_id, value) do update
set label_fa = excluded.label_fa,
    sort_order = excluded.sort_order,
    is_active = true;
