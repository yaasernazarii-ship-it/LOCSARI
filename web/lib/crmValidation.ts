// اعتبارسنجی متمرکز ورودی‌های CRM (بخش ۲۳ پرامپت فاز ۷.۳) — الگوی has/need دقیقاً مطابق propertyInput.ts فاز ۳.
// partial=true یعنی PATCH: فقط فیلدهای واقعاً موجود در body بررسی و در خروجی برگردانده می‌شوند.

import { DbOrTx } from "./propertyAttributes";
import { db } from "./db";
import { isValidIranianPhone } from "./auth";
import {
  isNonEmptyString,
  isValidNonNegativeInteger,
  isValidTomanAmount,
  isValidTransactionType,
  isValidLeadSource,
  isValidLeadStatus,
  isValidCustomerStatus,
  isValidRequirementStatus,
  isValidFollowUpType,
  isValidFollowUpStatus,
  isValidVisitStatus,
  isValidInterestLevel,
  isValidTaskStatus,
  isValidTaskPriority,
} from "./validation";

const ALLOWED_CITY_SLUG = "sari";

type ValidationResult<T> = { ok: true; data: Partial<T> } | { ok: false; error: string };

function makeHelpers(body: Record<string, unknown>, partial: boolean) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const need = (key: string) => !partial || has(key);
  return { has, need };
}

async function optionalUserId(dbOrTx: DbOrTx, raw: unknown): Promise<{ ok: true; value: number | null } | { ok: false; error: string }> {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "شناسهٔ کاربر واگذارشونده نامعتبر است" };
  const user = await dbOrTx.selectFrom("users").select("id").where("id", "=", id).executeTakeFirst();
  if (!user) return { ok: false, error: "کاربر واگذارشونده یافت نشد" };
  return { ok: true, value: id };
}

async function optionalAgencyId(dbOrTx: DbOrTx, raw: unknown): Promise<{ ok: true; value: number | null } | { ok: false; error: string }> {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "شناسهٔ آژانس نامعتبر است" };
  const agency = await dbOrTx.selectFrom("agencies").select("id").where("id", "=", id).executeTakeFirst();
  if (!agency) return { ok: false, error: "آژانس یافت نشد" };
  return { ok: true, value: id };
}

// ============ Lead ============

export interface LeadFields {
  name: string;
  mobile: string;
  source: string;
  status: string;
  agencyId: number | null;
  assignedToUserId: number | null;
  notes: string | null;
}

export async function validateLeadInput(body: Record<string, unknown>, opts: { partial: boolean }, dbOrTx: DbOrTx = db): Promise<ValidationResult<LeadFields>> {
  const { has, need } = makeHelpers(body, opts.partial);
  const data: Partial<LeadFields> = {};

  if (need("name")) {
    if (!isNonEmptyString(body.name, 150)) return { ok: false, error: "name نامعتبر است" };
    data.name = (body.name as string).trim();
  }
  if (need("mobile")) {
    if (typeof body.mobile !== "string" || !isValidIranianPhone(body.mobile)) return { ok: false, error: "mobile نامعتبر است" };
    data.mobile = body.mobile;
  }
  if (has("source")) {
    if (!isValidLeadSource(body.source)) return { ok: false, error: "source نامعتبر است" };
    data.source = body.source;
  }
  if (has("status")) {
    if (!isValidLeadStatus(body.status)) return { ok: false, error: "status نامعتبر است" };
    data.status = body.status;
  }
  if (has("agencyId")) {
    const r = await optionalAgencyId(dbOrTx, body.agencyId);
    if (!r.ok) return r;
    data.agencyId = r.value;
  }
  if (has("assignedToUserId")) {
    const r = await optionalUserId(dbOrTx, body.assignedToUserId);
    if (!r.ok) return r;
    data.assignedToUserId = r.value;
  }
  if (has("notes")) {
    data.notes = typeof body.notes === "string" ? body.notes : null;
  }

  return { ok: true, data };
}

// ============ Customer ============

export interface CustomerFields {
  name: string;
  mobile: string;
  email: string | null;
  nationalId: string | null;
  userId: number | null;
  agencyId: number | null;
  assignedToUserId: number | null;
  status: string;
  notes: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function validateCustomerInput(
  body: Record<string, unknown>,
  opts: { partial: boolean },
  dbOrTx: DbOrTx = db
): Promise<ValidationResult<CustomerFields>> {
  const { has, need } = makeHelpers(body, opts.partial);
  const data: Partial<CustomerFields> = {};

  if (need("name")) {
    if (!isNonEmptyString(body.name, 150)) return { ok: false, error: "name نامعتبر است" };
    data.name = (body.name as string).trim();
  }
  if (need("mobile")) {
    if (typeof body.mobile !== "string" || !isValidIranianPhone(body.mobile)) return { ok: false, error: "mobile نامعتبر است" };
    data.mobile = body.mobile;
  }
  if (has("email")) {
    if (body.email === null) data.email = null;
    else {
      if (typeof body.email !== "string" || !EMAIL_REGEX.test(body.email) || body.email.length > 150)
        return { ok: false, error: "email نامعتبر است" };
      data.email = body.email;
    }
  }
  if (has("nationalId")) {
    if (body.nationalId === null) data.nationalId = null;
    else {
      if (typeof body.nationalId !== "string" || !/^\d{8,10}$/.test(body.nationalId)) return { ok: false, error: "nationalId نامعتبر است" };
      data.nationalId = body.nationalId;
    }
  }
  if (has("userId")) {
    const r = await optionalUserId(dbOrTx, body.userId);
    if (!r.ok) return r;
    data.userId = r.value;
  }
  if (has("agencyId")) {
    const r = await optionalAgencyId(dbOrTx, body.agencyId);
    if (!r.ok) return r;
    data.agencyId = r.value;
  }
  if (has("assignedToUserId")) {
    const r = await optionalUserId(dbOrTx, body.assignedToUserId);
    if (!r.ok) return r;
    data.assignedToUserId = r.value;
  }
  if (has("status")) {
    if (!isValidCustomerStatus(body.status)) return { ok: false, error: "status نامعتبر است" };
    data.status = body.status;
  }
  if (has("notes")) {
    data.notes = typeof body.notes === "string" ? body.notes : null;
  }

  return { ok: true, data };
}

/** اعتبارسنجی typeIds ارسالی برای اتصال Customer به چند Customer Type (بخش ۶ و ۹) */
export async function validateCustomerTypeIds(dbOrTx: DbOrTx, raw: unknown): Promise<{ ok: true; ids: number[] } | { ok: false; error: string }> {
  if (!Array.isArray(raw)) return { ok: false, error: "typeIds باید آرایه باشد" };
  const ids = raw.map((v) => Number(v));
  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "typeIds نامعتبر است" };
  }
  if (ids.length === 0) return { ok: true, ids: [] };
  const rows = await dbOrTx.selectFrom("customer_types").select("id").where("id", "in", ids).where("is_active", "=", true).execute();
  if (rows.length !== new Set(ids).size) return { ok: false, error: "برخی از typeId ها معتبر یا فعال نیستند" };
  return { ok: true, ids: Array.from(new Set(ids)) };
}

// ============ Customer Requirement ============
// priority از همان مقادیر Task (low/normal/high/urgent) بازاستفاده می‌شود — بدون تعریف Enum موازی.

export interface RequirementFields {
  categoryId: number;
  transactionType: string;
  minPrice: number | null;
  maxPrice: number | null;
  minDeposit: number | null;
  maxDeposit: number | null;
  minMonthlyRent: number | null;
  maxMonthlyRent: number | null;
  minArea: number | null;
  maxArea: number | null;
  bedrooms: number | null;
  status: string;
  priority: string;
  notes: string | null;
  assignedToUserId: number | null;
}

function optionalMoney(raw: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (!isValidTomanAmount(raw)) return { ok: false, error: "مبلغ نامعتبر است" };
  return { ok: true, value: raw as number };
}

export async function validateRequirementInput(
  body: Record<string, unknown>,
  opts: { partial: boolean },
  dbOrTx: DbOrTx = db
): Promise<ValidationResult<RequirementFields>> {
  const { has, need } = makeHelpers(body, opts.partial);
  const data: Partial<RequirementFields> = {};

  if (need("categoryId")) {
    const categoryId = Number(body.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) return { ok: false, error: "categoryId نامعتبر است" };
    const category = await dbOrTx.selectFrom("categories").select(["id", "is_active"]).where("id", "=", categoryId).executeTakeFirst();
    if (!category) return { ok: false, error: "دسته‌بندی یافت نشد" };
    if (!category.is_active) return { ok: false, error: "دسته‌بندی غیرفعال است" };
    data.categoryId = categoryId;
  }
  if (need("transactionType")) {
    if (!isValidTransactionType(body.transactionType)) return { ok: false, error: "transactionType نامعتبر است" };
    data.transactionType = body.transactionType;
  }
  for (const key of ["minPrice", "maxPrice", "minDeposit", "maxDeposit", "minMonthlyRent", "maxMonthlyRent"] as const) {
    if (has(key)) {
      const r = optionalMoney(body[key]);
      if (!r.ok) return r;
      data[key] = r.value;
    }
  }
  if (data.minPrice != null && data.maxPrice != null && data.minPrice > data.maxPrice) return { ok: false, error: "minPrice نباید از maxPrice بیشتر باشد" };
  if (data.minDeposit != null && data.maxDeposit != null && data.minDeposit > data.maxDeposit) return { ok: false, error: "minDeposit نباید از maxDeposit بیشتر باشد" };
  if (data.minMonthlyRent != null && data.maxMonthlyRent != null && data.minMonthlyRent > data.maxMonthlyRent)
    return { ok: false, error: "minMonthlyRent نباید از maxMonthlyRent بیشتر باشد" };

  if (has("minArea")) {
    if (body.minArea !== null && (typeof body.minArea !== "number" || body.minArea < 0)) return { ok: false, error: "minArea نامعتبر است" };
    data.minArea = (body.minArea as number | null) ?? null;
  }
  if (has("maxArea")) {
    if (body.maxArea !== null && (typeof body.maxArea !== "number" || body.maxArea < 0)) return { ok: false, error: "maxArea نامعتبر است" };
    data.maxArea = (body.maxArea as number | null) ?? null;
  }
  if (data.minArea != null && data.maxArea != null && data.minArea > data.maxArea) return { ok: false, error: "minArea نباید از maxArea بیشتر باشد" };

  if (has("bedrooms")) {
    if (body.bedrooms !== null && !isValidNonNegativeInteger(body.bedrooms)) return { ok: false, error: "bedrooms نامعتبر است" };
    data.bedrooms = (body.bedrooms as number | null) ?? null;
  }
  if (has("status")) {
    if (!isValidRequirementStatus(body.status)) return { ok: false, error: "status نامعتبر است" };
    data.status = body.status;
  }
  if (has("priority")) {
    if (!isValidTaskPriority(body.priority)) return { ok: false, error: "priority نامعتبر است" };
    data.priority = body.priority;
  }
  if (has("notes")) {
    data.notes = typeof body.notes === "string" ? body.notes : null;
  }
  if (has("assignedToUserId")) {
    const r = await optionalUserId(dbOrTx, body.assignedToUserId);
    if (!r.ok) return r;
    data.assignedToUserId = r.value;
  }

  return { ok: true, data };
}

// ============ Requirement Location (بخش ۸: زنجیرهٔ تعلق مکانی + محدودیت شهر ساری، مطابق propertyInput.ts) ============

export interface RequirementLocationFields {
  cityId: number;
  districtId: number | null;
  marketZoneId: number | null;
  neighborhoodId: number | null;
}

export async function validateRequirementLocationInput(body: Record<string, unknown>, dbOrTx: DbOrTx = db): Promise<ValidationResult<RequirementLocationFields> | { ok: true; data: RequirementLocationFields }> {
  const cityId = Number(body.cityId);
  if (!Number.isInteger(cityId) || cityId <= 0) return { ok: false, error: "cityId نامعتبر است" };
  const city = await dbOrTx.selectFrom("cities").select(["id", "slug", "is_active"]).where("id", "=", cityId).executeTakeFirst();
  if (!city || !city.is_active) return { ok: false, error: "شهر یافت نشد یا غیرفعال است" };
  if (city.slug !== ALLOWED_CITY_SLUG) return { ok: false, error: "LocationSari فعلاً فقط برای شهر ساری فعال است" };

  let districtId: number | null = null;
  if (body.districtId !== undefined && body.districtId !== null) {
    districtId = Number(body.districtId);
    if (!Number.isInteger(districtId) || districtId <= 0) return { ok: false, error: "districtId نامعتبر است" };
    const d = await dbOrTx.selectFrom("districts").select(["id", "city_id", "is_active"]).where("id", "=", districtId).executeTakeFirst();
    if (!d || !d.is_active) return { ok: false, error: "منطقهٔ رسمی یافت نشد یا غیرفعال است" };
    if (d.city_id !== cityId) return { ok: false, error: "منطقه متعلق به این شهر نیست" };
  }

  let marketZoneId: number | null = null;
  if (body.marketZoneId !== undefined && body.marketZoneId !== null) {
    marketZoneId = Number(body.marketZoneId);
    if (!Number.isInteger(marketZoneId) || marketZoneId <= 0) return { ok: false, error: "marketZoneId نامعتبر است" };
    const mz = await dbOrTx.selectFrom("market_zones").select(["id", "city_id", "is_active"]).where("id", "=", marketZoneId).executeTakeFirst();
    if (!mz || !mz.is_active) return { ok: false, error: "منطقهٔ عرفی یافت نشد یا غیرفعال است" };
    if (mz.city_id !== cityId) return { ok: false, error: "منطقهٔ عرفی متعلق به این شهر نیست" };
  }

  let neighborhoodId: number | null = null;
  if (body.neighborhoodId !== undefined && body.neighborhoodId !== null) {
    neighborhoodId = Number(body.neighborhoodId);
    if (!Number.isInteger(neighborhoodId) || neighborhoodId <= 0) return { ok: false, error: "neighborhoodId نامعتبر است" };
    const n = await dbOrTx.selectFrom("neighborhoods").select(["id", "city_id", "is_active"]).where("id", "=", neighborhoodId).executeTakeFirst();
    if (!n || !n.is_active) return { ok: false, error: "محله یافت نشد یا غیرفعال است" };
    if (n.city_id !== cityId) return { ok: false, error: "محله متعلق به این شهر نیست" };
  }

  return { ok: true, data: { cityId, districtId, marketZoneId, neighborhoodId } };
}

// ============ Follow-up ============

export interface FollowUpFields {
  leadId: number | null;
  customerId: number | null;
  type: string;
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  notes: string | null;
  assignedToUserId: number | null;
}

function isValidIsoDate(v: unknown): v is string {
  return typeof v === "string" && !Number.isNaN(Date.parse(v));
}

export async function validateFollowUpInput(
  body: Record<string, unknown>,
  opts: { partial: boolean },
  dbOrTx: DbOrTx = db
): Promise<ValidationResult<FollowUpFields>> {
  const { has, need } = makeHelpers(body, opts.partial);
  const data: Partial<FollowUpFields> = {};

  if (!opts.partial) {
    const hasLead = body.leadId !== undefined && body.leadId !== null;
    const hasCustomer = body.customerId !== undefined && body.customerId !== null;
    if (hasLead === hasCustomer) return { ok: false, error: "دقیقاً یکی از leadId یا customerId باید مقداردهی شود" };
  }
  if (has("leadId")) {
    if (body.leadId === null) data.leadId = null;
    else {
      const leadId = Number(body.leadId);
      if (!Number.isInteger(leadId) || leadId <= 0) return { ok: false, error: "leadId نامعتبر است" };
      const lead = await dbOrTx.selectFrom("leads").select("id").where("id", "=", leadId).executeTakeFirst();
      if (!lead) return { ok: false, error: "سرنخ یافت نشد" };
      data.leadId = leadId;
    }
  }
  if (has("customerId")) {
    if (body.customerId === null) data.customerId = null;
    else {
      const customerId = Number(body.customerId);
      if (!Number.isInteger(customerId) || customerId <= 0) return { ok: false, error: "customerId نامعتبر است" };
      const customer = await dbOrTx.selectFrom("customers").select("id").where("id", "=", customerId).executeTakeFirst();
      if (!customer) return { ok: false, error: "مشتری یافت نشد" };
      data.customerId = customerId;
    }
  }
  if (has("type")) {
    if (!isValidFollowUpType(body.type)) return { ok: false, error: "type نامعتبر است" };
    data.type = body.type;
  }
  if (has("status")) {
    if (!isValidFollowUpStatus(body.status)) return { ok: false, error: "status نامعتبر است" };
    data.status = body.status;
  }
  if (has("scheduledAt")) {
    if (body.scheduledAt !== null && !isValidIsoDate(body.scheduledAt)) return { ok: false, error: "scheduledAt نامعتبر است" };
    data.scheduledAt = (body.scheduledAt as string | null) ?? null;
  }
  if (has("completedAt")) {
    if (body.completedAt !== null && !isValidIsoDate(body.completedAt)) return { ok: false, error: "completedAt نامعتبر است" };
    data.completedAt = (body.completedAt as string | null) ?? null;
  }
  if (has("notes")) data.notes = typeof body.notes === "string" ? body.notes : null;
  if (has("assignedToUserId")) {
    const r = await optionalUserId(dbOrTx, body.assignedToUserId);
    if (!r.ok) return r;
    data.assignedToUserId = r.value;
  }

  return { ok: true, data };
}

// ============ Visit ============

export interface VisitFields {
  customerId: number;
  advertisementId: number;
  requirementId: number | null;
  assignedToUserId: number | null;
  status: string;
  scheduledAt: string;
  feedback: string | null;
}

export async function validateVisitInput(body: Record<string, unknown>, opts: { partial: boolean }, dbOrTx: DbOrTx = db): Promise<ValidationResult<VisitFields>> {
  const { has, need } = makeHelpers(body, opts.partial);
  const data: Partial<VisitFields> = {};

  if (need("customerId")) {
    const customerId = Number(body.customerId);
    if (!Number.isInteger(customerId) || customerId <= 0) return { ok: false, error: "customerId نامعتبر است" };
    const customer = await dbOrTx.selectFrom("customers").select(["id", "agency_id"]).where("id", "=", customerId).executeTakeFirst();
    if (!customer) return { ok: false, error: "مشتری یافت نشد" };
    data.customerId = customerId;
  }
  if (need("advertisementId")) {
    const advertisementId = Number(body.advertisementId);
    if (!Number.isInteger(advertisementId) || advertisementId <= 0) return { ok: false, error: "advertisementId نامعتبر است" };
    const ad = await dbOrTx.selectFrom("advertisements").select("id").where("id", "=", advertisementId).executeTakeFirst();
    if (!ad) return { ok: false, error: "آگهی یافت نشد" };
    data.advertisementId = advertisementId;
  }
  if (has("requirementId")) {
    if (body.requirementId === null) data.requirementId = null;
    else {
      const requirementId = Number(body.requirementId);
      if (!Number.isInteger(requirementId) || requirementId <= 0) return { ok: false, error: "requirementId نامعتبر است" };
      const effectiveCustomerId = data.customerId;
      const req = await dbOrTx.selectFrom("customer_requirements").select(["id", "customer_id"]).where("id", "=", requirementId).executeTakeFirst();
      if (!req) return { ok: false, error: "نیازمندی یافت نشد" };
      if (effectiveCustomerId && req.customer_id !== effectiveCustomerId) return { ok: false, error: "نیازمندی متعلق به این مشتری نیست" };
      data.requirementId = requirementId;
    }
  }
  if (has("assignedToUserId")) {
    const r = await optionalUserId(dbOrTx, body.assignedToUserId);
    if (!r.ok) return r;
    data.assignedToUserId = r.value;
  }
  if (has("status")) {
    if (!isValidVisitStatus(body.status)) return { ok: false, error: "status نامعتبر است" };
    data.status = body.status;
  }
  if (need("scheduledAt")) {
    if (!isValidIsoDate(body.scheduledAt)) return { ok: false, error: "scheduledAt نامعتبر است" };
    data.scheduledAt = body.scheduledAt as string;
  }
  if (has("feedback")) {
    data.feedback = typeof body.feedback === "string" ? body.feedback : null;
  }

  return { ok: true, data };
}

// ============ Customer Property Interest ============

export interface InterestFields {
  advertisementId: number;
  interestLevel: string;
  notes: string | null;
}

export async function validateInterestInput(body: Record<string, unknown>, dbOrTx: DbOrTx = db): Promise<ValidationResult<InterestFields> | { ok: true; data: InterestFields }> {
  const advertisementId = Number(body.advertisementId);
  if (!Number.isInteger(advertisementId) || advertisementId <= 0) return { ok: false, error: "advertisementId نامعتبر است" };
  const ad = await dbOrTx.selectFrom("advertisements").select("id").where("id", "=", advertisementId).executeTakeFirst();
  if (!ad) return { ok: false, error: "آگهی یافت نشد" };

  let interestLevel = "interested";
  if (body.interestLevel !== undefined) {
    if (!isValidInterestLevel(body.interestLevel)) return { ok: false, error: "interestLevel نامعتبر است" };
    interestLevel = body.interestLevel;
  }
  const notes = typeof body.notes === "string" ? body.notes : null;
  return { ok: true, data: { advertisementId, interestLevel, notes } };
}

// ============ Task ============

const TASK_RELATED_TABLES: Record<string, "leads" | "customers" | "customer_requirements" | "crm_visits" | "crm_follow_ups"> = {
  lead: "leads",
  customer: "customers",
  customer_requirement: "customer_requirements",
  crm_visit: "crm_visits",
  crm_follow_up: "crm_follow_ups",
};

export interface TaskFields {
  title: string;
  description: string | null;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  status: string;
  priority: string;
  dueAt: string | null;
  assignedToUserId: number | null;
}

export async function validateTaskInput(body: Record<string, unknown>, opts: { partial: boolean }, dbOrTx: DbOrTx = db): Promise<ValidationResult<TaskFields>> {
  const { has, need } = makeHelpers(body, opts.partial);
  const data: Partial<TaskFields> = {};

  if (need("title")) {
    if (!isNonEmptyString(body.title, 200)) return { ok: false, error: "title نامعتبر است" };
    data.title = (body.title as string).trim();
  }
  if (has("description")) data.description = typeof body.description === "string" ? body.description : null;

  const hasType = has("relatedEntityType");
  const hasId = has("relatedEntityId");
  if (hasType !== hasId && !(body.relatedEntityType === null && body.relatedEntityId === null)) {
    return { ok: false, error: "relatedEntityType و relatedEntityId باید هم‌زمان ارسال شوند" };
  }
  if (hasType) {
    if (body.relatedEntityType === null) {
      data.relatedEntityType = null;
      data.relatedEntityId = null;
    } else {
      if (typeof body.relatedEntityType !== "string" || !(body.relatedEntityType in TASK_RELATED_TABLES))
        return { ok: false, error: "relatedEntityType نامعتبر است" };
      const relatedId = Number(body.relatedEntityId);
      if (!Number.isInteger(relatedId) || relatedId <= 0) return { ok: false, error: "relatedEntityId نامعتبر است" };
      const table = TASK_RELATED_TABLES[body.relatedEntityType];
      const row = await dbOrTx.selectFrom(table).select("id").where("id", "=", relatedId).executeTakeFirst();
      if (!row) return { ok: false, error: "موجودیت مرتبط یافت نشد" };
      data.relatedEntityType = body.relatedEntityType;
      data.relatedEntityId = relatedId;
    }
  }
  if (has("status")) {
    if (!isValidTaskStatus(body.status)) return { ok: false, error: "status نامعتبر است" };
    data.status = body.status;
  }
  if (has("priority")) {
    if (!isValidTaskPriority(body.priority)) return { ok: false, error: "priority نامعتبر است" };
    data.priority = body.priority;
  }
  if (has("dueAt")) {
    if (body.dueAt !== null && !isValidIsoDate(body.dueAt)) return { ok: false, error: "dueAt نامعتبر است" };
    data.dueAt = (body.dueAt as string | null) ?? null;
  }
  if (has("assignedToUserId")) {
    const r = await optionalUserId(dbOrTx, body.assignedToUserId);
    if (!r.ok) return r;
    data.assignedToUserId = r.value;
  }

  return { ok: true, data };
}

// ============ Customer Type (بخش ۶) — key/labelFa بدون Hard-code مقدار خاصی ============

const KEY_REGEX = /^[a-z][a-z0-9_]*$/;

export interface CustomerTypeFields {
  key: string;
  labelFa: string;
  sortOrder: number;
  isActive: boolean;
}

export async function validateCustomerTypeInput(
  body: Record<string, unknown>,
  opts: { partial: boolean },
  dbOrTx: DbOrTx = db
): Promise<ValidationResult<CustomerTypeFields>> {
  const { has, need } = makeHelpers(body, opts.partial);
  const data: Partial<CustomerTypeFields> = {};

  if (need("key")) {
    if (typeof body.key !== "string" || body.key.length === 0 || body.key.length > 30 || !KEY_REGEX.test(body.key))
      return { ok: false, error: "key نامعتبر است" };
    const dup = await dbOrTx.selectFrom("customer_types").select("id").where("key", "=", body.key).executeTakeFirst();
    if (dup) return { ok: false, error: "این key قبلاً استفاده شده است" };
    data.key = body.key;
  }
  if (need("labelFa")) {
    if (!isNonEmptyString(body.labelFa, 50)) return { ok: false, error: "labelFa نامعتبر است" };
    data.labelFa = (body.labelFa as string).trim();
  }
  if (has("sortOrder")) {
    if (!isValidNonNegativeInteger(body.sortOrder)) return { ok: false, error: "sortOrder نامعتبر است" };
    data.sortOrder = body.sortOrder as number;
  }
  if (has("isActive")) {
    if (typeof body.isActive !== "boolean") return { ok: false, error: "isActive نامعتبر است" };
    data.isActive = body.isActive;
  }

  return { ok: true, data };
}

// ============ Activity (بخش ۱۱) ============

const ACTIVITY_ENTITY_TYPES = ["lead", "customer", "customer_requirement", "crm_visit", "crm_follow_up", "crm_task"] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export function isValidActivityEntityType(value: unknown): value is ActivityEntityType {
  return typeof value === "string" && (ACTIVITY_ENTITY_TYPES as readonly string[]).includes(value);
}

export interface ActivityFields {
  entityType: ActivityEntityType;
  entityId: number;
  activityType: string;
  description: string | null;
  meta: Record<string, unknown> | null;
}

export function validateActivityInput(body: Record<string, unknown>): ValidationResult<ActivityFields> {
  if (!isValidActivityEntityType(body.entityType)) return { ok: false, error: "entityType نامعتبر است" };
  const entityId = Number(body.entityId);
  if (!Number.isInteger(entityId) || entityId <= 0) return { ok: false, error: "entityId نامعتبر است" };
  if (!isNonEmptyString(body.activityType, 30)) return { ok: false, error: "activityType نامعتبر است" };
  const description = typeof body.description === "string" ? body.description : null;
  const meta = body.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? (body.meta as Record<string, unknown>) : null;
  return { ok: true, data: { entityType: body.entityType, entityId, activityType: body.activityType as string, description, meta } };
}

// ============ Pipeline / Stage / Card (بخش ۲۰) — کاملاً DB-driven، بدون کلید ثابت ============

export interface PipelineFields {
  key: string;
  titleFa: string;
  isDefault: boolean;
  isActive: boolean;
}

export async function validatePipelineInput(
  body: Record<string, unknown>,
  opts: { partial: boolean },
  dbOrTx: DbOrTx = db
): Promise<ValidationResult<PipelineFields>> {
  const { has, need } = makeHelpers(body, opts.partial);
  const data: Partial<PipelineFields> = {};

  if (need("key")) {
    if (typeof body.key !== "string" || body.key.length === 0 || body.key.length > 50 || !KEY_REGEX.test(body.key))
      return { ok: false, error: "key نامعتبر است" };
    const dup = await dbOrTx.selectFrom("crm_pipelines").select("id").where("key", "=", body.key).executeTakeFirst();
    if (dup) return { ok: false, error: "این key قبلاً استفاده شده است" };
    data.key = body.key;
  }
  if (need("titleFa")) {
    if (!isNonEmptyString(body.titleFa, 150)) return { ok: false, error: "titleFa نامعتبر است" };
    data.titleFa = (body.titleFa as string).trim();
  }
  if (has("isDefault")) {
    if (typeof body.isDefault !== "boolean") return { ok: false, error: "isDefault نامعتبر است" };
    data.isDefault = body.isDefault;
  }
  if (has("isActive")) {
    if (typeof body.isActive !== "boolean") return { ok: false, error: "isActive نامعتبر است" };
    data.isActive = body.isActive;
  }

  return { ok: true, data };
}

export interface PipelineStageFields {
  key: string;
  titleFa: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
  isActive: boolean;
}

export async function validatePipelineStageInput(
  body: Record<string, unknown>,
  opts: { partial: boolean; pipelineId: number },
  dbOrTx: DbOrTx = db
): Promise<ValidationResult<PipelineStageFields>> {
  const { has, need } = makeHelpers(body, opts.partial);
  const data: Partial<PipelineStageFields> = {};

  if (need("key")) {
    if (typeof body.key !== "string" || body.key.length === 0 || body.key.length > 50 || !KEY_REGEX.test(body.key))
      return { ok: false, error: "key نامعتبر است" };
    const dup = await dbOrTx
      .selectFrom("crm_pipeline_stages")
      .select("id")
      .where("pipeline_id", "=", opts.pipelineId)
      .where("key", "=", body.key)
      .executeTakeFirst();
    if (dup) return { ok: false, error: "این key در این قیف قبلاً استفاده شده است" };
    data.key = body.key;
  }
  if (need("titleFa")) {
    if (!isNonEmptyString(body.titleFa, 150)) return { ok: false, error: "titleFa نامعتبر است" };
    data.titleFa = (body.titleFa as string).trim();
  }
  if (has("sortOrder")) {
    if (!isValidNonNegativeInteger(body.sortOrder)) return { ok: false, error: "sortOrder نامعتبر است" };
    data.sortOrder = body.sortOrder as number;
  }
  if (has("isWon")) {
    if (typeof body.isWon !== "boolean") return { ok: false, error: "isWon نامعتبر است" };
    data.isWon = body.isWon;
  }
  if (has("isLost")) {
    if (typeof body.isLost !== "boolean") return { ok: false, error: "isLost نامعتبر است" };
    data.isLost = body.isLost;
  }
  if (data.isWon && data.isLost) return { ok: false, error: "یک مرحله نمی‌تواند هم‌زمان won و lost باشد" };
  if (has("isActive")) {
    if (typeof body.isActive !== "boolean") return { ok: false, error: "isActive نامعتبر است" };
    data.isActive = body.isActive;
  }

  return { ok: true, data };
}

export interface PipelineCardFields {
  stageId: number;
  leadId: number | null;
  customerId: number | null;
  assignedToUserId: number | null;
}

export async function validatePipelineCardInput(
  body: Record<string, unknown>,
  opts: { partial: boolean; pipelineId: number },
  dbOrTx: DbOrTx = db
): Promise<ValidationResult<PipelineCardFields>> {
  const { has, need } = makeHelpers(body, opts.partial);
  const data: Partial<PipelineCardFields> = {};

  if (need("stageId")) {
    const stageId = Number(body.stageId);
    if (!Number.isInteger(stageId) || stageId <= 0) return { ok: false, error: "stageId نامعتبر است" };
    const stage = await dbOrTx
      .selectFrom("crm_pipeline_stages")
      .select(["id", "is_active"])
      .where("id", "=", stageId)
      .where("pipeline_id", "=", opts.pipelineId)
      .executeTakeFirst();
    if (!stage) return { ok: false, error: "مرحله در این قیف یافت نشد" };
    if (!stage.is_active) return { ok: false, error: "مرحله غیرفعال است" };
    data.stageId = stageId;
  }

  if (!opts.partial) {
    const hasLead = body.leadId !== undefined && body.leadId !== null;
    const hasCustomer = body.customerId !== undefined && body.customerId !== null;
    if (hasLead === hasCustomer) return { ok: false, error: "دقیقاً یکی از leadId یا customerId باید مقداردهی شود" };
  }
  if (has("leadId")) {
    if (body.leadId === null) data.leadId = null;
    else {
      const leadId = Number(body.leadId);
      if (!Number.isInteger(leadId) || leadId <= 0) return { ok: false, error: "leadId نامعتبر است" };
      const lead = await dbOrTx.selectFrom("leads").select("id").where("id", "=", leadId).executeTakeFirst();
      if (!lead) return { ok: false, error: "سرنخ یافت نشد" };
      data.leadId = leadId;
    }
  }
  if (has("customerId")) {
    if (body.customerId === null) data.customerId = null;
    else {
      const customerId = Number(body.customerId);
      if (!Number.isInteger(customerId) || customerId <= 0) return { ok: false, error: "customerId نامعتبر است" };
      const customer = await dbOrTx.selectFrom("customers").select("id").where("id", "=", customerId).executeTakeFirst();
      if (!customer) return { ok: false, error: "مشتری یافت نشد" };
      data.customerId = customerId;
    }
  }
  if (has("assignedToUserId")) {
    const r = await optionalUserId(dbOrTx, body.assignedToUserId);
    if (!r.ok) return r;
    data.assignedToUserId = r.value;
  }

  return { ok: true, data };
}
