import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { storage, ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from "@/lib/storage";
import { getManagedAgencyId } from "@/lib/agencyAccess";

// POST /api/account/agency/logo — بارگذاری لوگوی آژانس (فقط مالک؛ بخش ۲۶)
export async function POST(req: NextRequest) {
  const auth = await requirePermission("agency.edit");
  if (auth.response) return auth.response;

  if (!checkRateLimit(`agency-media:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const agencyId = await getManagedAgencyId(auth.user.id);
  if (!agencyId) return NextResponse.json({ error: "آژانسی برای مدیریت یافت نشد" }, { status: 404 });
  const agency = { id: agencyId };

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
  const saved = await storage.save(buffer, { subDir: `agencies/${agency.id}`, extension });

  const updated = await db
    .updateTable("agencies")
    .set({ logo: saved.url, updated_at: new Date().toISOString() })
    .where("id", "=", agency.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "agency", agency.id, { event: "logo" });
  return NextResponse.json({ agency: updated });
}
