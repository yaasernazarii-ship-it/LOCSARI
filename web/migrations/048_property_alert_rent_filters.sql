alter table property_alerts
  add column if not exists min_deposit numeric,
  add column if not exists max_deposit numeric,
  add column if not exists min_monthly_rent numeric,
  add column if not exists max_monthly_rent numeric,
  add column if not exists bedrooms int;

create index if not exists idx_property_alerts_rent_match
on property_alerts(is_active, min_deposit, max_deposit, min_monthly_rent, max_monthly_rent);
