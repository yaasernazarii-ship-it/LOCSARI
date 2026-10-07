// ثبت Timeline کسب‌وکاری CRM (بخش ۱۱ و ۲۷) — مستقل از admin_audit_logs (که برای Compliance سیستمی است)

import { DbOrTx } from "./propertyAttributes";
import { db } from "./db";

export type CrmEntityType = "lead" | "customer" | "customer_requirement" | "crm_visit" | "crm_follow_up" | "crm_task";

export async function logCrmActivity(
  dbOrTx: DbOrTx,
  entityType: CrmEntityType,
  entityId: number,
  activityType: string,
  description: string,
  userId: number | null,
  meta?: Record<string, unknown>
): Promise<void> {
  await dbOrTx
    .insertInto("crm_activities")
    .values({
      entity_type: entityType,
      entity_id: entityId,
      activity_type: activityType,
      description,
      meta: meta ? JSON.stringify(meta) : null,
      created_by_user_id: userId,
    })
    .execute();
}

export { db };
