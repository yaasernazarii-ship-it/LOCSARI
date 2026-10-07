import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";

type Params = { params: { id: string } };

// PATCH /api/account/memberships/[id] — پذیرش/رد دعوتِ آژانس توسط خودِ کاربر دعوت‌شده (بخش ۱۹)
// فقط برای عضویت‌هایی که آغازگرشان آژانس بوده (invited_by_user_id ست‌شده)؛ IDOR-safe: ۴۰۴ برای غیرمرتبط.
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePermission("membership.view");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`membership-self:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const membershipId = parseId(params.id);
  if (!membershipId) return NextResponse.json({ error: "شناسهٔ نامعتبر است" }, { status: 400 });

  const membership = await db
    .selectFrom("agency_memberships")
    .selectAll()
    .where("id", "=", membershipId)
    .where("user_id", "=", auth.user.id)
    .executeTakeFirst();
  if (!membership) return NextResponse.json({ error: "عضویت یافت نشد" }, { status: 404 });

  if (membership.invited_by_user_id === null) {
    return NextResponse.json({ error: "این عضویت با درخواستِ خودِ شما ایجاد شده؛ باید توسط آژانس بررسی شود" }, { status: 400 });
  }
  if (membership.status !== "pending") {
    return NextResponse.json({ error: "این دعوت دیگر در انتظار نیست" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const action = (body as { action?: unknown } | null)?.action;
  if (action !== "accept" && action !== "reject") {
    return NextResponse.json({ error: "action نامعتبر است (accept/reject)" }, { status: 400 });
  }
  const nextStatus = action === "accept" ? "active" : "removed";

  if (action === "accept" && membership.consultant_id) {
    const consultant = await db.selectFrom("consultants").select(["agency_id"]).where("id", "=", membership.consultant_id).executeTakeFirst();
    if (consultant?.agency_id && consultant.agency_id !== membership.agency_id) {
      return NextResponse.json({ error: "شما از قبل عضو آژانس دیگری هستید" }, { status: 409 });
    }
  }

  const updated = await db.transaction().execute(async (trx) => {
    const row = await trx
      .updateTable("agency_memberships")
      .set({ status: nextStatus, updated_at: new Date().toISOString() })
      .where("id", "=", membershipId)
      .returningAll()
      .executeTakeFirstOrThrow();

    if (row.consultant_id && nextStatus === "active") {
      await trx
        .updateTable("consultants")
        .set({ agency_id: row.agency_id, updated_at: new Date().toISOString() })
        .where("id", "=", row.consultant_id)
        .execute();
    }
    return row;
  });

  await logAdminAction(auth.user.id, "update", "agency_membership", membershipId, { event: action, self: true });
  return NextResponse.json({ membership: updated });
}
