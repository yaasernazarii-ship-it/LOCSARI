-- افزودن امکان نمایش ویدیوی آپارات: در صفحات محتوای سایت (site_pages، از جمله «درباره ما»)
-- و در صفحهٔ عمومی «آگهی‌های VIP»

alter table site_pages add column if not exists video_url text;

create table if not exists vip_page_settings (
  id integer primary key default 1,
  video_url text,
  updated_at timestamptz not null default now(),
  constraint vip_page_settings_singleton check (id = 1)
);

insert into vip_page_settings (id) values (1) on conflict (id) do nothing;
