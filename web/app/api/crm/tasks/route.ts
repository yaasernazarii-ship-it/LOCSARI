import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, parsePagination, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow, agencyIdsOrNone, idsOrNone, resolveAgencyRelatedIds, getEntityOwnerFields, CrmOwnedEntityType } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validateTaskInput } from "@/lib/crmValidation";
import { isValidTaskStatus, isValidTaskPriority } from "@/lib/validation";

// GET /api/crm/tasks — وظایف کاربران CRM (بخش ۱۳)، محدود به Scope کاربر
export async function GET(req: NextRequest) {
  const auth = await requireCrmPermission("task.view");
  if (auth.response) return auth.response;

  const scope = await resolveCrmScope(auth.user.id);
  const { page, limit, offset } = parsePagination(req);
  const sp = req.nextUrl.searchParams;

  let query = db.selectFrom("crm_tasks").selectAll();
  let countQuery = db.selectFrom("crm_tasks");

  const status = sp.get("status");
  if (status) {
    if (!isValidTaskStatus(status)) return errData(400, "INVALID_STATUS", "status نامعتبر است");
    query = query.where("status", "=", status);
    countQuery = countQuery.where("status", "=", status);
  }
  const priority = sp.get("priority");
  if (priority) {
    if (!isValidTaskPriority(priority)) return errData(400, "INVALID_PRIORITY", "priority نامعتبر است");
    query = query.where("priority", "=", priority);
    countQuery = countQuery.where("priority", "=", priority);
  }
  const assignedTo = sp.get("assignedTo");
  if (assignedTo) {
    const id = Number(assignedTo);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_ASSIGNED_TO", "assignedTo نامعتبر است");
    query = query.where("assigned_to_user_id", "=", id);
    countQuery = countQuery.where("assigned_to_user_id", "=", id);
  }
  const relatedEntityType = sp.get("relatedEntityType");
  const relatedEntityId = sp.get("relatedEntityId");
  if (relatedEntityType && relatedEntityId) {
    const id = Number(relatedEntityId);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_RELATED_ENTITY_ID", "relatedEntityId نامعتبر است");
    query = query.where("related_entity_type", "=", relatedEntityType).where("related_entity_id", "=", id);
    countQuery = countQuery.where("related_entity_type", "=", relatedEntityType).where("related_entity_id", "=", id);
  }

  if (scope.kind === "agency") {
    const { leadIds, customerIds, requirementIds, visitIds, followUpIds } = await resolveAgencyRelatedIds(db, agencyIdsOrNone(scope));
    const applyAgencyFilter = <QB extends { where: (cb: (eb: any) => any) => QB }>(qb: QB): QB =>
      qb.where((eb) =>
        eb.or([
          eb.and([eb("related_entity_type", "=", "lead"), eb("related_entity_id", "in", idsOrNone(leadIds))]),
          eb.and([eb("related_entity_type", "=", "customer"), eb("related_entity_id", "in", idsOrNone(customerIds))]),
          eb.and([eb("related_entity_type", "=", "customer_requirement"), eb("related_entity_id", "in", idsOrNone(requirementIds))]),
          eb.and([eb("related_entity_type", "=", "crm_visit"), eb("related_entity_id", "in", idsOrNone(visitIds))]),
          eb.and([eb("related_entity_type", "=", "crm_follow_up"), eb("related_entity_id", "in", idsOrNone(followUpIds))]),
        ])
      );
    query = applyAgencyFilter(query);
    countQuery = applyAgencyFilter(countQuery);
  } else if (scope.kind === "assigned") {
    query = query.where((eb) => eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("created_by_user_id", "=", scope.userId)]));
    countQuery = countQuery.where((eb) => eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("created_by_user_id", "=", scope.userId)]));
  }

  query = query.orderBy("due_at", "asc").limit(limit).offset(offset);

  const [rows, totalRow] = await Promise.all([query.execute(), countQuery.select((eb) => eb.fn.countAll().as("count")).executeTakeFirst()]);

  return okData(rows, { page, limit, total: Number(totalRow?.count ?? 0) });
}

// POST /api/crm/tasks — ثبت وظیفهٔ جدید، در صورت اتصال به موجودیت باید داخل Scope کاربر باشد
export async function POST(req: NextRequest) {
  const auth = await requireCrmPermission("task.create");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-task-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validateTaskInput(body as Record<string, unknown>, { partial: false });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  if (data.relatedEntityType && data.relatedEntityId) {
    const scope = await resolveCrmScope(auth.user.id);
    const owner = await getEntityOwnerFields(db, data.relatedEntityType as CrmOwnedEntityType, data.relatedEntityId);
    if (!owner || !scopeAllowsRow(scope, owner)) return errData(404, "NOT_FOUND", "موجودیت مرتبط یافت نشد");
  }

  const row = await db
    .insertInto("crm_tasks")
    .values({
      title: data.title!,
      description: data.description ?? null,
      related_entity_type: data.relatedEntityType ?? null,
      related_entity_id: data.relatedEntityId ?? null,
      status: data.status ?? "todo",
      priority: data.priority ?? "normal",
      due_at: data.dueAt ?? null,
      assigned_to_user_id: data.assignedToUserId ?? null,
      created_by_user_id: auth.user.id,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "crm_task", row.id, { relatedEntityType: row.related_entity_type, relatedEntityId: row.related_entity_id });

  return okData(row, undefined, 201);
}
