import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { getManagedAgencyId } from "@/lib/agencyAccess";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

const MANAGE_ACTIONS = ["accept", "reject", "suspend", "reactivate", "remove"] as const;
type ManageAction = (typeof MANAGE_ACTIONS)[number];

// PATCH /api/account/agency/members/[id] — مدیریت عضویت توسط Agency Manager (بخش ۸ و ۱۹)
// accept/reject فقط برای درخواست‌های عضویتِ آغازشده از سمت کاربر (invited_by_user_id=null) معنا دارد؛
// suspend/reactivate/remove برای اعضای فعال.
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePermission("membership.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`membership-manage:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const membershipId = parseId(params.id);
  if (!membershipId) return NextResponse.json({ error: "شناسهٔ نامعتبر است" }, { status: 400 });

  const agencyId = await getManagedAgencyId(auth.user.id);
  if (!agencyId) return NextResponse.json({ error: "آژانسی برای مدیریت یافت نشد" }, { status: 404 });

  const membership = await db
    .selectFrom("agency_memberships")
    .selectAll()
    .where("id", "=", membershipId)
    .where("agency_id", "=", agencyId)
    .executeTakeFirst();
  if (!membership) return NextResponse.json({ error: "عضویت یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const action = (body as { action?: unknown } | null)?.action;
  if (typeof action !== "string" || !MANAGE_ACTIONS.includes(action as ManageAction)) {
    return NextResponse.json({ error: "action نامعتبر است" }, { status: 400 });
  }

  if (membership.membership_role === "owner") {
    return NextResponse.json({ error: "عضویت مالک آژانس قابل تغییر از این مسیر نیست" }, { status: 400 });
  }

  let nextStatus: string;
  if (action === "accept" || action === "reactivate") nextStatus = "active";
  else if (action === "reject") nextStatus = "removed";
  else if (action === "suspend") nextStatus = "suspended";
  else nextStatus = "removed"; // remove

  if ((action === "accept" || action === "reject") && membership.invited_by_user_id !== null) {
    return NextResponse.json({ error: "این عضویت با دعوتِ آژانس ایجاد شده؛ باید توسط خودِ کاربر پذیرفته/رد شود" }, { status: 400 });
  }
  if ((action === "suspend" || action === "reactivate" || action === "remove") && membership.status === "pending") {
    return NextResponse.json({ error: "این عضویت هنوز فعال نشده است" }, { status: 400 });
  }

  // حداکثر یک آژانس برای هر مشاور در این فاز
  if (nextStatus === "active" && membership.consultant_id) {
    const consultant = await db.selectFrom("consultants").select(["agency_id"]).where("id", "=", membership.consultant_id).executeTakeFirst();
    if (consultant?.agency_id && consultant.agency_id !== agencyId) {
      return NextResponse.json({ error: "این مشاور از قبل عضو آژانس دیگری است" }, { status: 409 });
    }
  }

  const updated = await db.transaction().execute(async (trx) => {
    const row = await trx
      .updateTable("agency_memberships")
      .set({ status: nextStatus, updated_at: new Date().toISOString() })
      .where("id", "=", membershipId)
      .returningAll()
      .executeTakeFirstOrThrow();

    if (row.consultant_id) {
      if (nextStatus === "active") {
        await trx.updateTable("consultants").set({ agency_id: agencyId, updated_at: new Date().toISOString() }).where("id", "=", row.consultant_id).execute();
      } else if (nextStatus === "removed" || nextStatus === "suspended") {
        await trx
          .updateTable("consultants")
          .set({ agency_id: null, updated_at: new Date().toISOString() })
          .where("id", "=", row.consultant_id)
          .where("agency_id", "=", agencyId)
          .execute();
      }
    }
    return row;
  });

  await logAdminAction(auth.user.id, "update", "agency_membership", membershipId, { event: action, agencyId });
  return NextResponse.json({ membership: updated });
}
