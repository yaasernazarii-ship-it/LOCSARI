import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, parsePagination, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow, agencyIdsOrNone, idsOrNone, resolveAgencyRelatedIds } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { logCrmActivity } from "@/lib/crmActivity";
import { validateFollowUpInput } from "@/lib/crmValidation";
import { isValidFollowUpType, isValidFollowUpStatus } from "@/lib/validation";

// GET /api/crm/follow-ups — پیگیری‌های Lead/Customer (بخش ۱۰)، محدود به Scope کاربر
export async function GET(req: NextRequest) {
  const auth = await requireCrmPermission("followup.view");
  if (auth.response) return auth.response;

  const scope = await resolveCrmScope(auth.user.id);
  const { page, limit, offset } = parsePagination(req);
  const sp = req.nextUrl.searchParams;

  let query = db.selectFrom("crm_follow_ups").selectAll();
  let countQuery = db.selectFrom("crm_follow_ups");

  const leadId = sp.get("leadId");
  if (leadId) {
    const id = Number(leadId);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_LEAD_ID", "leadId نامعتبر است");
    query = query.where("lead_id", "=", id);
    countQuery = countQuery.where("lead_id", "=", id);
  }
  const customerId = sp.get("customerId");
  if (customerId) {
    const id = Number(customerId);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_CUSTOMER_ID", "customerId نامعتبر است");
    query = query.where("customer_id", "=", id);
    countQuery = countQuery.where("customer_id", "=", id);
  }
  const type = sp.get("type");
  if (type) {
    if (!isValidFollowUpType(type)) return errData(400, "INVALID_TYPE", "type نامعتبر است");
    query = query.where("type", "=", type);
    countQuery = countQuery.where("type", "=", type);
  }
  const status = sp.get("status");
  if (status) {
    if (!isValidFollowUpStatus(status)) return errData(400, "INVALID_STATUS", "status نامعتبر است");
    query = query.where("status", "=", status);
    countQuery = countQuery.where("status", "=", status);
  }
  const assignedTo = sp.get("assignedTo");
  if (assignedTo) {
    const id = Number(assignedTo);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_ASSIGNED_TO", "assignedTo نامعتبر است");
    query = query.where("assigned_to_user_id", "=", id);
    countQuery = countQuery.where("assigned_to_user_id", "=", id);
  }

  if (scope.kind === "agency") {
    const { leadIds, customerIds } = await resolveAgencyRelatedIds(db, agencyIdsOrNone(scope));
    const lIds = idsOrNone(leadIds);
    const cIds = idsOrNone(customerIds);
    query = query.where((eb) => eb.or([eb("lead_id", "in", lIds), eb("customer_id", "in", cIds)]));
    countQuery = countQuery.where((eb) => eb.or([eb("lead_id", "in", lIds), eb("customer_id", "in", cIds)]));
  } else if (scope.kind === "assigned") {
    query = query.where((eb) => eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("created_by_user_id", "=", scope.userId)]));
    countQuery = countQuery.where((eb) => eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("created_by_user_id", "=", scope.userId)]));
  }

  query = query.orderBy("created_at", "desc").limit(limit).offset(offset);

  const [rows, totalRow] = await Promise.all([query.execute(), countQuery.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()]);

  return okData(rows, { page, limit, total: Number(totalRow?.count ?? 0) });
}

// POST /api/crm/follow-ups — ثبت پیگیری جدید برای یک Lead یا Customer
export async function POST(req: NextRequest) {
  const auth = await requireCrmPermission("followup.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-followup-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validateFollowUpInput(body as Record<string, unknown>, { partial: false });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  // بررسی Scope والد (Lead یا Customer) پیش از ثبت — کاربر نباید بتواند برای موجودیت خارج از دامنهٔ خودش پیگیری بسازد
  const scope = await resolveCrmScope(auth.user.id);
  if (data.leadId != null) {
    const lead = await db.selectFrom("leads").select(["agency_id", "assigned_to_user_id", "created_by_user_id"]).where("id", "=", data.leadId).executeTakeFirst();
    if (!lead || !scopeAllowsRow(scope, { agencyId: lead.agency_id, assignedToUserId: lead.assigned_to_user_id, createdByUserId: lead.created_by_user_id }))
      return errData(404, "NOT_FOUND", "سرنخ یافت نشد");
  }
  if (data.customerId != null) {
    const customer = await db.selectFrom("customers").select(["agency_id", "assigned_to_user_id", "created_by_user_id"]).where("id", "=", data.customerId).executeTakeFirst();
    if (!customer || !scopeAllowsRow(scope, { agencyId: customer.agency_id, assignedToUserId: customer.assigned_to_user_id, createdByUserId: customer.created_by_user_id }))
      return errData(404, "NOT_FOUND", "مشتری یافت نشد");
  }

  const row = await db
    .insertInto("crm_follow_ups")
    .values({
      lead_id: data.leadId ?? null,
      customer_id: data.customerId ?? null,
      type: data.type ?? "call",
      status: data.status ?? "pending",
      scheduled_at: data.scheduledAt ?? null,
      completed_at: data.completedAt ?? null,
      notes: data.notes ?? null,
      assigned_to_user_id: data.assignedToUserId ?? null,
      created_by_user_id: auth.user.id,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "crm_follow_up", row.id, { leadId: row.lead_id, customerId: row.customer_id });
  const entityType = row.lead_id ? "lead" : "customer";
  const entityId = row.lead_id ?? row.customer_id!;
  await logCrmActivity(db, entityType, entityId, "followup_created", "پیگیری جدید ثبت شد", auth.user.id, { followUpId: row.id, type: row.type });

  return okData(row, undefined, 201);
}
