import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { validateAndSaveRequirementAttributes, getRequirementAttributes, AttributeInput } from "@/lib/crmRequirementAttributes";
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

// GET /api/crm/requirements/[id]/attributes — فیلدهای پویای نیازمندی (بخش ۱۲، دقیقاً هم‌ساختار Property Attributes)
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("requirement.view");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const requirement = await loadScopedRequirement(auth.user.id, id);
  if (!requirement) return errData(404, "NOT_FOUND", "نیازمندی یافت نشد");

  const attributes = await getRequirementAttributes(id);
  return okData(attributes);
}

// PUT /api/crm/requirements/[id]/attributes — جایگزینیِ کامل فیلدهای پویا (Set-Replace، مثل الگوی Property)
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("requirement.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-requirement-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const requirement = await loadScopedRequirement(auth.user.id, id);
  if (!requirement) return errData(404, "NOT_FOUND", "نیازمندی یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !Array.isArray((body as Record<string, unknown>).attributes))
    return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const rawAttributes = (body as Record<string, unknown>).attributes as unknown[];
  const attributes: AttributeInput[] = [];
  for (const a of rawAttributes) {
    if (!a || typeof a !== "object" || !("fieldId" in a) || !("value" in a)) return errData(400, "VALIDATION_ERROR", "ساختار attributes نامعتبر است");
    attributes.push({ fieldId: Number((a as { fieldId: unknown }).fieldId), value: (a as { value: unknown }).value });
  }

  const result = await db.transaction().execute((trx) => validateAndSaveRequirementAttributes(trx, id, requirement.category_id, attributes));
  if (!result.ok) return errData(400, "VALIDATION_ERROR", result.error);

  await logAdminAction(auth.user.id, "update", "customer_requirement", id, { action: "attributes_replaced" });

  const attributesResult = await getRequirementAttributes(id);
  return okData(attributesResult);
}
