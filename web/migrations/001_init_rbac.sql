-- فاز ۱ لوکیشن ساری: احراز هویت + کاربران + RBAC
-- توجه: این اسکیمای جدید مستقل از دیتابیس JSON فعلی است و آن را جایگزین نمی‌کند.

create table if not exists users (
  id serial primary key,
  name varchar(150) not null,
  phone varchar(15) unique not null,
  password_hash text not null,
  status varchar(20) not null default 'active', -- active | suspended
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roles (
  id serial primary key,
  key varchar(50) unique not null,
  title_fa varchar(100) not null,
  created_at timestamptz not null default now()
);

create table if not exists permissions (
  id serial primary key,
  key varchar(100) unique not null,
  description_fa varchar(200)
);

create table if not exists role_permissions (
  role_id int not null references roles(id) on delete cascade,
  permission_id int not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists user_roles (
  user_id int not null references users(id) on delete cascade,
  role_id int not null references roles(id) on delete cascade,
  primary key (user_id, role_id)
);

-- استثنای مستقیم روی کاربر؛ مستقل از نقش (طبق الزام: دسترسی‌ها فقط بر اساس Role نباشند)
create table if not exists user_permissions (
  user_id int not null references users(id) on delete cascade,
  permission_id int not null references permissions(id) on delete cascade,
  effect varchar(6) not null default 'allow', -- allow | deny
  primary key (user_id, permission_id)
);

create table if not exists refresh_tokens (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists idx_user_roles_user on user_roles(user_id);
create index if not exists idx_role_permissions_role on role_permissions(role_id);
create index if not exists idx_user_permissions_user on user_permissions(user_id);
create index if not exists idx_refresh_tokens_user on refresh_tokens(user_id);
