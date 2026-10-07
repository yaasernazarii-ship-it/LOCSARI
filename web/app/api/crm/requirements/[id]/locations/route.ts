import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validateRequirementLocationInput } from "@/lib/crmValidation";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

async function loadScopedRequirement(userId: number, id: number) {
  const scope = await resolveCrmScope(userId);
  const requirement = await db.selectFrom("customer_requirements").selectAll().where("id", "=", id).executeTakeFirst();
  if (!requirement) return null;
  const customer = await db.selectFrom("customers").select("agency_id").where("id", "=", requirement.customer_id).executeTakeFirst();
  const allowed = scopeAllowsRow(scope, {
    agencyId: customer?.agency_id ?? null,
    assignedToUserId: requirement.assigned_to_user_id,
    createdByUserId: requirement.created_by_user_id,
  });
  return allowed ? requirement : null;
}

// GET /api/crm/requirements/[id]/locations — چندگانه (بخش ۸: یک نیازمندی می‌تواند چند منطقهٔ موردنظر داشته باشد)
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("requirement.view");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const requirement = await loadScopedRequirement(auth.user.id, id);
  if (!requirement) return errData(404, "NOT_FOUND", "نیازمندی یافت نشد");

  const rows = await db.selectFrom("requirement_locations").selectAll().where("requirement_id", "=", id).execute();
  return okData(rows);
}

// POST /api/crm/requirements/[id]/locations — افزودن یک منطقهٔ موردنظر دیگر
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("requirement.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-requirement-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const requirement = await loadScopedRequirement(auth.user.id, id);
  if (!requirement) return errData(404, "NOT_FOUND", "نیازمندی یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validateRequirementLocationInput(body as Record<string, unknown>);
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);

  const row = await db
    .insertInto("requirement_locations")
    .values({
      requirement_id: id,
      city_id: validated.data.cityId!,
      district_id: validated.data.districtId ?? null,
      market_zone_id: validated.data.marketZoneId ?? null,
      neighborhood_id: validated.data.neighborhoodId ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "create", "requirement_location", row.id, { requirementId: id });

  return okData(row, undefined, 201);
}
