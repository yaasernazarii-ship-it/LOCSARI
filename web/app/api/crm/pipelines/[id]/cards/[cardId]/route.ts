import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { logCrmActivity } from "@/lib/crmActivity";
import { validatePipelineCardInput } from "@/lib/crmValidation";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string; cardId: string } };

// PATCH /api/crm/pipelines/[id]/cards/[cardId] — جابه‌جایی روی Kanban (stage) یا واگذاری مجدد (فقط pipeline.manage)
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("pipeline.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-pipeline-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const pipelineId = parseId(params.id);
  const cardId = parseId(params.cardId);
  if (!pipelineId || !cardId) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const card = await db.selectFrom("crm_pipeline_cards").selectAll().where("id", "=", cardId).where("pipeline_id", "=", pipelineId).executeTakeFirst();
  if (!card) return errData(404, "NOT_FOUND", "کارت یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validatePipelineCardInput(body as Record<string, unknown>, { partial: true, pipelineId });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.stageId !== undefined && data.stageId !== card.stage_id) {
    update.stage_id = data.stageId;
    update.entered_stage_at = new Date().toISOString();
  }
  if (data.assignedToUserId !== undefined) update.assigned_to_user_id = data.assignedToUserId;

  const updated = await db.updateTable("crm_pipeline_cards").set(update).where("id", "=", cardId).returningAll().executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "crm_pipeline_card", cardId, { fields: Object.keys(update) });
  if (update.stage_id !== undefined) {
    const entityType = updated.lead_id ? "lead" : "customer";
    const entityId = updated.lead_id ?? updated.customer_id!;
    await logCrmActivity(db, entityType, entityId, "pipeline_stage_changed", "مرحلهٔ قیف فروش تغییر کرد", auth.user.id, { pipelineId, stageId: updated.stage_id });
  }

  return okData(updated);
}

// DELETE /api/crm/pipelines/[id]/cards/[cardId]
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("pipeline.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-pipeline-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const pipelineId = parseId(params.id);
  const cardId = parseId(params.cardId);
  if (!pipelineId || !cardId) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const card = await db.selectFrom("crm_pipeline_cards").select("id").where("id", "=", cardId).where("pipeline_id", "=", pipelineId).executeTakeFirst();
  if (!card) return errData(404, "NOT_FOUND", "کارت یافت نشد");

  await db.deleteFrom("crm_pipeline_cards").where("id", "=", cardId).execute();
  await logAdminAction(auth.user.id, "delete", "crm_pipeline_card", cardId, { pipelineId });

  return okData({ id: cardId });
}
