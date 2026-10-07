import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow } from "@/lib/crmScope";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { logCrmActivity } from "@/lib/crmActivity";
import { validateLeadInput } from "@/lib/crmValidation";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

async function loadScopedLead(userId: number, id: number) {
  const scope = await resolveCrmScope(userId);
  const lead = await db.selectFrom("leads").selectAll().where("id", "=", id).executeTakeFirst();
  if (!lead) return { scope, lead: null };
  const allowed = scopeAllowsRow(scope, {
    agencyId: lead.agency_id,
    assignedToUserId: lead.assigned_to_user_id,
    createdByUserId: lead.created_by_user_id,
  });
  return { scope, lead: allowed ? lead : null };
}

// GET /api/crm/leads/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("lead.view");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const { lead } = await loadScopedLead(auth.user.id, id);
  // در صورت عدم مجاز بودن یا عدم وجود، همیشه 404 یکسان — بدون افشای وجود رکورد (بخش ۲۲)
  if (!lead) return errData(404, "NOT_FOUND", "سرنخ یافت نشد");

  return okData(lead);
}

// PATCH /api/crm/leads/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("lead.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-lead-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const { lead } = await loadScopedLead(auth.user.id, id);
  if (!lead) return errData(404, "NOT_FOUND", "سرنخ یافت نشد");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return errData(400, "INVALID_BODY", "بدنهٔ درخواست نامعتبر است");

  const validated = await validateLeadInput(body as Record<string, unknown>, { partial: true });
  if (!validated.ok) return errData(400, "VALIDATION_ERROR", validated.error);
  const data = validated.data;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) update.name = data.name;
  if (data.mobile !== undefined) update.mobile = data.mobile;
  if (data.source !== undefined) update.source = data.source;
  if (data.status !== undefined) update.status = data.status;
  if (data.agencyId !== undefined) update.agency_id = data.agencyId;
  if (data.assignedToUserId !== undefined) update.assigned_to_user_id = data.assignedToUserId;
  if (data.notes !== undefined) update.notes = data.notes;

  const updated = await db.updateTable("leads").set(update).where("id", "=", id).returningAll().executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "lead", id, { fields: Object.keys(update) });
  if (data.assignedToUserId !== undefined) {
    await logCrmActivity(db, "lead", id, "assigned", "سرنخ واگذار شد", auth.user.id, { assignedToUserId: data.assignedToUserId });
  }
  if (data.status !== undefined) {
    await logCrmActivity(db, "lead", id, "status_changed", `وضعیت سرنخ به ${data.status} تغییر کرد`, auth.user.id, { status: data.status });
  }

  return okData(updated);
}

// DELETE /api/crm/leads/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("lead.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`crm-lead-write:${getClientIp(req)}`)) return errData(429, "RATE_LIMITED", "تعداد درخواست بیش از حد مجاز است");

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const { lead } = await loadScopedLead(auth.user.id, id);
  if (!lead) return errData(404, "NOT_FOUND", "سرنخ یافت نشد");

  await db.deleteFrom("leads").where("id", "=", id).execute();
  await logAdminAction(auth.user.id, "delete", "lead", id);

  return okData({ id });
}
