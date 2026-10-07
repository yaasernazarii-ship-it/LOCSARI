-- فاز ۵.۱ لوکیشن ساری: صندوق درخواست تماس/بازدید («Contact & Viewing Request Inbox»)
-- توسعهٔ همان Entity ساخته‌شده در 009 (advertisement_inquiries) به‌جای ساخت یک سیستم موازی؛
-- مالک آگهی (owner_user_id) و وضعیت‌های کامل‌تر گردش‌کار اضافه می‌شود تا در فاز CRM آینده
-- بتواند به Lead/Customer/Visit متصل شود، بدون نیاز به هیچ Pipeline/Employee Assignment در همین فاز.

alter table advertisement_inquiries
  add column if not exists owner_user_id int references users(id) on delete cascade,
  add column if not exists preferred_time varchar(5),
  add column if not exists updated_at timestamptz not null default now();

update advertisement_inquiries ai
  set owner_user_id = ad.created_by_user_id
  from advertisements ad
  where ad.id = ai.advertisement_id and ai.owner_user_id is null;

alter table advertisement_inquiries
  alter column owner_user_id set not null;

update advertisement_inquiries set status = 'contacted' where status = 'read';

alter table advertisement_inquiries drop constraint if exists advertisement_inquiries_status_check;
alter table advertisement_inquiries
  add constraint advertisement_inquiries_status_check
  check (status in ('new', 'contacted', 'scheduled', 'completed', 'cancelled', 'closed'));

create index if not exists idx_inquiries_owner on advertisement_inquiries(owner_user_id);
