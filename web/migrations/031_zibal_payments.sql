create table if not exists payment_orders (
  id serial primary key,
  subscription_id int not null unique references vip_subscriptions(id) on delete cascade,
  user_id int not null references users(id) on delete cascade,
  gateway varchar(32) not null default 'zibal',
  authority varchar(128) not null,
  amount_rial bigint not null check (amount_rial > 0),
  status varchar(16) not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  ref_id varchar(64),
  card_pan varchar(20),
  error_code varchar(64),
  callback_payload jsonb,
  verify_payload jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (gateway, authority)
);

create index if not exists idx_payment_orders_user on payment_orders(user_id);
create index if not exists idx_payment_orders_status on payment_orders(status);
