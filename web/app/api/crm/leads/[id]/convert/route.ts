import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { logCrmActivity } from "@/lib/crmActivity";
import { convertLeadToCustomer } from "@/lib/crmConversion";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

// POST /api/crm/leads/[id]/convert — تبدیل Transactional سرنخ به مشتری (بخش ۴)
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("lead.convert");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-lead-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const scope = await resolveCrmScope(auth.user.id);
  const lead = await db.selectFrom("leads").selectAll().where("id", "=", id).executeTakeFirst();
  if (!lead) return errData(404, "NOT_FOUND", "سرنخ یافت نشد");
  const allowed = scopeAllowsRow(scope, { agencyId: lead.agency_id, assignedToUserId: lead.assigned_to_user_id, createdByUserId: lead.created_by_user_id });
  if (!allowed) return errData(404, "NOT_FOUND", "سرنخ یافت نشد");

  const result = await db.transaction().execute((trx) => convertLeadToCustomer(trx, id, auth.user.id));
  if (!result.ok) return errData(400, "CONVERT_FAILED", result.error);

  await logAdminAction(auth.user.id, "update", "lead", id, { event: "convert", customerId: result.customerId });
  await logCrmActivity(db, "lead", id, "converted", "سرنخ به مشتری تبدیل شد", auth.user.id, { customerId: result.customerId });
  await logCrmActivity(
    db,
    "customer",
    result.customerId,
    result.linkedToExistingCustomer ? "linked_from_lead" : "created_from_lead",
    result.linkedToExistingCustomer ? "سرنخ به مشتری موجود متصل شد" : "مشتری از سرنخ ایجاد شد",
    auth.user.id,
    { leadId: id }
  );

  return okData({ customerId: result.customerId, linkedToExistingCustomer: result.linkedToExistingCustomer });
}
