import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logAdminAction } from "@/lib/audit";
import { storage, ALLOWED_VIDEO_MIME_TYPES, MAX_VIDEO_SIZE_BYTES } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const auth = await requirePermission("cip.manage");
  if (auth.response) return auth.response;
  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const isUploadedFile = !!file && typeof file === "object" && "arrayBuffer" in file && "size" in file && "type" in file;
  if (!isUploadedFile) return NextResponse.json({ error: "فایل ارسال نشده است" }, { status: 400 });

  const extension = ALLOWED_VIDEO_MIME_TYPES[file.type];
  if (!extension) return NextResponse.json({ error: "نوع فایل مجاز نیست (فقط ویدیو: mp4/webm/mov)" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_VIDEO_SIZE_BYTES) {
    return NextResponse.json({ error: "حجم فایل نامعتبر است (حداکثر ۱۰۰ مگابایت)" }, { status: 400 });
  }

  const saved = await storage.save(Buffer.from(await file.arrayBuffer()), { subDir: "cip/introduction", extension });
  const row = await db
    .insertInto("cip_page_settings")
    .values({ id: 1, video_url: saved.url, updated_at: new Date().toISOString() })
    .onConflict((oc) => oc.column("id").doUpdateSet({ video_url: saved.url, updated_at: new Date().toISOString() }))
    .returningAll()
    .executeTakeFirstOrThrow();

  await logAdminAction(auth.user.id, "update", "cip_video", 1, { videoUploaded: true });
  return NextResponse.json({ videoUrl: row.video_url }, { status: 201 });
}
