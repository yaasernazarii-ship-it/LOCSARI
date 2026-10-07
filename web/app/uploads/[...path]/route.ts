// سرو موقت uploadهای runtime از UPLOAD_DIR (بخش ۴ فاز ۱.۱).
// این route فقط تا زمان تنظیم Nginx برای سرو مستقیم /uploads/ از دیسک استفاده می‌شود؛
// بعد از آن مرحله، این مسیر می‌تواند fallback بماند یا حذف شود (بدون تغییر URL عمومی).
// عمداً بدون authentication است: تصاویر ملک/آگهی از ابتدا عمومی بوده‌اند (همان رفتار public/ قبلی).
import { NextRequest, NextResponse } from "next/server";
import { stat, readFile } from "fs/promises";
import { resolveUploadFilePath } from "@/lib/storage";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const ext = (params.path[params.path.length - 1] || "").split(".").pop()?.toLowerCase() || "";
  const mime = MIME_BY_EXT[ext];
  if (!mime) return NextResponse.json({ error: "نوع فایل مجاز نیست" }, { status: 404 });

  const fullPath = resolveUploadFilePath(params.path);
  if (!fullPath) return NextResponse.json({ error: "مسیر نامعتبر است" }, { status: 400 });

  try {
    const st = await stat(fullPath);
    if (!st.isFile()) throw new Error("not-a-file");
    const buffer = await readFile(fullPath);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(st.size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "فایل یافت نشد" }, { status: 404 });
  }
}
