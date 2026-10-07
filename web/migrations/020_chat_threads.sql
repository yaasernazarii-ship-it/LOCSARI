-- فاز ۸: گفتگوی خصوصی خریدار/آگهی‌دهنده روی هر آگهی («Advertisement Private Chat»)
-- الزام: قبل از نمایش شماره تماس، بازدیدکننده باید حساب کاربری داشته باشد (ورود اجباری)
-- و علاوه بر درخواست تماس/بازدید (advertisement_inquiries)، امکان چت دوطرفه هم داشته باشد
-- که در پنل مدیریت هم قابل نظارت باشد (chat.view).

create table if not exists chat_threads (
  id serial primary key,
  advertisement_id int not null references advertisements(id) on delete cascade,
  buyer_user_id int not null references users(id) on delete cascade,
  seller_user_id int not null references users(id) on delete cascade,
  buyer_last_read_at timestamptz,
  seller_last_read_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (advertisement_id, buyer_user_id)
);

create index if not exists idx_chat_threads_buyer on chat_threads(buyer_user_id);
create index if not exists idx_chat_threads_seller on chat_threads(seller_user_id);
create index if not exists idx_chat_threads_advertisement on chat_threads(advertisement_id);

create table if not exists chat_messages (
  id serial primary key,
  thread_id int not null references chat_threads(id) on delete cascade,
  sender_user_id int not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_thread on chat_messages(thread_id, created_at);

-- مجوز نظارتی ادمین بر گفتگوها (فقط مشاهده — بدون ارسال پیام از طرف ادمین)
insert into permissions (key, description_fa) values
  ('chat.view', 'مشاهدهٔ گفتگوهای خصوصی آگهی‌ها (نظارتی)')
on conflict (key) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.key in ('super_admin', 'system_admin') and p.key = 'chat.view'
on conflict do nothing;
