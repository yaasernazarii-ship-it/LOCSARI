import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";

// GET /api/account/memberships — همهٔ عضویت‌های آژانسیِ خودِ کاربر واردشده (فاز ۶، بخش ۸)
export async function GET() {
  const auth = await requirePermission("membership.view");
  if (auth.response) return auth.response;

  const memberships = await db
    .selectFrom("agency_memberships")
    .innerJoin("agencies", "agencies.id", "agency_memberships.agency_id")
    .select([
      "agency_memberships.id",
      "agency_memberships.agency_id",
      "agency_memberships.membership_role",
      "agency_memberships.status",
      "agency_memberships.invited_by_user_id",
      "agency_memberships.created_at",
      "agencies.name as agency_name",
      "agencies.slug as agency_slug",
    ])
    .where("agency_memberships.user_id", "=", auth.user.id)
    .orderBy("agency_memberships.created_at", "desc")
    .execute();

  return NextResponse.json({ memberships });
}
