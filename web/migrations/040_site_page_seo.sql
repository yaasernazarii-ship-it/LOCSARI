-- تنظیمات سئوی مستقل برای صفحات محتوایی
alter table site_pages add column if not exists seo_title varchar(200);
alter table site_pages add column if not exists seo_description varchar(320);
