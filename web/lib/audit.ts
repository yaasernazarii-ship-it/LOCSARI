import { db } from "./db";

export type AuditAction = "create" | "update" | "delete";

/** ثبت لاگ عملیات نوشتاری Admin — زیرساخت پایهٔ Audit Log که از فاز ۲ به بعد قابل توسعه است. */
export async function logAdminAction(
  userId: number,
  action: AuditAction,
  entityType: string,
  entityId: number,
  meta?: Record<string, unknown>
): Promise<void> {
  await db
    .insertInto("admin_audit_logs")
    .values({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      meta: meta ? JSON.stringify(meta) : null,
    })
    .execute();
}
