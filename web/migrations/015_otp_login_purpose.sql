-- فاز ۱.۲ (تکمیلی): افزودن purpose جدید «login» — ورود/ثبت‌نام خودکار کاربر عادی فقط با پیامک

alter table otp_codes drop constraint if exists otp_codes_purpose_check;
alter table otp_codes add constraint otp_codes_purpose_check check (purpose in ('registration', 'password_reset', 'login'));
