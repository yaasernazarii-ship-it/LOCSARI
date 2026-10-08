import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId, AdvertisementStatus } from "@/lib/validation";
import { canTransition, transitionAdvertisementStatus, DEFAULT_LISTING_DURATION_DAYS } from "@/lib/advertisementWorkflow";

// POST /api/advertisements/:id/publish — فقط بازبین مرکزی (advertisement.publish، بخش ۸ و ۲۳)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("advertisement.publish");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`advertisement-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const ad = await db.selectFrom("advertisements").selectAll().where("id", "=", id).executeTakeFirst();
  if (!ad) return NextResponse.json({ error: "آگهی یافت نشد" }, { status: 404 });

  const from = ad.status as AdvertisementStatus;
  if (!canTransition(from, "published")) {
    return NextResponse.json({ error: `تغییر وضعیت از ${from} به published مجاز نیست` }, { status: 400 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await transitionAdvertisementStatus(db, {
    advertisementId: id,
    from,
    to: "published",
    changedBy: auth.user.id,
    extra: { published_at: now.toISOString(), expires_at: expiresAt },
  });
  await logAdminAction(auth.user.id, "update", "advertisement", id, { action: "publish" });

  const advertisement = await db.selectFrom("advertisements").selectAll().where("id", "=", id).executeTakeFirst();
  return NextResponse.json({ advertisement });
}
