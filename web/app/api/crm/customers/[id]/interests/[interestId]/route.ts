import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string; interestId: string } };

// DELETE /api/crm/customers/[id]/interests/[interestId]
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("customer.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-interest-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const customerId = parseId(params.id);
  const interestId = parseId(params.interestId);
  if (!customerId || !interestId) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const scope = await resolveCrmScope(auth.user.id);
  const customer = await db.selectFrom("customers").selectAll().where("id", "=", customerId).executeTakeFirst();
  if (!customer) return errData(404, "NOT_FOUND", "مشتری یافت نشد");
  const allowed = scopeAllowsRow(scope, { agencyId: customer.agency_id, assignedToUserId: customer.assigned_to_user_id, createdByUserId: customer.created_by_user_id });
  if (!allowed) return errData(404, "NOT_FOUND", "مشتری یافت نشد");

  const interest = await db.selectFrom("customer_property_interests").select("id").where("id", "=", interestId).where("customer_id", "=", customerId).executeTakeFirst();
  if (!interest) return errData(404, "NOT_FOUND", "علاقه‌مندی یافت نشد");

  await db.deleteFrom("customer_property_interests").where("id", "=", interestId).execute();
  await logAdminAction(auth.user.id, "delete", "customer_property_interest", interestId, { customerId });

  return okData({ id: interestId });
}
