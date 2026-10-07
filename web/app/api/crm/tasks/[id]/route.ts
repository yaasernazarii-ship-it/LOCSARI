import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow, getEntityOwnerFields, CrmOwnedEntityType } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validateTaskInput } from "@/lib/crmValidation";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

async function loadScopedTask(userId: number, id: number) {
  const scope = await resolveCrmScope(userId);
  const task = await db.selectFrom("crm_tasks").selectAll().where("id", "=", id).executeTakeFirst();
  if (!task) return null;
  // برای Task مستقل (بدون related entity)، فقط scope اختصاصی/کامل معتبر است — Task بدون Entity هرگز به دامنهٔ آژانس تعلق ندارد
  const allowed = scopeAllowsRow(scope, { agencyId: null, assignedToUserId: task.assigned_to_user_id, createdByUserId: task.created_by_user_id });
  if (allowed) return task;
  if (scope.kind !== "agency") return null;
  if (!task.related_entity_type || !task.related_entity_id) return null;
  const owner = await getEntityOwnerFields(db, task.related_entity_type as CrmOwnedEntityType, task.related_entity_id);
  if (owner && scopeAllowsRow(scope, { agencyId: owner.agencyId, assignedToUserId: task.assigned_to_user_id, createdByUserId: task.created_by_user_id })) return task;
  return null;
}

// GET /api/crm/tasks/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("task.view");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const task = await loadScopedTask(auth.user.id, id);
  if (!task) return errData(404, "NOT_FOUND", "وظیفه یافت نشد");

  return okData(task);
}

// PATCH /api/crm/tasks/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("task.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-task-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const task = await loadScopedTask(auth.user.id, id);
  if (!task) return errData(404, "NOT_FOUND", "وظیفه یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validateTaskInput(body as Record<string, unknown>, { partial: true });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if (data.relatedEntityType !== undefined) update.related_entity_type = data.relatedEntityType;
  if (data.relatedEntityId !== undefined) update.related_entity_id = data.relatedEntityId;
  if (data.status !== undefined) {
    update.status = data.status;
    if (data.status === "done" && task.completed_at === null) update.completed_at = new Date().toISOString();
  }
  if (data.priority !== undefined) update.priority = data.priority;
  if (data.dueAt !== undefined) update.due_at = data.dueAt;
  if (data.assignedToUserId !== undefined) update.assigned_to_user_id = data.assignedToUserId;

  const updated = await db.updateTable("crm_tasks").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "crm_task", id, { fields: Object.keys(update) });

  return okData(updated);
}

// DELETE /api/crm/tasks/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("task.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-task-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const task = await loadScopedTask(auth.user.id, id);
  if (!task) return errData(404, "NOT_FOUND", "وظیفه یافت نشد");

  await db.deleteFrom("crm_tasks").where("id", "=", id).execute();
  await logAdminAction(auth.user.id, "delete", "crm_task", id);

  return okData({ id });
}
