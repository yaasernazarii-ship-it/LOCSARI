import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCrmPermission, parsePagination, okData, errData } from "@/lib/crmResponse";
import { resolveCrmScope, scopeAllowsRow } from "@/lib/crmScope";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

// GET /api/crm/customers/[id]/timeline — Timeline کسب‌وکاری Chronological (بخش ۱۱)
// شامل فعالیت‌های ثبت‌شده روی خودِ مشتری + Requirement/Visit/Follow-up/Task مرتبط با او + سرنخ مبدأ (در صورت وجود).
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireCrmPermission("crm.activity.view");
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return errData(400, "INVALID_ID", "شناسهٔ نامعتبر است");

  const scope = await resolveCrmScope(auth.user.id);
  const customer = await db.selectFrom("customers").selectAll().where("id", "=", id).executeTakeFirst();
  if (!customer) return errData(404, "NOT_FOUND", "مشتری یافت نشد");
  const allowed = scopeAllowsRow(scope, { agencyId: customer.agency_id, assignedToUserId: customer.assigned_to_user_id, createdByUserId: customer.created_by_user_id });
  if (!allowed) return errData(404, "NOT_FOUND", "مشتری یافت نشد");

  const [requirementIds, visitIds, followUpIds, taskIds] = await Promise.all([
    db.selectFrom("customer_requirements").select("id").where("customer_id", "=", id).execute(),
    db.selectFrom("crm_visits").select("id").where("customer_id", "=", id).execute(),
    db.selectFrom("crm_follow_ups").select("id").where("customer_id", "=", id).execute(),
    db.selectFrom("crm_tasks").select("id").where("related_entity_type", "=", "customer").where("related_entity_id", "=", id).execute(),
  ]);

  const { page, limit, offset } = parsePagination(req);

  const applyFilter = <QB extends { where: (cb: (eb: any) => any) => QB }>(qb: QB): QB =>
    qb.where((eb) => {
      const conditions = [eb.and([eb("entity_type", "=", "customer"), eb("entity_id", "=", id)])];
      if (requirementIds.length) conditions.push(eb.and([eb("entity_type", "=", "customer_requirement"), eb("entity_id", "in", requirementIds.map((r) => r.id))]));
      if (visitIds.length) conditions.push(eb.and([eb("entity_type", "=", "crm_visit"), eb("entity_id", "in", visitIds.map((r) => r.id))]));
      if (followUpIds.length) conditions.push(eb.and([eb("entity_type", "=", "crm_follow_up"), eb("entity_id", "in", followUpIds.map((r) => r.id))]));
      if (taskIds.length) conditions.push(eb.and([eb("entity_type", "=", "crm_task"), eb("entity_id", "in", taskIds.map((r) => r.id))]));
      if (customer.source_lead_id) conditions.push(eb.and([eb("entity_type", "=", "lead"), eb("entity_id", "=", customer.source_lead_id)]));
      return eb.or(conditions);
    });

  const query = applyFilter(db.selectFrom("crm_activities").selectAll()).orderBy("created_at", "desc").limit(limit).offset(offset);
  const countQuery = applyFilter(db.selectFrom("crm_activities")).select((eb) => eb.fn.countAll().as("count"));

  const [rows, totalRow] = await Promise.all([query.execute(), countQuery.executeTakeFirst()]);

  return okData(rows, { page, limit, total: Number(totalRow?.count ?? 0) });
}
