import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow, CrmScope } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { logCrmActivity } from "@/lib/crmActivity";
import { validateRequirementInput } from "@/lib/crmValidation";
import { getRequirementAttributes } from "@/lib/crmRequirementAttributes";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

async function loadScopedRequirement(scope: CrmScope, id: number) {
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

// GET /api/crm/requirements/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("requirement.view");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const scope = await resolveCrmScope(auth.user.id);
  const requirement = await loadScopedRequirement(scope, id);
  if (!requirement) return errData(404, "NOT_FOUND", "نیازمندی یافت نشد");

  const [locations, attributes] = await Promise.all([
    db.selectFrom("requirement_locations").selectAll().where("requirement_id", "=", id).execute(),
    getRequirementAttributes(id),
  ]);

  return okData({ ...requirement, locations, attributes });
}

// PATCH /api/crm/requirements/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("requirement.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-requirement-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const scope = await resolveCrmScope(auth.user.id);
  const requirement = await loadScopedRequirement(scope, id);
  if (!requirement) return errData(404, "NOT_FOUND", "نیازمندی یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validateRequirementInput(body as Record<string, unknown>, { partial: true });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.categoryId !== undefined) update.category_id = data.categoryId;
  if (data.transactionType !== undefined) update.transaction_type = data.transactionType;
  if (data.minPrice !== undefined) update.min_price = data.minPrice;
  if (data.maxPrice !== undefined) update.max_price = data.maxPrice;
  if (data.minDeposit !== undefined) update.min_deposit = data.minDeposit;
  if (data.maxDeposit !== undefined) update.max_deposit = data.maxDeposit;
  if (data.minMonthlyRent !== undefined) update.min_monthly_rent = data.minMonthlyRent;
  if (data.maxMonthlyRent !== undefined) update.max_monthly_rent = data.maxMonthlyRent;
  if (data.minArea !== undefined) update.min_area = data.minArea;
  if (data.maxArea !== undefined) update.max_area = data.maxArea;
  if (data.bedrooms !== undefined) update.bedrooms = data.bedrooms;
  if (data.status !== undefined) update.status = data.status;
  if (data.priority !== undefined) update.priority = data.priority;
  if (data.notes !== undefined) update.notes = data.notes;
  if (data.assignedToUserId !== undefined) update.assigned_to_user_id = data.assignedToUserId;

  const updated = await db.updateTable("customer_requirements").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "customer_requirement", id, { fields: Object.keys(update) });
  if (data.assignedToUserId !== undefined) {
    await logCrmActivity(db, "customer_requirement", id, "assigned", "نیازمندی واگذار شد", auth.user.id, { assignedToUserId: data.assignedToUserId });
  }
  if (data.status !== undefined) {
    await logCrmActivity(db, "customer_requirement", id, "status_changed", `وضعیت نیازمندی به ${data.status} تغییر کرد`, auth.user.id, { status: data.status });
  }

  return okData(updated);
}

// DELETE /api/crm/requirements/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("requirement.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-requirement-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const scope = await resolveCrmScope(auth.user.id);
  const requirement = await loadScopedRequirement(scope, id);
  if (!requirement) return errData(404, "NOT_FOUND", "نیازمندی یافت نشد");

  await db.deleteFrom("customer_requirements").where("id", "=", id).execute();
  await logAdminAction(auth.user.id, "delete", "customer_requirement", id);

  return okData({ id });
}
