-- فاز ۴: Search + Filters + Map Engine — Full Text Search و ایندکس‌های مرتبط با جستجو
-- توجه: migrationهای قبلی (000 تا 007) دست‌نخورده می‌مانند؛ این فایل فقط اضافه می‌کند.

-- ============ Full Text Search (بخش ۲۹ پرامپت) ============
-- ستون Generated (نه Trigger) از title+description آگهی — همیشه هم‌گام با داده، بدون منطق اضافه در اپ.
-- زبان 'simple' انتخاب شد چون دیکشنری فارسی built-in در PostgreSQL موجود نیست؛ tokenizer ساده
-- (بدون stemming) برای عنوان/توضیحات آگهی کافی و قابل‌پیش‌بینی است.
alter table advertisements add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored;

create index if not exists idx_advertisements_search_vector on advertisements using gin(search_vector);

-- ============ ایندکس‌های ستونی مرتبط با جستجو (بخش ۳۳ پرامپت) ============
-- advertisements: status/transaction_type/created_at/expires_at/property_id از فاز ۳ (006) از قبل موجودند.
create index if not exists idx_advertisements_price on advertisements(price);
create index if not exists idx_advertisements_deposit on advertisements(deposit);
create index if not exists idx_advertisements_monthly_rent on advertisements(monthly_rent);
create index if not exists idx_advertisements_published_at on advertisements(published_at);

-- properties: category_id/city_id/district_id/market_zone_id/neighborhood_id از فاز ۳ (006) از قبل موجودند.
create index if not exists idx_properties_area on properties(area);
create index if not exists idx_properties_bedrooms on properties(bedrooms);
create index if not exists idx_properties_built_year on properties(built_year);

-- ============ ایندکس‌های ترکیبی بر اساس الگوی واقعی Query جستجو (بخش ۳۳ پرامپت) ============
-- Query اصلی همیشه با status='published' شروع می‌شود و پیش‌فرض بر اساس published_at مرتب می‌شود؛
-- این دو ایندکس ترکیبی، رایج‌ترین دو مسیر Query (پیش‌فرض «جدیدترین» و فیلترشده با نوع معامله) را پوشش می‌دهند.
create index if not exists idx_advertisements_status_published_at on advertisements(status, published_at desc);
create index if not exists idx_advertisements_status_type_published_at on advertisements(status, transaction_type, published_at desc);
