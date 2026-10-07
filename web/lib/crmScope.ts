// تعیین دامنهٔ دسترسی CRM بر اساس نقش کاربر (بخش ۱۷، ۱۸، ۱۹، ۲۰، ۲۲ پرامپت فاز ۷.۳)
// Authorization همیشه سمت سرور و مستقیماً از دیتابیس تصمیم‌گیری می‌شود؛ به JWT اعتماد نمی‌شود.

import { db } from "./db";
import { getUserRoleKeys } from "./rbac";
import { DbOrTx } from "./propertyAttributes";

export type CrmScope =
  | { kind: "full" } // super_admin, system_admin, crm_manager — دسترسی کامل سیستمی
  | { kind: "agency"; agencyIds: number[] } // agency_manager — فقط دامنهٔ آژانس(های) خودش
  | { kind: "assigned"; userId: number }; // consultant, employee — فقط دادهٔ واگذارشده/ایجادشده توسط خودش

const FULL_ACCESS_ROLES = ["super_admin", "system_admin", "crm_manager"];

/** دامنهٔ CRM کاربر را از روی نقش‌های واقعی او (نه ادعای Client) محاسبه می‌کند. */
export async function resolveCrmScope(userId: number): Promise<CrmScope> {
  const roles = await getUserRoleKeys(userId);

  if (roles.some((r) => FULL_ACCESS_ROLES.includes(r))) {
    return { kind: "full" };
  }

  if (roles.includes("agency_manager")) {
    const owned = await db.selectFrom("agencies").select("id").where("owner_user_id", "=", userId).execute();
    const managed = await db
      .selectFrom("agency_memberships")
      .select("agency_id")
      .where("user_id", "=", userId)
      .where("membership_role", "=", "manager")
      .where("status", "=", "active")
      .execute();
    const ids = Array.from(new Set([...owned.map((a) => a.id), ...managed.map((m) => m.agency_id)]));
    return { kind: "agency", agencyIds: ids };
  }

  // consultant/employee/سایر نقش‌های بدون دسترسی سیستمی: فقط دادهٔ واگذارشده به خودشان یا ایجادشده توسط خودشان
  return { kind: "assigned", userId };
}

/**
 * بررسی IDOR-Safe یک رکورد منفرد در برابر دامنهٔ کاربر.
 * agencyId باید از رکورد خودش (Lead/Customer) یا از طریق join به Customer/Lead والد (برای Entityهای فرزند) محاسبه شود.
 */
export function scopeAllowsRow(
  scope: CrmScope,
  row: { agencyId: number | null; assignedToUserId: number | null; createdByUserId: number | null }
): boolean {
  if (scope.kind === "full") return true;
  if (scope.kind === "agency") return row.agencyId !== null && scope.agencyIds.includes(row.agencyId);
  return row.assignedToUserId === scope.userId || row.createdByUserId === scope.userId;
}

/** لیست agencyId معتبر برای فیلتر IN — اگر خالی باشد، هیچ ردیفی نباید برگردد (نه اینکه فیلتر نادیده گرفته شود) */
export function agencyIdsOrNone(scope: Extract<CrmScope, { kind: "agency" }>): number[] {
  return scope.agencyIds.length > 0 ? scope.agencyIds : [-1];
}

/** هر آرایهٔ شناسهٔ خالی را به [-1] تبدیل می‌کند تا فیلتر IN به‌جای نادیده‌گرفته‌شدن، هیچ ردیفی برنگرداند. */
export function idsOrNone(ids: number[]): number[] {
  return ids.length > 0 ? ids : [-1];
}

/**
 * برای دامنهٔ agency، شناسهٔ Lead/Customer/Requirement/Visit/Follow-up های متعلق به آژانس(های) کاربر را محاسبه می‌کند —
 * برای فیلتر لیست‌های سطح‌بالا (Follow-up/Visit/Requirement/Task) که ستون agency_id مستقیم ندارند.
 */
export async function resolveAgencyRelatedIds(dbOrTx: DbOrTx, agencyIds: number[]) {
  const ids = idsOrNone(agencyIds);
  const leadIds = (await dbOrTx.selectFrom("leads").select("id").where("agency_id", "in", ids).execute()).map((r) => r.id);
  const customerIds = (await dbOrTx.selectFrom("customers").select("id").where("agency_id", "in", ids).execute()).map((r) => r.id);
  const custIds = idsOrNone(customerIds);
  const requirementIds = (await dbOrTx.selectFrom("customer_requirements").select("id").where("customer_id", "in", custIds).execute()).map((r) => r.id);
  const visitIds = (await dbOrTx.selectFrom("crm_visits").select("id").where("customer_id", "in", custIds).execute()).map((r) => r.id);
  const followUpIds = (
    await dbOrTx
      .selectFrom("crm_follow_ups")
      .select("id")
      .where((eb) => eb.or([eb("customer_id", "in", custIds), eb("lead_id", "in", idsOrNone(leadIds))]))
      .execute()
  ).map((r) => r.id);
  return { leadIds, customerIds, requirementIds, visitIds, followUpIds };
}

export type OwnerFields = { agencyId: number | null; assignedToUserId: number | null; createdByUserId: number | null };
export type CrmOwnedEntityType = "lead" | "customer" | "customer_requirement" | "crm_visit" | "crm_follow_up" | "crm_task";

/**
 * محاسبهٔ agencyId/assignedToUserId/createdByUserId مؤثر یک Entity برای بررسی IDOR-Safe (بخش ۲۲).
 * برای Entityهای فرزند (Requirement/Visit/Follow-up/Task)، agencyId همیشه از والد (Lead/Customer) استخراج می‌شود —
 * چون خودِ این جداول ستون agency_id ندارند (طبق تصمیم طراحی فاز ۷.۲، بدون رابطهٔ تکراری).
 * خروجی null یعنی خودِ Entity یافت نشد (باید در پاسخ 404 بدون افشای جزئیات ترجمه شود).
 */
export async function getEntityOwnerFields(dbOrTx: DbOrTx, entityType: CrmOwnedEntityType, entityId: number): Promise<OwnerFields | null> {
  switch (entityType) {
    case "lead": {
      const row = await dbOrTx
        .selectFrom("leads")
        .select(["agency_id", "assigned_to_user_id", "created_by_user_id"])
        .where("id", "=", entityId)
        .executeTakeFirst();
      if (!row) return null;
      return { agencyId: row.agency_id, assignedToUserId: row.assigned_to_user_id, createdByUserId: row.created_by_user_id };
    }
    case "customer": {
      const row = await dbOrTx
        .selectFrom("customers")
        .select(["agency_id", "assigned_to_user_id", "created_by_user_id"])
        .where("id", "=", entityId)
        .executeTakeFirst();
      if (!row) return null;
      return { agencyId: row.agency_id, assignedToUserId: row.assigned_to_user_id, createdByUserId: row.created_by_user_id };
    }
    case "customer_requirement": {
      const row = await dbOrTx
        .selectFrom("customer_requirements as cr")
        .innerJoin("customers as c", "c.id", "cr.customer_id")
        .select(["c.agency_id as agency_id", "cr.assigned_to_user_id as assigned_to_user_id", "cr.created_by_user_id as created_by_user_id"])
        .where("cr.id", "=", entityId)
        .executeTakeFirst();
      if (!row) return null;
      return { agencyId: row.agency_id, assignedToUserId: row.assigned_to_user_id, createdByUserId: row.created_by_user_id };
    }
    case "crm_visit": {
      const row = await dbOrTx
        .selectFrom("crm_visits as v")
        .innerJoin("customers as c", "c.id", "v.customer_id")
        .select(["c.agency_id as agency_id", "v.assigned_to_user_id as assigned_to_user_id", "v.created_by_user_id as created_by_user_id"])
        .where("v.id", "=", entityId)
        .executeTakeFirst();
      if (!row) return null;
      return { agencyId: row.agency_id, assignedToUserId: row.assigned_to_user_id, createdByUserId: row.created_by_user_id };
    }
    case "crm_follow_up": {
      const row = await dbOrTx
        .selectFrom("crm_follow_ups as f")
        .leftJoin("leads as l", "l.id", "f.lead_id")
        .leftJoin("customers as c", "c.id", "f.customer_id")
        .select([
          "f.assigned_to_user_id as assigned_to_user_id",
          "f.created_by_user_id as created_by_user_id",
          "l.agency_id as lead_agency_id",
          "c.agency_id as customer_agency_id",
        ])
        .where("f.id", "=", entityId)
        .executeTakeFirst();
      if (!row) return null;
      return {
        agencyId: row.lead_agency_id ?? row.customer_agency_id ?? null,
        assignedToUserId: row.assigned_to_user_id,
        createdByUserId: row.created_by_user_id,
      };
    }
    case "crm_task": {
      const row = await dbOrTx
        .selectFrom("crm_tasks")
        .select(["related_entity_type", "related_entity_id", "assigned_to_user_id", "created_by_user_id"])
        .where("id", "=", entityId)
        .executeTakeFirst();
      if (!row) return null;
      let agencyId: number | null = null;
      if (row.related_entity_type === "lead" && row.related_entity_id) {
        const lead = await dbOrTx.selectFrom("leads").select("agency_id").where("id", "=", row.related_entity_id).executeTakeFirst();
        agencyId = lead?.agency_id ?? null;
      } else if (row.related_entity_type === "customer" && row.related_entity_id) {
        const customer = await dbOrTx.selectFrom("customers").select("agency_id").where("id", "=", row.related_entity_id).executeTakeFirst();
        agencyId = customer?.agency_id ?? null;
      }
      return { agencyId, assignedToUserId: row.assigned_to_user_id, createdByUserId: row.created_by_user_id };
    }
  }
}
