-- شناسهٔ عمومی، ثابت و یکتای هر آگهی برای ارجاع و جست‌وجو.
alter table advertisements
  add column if not exists public_code text generated always as ('LS-' || lpad(id::text, 8, '0')) stored;

create unique index if not exists idx_advertisements_public_code on advertisements(public_code);
