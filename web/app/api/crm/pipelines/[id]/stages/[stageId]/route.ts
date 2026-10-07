import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validatePipelineStageInput } from "@/lib/crmValidation";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string; stageId: string } };

// PATCH /api/crm/pipelines/[id]/stages/[stageId]
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("pipeline.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-pipeline-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const pipelineId = parseId(params.id);
  const stageId = parseId(params.stageId);
  if (!pipelineId || !stageId) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const stage = await db.selectFrom("crm_pipeline_stages").select("id").where("id", "=", stageId).where("pipeline_id", "=", pipelineId).executeTakeFirst();
  if (!stage) return errData(404, "NOT_FOUND", "مرحله یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validatePipelineStageInput(body as Record<string, unknown>, { partial: true, pipelineId });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const update: Record<string, unknown> = {};
  if (data.key !== undefined) update.key = data.key;
  if (data.titleFa !== undefined) update.title_fa = data.titleFa;
  if (data.sortOrder !== undefined) update.sort_order = data.sortOrder;
  if (data.isWon !== undefined) update.is_won = data.isWon;
  if (data.isLost !== undefined) update.is_lost = data.isLost;
  if (data.isActive !== undefined) update.is_active = data.isActive;

  const updated = await db.updateTable("crm_pipeline_stages").set(update).where("id", "=", stageId).returningAll().executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "crm_pipeline_stage", stageId, { fields: Object.keys(update) });

  return okData(updated);
}

// DELETE /api/crm/pipelines/[id]/stages/[stageId]
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("pipeline.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-pipeline-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const pipelineId = parseId(params.id);
  const stageId = parseId(params.stageId);
  if (!pipelineId || !stageId) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const stage = await db.selectFrom("crm_pipeline_stages").select("id").where("id", "=", stageId).where("pipeline_id", "=", pipelineId).executeTakeFirst();
  if (!stage) return errData(404, "NOT_FOUND", "مرحله یافت نشد");

  const cardCount = await db.selectFrom("crm_pipeline_cards").where("stage_id", "=", stageId).select((eb) => eb.fn.countAll().as("count")).executeTakeFirst();
  if (Number(cardCount?.count ?? 0) > 0) return errData(409, "STAGE_NOT_EMPTY", "این مرحله دارای کارت است و قابل حذف نیست");

  await db.deleteFrom("crm_pipeline_stages").where("id", "=", stageId).execute();
  await logAdminAction(auth.user.id, "delete", "crm_pipeline_stage", stageId, { pipelineId });

  return okData({ id: stageId });
}
