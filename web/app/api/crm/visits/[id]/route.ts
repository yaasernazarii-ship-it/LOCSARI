import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, getEntityOwnerFields, scopeAllowsRow } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { logCrmActivity } from "@/lib/crmActivity";
import { validateVisitInput } from "@/lib/crmValidation";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

async function loadScopedVisit(userId: number, id: number) {
  const scope = await resolveCrmScope(userId);
  const visit = await db.selectFrom("crm_visits").selectAll().where("id", "=", id).executeTakeFirst();
  if (!visit) return null;
  const owner = await getEntityOwnerFields(db, "crm_visit", id);
  if (!owner || !scopeAllowsRow(scope, owner)) return null;
  return visit;
}

// GET /api/crm/visits/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("visit.view");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const visit = await loadScopedVisit(auth.user.id, id);
  if (!visit) return errData(404, "NOT_FOUND", "بازدید یافت نشد");

  return okData(visit);
}

// PATCH /api/crm/visits/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("visit.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-visit-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const visit = await loadScopedVisit(auth.user.id, id);
  if (!visit) return errData(404, "NOT_FOUND", "بازدید یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validateVisitInput(body as Record<string, unknown>, { partial: true });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.requirementId !== undefined) update.requirement_id = data.requirementId;
  if (data.assignedToUserId !== undefined) update.assigned_to_user_id = data.assignedToUserId;
  if (data.status !== undefined) update.status = data.status;
  if (data.scheduledAt !== undefined) update.scheduled_at = data.scheduledAt;
  if (data.feedback !== undefined) update.feedback = data.feedback;
  if (data.status === "completed" && visit.completed_at === null) update.completed_at = new Date().toISOString();

  const updated = await db.updateTable("crm_visits").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "crm_visit", id, { fields: Object.keys(update) });
  if (data.status !== undefined) {
    await logCrmActivity(db, "customer", updated.customer_id, "visit_status_changed", `وضعیت بازدید به ${data.status} تغییر کرد`, auth.user.id, { visitId: id, status: data.status });
  }

  return okData(updated);
}

// DELETE /api/crm/visits/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("visit.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-visit-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const visit = await loadScopedVisit(auth.user.id, id);
  if (!visit) return errData(404, "NOT_FOUND", "بازدید یافت نشد");

  await db.deleteFrom("crm_visits").where("id", "=", id).execute();
  await logAdminAction(auth.user.id, "delete", "crm_visit", id);

  return okData({ id });
}
