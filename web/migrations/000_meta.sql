-- جدول ردیابی Migrationهای اجراشده
create table if not exists schema_migrations (
  filename varchar(200) primary key,
  applied_at timestamptz not null default now()
);
