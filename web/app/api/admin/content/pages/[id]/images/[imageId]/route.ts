import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { storage } from "@/lib/storage";

// DELETE /api/admin/content/pages/:id/images/:imageId — حذف یک تصویر (مثلاً یک مجوز) از صفحهٔ محتوا
export async function DELETE(req: NextRequest, { params }: { params: { id: string; imageId: string } }) {
  const auth = await requirePermission("content.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const pageId = parseId(params.id);
  const imageId = parseId(params.imageId);
  if (!pageId || !imageId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  const image = await db
    .selectFrom("site_page_images")
    .selectAll()
    .where("id", "=", imageId)
    .where("page_id", "=", pageId)
    .executeTakeFirst();
  if (!image) return NextResponse.json({ error: "تصویر یافت نشد" }, { status: 404 });

  await db.deleteFrom("site_page_images").where("id", "=", imageId).execute();
  await storage.delete(image.storage_key);

  await logAdminAction(auth.user.id, "delete", "site_page_image", imageId, { pageId });
  return NextResponse.json({ success: true });
}
