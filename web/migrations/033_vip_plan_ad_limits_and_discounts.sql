alter table vip_plans
  add column if not exists ad_limit int not null default 1 check (ad_limit > 0),
  add column if not exists discount_percent numeric(5,2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100);

alter table vip_subscriptions
  add column if not exists agency_id int references agencies(id) on delete set null,
  add column if not exists ad_limit int not null default 1 check (ad_limit > 0);

create index if not exists idx_vip_subscriptions_agency_status on vip_subscriptions(agency_id, status);