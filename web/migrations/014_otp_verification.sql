-- فاز ۱.۲: تأیید شماره موبایل با OTP (ثبت‌نام + بازیابی رمز عبور)

create table if not exists otp_codes (
  id serial primary key,
  phone varchar(15) not null,
  purpose varchar(20) not null, -- registration | password_reset
  code_hash text not null,      -- هرگز کد به‌صورت plaintext ذخیره نمی‌شود
  ip varchar(45),
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint otp_codes_purpose_check check (purpose in ('registration', 'password_reset'))
);

-- برای یافتن سریع آخرین چالش فعال یک شماره در یک purpose مشخص
create index if not exists idx_otp_codes_phone_purpose on otp_codes(phone, purpose);
-- برای پاک‌سازی/بررسی نرخ ارسال بر اساس زمان
create index if not exists idx_otp_codes_created_at on otp_codes(created_at);

-- برای invalidate کردن نشست‌های قدیمی بعد از بازیابی رمز عبور (در صورت امکان با معماری فعلی).
-- NULL یعنی هیچ محدودیتی روی نشست‌های قبلی وجود ندارد (کاربران فعلی تحت تأثیر قرار نمی‌گیرند).
alter table users add column if not exists password_changed_at timestamptz;
