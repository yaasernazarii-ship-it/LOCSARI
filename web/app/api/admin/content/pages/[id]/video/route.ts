import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { parseId } from "@/lib/validation";
import { storage, ALLOWED_VIDEO_MIME_TYPES, MAX_VIDEO_SIZE_BYTES } from "@/lib/storage";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission("content.edit");
  if (auth.response) return auth.response;
  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });

  const pageId = parseId(params.id);
  if (!pageId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });
  const page = await db.selectFrom("site_pages").select("id").where("id", "=", pageId).executeTakeFirst();
  if (!page) return NextResponse.json({ error: "صفحه یافت نشد" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const isFile = !!file && typeof file === "object" && "arrayBuffer" in file && "size" in file && "type" in file;
  if (!isFile) return NextResponse.json({ error: "فایل ویدیو ارسال نشده است" }, { status: 400 });
  const extension = ALLOWED_VIDEO_MIME_TYPES[file.type];
  if (!extension) return NextResponse.json({ error: "نوع فایل مجاز نیست (mp4، webm یا mov)" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_VIDEO_SIZE_BYTES) return NextResponse.json({ error: "حجم ویدیو نباید بیشتر از ۳۰ مگابایت باشد" }, { status: 400 });

  const saved = await storage.save(Buffer.from(await file.arrayBuffer()), { subDir: `site-pages/${pageId}/videos`, extension });
  await db.updateTable("site_pages").set({ video_url: saved.url, updated_at: new Date().toISOString() }).where("id", "=", pageId).execute();
  return NextResponse.json({ url: saved.url });
}
