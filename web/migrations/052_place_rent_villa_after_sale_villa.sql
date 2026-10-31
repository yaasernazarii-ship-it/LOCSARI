-- «رهن و اجاره ویلا» باید بلافاصله بعد از «خرید و فروش ویلا» نمایش داده شود.
-- ترتیب سایر دسته‌های اصلی بدون تغییر حفظ می‌شود.

with target(slug, sort_order) as (
  values
    ('kharid-forosh-vila', 1),
    ('rahn-ejare-vila', 2),
    ('rahn-ejare-khane-apartman', 3),
    ('kharid-forosh-khane-apartman', 4),
    ('ejare-kutahmoddat-vila-suite', 5),
    ('rahn-ejare-edari-tejari-sanati', 6),
    ('kharid-forosh-edari-tejari-sanati', 7),
    ('zamin-bagh', 8),
    ('pishforosh-mosharekat-sakht', 9),
    ('saeer-amlak', 10)
)
update categories c
set sort_order = t.sort_order
from target t
where c.slug = t.slug;
