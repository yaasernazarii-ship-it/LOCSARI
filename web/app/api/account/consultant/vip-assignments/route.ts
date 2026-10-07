import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { TASK_STATUSES } from "@/lib/validation";

// GET /api/account/consultant/vip-assignments — فهرست آگهی‌های VIP که به مشاورِ خودِ کاربر واگذار شده
// تا بتواند وضعیت پیگیری و نتیجه را گزارش دهد.
export async function GET() {
  const auth = await requirePermission("consultant.view");
  if (auth.response) return auth.response;

  const consultant = await db.selectFrom("consultants").select("id").where("user_id", "=", auth.user.id).executeTakeFirst();
  if (!consultant) return NextResponse.json({ consultant: false, assignments: [] });

  const assignments = await db
    .selectFrom("vip_ad_assignments")
    .innerJoin("advertisements", "advertisements.id", "vip_ad_assignments.advertisement_id")
    .select([
      "vip_ad_assignments.id",
      "vip_ad_assignments.status",
      "vip_ad_assignments.result_note",
      "vip_ad_assignments.assigned_at",
      "advertisements.id as advertisement_id",
      "advertisements.title as advertisement_title",
      "advertisements.slug as advertisement_slug",
      "advertisements.vip_expires_at",
    ])
    .where("vip_ad_assignments.consultant_id", "=", consultant.id)
    .orderBy("vip_ad_assignments.assigned_at", "desc")
    .execute();

  return NextResponse.json({ consultant: true, statuses: TASK_STATUSES, assignments });
}
