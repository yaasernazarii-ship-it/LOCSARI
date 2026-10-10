create table if not exists property_assistant_settings (
  id smallint primary key default 1 check (id = 1),
  name varchar(120) not null default 'دستیار نیازسنجی هوشمند شما',
  updated_at timestamptz not null default now()
);

insert into property_assistant_settings (id, name)
values (1, 'دستیار نیازسنجی هوشمند شما')
on conflict (id) do nothing;
