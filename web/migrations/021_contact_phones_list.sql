-- تبدیل شماره تماس سایت از دو ستون ثابت (phone1/phone2) به فهرست نامحدود شماره‌ها

alter table site_contact_info add column if not exists phones jsonb not null default '[]'::jsonb;

update site_contact_info
set phones = (
  select coalesce(jsonb_agg(p), '[]'::jsonb)
  from (values (phone1), (phone2)) as v(p)
  where v.p is not null and v.p <> ''
)
where id = 1 and phones = '[]'::jsonb;

alter table site_contact_info drop column if exists phone1;
alter table site_contact_info drop column if exists phone2;
