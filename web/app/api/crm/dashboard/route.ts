import { db } from "@/lib/db";
import { requireCrmPermission, okData } from "@/lib/crmResponse";
import { resolveCrmScope, agencyIdsOrNone, idsOrNone, resolveAgencyRelatedIds } from "@/lib/crmScope";
import { sql } from "kysely";

// GET /api/crm/dashboard — تجمیع آماری داشبورد CRM (بخش ۲۱)، محدود به Scope کاربر (crm.report.view)
export async function GET() {
  const auth = await requireCrmPermission("crm.report.view");
  if (auth.response) return auth.response;

  const scope = await resolveCrmScope(auth.user.id);

  let leadQuery = db.selectFrom("leads");
  let customerQuery = db.selectFrom("customers");
  let requirementQuery = db.selectFrom("customer_requirements");
  let followUpQuery = db.selectFrom("crm_follow_ups");
  let visitQuery = db.selectFrom("crm_visits");
  let taskQuery = db.selectFrom("crm_tasks");

  if (scope.kind === "agency") {
    const ids = agencyIdsOrNone(scope);
    leadQuery = leadQuery.where("agency_id", "in", ids);
    customerQuery = customerQuery.where("agency_id", "in", ids);
    const { leadIds, customerIds, requirementIds: reqIds, visitIds, followUpIds } = await resolveAgencyRelatedIds(db, ids);
    requirementQuery = requirementQuery.where("customer_id", "in", idsOrNone(customerIds));
    followUpQuery = followUpQuery.where((eb) => eb.or([eb("lead_id", "in", idsOrNone(leadIds)), eb("customer_id", "in", idsOrNone(customerIds))]));
    visitQuery = visitQuery.where("customer_id", "in", idsOrNone(customerIds));
    taskQuery = taskQuery.where((eb) =>
      eb.or([
        eb.and([eb("related_entity_type", "=", "lead"), eb("related_entity_id", "in", idsOrNone(leadIds))]),
        eb.and([eb("related_entity_type", "=", "customer"), eb("related_entity_id", "in", idsOrNone(customerIds))]),
        eb.and([eb("related_entity_type", "=", "customer_requirement"), eb("related_entity_id", "in", idsOrNone(reqIds))]),
        eb.and([eb("related_entity_type", "=", "crm_visit"), eb("related_entity_id", "in", idsOrNone(visitIds))]),
        eb.and([eb("related_entity_type", "=", "crm_follow_up"), eb("related_entity_id", "in", idsOrNone(followUpIds))]),
      ])
    );
  } else if (scope.kind === "assigned") {
    const mine = (eb: any) => eb.or([eb("assigned_to_user_id", "=", scope.userId), eb("created_by_user_id", "=", scope.userId)]);
    leadQuery = leadQuery.where(mine);
    customerQuery = customerQuery.where(mine);
    requirementQuery = requirementQuery.where(mine);
    followUpQuery = followUpQuery.where(mine);
    visitQuery = visitQuery.where(mine);
    taskQuery = taskQuery.where(mine);
  }

  const [
    leadsByStatus,
    customersByStatus,
    requirementsByStatus,
    followUpsPending,
    visitsScheduled,
    tasksOpen,
    tasksOverdue,
    pipelineDistribution,
  ] = await Promise.all([
    leadQuery.select(["status"]).select((eb) => eb.fn.countAll().as("count")).groupBy("status").execute(),
    customerQuery.select(["status"]).select((eb) => eb.fn.countAll().as("count")).groupBy("status").execute(),
    requirementQuery.select(["status"]).select((eb) => eb.fn.countAll().as("count")).groupBy("status").execute(),
    followUpQuery.where("status", "=", "pending").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
    visitQuery.where("status", "=", "scheduled").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
    taskQuery.where("status", "!=", "done").select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
    taskQuery.where("status", "!=", "done").where("due_at", "is not", null).where("due_at", "<", sql<Date>`now()`).select((eb) => eb.fn.countAll().as("count")).executeTakeFirst(),
    db
      .selectFrom("crm_pipeline_cards as pc")
      .innerJoin("crm_pipeline_stages as ps", "ps.id", "pc.stage_id")
      .select(["ps.id as stage_id", "ps.title_fa as stage_title", "ps.pipeline_id as pipeline_id"])
      .select((eb) => eb.fn.countAll().as("count"))
      .groupBy(["ps.id", "ps.title_fa", "ps.pipeline_id"])
      .execute(),
  ]);

  return okData({
    leadsByStatus: leadsByStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
    customersByStatus: customersByStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
    requirementsByStatus: requirementsByStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
    followUpsPending: Number(followUpsPending?.count ?? 0),
    visitsScheduled: Number(visitsScheduled?.count ?? 0),
    tasksOpen: Number(tasksOpen?.count ?? 0),
    tasksOverdue: Number(tasksOverdue?.count ?? 0),
    pipelineDistribution: pipelineDistribution.map((r) => ({ pipelineId: r.pipeline_id, stageId: r.stage_id, stageTitle: r.stage_title, count: Number(r.count) })),
  });
}
