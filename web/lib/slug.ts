// تولید Slug یکتا برای موجودیت‌هایی که کاربر عادی می‌سازد (Agency/Consultant، فاز ۶) و خودشان مثل
// دسته‌بندی‌ها Slug دستیِ Admin ندارند. چون Transliteration خودکار فارسی قابل‌اعتماد نیست (طبق یادداشت
// lib/validation.ts)، فقط کاراکترهای لاتین/عدد نام حفظ می‌شوند و همیشه با شناسهٔ عددیِ ردیف یکتا می‌شوند
// (دقیقاً همان الگوی slug آگهی در app/api/advertisements/route.ts).

const BASE_SLUG_REGEX = /[^a-z0-9]+/g;

export function baseSlugify(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(BASE_SLUG_REGEX, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || "entry";
}

export function buildUniqueSlug(name: string, prefix: string, id: number): string {
  return `${baseSlugify(name)}-${prefix}-${id}`;
}
