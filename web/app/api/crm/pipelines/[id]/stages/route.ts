import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validatePipelineStageInput } from "@/lib/crmValidation";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

// GET /api/crm/pipelines/[id]/stages
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("pipeline.view");
  if (auth.response) return auth.response;

  const pipelineId = parseId(params.id);
  if (!pipelineId) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const pipeline = await db.selectFrom("crm_pipelines").select("id").where("id", "=", pipelineId).executeTakeFirst();
  if (!pipeline) return errData(404, "NOT_FOUND", "قیف فروش یافت نشد");

  const stages = await db.selectFrom("crm_pipeline_stages").selectAll().where("pipeline_id", "=", pipelineId).orderBy("sort_order", "asc").execute();
  return okData(stages);
}

// POST /api/crm/pipelines/[id]/stages — افزودن مرحلهٔ جدید
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("pipeline.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-pipeline-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const pipelineId = parseId(params.id);
  if (!pipelineId) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const pipeline = await db.selectFrom("crm_pipelines").select("id").where("id", "=", pipelineId).executeTakeFirst();
  if (!pipeline) return errData(404, "NOT_FOUND", "قیف فروش یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validatePipelineStageInput(body as Record<string, unknown>, { partial: false, pipelineId });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const row = await db
    .insertInto("crm_pipeline_stages")
    .values({
      pipeline_id: pipelineId,
      key: data.key!,
      title_fa: data.titleFa!,
      sort_order: data.sortOrder ?? 0,
      is_won: data.isWon ?? false,
      is_lost: data.isLost ?? false,
      is_active: data.isActive ?? true,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "crm_pipeline_stage", row.id, { pipelineId, key: row.key });

  return okData(row, undefined, 201);
}
