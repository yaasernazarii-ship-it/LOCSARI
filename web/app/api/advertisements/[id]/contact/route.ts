import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { parseId } from "@/lib/validation";

// GET /api/advertisements/:id/contact — نمایش نام و شماره تماس مالک آگهی (بخش «Contact CTA» فاز ۵)
// از این پس فقط برای کاربر واردشده مجاز است (الزام: بازدیدکننده قبل از دیدن شماره باید حساب داشته باشد)؛
// Rate limit هم روی کاربر و هم روی IP باقی می‌ماند. فقط برای آگهی منتشرشده/فعال.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  if (!checkRateLimit(`advertisement-contact:user:${auth.user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }
  if (!checkRateLimit(`advertisement-contact:ip:${getClientIp(req)}`, 40, 60_000)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const row = await db
    .selectFrom("advertisements")
    .innerJoin("properties", "properties.id", "advertisements.property_id")
    .innerJoin("users", "users.id", "advertisements.created_by_user_id")
    .select(["advertisements.status", "advertisements.expires_at", "properties.is_active", "users.name", "users.phone"])
    .where("advertisements.id", "=", id)
    .executeTakeFirst();

  if (!row || row.status !== "published" || !row.is_active || (row.expires_at && new Date(row.expires_at) < new Date())) {
    return NextResponse.json({ error: "آگهی یافت نشد یا غیرفعال است" }, { status: 404 });
  }

  return NextResponse.json({ name: row.name, phone: row.phone });
}
