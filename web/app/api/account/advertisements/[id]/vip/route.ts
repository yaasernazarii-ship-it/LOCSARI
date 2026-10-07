import { NextRequest, NextResponse } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db";
import { requirePermission, isPropertyReviewer } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { getActiveVipSubscription, getActiveVipSubscriptionForAgency } from "@/lib/vip";
import { userHasPermission } from "@/lib/rbac";
import { isValidAparatUrl } from "@/lib/aparat";

// namespace‌های قفل مشاوره‌ای پستگرس برای سریال‌سازی فعال‌سازی VIP در سطح آژانس/کاربر (از تصادف با سایر قفل‌ها جلوگیری می‌کند)
const VIP_LOCK_NAMESPACE_AGENCY = 823001;
const VIP_LOCK_NAMESPACE_USER = 823002;

// POST /api/account/advertisements/:id/vip — فعال/غیرفعال‌سازی نمایش VIP روی یک آگهی.
// کاربر عادی: فقط روی آگهی خودش و فقط با داشتن یک اشتراک VIP فعال ممکن است؛ انقضای VIP هرگز از انقضای
// خودِ اشتراک فراتر نمی‌رود. ادمین (دارای مجوز vip.manage): می‌تواند بدون نیاز به اشتراک، هر آگهی‌ای را
// VIP کند (بدون تاریخ انقضا) و لینک ویدیوی آپارات مخصوص همان آگهی را نیز تنظیم کند (فقط ادمین).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("advertisement.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`vip-ad-toggle:${auth.user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const ad = await db.selectFrom("advertisements").selectAll().where("id", "=", id).executeTakeFirst();
  if (!ad) return NextResponse.json({ error: "آگهی یافت نشد" }, { status: 404 });

  const reviewer = await isPropertyReviewer(auth.user.id);
  const isAdmin = await userHasPermission(auth.user.id, "vip.manage");
  if (!reviewer && !isAdmin && ad.created_by_user_id !== auth.user.id) {
    return NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 });
  }
  if (["archived", "rejected"].includes(ad.status)) {
    return NextResponse.json({ error: "آگهی در این وضعیت قابل تبدیل به VIP نیست" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const enable = body?.enable === true;

  if (!enable) {
    const updated = await db
      .updateTable("advertisements")
      .set({ is_vip: false, vip_expires_at: null, vip_video_url: null, updated_at: new Date().toISOString() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await logAdminAction(auth.user.id, "update", "advertisement", id, { vip: false });
    return NextResponse.json({ advertisement: updated });
  }

  // لینک ویدیوی آپارات: فقط ادمین (vip.manage) می‌تواند تنظیم کند؛ از کاربر عادی نادیده گرفته می‌شود.
  let videoUrl: string | null | undefined = undefined;
  if (isAdmin && body && "videoUrl" in body) {
    const raw = body.videoUrl;
    if (raw === null || raw === "") {
      videoUrl = null;
    } else if (isValidAparatUrl(raw)) {
      videoUrl = raw.trim();
    } else {
      return NextResponse.json({ error: "لینک ویدیوی آپارات نامعتبر است" }, { status: 400 });
    }
  }

  let updated;
  if (!isAdmin) {
    const scopeId = ad.agency_id ?? ad.created_by_user_id;
    const lockNamespace = ad.agency_id !== null ? VIP_LOCK_NAMESPACE_AGENCY : VIP_LOCK_NAMESPACE_USER;
    const result = await db.transaction().execute(async (tx) => {
      await sql`select pg_advisory_xact_lock(${lockNamespace}, ${scopeId})`.execute(tx);

      const subscription = ad.agency_id
        ? await getActiveVipSubscriptionForAgency(tx, ad.agency_id)
        : await getActiveVipSubscription(tx, ad.created_by_user_id);
      if (!subscription) return { error: "برای فعال‌سازی VIP باید ابتدا یک اشتراک VIP فعال تهیه کنید", status: 403 as const };

      const activeVipAds = await tx
        .selectFrom("advertisements")
        .select("id")
        .where("is_vip", "=", true)
        .where("id", "!=", ad.id)
        .where((eb) =>
          ad.agency_id !== null
            ? eb("agency_id", "=", ad.agency_id)
            : eb("created_by_user_id", "=", ad.created_by_user_id)
        )
        .where((eb) => eb.or([eb("vip_expires_at", "is", null), eb("vip_expires_at", ">", new Date())]))
        .execute();
      if (activeVipAds.length >= subscription.ad_limit) {
        return { error: `سقف ${subscription.ad_limit.toLocaleString("fa-IR")} آگهی VIP این اشتراک تکمیل شده است`, status: 409 as const };
      }

      const advertisement = await tx
        .updateTable("advertisements")
        .set({ is_vip: true, vip_expires_at: null, updated_at: new Date().toISOString() })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return { advertisement };
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    updated = result.advertisement;
  } else {
    const subscription = await getActiveVipSubscription(db, ad.created_by_user_id);
    const vipExpiresAt = subscription?.ends_at ? (subscription.ends_at instanceof Date ? subscription.ends_at : new Date(subscription.ends_at)) : null;
    updated = await db
      .updateTable("advertisements")
      .set({
        is_vip: true,
        vip_expires_at: vipExpiresAt ? vipExpiresAt.toISOString() : null,
        ...(videoUrl !== undefined ? { vip_video_url: videoUrl } : {}),
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  await logAdminAction(auth.user.id, "update", "advertisement", id, {
    vip: true,
    vipExpiresAt: updated.vip_expires_at ? new Date(updated.vip_expires_at).toISOString() : null,
  });
  return NextResponse.json({ advertisement: updated });
}
