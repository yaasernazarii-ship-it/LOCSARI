import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, parsePagination, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow, agencyIdsOrNone, idsOrNone } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { logCrmActivity } from "@/lib/crmActivity";
import { validateVisitInput } from "@/lib/crmValidation";
import { isValidVisitStatus } from "@/lib/validation";

// GET /api/crm/visits — بازدیدهای مشتری از آگهی (بخش ۹)، محدود به Scope کاربر
export async function GET(req: NextRequest) {
  const auth = await requireCrmPermission("visit.view");
  if (auth.response) return auth.response;

  const scope = await resolveCrmScope(auth.user.id);
  const { page, limit, offset } = parsePagination(req);
  const sp = req.nextUrl.searchParams;

  let query = db.selectFrom("crm_visits").selectAll();
  let countQuery = db.selectFrom("crm_visits");

  const customerId = sp.get("customerId");
  if (customerId) {
    const id = Number(customerId);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_CUSTOMER_ID", "customerId نامعتبر است");
    query = query.where("customer_id", "=", id);
    countQuery = countQuery.where("customer_id", "=", id);
  }
  const advertisementId = sp.get("advertisementId");
  if (advertisementId) {
    const id = Number(advertisementId);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_ADVERTISEMENT_ID", "advertisementId نامعتبر است");
    query = query.where("advertisement_id", "=", id);
    countQuery = countQuery.where("advertisement_id", "=", id);
  }
  const status = sp.get("status");
  if (status) {
    if (!isValidVisitStatus(status)) return errData(400, "INVALID_STATUS", "status نامعتبر است");
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
    const ids = idsOrNone((await db.selectFrom("customers").select("id").where("agency_id", "in", agencyIdsOrNone(scope)).execute()).map((r) => r.id));
    query = query.where("customer_id", "in", ids);
    countQuery = countQuery.where("customer_id", "in", ids);
  } else if (scope.kind === "assigned") {
    query = query.where((eb) => eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("created_by_user_id", "=", scope.userId)]));
    countQuery = countQuery.where((eb) => eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("created_by_user_id", "=", scope.userId)]));
  }

  query = query.orderBy("scheduled_at", "desc").limit(limit).offset(offset);

  const [rows, totalRow] = await Promise.all([query.execute(), countQuery.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()]);

  return okData(rows, { page, limit, total: Number(totalRow?.count ?? 0) });
}

// POST /api/crm/visits — ثبت بازدید مشتری از یک آگهی
export async function POST(req: NextRequest) {
  const auth = await requireCrmPermission("visit.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-visit-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validateVisitInput(body as Record<string, unknown>, { partial: false });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const scope = await resolveCrmScope(auth.user.id);
  const customer = await db
    .selectFrom("customers")
    .select(["agency_id", "assigned_to_user_id", "created_by_user_id"])
    .where("id", "=", data.customerId!)
    .executeTakeFirst();
  if (!customer || !scopeAllowsRow(scope, { agencyId: customer.agency_id, assignedToUserId: customer.assigned_to_user_id, createdByUserId: customer.created_by_user_id }))
    return errData(404, "NOT_FOUND", "مشتری یافت نشد");

  const row = await db
    .insertInto("crm_visits")
    .values({
      customer_id: data.customerId!,
      advertisement_id: data.advertisementId!,
      requirement_id: data.requirementId ?? null,
      assigned_to_user_id: data.assignedToUserId ?? null,
      status: data.status ?? "scheduled",
      scheduled_at: data.scheduledAt!,
      feedback: data.feedback ?? null,
      created_by_user_id: auth.user.id,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "crm_visit", row.id, { customerId: row.customer_id, advertisementId: row.advertisement_id });
  await logCrmActivity(db, "customer", row.customer_id, "visit_scheduled", "بازدید جدید ثبت شد", auth.user.id, { visitId: row.id, advertisementId: row.advertisement_id });

  return okData(row, undefined, 201);
}
