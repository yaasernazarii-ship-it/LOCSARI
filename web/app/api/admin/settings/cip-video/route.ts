import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { isValidAparatUrl } from "@/lib/aparat";

// GET /api/admin/settings/cip-video — دریافت لینک ویدیوی CIP
export async function GET() {
  const auth = await requirePermission("cip.manage");
  if (auth.response) return auth.response;

  const row = await db.selectFrom("cip_page_settings").selectAll().where("id", "=", 1).executeTakeFirst();
  return NextResponse.json({ videoUrl: row?.video_url ?? null });
}

// PATCH /api/admin/settings/cip-video — ثبت/حذف لینک ویدیوی آپارات CIP
export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("cip.manage");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const raw = body?.videoUrl;
  if (raw !== null && !isValidAparatUrl(raw)) {
    return NextResponse.json({ error: "لینک ویدیو باید یک آدرس معتبر آپارات باشد" }, { status: 400 });
  }
  const videoUrl = typeof raw === "string" ? raw.trim() : null;

  const row = await db
    .insertInto("cip_page_settings")
    .values({ id: 1, video_url: videoUrl, updated_at: new Date().toISOString() })
    .onConflict((oc) => oc.column("id").doUpdateSet({ video_url: videoUrl, updated_at: new Date().toISOString() }))
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "cip_video", 1, { videoUrl });
  return NextResponse.json({ videoUrl: row.video_url });
}
