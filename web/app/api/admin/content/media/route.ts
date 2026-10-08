import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { ALLOWED_IMAGE_MIME_TYPES, ALLOWED_VIDEO_MIME_TYPES, MAX_IMAGE_SIZE_BYTES, MAX_VIDEO_SIZE_BYTES, storage } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const auth = await requirePermission("content.edit");
  if (auth.response) return auth.response;
  if (!checkRateLimit(`admin-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const isFile = !!file && typeof file === "object" && "arrayBuffer" in file && "size" in file && "type" in file;
  if (!isFile) return NextResponse.json({ error: "فایل ارسال نشده است" }, { status: 400 });

  const imageExtension = ALLOWED_IMAGE_MIME_TYPES[file.type];
  const videoExtension = ALLOWED_VIDEO_MIME_TYPES[file.type];
  const extension = imageExtension || videoExtension;
  const maxSize = imageExtension ? MAX_IMAGE_SIZE_BYTES : MAX_VIDEO_SIZE_BYTES;
  if (!extension) return NextResponse.json({ error: "نوع فایل مجاز نیست" }, { status: 400 });
  if (file.size <= 0 || file.size > maxSize) {
    return NextResponse.json({ error: "حجم فایل بیشتر از حد مجاز است" }, { status: 400 });
  }

  const saved = await storage.save(Buffer.from(await file.arrayBuffer()), { subDir: "site-content", extension });
  return NextResponse.json({ url: saved.url, kind: imageExtension ? "image" : "video" });
}
