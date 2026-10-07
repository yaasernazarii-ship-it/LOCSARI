alter table vip_subscriptions
  drop constraint if exists vip_subscriptions_status_check;

alter table vip_subscriptions
  add constraint vip_subscriptions_status_check
  check (status in ('awaiting_payment', 'pending', 'active', 'rejected', 'expired', 'cancelled'));

update vip_subscriptions
set status = 'awaiting_payment'
where status = 'pending'
  and starts_at is null;
