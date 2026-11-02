create table if not exists rate_limit_buckets (
  bucket_key varchar(255) primary key,
  count integer not null,
  reset_at timestamptz not null
);

create index if not exists rate_limit_buckets_reset_at_idx on rate_limit_buckets (reset_at);
