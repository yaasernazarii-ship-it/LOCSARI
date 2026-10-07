import { NextResponse } from "next/server";
import { getCurrentUser } from "./session";
import { userHasPermission } from "./rbac";

type RequirePermissionResult =
  | { user: { id: number; name: string; phone: string }; response: null }
  | { user: null; response: NextResponse };

/**
 * محافظ استاندارد Admin API: احراز هویت + بررسی Permission مستقیماً از دیتابیس.
 * هیچ مسیر Admin نباید بدون این تابع (یا معادل آن) اجرا شود.
 */
export async function requirePermission(permissionKey: string): Promise<RequirePermissionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "وارد نشده‌اید" }, { status: 401 }) };
  }
  const allowed = await userHasPermission(user.id, permissionKey);
  if (!allowed) {
    return { user: null, response: NextResponse.json({ error: "دسترسی مجاز نیست" }, { status: 403 }) };
  }
  return { user, response: null };
}

/** فقط احراز هویت، بدون بررسی Permission خاص — برای مسیرهایی که خودشان منطق Ownership/Permission ترکیبی دارند */
export async function requireAuth(): Promise<RequirePermissionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "وارد نشده‌اید" }, { status: 401 }) };
  }
  return { user, response: null };
}

/**
 * تشخیص «بازبین مرکزی» برای Property/Advertisement (بخش ۸ پرامپت فاز ۳: Review مرکزی).
 * داشتن advertisement.approve به‌معنای دسترسی کامل ادمین به کل دامنهٔ ملک/آگهی (فارغ از مالکیت) است.
 */
export async function isPropertyReviewer(userId: number): Promise<boolean> {
  return userHasPermission(userId, "advertisement.approve");
}
