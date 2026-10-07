import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow, getEntityOwnerFields, agencyIdsOrNone, idsOrNone, resolveAgencyRelatedIds } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validatePipelineCardInput } from "@/lib/crmValidation";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

// GET /api/crm/pipelines/[id]/cards — نمای Kanban یک قیف، محدود به Scope کاربر (بخش ۲۰)
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("pipeline.view");
  if (auth.response) return auth.response;

  const pipelineId = parseId(params.id);
  if (!pipelineId) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const pipeline = await db.selectFrom("crm_pipelines").select("id").where("id", "=", pipelineId).executeTakeFirst();
  if (!pipeline) return errData(404, "NOT_FOUND", "قیف فروش یافت نشد");

  const scope = await resolveCrmScope(auth.user.id);
  let query = db.selectFrom("crm_pipeline_cards").selectAll().where("pipeline_id", "=", pipelineId);

  const stageId = req.nextUrl.searchParams.get("stageId");
  if (stageId) {
    const id = Number(stageId);
    if (!Number.isInteger(id) || id <= 0) return errData(400, "INVALID_STAGE_ID", "stageId نامعتبر است");
    query = query.where("stage_id", "=", id);
  }

  if (scope.kind === "agency") {
    const { leadIds, customerIds } = await resolveAgencyRelatedIds(db, agencyIdsOrNone(scope));
    query = query.where((eb) => eb.or([eb("lead_id", "in", idsOrNone(leadIds)), eb("customer_id", "in", idsOrNone(customerIds))]));
  } else if (scope.kind === "assigned") {
    const [leadRows, customerRows] = await Promise.all([
      db.selectFrom("leads").select("id").where((eb) => eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("created_by_user_id", "=", scope.userId)])).execute(),
      db.selectFrom("customers").select("id").where((eb) => eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("created_by_user_id", "=", scope.userId)])).execute(),
    ]);
    const leadIds = idsOrNone(leadRows.map((r) => r.id));
    const customerIds = idsOrNone(customerRows.map((r) => r.id));
    query = query.where((eb) =>
      eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("lead_id", "in", leadIds), eb("customer_id", "in", customerIds)])
    );
  }

  const rows = await query.orderBy("stage_id", "asc").orderBy("sort_order", "asc").execute();
  return okData(rows);
}

// POST /api/crm/pipelines/[id]/cards — افزودن کارت جدید (فقط pipeline.manage — مدیران)
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

  const validated = await validatePipelineCardInput(body as Record<string, unknown>, { partial: false, pipelineId });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const scope = await resolveCrmScope(auth.user.id);
  const entityType = data.leadId != null ? "lead" : "customer";
  const entityId = data.leadId ?? data.customerId!;
  const owner = await getEntityOwnerFields(db, entityType, entityId);
  if (!owner || !scopeAllowsRow(scope, owner)) return errData(404, "NOT_FOUND", "سرنخ یا مشتری یافت نشد");

  const row = await db
    .insertInto("crm_pipeline_cards")
    .values({
      pipeline_id: pipelineId,
      stage_id: data.stageId!,
      lead_id: data.leadId ?? null,
      customer_id: data.customerId ?? null,
      assigned_to_user_id: data.assignedToUserId ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "crm_pipeline_card", row.id, { pipelineId, stageId: row.stage_id });

  return okData(row, undefined, 201);
}
