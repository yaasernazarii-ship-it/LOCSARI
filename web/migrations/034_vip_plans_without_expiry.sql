alter table vip_plans
  alter column duration_days set default 1;

update vip_subscriptions
set ends_at = null
where status = 'active';

update advertisements
set vip_expires_at = null
where is_vip = true;
