// انتزاع ذخیره‌سازی تصاویر (بخش ۱۰ پرامپت فاز ۳): دیتابیس هرگز به یک Storage Provider خاص
// وابسته نیست؛ فقط storage_key/url را نگه می‌دارد. در آینده می‌توان LocalStorageService را با
// نسخهٔ Object Storage/CDN جایگزین کرد بدون تغییر Schema یا لایهٔ API.
//
// نکتهٔ Phase 1.1: در حالت production (`next start`)، Next.js لیست فایل‌های پوشهٔ public/ را
// فقط یک‌بار در لحظهٔ startup می‌خواند (`setupFsCheck` در next/dist/server/lib/router-utils/filesystem.js)
// و آن را در یک Set حافظه نگه می‌دارد؛ بنابراین فایل‌هایی که بعد از startup داخل public/uploads
// ایجاد شوند هرگز از طریق static handling داخلی Next با HTTP 200 سرو نمی‌شوند (۴۰۴ می‌گیرند)،
// حتی اگر واقعاً روی دیسک موجود باشند. برای همین uploadهای runtime باید در مسیری کاملاً خارج
// از پوشهٔ public/ و خارج از دایرکتوری اپلیکیشن ذخیره شوند. سرو کردن این مسیر به‌صورت موقت
// (تا زمان تنظیم Nginx در فاز deployment) از طریق یک Route Handler اختصاصی (app/uploads/[...path])
// انجام می‌شود که مستقیماً از دیسک می‌خواند — نه از static file handler داخلی Next.js.

import { mkdir, writeFile, unlink } from "fs/promises";
import { join, resolve, sep } from "path";
import { randomUUID } from "crypto";

export interface SavedFile {
  key: string; // مسیر نسبی داخلی (برای حذف بعدی)
  url: string; // مسیر عمومی قابل‌دسترس از مرورگر
}

export interface StorageService {
  save(buffer: Buffer, opts: { subDir: string; extension: string }): Promise<SavedFile>;
  delete(key: string): Promise<void>;
}

// مسیر فیزیکی ذخیرهٔ uploadهای runtime — از env قابل تنظیم است (پیش‌فرض: خارج از public/،
// چون public/ به مکانیزم static caching داخلی Next.js وابسته و برای این منظور نامناسب است).
// در صورت نبود UPLOAD_DIR، به مسیر قدیمی public/uploads برمی‌گردد (فقط برای سازگاری محیط dev).
const UPLOAD_ROOT = resolve(process.env.UPLOAD_DIR || join(process.cwd(), "public", "uploads"));
const PUBLIC_PREFIX = "/uploads"; // URL عمومی — مستقل از مسیر فایل‌سیستم؛ توسط Route Handler/Nginx روی همین prefix سرو می‌شود

class LocalStorageService implements StorageService {
  async save(buffer: Buffer, opts: { subDir: string; extension: string }): Promise<SavedFile> {
    const dir = join(UPLOAD_ROOT, opts.subDir);
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.${opts.extension}`;
    const fullPath = join(dir, filename);
    await writeFile(fullPath, buffer, { mode: 0o640 });
    const key = join(opts.subDir, filename);
    return { key, url: `${PUBLIC_PREFIX}/${opts.subDir}/${filename}` };
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(UPLOAD_ROOT, key));
    } catch {
      // فایل از قبل موجود نبود؛ حذف idempotent است
    }
  }
}

export const storage: StorageService = new LocalStorageService();

/**
 * تبدیل امن یک مسیر نسبی (از URL عمومی `/uploads/...`) به مسیر فیزیکی واقعی داخل UPLOAD_ROOT.
 * در برابر path traversal محافظت می‌کند: اگر مسیر نهایی resolve-شده بیرون از UPLOAD_ROOT بیفتد، null برمی‌گرداند.
 * فقط توسط Route Handler سرو عمومی فایل استفاده می‌شود؛ لایهٔ API دیگری این تابع را صدا نمی‌زند.
 */
export function resolveUploadFilePath(relativeSegments: string[]): string | null {
  const relative = relativeSegments.join("/");
  const full = resolve(UPLOAD_ROOT, relative);
  if (full !== UPLOAD_ROOT && !full.startsWith(UPLOAD_ROOT + sep)) return null;
  return full;
}

export const ALLOWED_IMAGE_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ALLOWED_VIDEO_MIME_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // ۱۰ مگابایت
export const MAX_VIDEO_SIZE_BYTES = 30 * 1024 * 1024; // ۳۰ مگابایت
export const MAX_MEDIA_PER_PROPERTY = 20;
export const MAX_VIDEO_PER_PROPERTY = 3;
export const MIN_PROPERTY_IMAGES = 3;
