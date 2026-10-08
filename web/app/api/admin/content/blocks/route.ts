import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { SITE_CONTENT_DEFAULTS, SiteContentKey } from "@/lib/siteContent";

export async function GET() {
  const auth = await requirePermission("content.view");
  if (auth.response) return auth.response;

  const blocks = await db.selectFrom("site_content_blocks").selectAll().orderBy("page_key").orderBy("section_key").execute();
  return NextResponse.json({ blocks });
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("content.edit");
  if (auth.response) return auth.response;
  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const values = body?.values;
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return NextResponse.json({ error: "دادهٔ محتوا نامعتبر است" }, { status: 400 });
  }

  const allowed = Object.keys(SITE_CONTENT_DEFAULTS) as SiteContentKey[];
  const isAllowedKey = (key: string) => allowed.includes(key as SiteContentKey) || /^[a-z0-9_-]+\.[a-z0-9_-]+\.(image|video|button_url)$/.test(key);
  const updates = Object.entries(values).filter(
    ([key, value]) => isAllowedKey(key) && typeof value === "string" && value.length <= 5000
  ) as [SiteContentKey, string][];
  if (updates.length === 0) return NextResponse.json({ error: "محتوای قابل ذخیره‌ای ارسال نشده است" }, { status: 400 });

  await db.transaction().execute(async (trx) => {
    for (const [contentKey, value] of updates) {
      // page_key/section_key در ردیف موجود حفظ می‌شود تا گروه‌بندی پنل (مثلاً «اجزای مشترک») به‌هم نریزد؛
      // فقط برای کلید جدید از پیشوند کلید مشتق می‌شود.
      const existing = await trx
        .selectFrom("site_content_blocks")
        .select(["page_key", "section_key", "label_fa"])
        .where("content_key", "=", contentKey)
        .executeTakeFirst();

      await trx
        .insertInto("site_content_blocks")
        .values({
          content_key: contentKey,
          page_key: existing?.page_key ?? contentKey.split(".")[0],
          section_key: existing?.section_key ?? contentKey.split(".")[1],
          label_fa: existing?.label_fa ?? contentKey,
          value: value.trim(),
          updated_by_user_id: auth.user.id,
        })
        .onConflict((oc) => oc.column("content_key").doUpdateSet({ value: value.trim(), updated_by_user_id: auth.user.id, updated_at: new Date().toISOString() }))
        .execute();
    }
  });

  await logAdminAction(auth.user.id, "update", "site_content", 0, { keys: updates.map(([key]) => key) });
  return NextResponse.json({ ok: true });
}
