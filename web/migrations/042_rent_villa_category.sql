insert into categories (name, slug, sort_order)
values ('رهن و اجاره ویلا', 'rahn-ejare-vila', 10)
on conflict (slug) do nothing;

insert into category_fields (category_id, key, label_fa, field_type, is_required, sort_order)
select c.id, f.key, f.label, f.ftype, f.req, f.ord
from categories c
cross join (values
  ('metraj_zamin', 'متراژ زمین', 'number', true, 1),
  ('metraj_bana', 'متراژ بنا', 'number', false, 2),
  ('khab', 'تعداد خواب', 'number', false, 3),
  ('estakhr', 'استخر', 'boolean', false, 4),
  ('parking', 'پارکینگ', 'boolean', false, 5),
  ('hayat', 'حیاط', 'boolean', false, 6),
  ('sanad', 'سند', 'text', false, 7)
) as f(key, label, ftype, req, ord)
where c.slug = 'rahn-ejare-vila'
on conflict (category_id, key) do nothing;
