-- تغییر دو فیلد دستهٔ «زمین و باغ»:
--   • «عرض زمین» (arz_zamin)      → برچسب «عرض خیابان» (عدد)
--   • «بر خیابان» (bar_khiaban)   → برچسب «بر زمین» و تبدیل از بله/خیر به عدد
-- هر دو اختیاری (خالی) می‌مانند تا کاربر فقط عدد وارد کند.
--
-- فقط برچسب و نوع عوض می‌شود؛ کلید داخلی (key) و شناسهٔ فیلد ثابت می‌مانند تا هیچ
-- آگهی، فیلتر یا گزارش موجودی به فیلد ناموجود اشاره نکند. مقادیر قدیمی حذف نمی‌شوند:
-- مقدار boolean قبلی در ستون value_boolean باقی می‌ماند و از مسیر عددی خوانده نمی‌شود.

update category_fields
set label_fa = 'عرض خیابان',
    field_type = 'number',
    is_required = false,
    updated_at = now()
where key = 'arz_zamin'
  and category_id = (select id from categories where slug = 'zamin-bagh');

update category_fields
set label_fa = 'بر زمین',
    field_type = 'number',
    is_required = false,
    updated_at = now()
where key = 'bar_khiaban'
  and category_id = (select id from categories where slug = 'zamin-bagh');
