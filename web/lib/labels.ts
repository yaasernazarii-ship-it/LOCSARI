// برچسب‌های فارسی مشترک بین صفحات عمومی (جستجو، جزئیات آگهی) — تک‌منبع، بدون تکرار در کامپوننت‌ها

import { TransactionType } from "./validation";
import { SearchSort } from "./search/types";

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  sale: "فروش",
  rent: "رهن و اجاره",
  mortgage_rent: "رهن کامل",
  short_term_rent: "اجارهٔ کوتاه‌مدت",
  pre_sale: "پیش‌فروش",
  partnership: "مشارکت در ساخت",
};

export const RENT_BASED_TRANSACTION_TYPES: TransactionType[] = ["rent", "mortgage_rent", "short_term_rent"];

export const ADVERTISEMENT_STATUS_LABELS: Record<string, string> = {
  draft: "پیش‌نویس",
  pending_review: "در انتظار بررسی",
  published: "منتشرشده",
  rejected: "ردشده",
  expired: "منقضی‌شده",
  sold: "فروخته‌شده",
  rented: "اجاره داده‌شده",
  archived: "آرشیوشده",
};

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  contact: "درخواست تماس",
  viewing_request: "درخواست بازدید",
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  new: "جدید",
  contacted: "تماس گرفته شد",
  scheduled: "زمان‌بندی شد",
  completed: "انجام شد",
  cancelled: "لغو شد",
  closed: "بسته شد",
};

export const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  pending: "در انتظار بررسی",
  approved: "تأیید شده",
  rejected: "رد شده",
  suspended: "تعلیق شده",
};

export const MEMBERSHIP_ROLE_LABELS: Record<string, string> = {
  owner: "مالک آژانس",
  manager: "مدیر آژانس",
  consultant: "مشاور",
  employee: "کارمند",
};

export const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  pending: "در انتظار",
  active: "فعال",
  suspended: "تعلیق‌شده",
  removed: "حذف‌شده",
};

export const SORT_LABELS: Record<SearchSort, string> = {
  newest: "جدیدترین",
  oldest: "قدیمی‌ترین",
  price_asc: "قیمت: کم به زیاد",
  price_desc: "قیمت: زیاد به کم",
  area_asc: "متراژ: کم به زیاد",
  area_desc: "متراژ: زیاد به کم",
  relevance: "مرتبط‌ترین",
};

// برچسب‌های فارسی زیرساخت CRM (فاز ۷.۲)

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  website: "وبسایت",
  phone: "تماس تلفنی",
  referral: "معرفی",
  social: "شبکه اجتماعی",
  advertisement: "آگهی",
  walk_in: "مراجعه حضوری",
  other: "سایر",
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "جدید",
  contacted: "تماس گرفته شد",
  qualified: "واجدشرایط",
  unqualified: "فاقد شرایط",
  converted: "تبدیل به مشتری",
  lost: "ازدست‌رفته",
};

export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  active: "فعال",
  inactive: "غیرفعال",
  blacklisted: "لیست سیاه",
};

export const REQUIREMENT_STATUS_LABELS: Record<string, string> = {
  open: "باز",
  matched: "تطبیق‌یافته",
  closed: "بسته‌شده",
  cancelled: "لغوشده",
};

export const FOLLOW_UP_TYPE_LABELS: Record<string, string> = {
  call: "تماس تلفنی",
  message: "پیامک",
  meeting: "جلسه",
  email: "ایمیل",
  other: "سایر",
};

export const FOLLOW_UP_STATUS_LABELS: Record<string, string> = {
  pending: "در انتظار",
  done: "انجام‌شده",
  cancelled: "لغوشده",
};

export const VISIT_STATUS_LABELS: Record<string, string> = {
  scheduled: "زمان‌بندی‌شده",
  completed: "انجام‌شده",
  cancelled: "لغوشده",
  no_show: "عدم‌حضور",
};

export const INTEREST_LEVEL_LABELS: Record<string, string> = {
  interested: "علاقه‌مند",
  very_interested: "بسیار علاقه‌مند",
  not_interested: "بی‌علاقه",
  rejected: "ردشده",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "در انتظار",
  in_progress: "درحال‌انجام",
  done: "انجام‌شده",
  cancelled: "لغوشده",
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "کم",
  normal: "معمولی",
  high: "بالا",
  urgent: "فوری",
};

export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  buyer: "خریدار",
  seller: "فروشنده",
  tenant: "مستأجر",
  landlord: "موجر",
  investor: "سرمایه‌گذار",
  partnership: "مشارکت در ساخت",
  other: "سایر",
};

export const VIP_SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "در انتظار پرداخت",
  pending: "در انتظار بررسی",
  active: "فعال",
  rejected: "ردشده",
  expired: "منقضی‌شده",
  cancelled: "لغوشده",
};

export function formatToman(value: number | null): string {
  if (value === null) return "توافقی";
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(value) + " تومان";
}

export function formatPublicationDate(value: Date | string | null): string {
  if (!value) return "هنوز منتشر نشده";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

export function formatPriceLine(item: {
  transactionType: string;
  price: number | null;
  deposit: number | null;
  monthlyRent: number | null;
}): string {
  if (RENT_BASED_TRANSACTION_TYPES.includes(item.transactionType as TransactionType)) {
    const deposit = formatToman(item.deposit);
    if (item.transactionType === "mortgage_rent") return `رهن: ${deposit}`;
    const rent = item.monthlyRent !== null ? formatToman(item.monthlyRent) + " در ماه" : "توافقی";
    return `رهن ${deposit} / اجاره ${rent}`;
  }
  return formatToman(item.price);
}
