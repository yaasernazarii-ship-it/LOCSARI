// کمک‌تابع مشترک برای پیدا کردن آژانسی که کاربر روی آن دسترسی مدیریتی دارد (فاز ۶، بخش ۸)
// «مدیریتی» یعنی عضویت فعال با نقش owner یا manager — نه صرفاً owner_user_id، چون در آینده
// Agency Manager هم می‌تواند از طریق agency_memberships دعوت شود (پایهٔ Employee Foundation، بخش ۲۲).

import { db } from "./db";

export async function getManagedAgencyId(userId: number): Promise<number | null> {
  const membership = await db
    .selectFrom("agency_memberships")
    .select(["agency_id"])
    .where("user_id", "=", userId)
    .where("status", "=", "active")
    .where("membership_role", "in", ["owner", "manager"])
    .executeTakeFirst();
  return membership?.agency_id ?? null;
}
