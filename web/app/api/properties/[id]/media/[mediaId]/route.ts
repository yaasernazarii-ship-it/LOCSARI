import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, isPropertyReviewer } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { storage } from "@/lib/storage";

async function loadOwnedMedia(propertyId: number, mediaId: number, userId: number, reviewer: boolean) {
  const property = await db
    .selectFrom("properties")
    .select(["id", "created_by_user_id"])
    .where("id", "=", propertyId)
    .executeTakeFirst();
  if (!property) return { error: NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 }) } as const;
  if (!reviewer && property.created_by_user_id !== userId) {
    return { error: NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 }) } as const;
  }
  const media = await db.selectFrom("property_media").selectAll().where("id", "=", mediaId).where("property_id", "=", propertyId).executeTakeFirst();
  if (!media) return { error: NextResponse.json({ error: "تصویر یافت نشد" }, { status: 404 }) } as const;
  return { media } as const;
}

// PATCH — تغییر ترتیب (sortOrder)، تعیین تصویر اصلی (isPrimary) یا altText — بخش ۱۱ پرامپت
export async function PATCH(req: NextRequest, { params }: { params: { id: string; mediaId: string } }) {
  const auth = await requirePermission("media.upload");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`property-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const propertyId = parseId(params.id);
  const mediaId = parseId(params.mediaId);
  if (!propertyId || !mediaId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const reviewer = await isPropertyReviewer(auth.user.id);
  const loaded = await loadOwnedMedia(propertyId, mediaId, auth.user.id, reviewer);
  if ("error" in loaded) return loaded.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "بدنهٔ درخواست نامعتبر است" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.altText !== undefined) update.alt_text = typeof body.altText === "string" ? body.altText : null;
  if (body.sortOrder !== undefined) {
    if (!Number.isInteger(body.sortOrder)) return NextResponse.json({ error: "sortOrder نامعتبر است" }, { status: 400 });
    update.sort_order = body.sortOrder;
  }

  if (Object.keys(update).length === 0 && body.isPrimary === undefined) {
    return NextResponse.json({ error: "هیچ فیلدی برای به‌روزرسانی ارسال نشده" }, { status: 400 });
  }

  const media = await db.transaction().execute(async (trx) => {
    if (body.isPrimary === true) {
      await trx.updateTable("property_media").set({ is_primary: false }).where("property_id", "=", propertyId).execute();
      update.is_primary = true;
    } else if (body.isPrimary === false) {
      update.is_primary = false;
    }
    if (Object.keys(update).length === 0) return loaded.media;
    return trx.updateTable("property_media").set(update).where("id", "=", mediaId).returningAll().executeTakeFirstOrThrow();
  });

  await logAdminAction(auth.user.id, "update", "property_media", mediaId, { propertyId });
  return NextResponse.json({ media });
}

// DELETE — اگر تصویر اصلی حذف شود، اولین تصویر باقی‌مانده خودکار جایگزین می‌شود
export async function DELETE(req: NextRequest, { params }: { params: { id: string; mediaId: string } }) {
  const auth = await requirePermission("media.delete");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`property-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const propertyId = parseId(params.id);
  const mediaId = parseId(params.mediaId);
  if (!propertyId || !mediaId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const reviewer = await isPropertyReviewer(auth.user.id);
  const loaded = await loadOwnedMedia(propertyId, mediaId, auth.user.id, reviewer);
  if ("error" in loaded) return loaded.error;

  await db.deleteFrom("property_media").where("id", "=", mediaId).execute();
  await storage.delete(loaded.media.storage_key);

  if (loaded.media.is_primary) {
    const next = await db
      .selectFrom("property_media")
      .select("id")
      .where("property_id", "=", propertyId)
      .orderBy("sort_order", "asc")
      .executeTakeFirst();
    if (next) {
      await db.updateTable("property_media").set({ is_primary: true }).where("id", "=", next.id).execute();
    }
  }

  await logAdminAction(auth.user.id, "delete", "property_media", mediaId, { propertyId });
  return NextResponse.json({ success: true });
}
