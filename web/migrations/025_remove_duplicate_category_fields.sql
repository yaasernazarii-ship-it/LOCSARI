-- رفع تکرار معیارها در فرم ثبت آگهی: چند فیلد اختصاصیِ دسته‌بندی (Seed اولیه) دقیقاً همان
-- فیلدهای پایهٔ ملک (area/built_area/land_area/bedrooms/built_year/floor/total_floors/total_units)
-- را دوباره از کاربر می‌پرسیدند. مقدار موجود (اگر ثبت شده) به ستون پایه منتقل و خودِ فیلد حذف می‌شود
-- (حذف با cascade مقادیر property_attributes/requirement_attributes مرتبط را هم پاک می‌کند).

-- خانه/آپارتمان (خرید-فروش و رهن-اجاره)
update properties p
set area = pa.value_number
from property_attributes pa
join category_fields cf on cf.id = pa.field_id
join categories c on c.id = cf.category_id
where pa.property_id = p.id and c.slug in ('kharid-forosh-khane-apartman', 'rahn-ejare-khane-apartman')
  and cf.key = 'metraj' and p.area is null and pa.value_number is not null;

update properties p
set bedrooms = pa.value_number::smallint
from property_attributes pa
join category_fields cf on cf.id = pa.field_id
join categories c on c.id = cf.category_id
where pa.property_id = p.id and c.slug in ('kharid-forosh-khane-apartman', 'rahn-ejare-khane-apartman', 'kharid-forosh-vila')
  and cf.key = 'khab' and p.bedrooms is null and pa.value_number is not null;

update properties p
set built_year = pa.value_number::smallint
from property_attributes pa
join category_fields cf on cf.id = pa.field_id
join categories c on c.id = cf.category_id
where pa.property_id = p.id and c.slug in ('kharid-forosh-khane-apartman', 'rahn-ejare-khane-apartman')
  and cf.key = 'sale_sakht' and p.built_year is null and pa.value_number is not null;

update properties p
set floor = pa.value_number::smallint
from property_attributes pa
join category_fields cf on cf.id = pa.field_id
join categories c on c.id = cf.category_id
where pa.property_id = p.id and c.slug in ('kharid-forosh-khane-apartman', 'rahn-ejare-khane-apartman')
  and cf.key = 'tabaghe' and p.floor is null and pa.value_number is not null;

update properties p
set total_floors = pa.value_number::smallint
from property_attributes pa
join category_fields cf on cf.id = pa.field_id
join categories c on c.id = cf.category_id
where pa.property_id = p.id and c.slug in ('kharid-forosh-khane-apartman', 'rahn-ejare-khane-apartman')
  and cf.key = 'tedad_tabaghat' and p.total_floors is null and pa.value_number is not null;

update properties p
set total_units = pa.value_number::smallint
from property_attributes pa
join category_fields cf on cf.id = pa.field_id
join categories c on c.id = cf.category_id
where pa.property_id = p.id and c.slug in ('kharid-forosh-khane-apartman', 'rahn-ejare-khane-apartman')
  and cf.key = 'tedad_vahed' and p.total_units is null and pa.value_number is not null;

-- ویلا
update properties p
set land_area = pa.value_number
from property_attributes pa
join category_fields cf on cf.id = pa.field_id
join categories c on c.id = cf.category_id
where pa.property_id = p.id and c.slug = 'kharid-forosh-vila'
  and cf.key = 'metraj_zamin' and p.land_area is null and pa.value_number is not null;

update properties p
set built_area = pa.value_number
from property_attributes pa
join category_fields cf on cf.id = pa.field_id
join categories c on c.id = cf.category_id
where pa.property_id = p.id and c.slug = 'kharid-forosh-vila'
  and cf.key = 'metraj_bana' and p.built_area is null and pa.value_number is not null;

-- زمین/باغ و اداری-تجاری-صنعتی: متراژ کلی
update properties p
set area = pa.value_number
from property_attributes pa
join category_fields cf on cf.id = pa.field_id
join categories c on c.id = cf.category_id
where pa.property_id = p.id and c.slug in ('zamin-bagh', 'kharid-forosh-edari-tejari-sanati')
  and cf.key = 'metraj' and p.area is null and pa.value_number is not null;

-- حذف خودِ فیلدهای تکراری (cascade مقادیر مرتبط را پاک می‌کند)
delete from category_fields cf
using categories c
where cf.category_id = c.id
  and (
    (c.slug in ('kharid-forosh-khane-apartman', 'rahn-ejare-khane-apartman')
      and cf.key in ('metraj', 'khab', 'sale_sakht', 'tabaghe', 'tedad_tabaghat', 'tedad_vahed'))
    or (c.slug = 'kharid-forosh-vila' and cf.key in ('metraj_zamin', 'metraj_bana', 'khab'))
    or (c.slug in ('zamin-bagh', 'kharid-forosh-edari-tejari-sanati') and cf.key = 'metraj')
  );
