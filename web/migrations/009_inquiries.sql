-- فاز ۵ لوکیشن ساری: زیرساخت تماس/درخواست بازدید (بخش «Contact / Inquiry foundation»)
-- عمداً ساده نگه داشته شده: نه یک سیستم CRM/چت کامل، فقط ثبت درخواست بازدیدکننده روی یک آگهی
-- که صاحب آگهی می‌تواند در حساب کاربری خودش ببیند. Notification/پاسخ خودکار در فازهای بعدی است.

create table if not exists advertisement_inquiries (
  id serial primary key,
  advertisement_id int not null references advertisements(id) on delete cascade,
  user_id int references users(id) on delete set null, -- null یعنی بازدیدکنندهٔ مهمان
  type varchar(20) not null check (type in ('contact', 'viewing_request')),
  name varchar(120) not null,
  phone varchar(20) not null,
  message text,
  preferred_date date,
  status varchar(20) not null default 'new' check (status in ('new', 'read')),
  created_at timestamptz not null default now()
);

create index if not exists idx_inquiries_advertisement on advertisement_inquiries(advertisement_id);
create index if not exists idx_inquiries_user on advertisement_inquiries(user_id);
create index if not exists idx_inquiries_created_at on advertisement_inquiries(created_at);
