-- افزودن موقعیت مکانی دقیق (نشان) به اطلاعات تماس سایت، برای نمایش نقشهٔ آدرس در صفحهٔ «تماس با ما»

alter table site_contact_info add column if not exists latitude double precision;
alter table site_contact_info add column if not exists longitude double precision;
