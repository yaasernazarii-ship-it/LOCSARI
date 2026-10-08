import { db } from "@/lib/db";

export const SITE_CONTENT_DEFAULTS = {
  "header.site_name": "لوکیشن ساری",
  "footer.description": "پلتفرم تخصصی املاک شهر ساری",
  "home.hero_title": "خرید، رهن و اجارهٔ ملک در ساری",
  "home.hero_description": "جستجوی سریع در آگهی‌های ثبت‌شدهٔ املاک شهر ساری — مستقیم از صاحب ملک، مشاوران و آژانس‌های معتبر.",
  "home.search_placeholder": "جستجو در عنوان آگهی، منطقه یا محله…",
  "home.latest_title": "جدیدترین آگهی‌ها",
  "home.cta_title": "می‌خواهید ملکتان را سریع بفروشید یا اجاره دهید؟",
  "home.cta_description": "ثبت آگهی رایگان است. کافی است ثبت‌نام کنید و مشخصات ملک را وارد کنید تا بعد از بررسی منتشر شود.",
  "vip.hero_title": "آگهی‌های VIP",
  "vip.hero_description": "آگهی‌های ویژه با اولویت نمایش، متعلق به کاربرانی که اشتراک VIP فعال تهیه کرده‌اند.",
  "vip.empty_message": "در حال حاضر آگهی VIP فعالی وجود ندارد.",
  "vip.cta_title": "می‌خواهید آگهی‌تان اینجا نمایش داده شود؟",
  "vip.cta_description": "با تهیهٔ اشتراک VIP، آگهی شما در این بخش با اولویت نمایش داده می‌شود.",
  "contact.intro": "برای مشاوره خرید، فروش، رهن یا اجاره ملک، از راه‌های زیر با تیم لوکیشن ساری در ارتباط باشید.",
  "cip.hero_title": "آگهی‌های CIP",
  "cip.hero_description": "آگهی‌هایی که برای آن‌ها ویدیوی اختصاصی و باکیفیت ساخته شده است. برای ملک خود هم می‌توانید سفارش ویدیو ثبت کنید.",
  "cip.intro_title": "معرفی خدمات CIP",
  "cip.intro_description": "نگاهی کوتاه به روند تولید ویدیوی اختصاصی برای معرفی حرفه‌ای ملک شما.",
  "cip.videos_title": "آگهی‌های دارای ویدیوی اختصاصی",
  "cip.empty_message": "هنوز ویدیوی CIP منتشرشده‌ای وجود ندارد.",
  "cip.plans_title": "پلن‌های تولید ویدیوی CIP",
  "cip.plans_description": "برای ملک خود ویدیوی حرفه‌ای سفارش دهید. پس از پرداخت، تیم ما برای هماهنگی تصویربرداری با شما تماس می‌گیرد.",
} as const;

export type SiteContentKey = keyof typeof SITE_CONTENT_DEFAULTS;
export type SiteContent = Record<string, string>;

export async function getSiteContent(): Promise<SiteContent> {
  const rows = await db
    .selectFrom("site_content_blocks")
    .select(["content_key", "value"])
    .execute();

  const content: SiteContent = { ...SITE_CONTENT_DEFAULTS };
  for (const row of rows) {
    if (row.value.trim()) content[row.content_key] = row.value;
  }
  return content;
}
