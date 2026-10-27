-- «۲۲بهمن» در فهرست بازبینی‌شدهٔ موقعیت‌های ساری است و نباید همراه مجموعهٔ قدیمی غیرفعال شود.

update neighborhoods
set is_active = true,
    sort_order = 1000
where id = 84
  and city_id = 1;
