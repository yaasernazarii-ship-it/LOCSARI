// قرارداد یکسان Response برای تمام APIهای CRM (بخش ۲۹ پرامپت فاز ۷.۳)

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "./session";
import { userHasPermission } from "./rbac";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(req: NextRequest): PaginationParams {
  const sp = req.nextUrl.searchParams;
  let page = Number(sp.get("page"));
  let limit = Number(sp.get("limit"));
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  return { page, limit, offset: (page - 1) * limit };
}

export function okData(data: unknown, meta?: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(meta ? { data, meta } : { data }, { status });
}

export function errData(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

type RequireResult = { user: { id: number; name: string; phone: string }; response: null } | { user: null; response: NextResponse };

/** محافظ استاندارد CRM API با قرارداد Response جدید (بخش ۲۹) — همیشه مستقیماً از DB (rbac.ts) تصمیم می‌گیرد. */
export async function requireCrmPermission(permissionKey: string): Promise<RequireResult> {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: errData(401, "UNAUTHENTICATED", "وارد نشده‌اید") };
  const allowed = await userHasPermission(user.id, permissionKey);
  if (!allowed) return { user: null, response: errData(403, "FORBIDDEN", "دسترسی مجاز نیست") };
  return { user, response: null };
}

export async function requireCrmAuth(): Promise<RequireResult> {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: errData(401, "UNAUTHENTICATED", "وارد نشده‌اید") };
  return { user, response: null };
}
