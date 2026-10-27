-- فهرست موقعیت‌های فرم ثبت آگهی باید فقط مجموعهٔ بازبینی‌شدهٔ ساری باشد.
-- موقعیت‌های قبلی حذف نمی‌شوند تا ارتباط آگهی‌ها، آژانس‌ها، هشدارها و CRM سالم بماند؛
-- فقط از فهرست انتخاب موقعیت‌های جدید پنهان می‌شوند.

update neighborhoods
set is_active = false
where city_id = 1
  and id between 1 and 84;

update neighborhoods
set is_active = true
where city_id = 1
  and id between 85 and 159;
