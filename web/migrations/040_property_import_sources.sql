alter table advertisements add column if not exists source_id varchar(255);
alter table advertisements add column if not exists source_url text;
alter table advertisements add column if not exists source_contact_phone varchar(50);
create unique index if not exists idx_advertisements_source_id_unique on advertisements (source_id) where source_id is not null;
