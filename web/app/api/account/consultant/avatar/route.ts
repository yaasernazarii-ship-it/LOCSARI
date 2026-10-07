import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { storage, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/storage";

// POST /api/account/consultant/avatar — بارگذاری تصویر پروفایل مشاور (بخش ۲۶، از همان StorageService فاز ۳)
export async function POST(req: NextRequest) {
  const auth = await requirePermission("consultant.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`consultant-media:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const consultant = await db.selectFrom("consultants").select(["id"]).where("user_id", "=", auth.user.id).executeTakeFirst();
  if (!consultant) return NextResponse.json({ error: "پروفایل مشاور یافت نشد" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const isUploadedFile = !!file && typeof file === "object" && "arrayBuffer" in file && "size" in file && "type" in file;
  if (!isUploadedFile) return NextResponse.json({ error: "فایل ارسال نشده است" }, { status: 400 });

  if (!ALLOWED_IMAGE_MIME_TYPES[file.type]) {
    return NextResponse.json({ error: "نوع فایل مجاز نیست (فقط jpeg/png/webp)" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: "حجم فایل نامعتبر است (حداکثر ۱۰ مگابایت)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = ALLOWED_IMAGE_MIME_TYPES[file.type];
  const saved = await storage.save(buffer, { subDir: `consultants/${consultant.id}`, extension });

  const updated = await db
    .updateTable("consultants")
    .set({ avatar: saved.url, updated_at: new Date().toISOString() })
    .where("id", "=", consultant.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "consultant", consultant.id, { event: "avatar" });
  return NextResponse.json({ consultant: updated });
}
