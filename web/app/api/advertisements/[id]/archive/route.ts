import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, isPropertyReviewer } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId, AdvertisementStatus } from "@/lib/validation";
import { canTransition, transitionAdvertisementStatus } from "@/lib/advertisementWorkflow";

// POST /api/advertisements/:id/archive — مالک یا بازبین مرکزی می‌توانند آگهی را آرشیو کنند (بخش ۲۱)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("advertisement.archive");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`advertisement-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const ad = await db.selectFrom("advertisements").selectAll().where("id", "=", id).executeTakeFirst();
  if (!ad) return NextResponse.json({ error: "آگهی یافت نشد" }, { status: 404 });

  const reviewer = await isPropertyReviewer(auth.user.id);
  if (!reviewer && ad.created_by_user_id !== auth.user.id) {
    return NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 });
  }

  const from = ad.status as AdvertisementStatus;
  if (!canTransition(from, "archived")) {
    return NextResponse.json({ error: `تغییر وضعیت از ${from} به archived مجاز نیست` }, { status: 400 });
  }

  await transitionAdvertisementStatus(db, { advertisementId: id, from, to: "archived", changedBy: auth.user.id });
  await logAdminAction(auth.user.id, "update", "advertisement", id, { action: "archive" });

  const advertisement = await db.selectFrom("advertisements").selectAll().where("id", "=", id).executeTakeFirst();
  return NextResponse.json({ advertisement });
}
