// منطق تبدیل Lead به Customer (بخش ۱۳ پرامپت فاز ۷.۲)
// قوانین: Lead هرگز حذف نمی‌شود (حفظ تاریخچه)؛ اگر موبایل با مشتری موجود مطابقت داشت به همان مشتری لینک می‌شود
// (جلوگیری از تکرار مشتری، به‌کمک UNIQUE روی customers.mobile)؛ در غیر این صورت مشتری جدید ساخته می‌شود.
// همیشه باید داخل یک Transaction فراخوانی شود تا سازگاری Lead/Customer تضمین شود.

import { Transaction } from "kysely";
import { Database } from "./db";

export type ConvertLeadResult =
  | { ok: true; customerId: number; linkedToExistingCustomer: boolean }
  | { ok: false; error: string };

export async function convertLeadToCustomer(
  tx: Transaction<Database>,
  leadId: number,
  actingUserId: number
): Promise<ConvertLeadResult> {
  const lead = await tx.selectFrom("leads").selectAll().where("id", "=", leadId).executeTakeFirst();
  if (!lead) return { ok: false, error: "سرنخ یافت نشد" };
  if (lead.status === "converted" || lead.converted_customer_id) {
    return { ok: false, error: "این سرنخ قبلاً به مشتری تبدیل شده است" };
  }

  // جلوگیری از تکرار مشتری: ابتدا بر اساس موبایل جستجو می‌شود
  const existing = await tx.selectFrom("customers").select(["id"]).where("mobile", "=", lead.mobile).executeTakeFirst();

  let customerId: number;
  let linkedToExistingCustomer: boolean;

  if (existing) {
    customerId = existing.id;
    linkedToExistingCustomer = true;
  } else {
    const created = await tx
      .insertInto("customers")
      .values({
        source_lead_id: lead.id,
        agency_id: lead.agency_id,
        assigned_to_user_id: lead.assigned_to_user_id,
        name: lead.name,
        mobile: lead.mobile,
        created_by_user_id: actingUserId,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    customerId = created.id;
    linkedToExistingCustomer = false;
  }

  await tx
    .updateTable("leads")
    .set({ status: "converted", converted_customer_id: customerId, converted_at: new Date().toISOString() })
    .where("id", "=", leadId)
    .execute();

  return { ok: true, customerId, linkedToExistingCustomer };
}
