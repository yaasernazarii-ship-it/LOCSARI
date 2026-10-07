import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validatePipelineInput } from "@/lib/crmValidation";

// GET /api/crm/pipelines — لیست قیف‌های فروش CRM (بخش ۲۰) — دادهٔ مرجع سراسری، بدون فیلتر Scope
export async function GET() {
  const auth = await requireCrmPermission("pipeline.view");
  if (auth.response) return auth.response;

  const rows = await db.selectFrom("crm_pipelines").selectAll().orderBy("is_default", "desc").orderBy("id", "asc").execute();
  return okData(rows);
}

// POST /api/crm/pipelines — تعریف قیف فروش جدید
export async function POST(req: NextRequest) {
  const auth = await requireCrmPermission("pipeline.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-pipeline-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validatePipelineInput(body as Record<string, unknown>, { partial: false });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const row = await db.transaction().execute(async (trx) => {
    if (data.isDefault) {
      await trx.updateTable("crm_pipelines").set({ is_default: false }).where("is_default", "=", true).execute();
    }
    return trx
      .insertInto("crm_pipelines")
      .values({ key: data.key!, title_fa: data.titleFa!, is_default: data.isDefault ?? false, is_active: data.isActive ?? true })
      .returningAll()
      .executeTakeFirstOrThrow();
  });

  await logAdminAction(auth.user.id, "create", "crm_pipeline", row.id, { key: row.key });

  return okData(row, undefined, 201);
}
