import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/apiAuth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { parseId } from "@/lib/validation";

// DELETE /api/favorites/:advertisementId — حذف یک آگهی از علاقه‌مندی‌های کاربر جاری
export async function DELETE(req: NextRequest, { params }: { params: { advertisementId: string } }) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  if (!checkRateLimit(`favorite-write:${getClientIp(req)}`)) {
    return NextResponse.json({ error: "تعداد درخواست بیش از حد مجاز است" }, { status: 429 });
  }

  const advertisementId = parseId(params.advertisementId);
  if (!advertisementId) return NextResponse.json({ error: "شناسه نامعتبر است" }, { status: 400 });

  await db
    .deleteFrom("favorites")
    .where("user_id", "=", auth.user.id)
    .where("advertisement_id", "=", advertisementId)
    .execute();

  return NextResponse.json({ success: true });
}
