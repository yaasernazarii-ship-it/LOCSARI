insert into site_content_blocks (content_key, page_key, section_key, label_fa, value) values
  ('cip.intro_title', 'cip', 'intro', 'عنوان معرفی خدمات', 'معرفی خدمات CIP'),
  ('cip.intro_description', 'cip', 'intro', 'متن معرفی خدمات', 'نگاهی کوتاه به روند تولید ویدیوی اختصاصی برای معرفی حرفه‌ای ملک شما.')
on conflict (content_key) do nothing;
