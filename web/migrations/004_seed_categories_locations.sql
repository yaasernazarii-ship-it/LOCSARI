-- Seed پایهٔ فاز ۲: استان/شهر مصوب فعلی پروژه + دسته‌بندی‌های اصلی مصوب + نمونهٔ فیلدهای اختصاصی
-- توجه: لیست مناطق/محله‌های واقعی ساری عمداً Seed نشده (نیازمند Dataset معتبر — به گزارش پایان فاز ۲ مراجعه شود).

insert into provinces (name, slug) values
  ('مازندران', 'mazandaran')
on conflict (slug) do nothing;

insert into cities (province_id, name, slug)
select p.id, 'ساری', 'sari'
from provinces p where p.slug = 'mazandaran'
on conflict (province_id, slug) do nothing;

-- دسته‌بندی‌های اصلی (بخش ۲ پرامپت فاز ۲)
-- «همه‌ی گروه املاک» عمداً اینجا نیست: یک Virtual Filter در سطح Application است، نه یک ردیف واقعی.
insert into categories (name, slug, sort_order) values
  ('خرید و فروش ویلا',                       'kharid-forosh-vila',              1),
  ('رهن و اجاره خانه و آپارتمان',              'rahn-ejare-khane-apartman',       2),
  ('خرید و فروش خانه و آپارتمان',              'kharid-forosh-khane-apartman',    3),
  ('اجاره کوتاه‌مدت ویلا و سوئیت',             'ejare-kutahmoddat-vila-suite',    4),
  ('رهن و اجاره اداری، تجاری و صنعتی',         'rahn-ejare-edari-tejari-sanati',  5),
  ('خرید و فروش اداری، تجاری و صنعتی',         'kharid-forosh-edari-tejari-sanati', 6),
  ('زمین و باغ',                              'zamin-bagh',                      7),
  ('پیش‌فروش و مشارکت در ساخت',                'pishforosh-mosharekat-sakht',     8),
  ('سایر املاک',                              'saeer-amlak',                     9)
on conflict (slug) do nothing;

-- فیلدهای اختصاصی نمونهٔ «خانه و آپارتمان» — روی هر دو دستهٔ خرید/فروش و رهن/اجارهٔ آپارتمان
insert into category_fields (category_id, key, label_fa, field_type, is_required, sort_order)
select c.id, f.key, f.label, f.ftype, f.req, f.ord
from categories c
join (values
  ('metraj',        'متراژ',            'number',  true,  1),
  ('khab',          'تعداد خواب',        'number',  false, 2),
  ('sale_sakht',    'سال ساخت',          'number',  false, 3),
  ('tabaghe',       'طبقه',             'number',  false, 4),
  ('tedad_tabaghat','تعداد طبقات',       'number',  false, 5),
  ('tedad_vahed',   'تعداد واحد',        'number',  false, 6),
  ('parking',       'پارکینگ',          'boolean', false, 7),
  ('asansor',       'آسانسور',          'boolean', false, 8),
  ('anbari',        'انباری',           'boolean', false, 9),
  ('balkon',        'بالکن',            'boolean', false, 10)
) as f(key, label, ftype, req, ord) on true
where c.slug in ('kharid-forosh-khane-apartman', 'rahn-ejare-khane-apartman')
on conflict (category_id, key) do nothing;

-- فیلدهای اختصاصی نمونهٔ «ویلا»
insert into category_fields (category_id, key, label_fa, field_type, is_required, sort_order)
select c.id, f.key, f.label, f.ftype, f.req, f.ord
from categories c
join (values
  ('metraj_zamin', 'متراژ زمین',   'number',  true,  1),
  ('metraj_bana',  'متراژ بنا',    'number',  false, 2),
  ('khab',         'تعداد خواب',   'number',  false, 3),
  ('estakhr',      'استخر',       'boolean', false, 4),
  ('parking',      'پارکینگ',     'boolean', false, 5),
  ('hayat',        'حیاط',        'boolean', false, 6),
  ('sanad',        'سند',         'text',    false, 7)
) as f(key, label, ftype, req, ord) on true
where c.slug = 'kharid-forosh-vila'
on conflict (category_id, key) do nothing;

-- فیلدهای اختصاصی نمونهٔ «زمین» (شامل یک فیلد select با گزینه‌ها طبق بخش ۵ پرامپت)
insert into category_fields (category_id, key, label_fa, field_type, is_required, sort_order)
select c.id, f.key, f.label, f.ftype, f.req, f.ord
from categories c
join (values
  ('metraj',        'متراژ',          'number', true,  1),
  ('noe_karbari',   'نوع کاربری',      'select', false, 2),
  ('sanad',         'سند',            'text',   false, 3),
  ('arz_zamin',     'عرض زمین',        'number', false, 4),
  ('bar_khiaban',   'بر خیابان',       'boolean',false, 5)
) as f(key, label, ftype, req, ord) on true
where c.slug = 'zamin-bagh'
on conflict (category_id, key) do nothing;

insert into category_field_options (field_id, value, label_fa, sort_order)
select cf.id, o.value, o.label, o.ord
from category_fields cf
join categories c on c.id = cf.category_id
join (values
  ('residential', 'مسکونی',   1),
  ('commercial',  'تجاری',    2),
  ('agricultural','کشاورزی',  3),
  ('industrial',  'صنعتی',    4),
  ('other',       'سایر',     5)
) as o(value, label, ord) on true
where c.slug = 'zamin-bagh' and cf.key = 'noe_karbari'
on conflict (field_id, value) do nothing;

-- فیلدهای اختصاصی نمونهٔ «اداری/تجاری/صنعتی» (مغازه و مشابه)
insert into category_fields (category_id, key, label_fa, field_type, is_required, sort_order)
select c.id, f.key, f.label, f.ftype, f.req, f.ord
from categories c
join (values
  ('metraj',      'متراژ',      'number',  true,  1),
  ('arz_melk',    'عرض ملک',    'number',  false, 2),
  ('ertefa',      'ارتفاع',     'number',  false, 3),
  ('bar_khiaban', 'بر خیابان',  'boolean', false, 4),
  ('parking',     'پارکینگ',   'boolean', false, 5)
) as f(key, label, ftype, req, ord) on true
where c.slug = 'kharid-forosh-edari-tejari-sanati'
on conflict (category_id, key) do nothing;
