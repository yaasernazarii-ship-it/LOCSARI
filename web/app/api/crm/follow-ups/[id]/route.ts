import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, getEntityOwnerFields, scopeAllowsRow } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { logCrmActivity } from "@/lib/crmActivity";
import { validateFollowUpInput } from "@/lib/crmValidation";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

async function loadScopedFollowUp(userId: number, id: number) {
  const scope = await resolveCrmScope(userId);
  const followUp = await db.selectFrom("crm_follow_ups").selectAll().where("id", "=", id).executeTakeFirst();
  if (!followUp) return null;
  const owner = await getEntityOwnerFields(db, "crm_follow_up", id);
  if (!owner || !scopeAllowsRow(scope, owner)) return null;
  return followUp;
}

// GET /api/crm/follow-ups/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("followup.view");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const followUp = await loadScopedFollowUp(auth.user.id, id);
  if (!followUp) return errData(404, "NOT_FOUND", "پیگیری یافت نشد");

  return okData(followUp);
}

// PATCH /api/crm/follow-ups/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("followup.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-followup-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const followUp = await loadScopedFollowUp(auth.user.id, id);
  if (!followUp) return errData(404, "NOT_FOUND", "پیگیری یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validateFollowUpInput(body as Record<string, unknown>, { partial: true });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.type !== undefined) update.type = data.type;
  if (data.status !== undefined) update.status = data.status;
  if (data.scheduledAt !== undefined) update.scheduled_at = data.scheduledAt;
  if (data.completedAt !== undefined) update.completed_at = data.completedAt;
  if (data.notes !== undefined) update.notes = data.notes;
  if (data.assignedToUserId !== undefined) update.assigned_to_user_id = data.assignedToUserId;

  const updated = await db.updateTable("crm_follow_ups").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "crm_follow_up", id, { fields: Object.keys(update) });
  const entityType = updated.lead_id ? "lead" : "customer";
  const entityId = updated.lead_id ?? updated.customer_id!;
  if (data.status !== undefined) {
    await logCrmActivity(db, entityType, entityId, "followup_status_changed", `وضعیت پیگیری به ${data.status} تغییر کرد`, auth.user.id, { followUpId: id, status: data.status });
  }

  return okData(updated);
}

// DELETE /api/crm/follow-ups/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("followup.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-followup-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const followUp = await loadScopedFollowUp(auth.user.id, id);
  if (!followUp) return errData(404, "NOT_FOUND", "پیگیری یافت نشد");

  await db.deleteFrom("crm_follow_ups").where("id", "=", id).execute();
  await logAdminAction(auth.user.id, "delete", "crm_follow_up", id);

  return okData({ id });
}
