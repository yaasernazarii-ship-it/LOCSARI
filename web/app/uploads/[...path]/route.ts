// سرو موقت uploadهای runtime از UPLOAD_DIR (بخش ۴ فاز ۱.۱).
// این route فقط تا زمان تنظیم Nginx برای سرو مستقیم /uploads/ از دیسک استفاده می‌شود؛
// بعد از آن مرحله، این مسیر می‌تواند fallback بماند یا حذف شود (بدون تغییر URL عمومی).
// عمداً بدون authentication است: تصاویر ملک/آگهی از ابتدا عمومی بوده‌اند (همان رفتار public/ قبلی).
import { NextRequest, NextResponse } from "next/server";
import { stat, open } from "fs/promises";
import { resolveUploadFilePath } from "@/lib/storage";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const ext = (params.path[params.path.length - 1] || "").split(".").pop()?.toLowerCase() || "";
  const mime = MIME_BY_EXT[ext];
  if (!mime) return NextResponse.json({ error: "نوع فایل مجاز نیست" }, { status: 404 });

  const fullPath = resolveUploadFilePath(params.path);
  if (!fullPath) return NextResponse.json({ error: "مسیر نامعتبر است" }, { status: 400 });

  try {
    const fileStat = await stat(fullPath);
    if (!fileStat.isFile()) throw new Error("not-a-file");

    const range = req.headers.get("range");
    if (!range || !mime.startsWith("video/")) {
      const handle = await open(fullPath, "r");
      try {
        const buffer = await handle.readFile();
        return new NextResponse(buffer, {
          status: 200,
          headers: { "Content-Type": mime, "Content-Length": String(fileStat.size), "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable" },
        });
      } finally {
        await handle.close();
      }
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${fileStat.size}` } });
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), fileStat.size - 1) : fileStat.size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= fileStat.size) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${fileStat.size}` } });
    }

    const length = end - start + 1;
    const buffer = Buffer.alloc(length);
    const handle = await open(fullPath, "r");
    try {
      await handle.read(buffer, 0, length, start);
    } finally {
      await handle.close();
    }
    return new NextResponse(buffer, {
      status: 206,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(length),
        "Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "فایل یافت نشد" }, { status: 404 });
  }
}
