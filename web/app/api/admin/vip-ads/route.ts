import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { TASK_STATUSES } from "@/lib/validation";

// GET /api/admin/vip-ads — لیست آگهی‌های VIP فعال به‌همراه مسئول پیگیری (مشاور)، وضعیت و نتیجه
// برای واگذاری/بازبینی مرکزی توسط ادمین.
export async function GET() {
  const auth = await requirePermission("vip.manage");
  if (auth.response) return auth.response;

  const ads = await db
    .selectFrom("advertisements")
    .innerJoin("users", "users.id", "advertisements.created_by_user_id")
    .leftJoin("vip_ad_assignments", "vip_ad_assignments.advertisement_id", "advertisements.id")
    .leftJoin("consultants", "consultants.id", "vip_ad_assignments.consultant_id")
    .select([
      "advertisements.id",
      "advertisements.title",
      "advertisements.slug",
      "advertisements.status",
      "advertisements.vip_expires_at",
      "users.name as owner_name",
      "users.phone as owner_phone",
      "vip_ad_assignments.id as assignment_id",
      "vip_ad_assignments.consultant_id",
      "vip_ad_assignments.status as assignment_status",
      "vip_ad_assignments.result_note",
      "vip_ad_assignments.assigned_at",
      "consultants.display_name as consultant_name",
    ])
    .where("advertisements.is_vip", "=", true)
    .where((eb) =>
      eb.or([eb("advertisements.vip_expires_at", "is", null), eb("advertisements.vip_expires_at", ">", new Date())])
    )
    .orderBy("advertisements.vip_expires_at", "desc")
    .execute();

  const consultants = await db
    .selectFrom("consultants")
    .select(["id", "display_name"])
    .where("verification_status", "=", "approved")
    .where("is_active", "=", true)
    .orderBy("display_name", "asc")
    .execute();

  return NextResponse.json({
    statuses: TASK_STATUSES,
    consultants,
    ads: ads.map((a) => ({ ...a, assignment_status: a.assignment_status ?? "pending" })),
  });
}
