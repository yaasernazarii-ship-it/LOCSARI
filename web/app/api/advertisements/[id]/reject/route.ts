import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isNonEmptyString, parseId, AdvertisementStatus } from "@/lib/validation";
import { canTransition, transitionAdvertisementStatus } from "@/lib/advertisementWorkflow";

// POST /api/advertisements/:id/reject — فقط بازبین مرکزی، همراه با دلیل رد (بخش ۸ و ۲۳)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("advertisement.reject");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`advertisement-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!isNonEmptyString(reason, 500)) return NextResponse.json({ error: "reason (دلیل رد) الزامی است" }, { status: 400 });

  const ad = await db.selectFrom("advertisements").selectAll().where("id", "=", id).executeTakeFirst();
  if (!ad) return NextResponse.json({ error: "آگهی یافت نشد" }, { status: 404 });

  const from = ad.status as AdvertisementStatus;
  if (!canTransition(from, "rejected")) {
    return NextResponse.json({ error: `تغییر وضعیت از ${from} به rejected مجاز نیست` }, { status: 400 });
  }

  await transitionAdvertisementStatus(db, {
    advertisementId: id,
    from,
    to: "rejected",
    changedBy: auth.user.id,
    reason,
    extra: { rejection_reason: reason },
  });
  await logAdminAction(auth.user.id, "update", "advertisement", id, { action: "reject", reason });

  const advertisement = await db.selectFrom("advertisements").selectAll().where("id", "=", id).executeTakeFirst();
  return NextResponse.json({ advertisement });
}
