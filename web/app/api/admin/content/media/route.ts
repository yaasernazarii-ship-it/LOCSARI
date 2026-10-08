import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES, storage } from "@/lib/storage";

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

  const extension = ALLOWED_IMAGE_MIME_TYPES[file.type];
  if (!extension) return NextResponse.json({ error: "فقط فایل‌های jpg، png و webp مجاز هستند" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: "حجم تصویر بیشتر از ۳۰ مگابایت است" }, { status: 400 });
  }

  const saved = await storage.save(Buffer.from(await file.arrayBuffer()), { subDir: "site-content", extension });
  return NextResponse.json({ url: saved.url });
}
