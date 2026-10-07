// اعتبارسنجی‌های مشترک برای API دسته‌بندی‌ها و مناطق جغرافیایی

// فقط حروف/اعداد لاتین کوچک و خط تیره — برای URL امن (چون Transliteration خودکار فارسی قابل‌اعتماد نیست،
// Admin خودش Slug را وارد می‌کند).
const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// برای key فیلدهای اختصاصی: مشابه Slug ولی با آندرلاین هم مجاز (نام متغیر-مانند)
const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

export function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 150 && SLUG_REGEX.test(value);
}

export function isValidFieldKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 80 && FIELD_KEY_REGEX.test(value);
}

export function parseId(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function parseOptionalId(raw: string | null): number | null | undefined {
  if (raw === null) return undefined; // پارامتر اصلاً ارسال نشده
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null; // null یعنی مقدار ارسال شده ولی نامعتبر است
}

export const FIELD_TYPES = ["text", "number", "boolean", "select", "multi_select", "date"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export function isValidFieldType(value: unknown): value is FieldType {
  return typeof value === "string" && (FIELD_TYPES as readonly string[]).includes(value);
}

export function isNonEmptyString(value: unknown, maxLen = 200): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLen;
}

// اعتبارسنجی‌های مشترک برای API ملک و آگهی (فاز ۳)

export const TRANSACTION_TYPES = ["sale", "rent", "mortgage_rent", "short_term_rent", "pre_sale", "partnership"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export function isValidTransactionType(value: unknown): value is TransactionType {
  return typeof value === "string" && (TRANSACTION_TYPES as readonly string[]).includes(value);
}

export const ADVERTISEMENT_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "expired",
  "sold",
  "rented",
  "archived",
] as const;
export type AdvertisementStatus = (typeof ADVERTISEMENT_STATUSES)[number];

export function isValidAdvertisementStatus(value: unknown): value is AdvertisementStatus {
  return typeof value === "string" && (ADVERTISEMENT_STATUSES as readonly string[]).includes(value);
}

export const LOCATION_PRECISIONS = ["exact", "approximate", "neighborhood_only"] as const;
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

export function isValidLocationPrecision(value: unknown): value is LocationPrecision {
  return typeof value === "string" && (LOCATION_PRECISIONS as readonly string[]).includes(value);
}

/** عدد صحیح یا اعشاری مثبت (برای مساحت/تعداد و...) — undefined یعنی مقدار ارسال نشده */
export function isValidPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** عدد صحیح یا اعشاری غیرمنفی (صفر مجاز) — برای فیلدهایی مثل زیربنا/متراژ زمین که ممکن است واقعاً صفر باشند */
export function isValidNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// اعتبارسنجی مبالغ تومانی با حداکثر دو رقم اعشار
export function isValidTomanAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 999_999_999_999_999 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-7
  );
}

// اعتبارسنجی‌های مشترک برای صندوق درخواست تماس/بازدید (فاز ۵.۱)

export const REQUEST_TYPES = ["contact", "viewing_request"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export function isValidRequestType(value: unknown): value is RequestType {
  return typeof value === "string" && (REQUEST_TYPES as readonly string[]).includes(value);
}

export const REQUEST_STATUSES = ["new", "contacted", "scheduled", "completed", "cancelled", "closed"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export function isValidRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === "string" && (REQUEST_STATUSES as readonly string[]).includes(value);
}

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
export function isValidTimeString(value: unknown): value is string {
  return typeof value === "string" && TIME_REGEX.test(value);
}

// اعتبارسنجی‌های مشترک برای Consultant + Agency (فاز ۶)

export const VERIFICATION_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export function isValidVerificationStatus(value: unknown): value is VerificationStatus {
  return typeof value === "string" && (VERIFICATION_STATUSES as readonly string[]).includes(value);
}

export const MEMBERSHIP_ROLES = ["owner", "manager", "consultant", "employee"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export function isValidMembershipRole(value: unknown): value is MembershipRole {
  return typeof value === "string" && (MEMBERSHIP_ROLES as readonly string[]).includes(value);
}

export const MEMBERSHIP_STATUSES = ["pending", "active", "suspended", "removed"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export function isValidMembershipStatus(value: unknown): value is MembershipStatus {
  return typeof value === "string" && (MEMBERSHIP_STATUSES as readonly string[]).includes(value);
}

// اعتبارسنجی‌های مشترک برای زیرساخت CRM (فاز ۷.۲)

export const LEAD_SOURCES = ["website", "phone", "referral", "social", "advertisement", "walk_in", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export function isValidLeadSource(value: unknown): value is LeadSource {
  return typeof value === "string" && (LEAD_SOURCES as readonly string[]).includes(value);
}

export const LEAD_STATUSES = ["new", "contacted", "qualified", "unqualified", "converted", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function isValidLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

export const CUSTOMER_STATUSES = ["active", "inactive", "blacklisted"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export function isValidCustomerStatus(value: unknown): value is CustomerStatus {
  return typeof value === "string" && (CUSTOMER_STATUSES as readonly string[]).includes(value);
}

export const REQUIREMENT_STATUSES = ["open", "matched", "closed", "cancelled"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export function isValidRequirementStatus(value: unknown): value is RequirementStatus {
  return typeof value === "string" && (REQUIREMENT_STATUSES as readonly string[]).includes(value);
}

// نوع معاملهٔ نیازمندی از همان TRANSACTION_TYPES ملک/آگهی بازاستفاده می‌شود (بدون تعریف موازی) — از isValidTransactionType بالا استفاده کنید.

export const FOLLOW_UP_TYPES = ["call", "message", "meeting", "email", "other"] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export function isValidFollowUpType(value: unknown): value is FollowUpType {
  return typeof value === "string" && (FOLLOW_UP_TYPES as readonly string[]).includes(value);
}

export const FOLLOW_UP_STATUSES = ["pending", "done", "cancelled"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export function isValidFollowUpStatus(value: unknown): value is FollowUpStatus {
  return typeof value === "string" && (FOLLOW_UP_STATUSES as readonly string[]).includes(value);
}

export const VISIT_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export function isValidVisitStatus(value: unknown): value is VisitStatus {
  return typeof value === "string" && (VISIT_STATUSES as readonly string[]).includes(value);
}

export const INTEREST_LEVELS = ["interested", "very_interested", "not_interested", "rejected"] as const;
export type InterestLevel = (typeof INTEREST_LEVELS)[number];

export function isValidInterestLevel(value: unknown): value is InterestLevel {
  return typeof value === "string" && (INTEREST_LEVELS as readonly string[]).includes(value);
}

export const TASK_STATUSES = ["pending", "in_progress", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export function isValidTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export function isValidTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && (TASK_PRIORITIES as readonly string[]).includes(value);
}

// اعتبارسنجی‌های مشترک برای پلن/اشتراک آگهی VIP

export const VIP_SUBSCRIPTION_STATUSES = ["awaiting_payment", "pending", "active", "rejected", "expired", "cancelled"] as const;
export type VipSubscriptionStatus = (typeof VIP_SUBSCRIPTION_STATUSES)[number];

export function isValidVipSubscriptionStatus(value: unknown): value is VipSubscriptionStatus {
  return typeof value === "string" && (VIP_SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

export function isValidPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** فقط http/https و طول معقول — بدون وابستگی به کتابخانهٔ خارجی */
export function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
