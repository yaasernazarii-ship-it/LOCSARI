import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { parseId } from "@/lib/validation";
import { storage, ALLOWED_VIDEO_MIME_TYPES, MAX_VIDEO_SIZE_BYTES } from "@/lib/storage";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("cip.manage");
  if (auth.response) return auth.response;
  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });
  const existing = await db.selectFrom("cip_requests").select(["id", "status"]).where("id", "=", id).executeTakeFirst();
  if (!existing) return NextResponse.json({ error: "درخواست یافت نشد" }, { status: 404 });
  if (existing.status === "awaiting_payment") return NextResponse.json({ error: "تا تکمیل پرداخت، امکان بارگذاری و انتشار ویدیو نیست" }, { status: 409 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const isUploadedFile = !!file && typeof file === "object" && "arrayBuffer" in file && "size" in file && "type" in file;
  if (!isUploadedFile) return NextResponse.json({ error: "فایل ارسال نشده است" }, { status: 400 });

  const extension = ALLOWED_VIDEO_MIME_TYPES[file.type];
  if (!extension) return NextResponse.json({ error: "نوع فایل مجاز نیست (فقط ویدیو: mp4/webm/mov)" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_VIDEO_SIZE_BYTES) {
    const limitMb = Math.round(MAX_VIDEO_SIZE_BYTES / (1024 * 1024));
    return NextResponse.json({ error: `حجم فایل نامعتبر است (حداکثر ${limitMb} مگابایت)` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = await storage.save(buffer, { subDir: `cip/${id}`, extension });

  const request = await db
    .updateTable("cip_requests")
    .set({ video_url: saved.url, status: "published", updated_at: new Date().toISOString() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "cip_request", id, { videoUploaded: true });
  return NextResponse.json({ request: { ...request, price: Number(request.price) } }, { status: 201 });
}
