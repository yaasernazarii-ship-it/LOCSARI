-- واگذاری پیگیری آگهی‌های VIP به مشاور (کارمند) مسئول + وضعیت و نتیجهٔ پیگیری
-- هر آگهی VIP حداکثر یک رکورد واگذاری دارد؛ ادمین مشاور را تعیین می‌کند و خود مشاور
-- در حساب کاربری‌اش وضعیت/نتیجهٔ پیگیری را گزارش می‌دهد.

create table if not exists vip_ad_assignments (
  id serial primary key,
  advertisement_id int not null unique references advertisements(id) on delete cascade,
  consultant_id int references consultants(id) on delete set null,
  status varchar(20) not null default 'pending'
    check (status in ('pending', 'in_progress', 'done', 'cancelled')),
  result_note text,
  assigned_by int references users(id),
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vip_ad_assignments_consultant on vip_ad_assignments(consultant_id);
create index if not exists idx_vip_ad_assignments_status on vip_ad_assignments(status);
