import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string; locationId: string } };

// DELETE /api/crm/requirements/[id]/locations/[locationId]
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("requirement.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-requirement-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  const locationId = parseId(params.locationId);
  if (!id || !locationId) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const scope = await resolveCrmScope(auth.user.id);
  const requirement = await db.selectFrom("customer_requirements").selectAll().where("id", "=", id).executeTakeFirst();
  if (!requirement) return errData(404, "NOT_FOUND", "نیازمندی یافت نشد");
  const customer = await db.selectFrom("customers").select("agency_id").where("id", "=", requirement.customer_id).executeTakeFirst();
  const allowed = scopeAllowsRow(scope, {
    agencyId: customer?.agency_id ?? null,
    assignedToUserId: requirement.assigned_to_user_id,
    createdByUserId: requirement.created_by_user_id,
  });
  if (!allowed) return errData(404, "NOT_FOUND", "نیازمندی یافت نشد");

  const location = await db.selectFrom("requirement_locations").select("id").where("id", "=", locationId).where("requirement_id", "=", id).executeTakeFirst();
  if (!location) return errData(404, "NOT_FOUND", "منطقهٔ موردنظر یافت نشد");

  await db.deleteFrom("requirement_locations").where("id", "=", locationId).execute();
  await logAdminAction(auth.user.id, "delete", "requirement_location", locationId, { requirementId: id });

  return okData({ id: locationId });
}
