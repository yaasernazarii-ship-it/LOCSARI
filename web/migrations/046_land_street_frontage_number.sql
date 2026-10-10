update category_fields
set field_type = 'number', updated_at = now()
where key = 'bar_khiaban'
  and category_id = (select id from categories where slug = 'zamin-bagh');
