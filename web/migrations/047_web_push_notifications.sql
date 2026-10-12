alter table property_alerts
  add column if not exists push_token uuid;

update property_alerts
set push_token = md5(random()::text || clock_timestamp()::text)::uuid
where push_token is null;

alter table property_alerts
  alter column push_token set not null;

create unique index if not exists idx_property_alerts_push_token
on property_alerts(push_token);

create table if not exists push_subscriptions (
  id bigserial primary key,
  property_alert_id bigint not null references property_alerts(id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists push_deliveries (
  id bigserial primary key,
  property_alert_id bigint not null references property_alerts(id) on delete cascade,
  advertisement_id int not null references advertisements(id) on delete cascade,
  push_subscription_id bigint references push_subscriptions(id) on delete set null,
  status varchar(20) not null check (status in ('sent', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz not null default now(),
  unique(property_alert_id, advertisement_id, push_subscription_id)
);
