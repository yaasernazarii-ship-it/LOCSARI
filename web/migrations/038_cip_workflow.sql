-- گردش کار مستقل CIP: مجوز اختصاصی، مشاور مسئول و تنظیمات ویدیوی معرفی.
insert into permissions (key, description_fa) values
  ('cip.manage', 'مدیریت پلن‌ها، درخواست‌ها و انتشار آگهی‌های CIP')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
join permissions p on p.key = 'cip.manage'
where r.key in ('super_admin', 'system_admin')
on conflict do nothing;

alter table cip_requests
  add column if not exists assigned_consultant_id integer references consultants(id) on delete set null,
  add column if not exists assigned_at timestamptz null;

create index if not exists idx_cip_requests_assigned_consultant on cip_requests(assigned_consultant_id);

create table if not exists cip_page_settings (
  id integer primary key default 1,
  video_url text,
  updated_at timestamptz not null default now(),
  constraint cip_page_settings_singleton check (id = 1)
);

insert into cip_page_settings (id) values (1) on conflict (id) do nothing;
