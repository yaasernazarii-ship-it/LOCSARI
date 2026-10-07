import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validatePipelineInput } from "@/lib/crmValidation";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

// GET /api/crm/pipelines/[id] — همراه با مراحل
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("pipeline.view");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const pipeline = await db.selectFrom("crm_pipelines").selectAll().where("id", "=", id).executeTakeFirst();
  if (!pipeline) return errData(404, "NOT_FOUND", "قیف فروش یافت نشد");

  const stages = await db.selectFrom("crm_pipeline_stages").selectAll().where("pipeline_id", "=", id).orderBy("sort_order", "asc").execute();

  return okData({ ...pipeline, stages });
}

// PATCH /api/crm/pipelines/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("pipeline.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-pipeline-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const pipeline = await db.selectFrom("crm_pipelines").select("id").where("id", "=", id).executeTakeFirst();
  if (!pipeline) return errData(404, "NOT_FOUND", "قیف فروش یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validatePipelineInput(body as Record<string, unknown>, { partial: true });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const updated = await db.transaction().execute(async (trx) => {
    if (data.isDefault === true) {
      await trx.updateTable("crm_pipelines").set({ is_default: false }).where("is_default", "=", true).where("id", "!=", id).execute();
    }
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.key !== undefined) update.key = data.key;
    if (data.titleFa !== undefined) update.title_fa = data.titleFa;
    if (data.isDefault !== undefined) update.is_default = data.isDefault;
    if (data.isActive !== undefined) update.is_active = data.isActive;
    return trx.updateTable("crm_pipelines").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
  });

  await logAdminAction(auth.user.id, "update", "crm_pipeline", id, { fields: Object.keys(data) });

  return okData(updated);
}

// DELETE /api/crm/pipelines/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("pipeline.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-pipeline-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const pipeline = await db.selectFrom("crm_pipelines").select("id").where("id", "=", id).executeTakeFirst();
  if (!pipeline) return errData(404, "NOT_FOUND", "قیف فروش یافت نشد");

  await db.deleteFrom("crm_pipelines").where("id", "=", id).execute();
  await logAdminAction(auth.user.id, "delete", "crm_pipeline", id);

  return okData({ id });
}
