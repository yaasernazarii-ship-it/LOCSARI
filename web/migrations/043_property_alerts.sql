create table if not exists property_alerts (
  id bigserial primary key,
  phone varchar(20) not null,
  query_text text not null,
  deal_type varchar(30),
  property_type varchar(30),
  neighborhood_id int references neighborhoods(id) on delete set null,
  min_price numeric,
  max_price numeric,
  min_area numeric,
  max_area numeric,
  is_active boolean not null default true,
  last_notified_advertisement_id int references advertisements(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_property_alerts_active on property_alerts(is_active, neighborhood_id);
create index if not exists idx_property_alerts_phone on property_alerts(phone);

create table if not exists property_alert_deliveries (
  id bigserial primary key,
  property_alert_id bigint not null references property_alerts(id) on delete cascade,
  advertisement_id int not null references advertisements(id) on delete cascade,
  status varchar(20) not null check (status in ('sent', 'failed', 'skipped')),
  error_message text,
  created_at timestamptz not null default now(),
  unique(property_alert_id, advertisement_id)
);
