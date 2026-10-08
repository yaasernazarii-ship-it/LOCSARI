create table if not exists scraper_import_logs (
  id bigserial primary key,
  source_id varchar(255),
  source_url text,
  status varchar(20) not null check (status in ('created', 'updated', 'duplicate', 'failed')),
  advertisement_id int references advertisements(id) on delete set null,
  property_id int references properties(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists idx_scraper_import_logs_created_at on scraper_import_logs(created_at);
create index if not exists idx_scraper_import_logs_source_id on scraper_import_logs(source_id);
create table if not exists scraper_runs (
  id bigserial primary key,
  bot_name varchar(120) not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  scanned_count int not null default 0,
  created_count int not null default 0,
  updated_count int not null default 0,
  duplicate_count int not null default 0,
  failed_count int not null default 0,
  error_message text
);
